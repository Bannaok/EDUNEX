import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  onSnapshot,
  query,
  where,
  setLogLevel,
  terminate
} from 'firebase/firestore';

process.env.DISABLE_HMR = 'true';

try {
  setLogLevel('silent');
} catch {
  // ignore
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '.data');
const FILES_DIR = path.join(DATA_DIR, 'files');
const STORE_FILE = path.join(DATA_DIR, 'realtime-store.json');
const FIREBASE_CONFIG_FILE = path.join(__dirname, 'firebase-applet-config.json');

// Initialize Firebase Firestore on Server for cross-container (ais-dev <-> ais-pre) & cross-device persistence
let firestoreDb: ReturnType<typeof getFirestore> | null = null;
let serverFirestoreUnavailable = false;
const lastServerFirestoreSerialized = new Map<string, string>();

function tripServerFirestoreBreaker() {
  if (serverFirestoreUnavailable) return;
  serverFirestoreUnavailable = true;
  if (firestoreDb) {
    try {
      terminate(firestoreDb).catch(() => {});
    } catch {
      // ignore
    }
  }
}

try {
  if (fs.existsSync(FIREBASE_CONFIG_FILE)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf-8'));
    if (firebaseConfig && firebaseConfig.projectId) {
      const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      firestoreDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
    }
  }
} catch {
  serverFirestoreUnavailable = true;
}

const KV_COLLECTION = 'realtime_kv';
const CHUNKS_COLLECTION = 'realtime_kv_chunks';
const SINGLE_DOC_MAX_CHARS = 650000;
const MAX_FIRESTORE_CHUNKS = 25;

// Legacy Google Apps Script fallback constants
const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbzol007NNSB5uYI_no15j6GB5Ej3IQ2MuN50Sud7mQKMYloHBYxoxv6N8PVLgSfsNjlZw/exec';
const MASTER_SPREADSHEET_ID = '1mVJl2FSHiJmQlOR8t-7h1Z4wXfbMWepUU_Qzkd1FSAM';
const CLOUD_KV_SHEET = 'RealtimeCloudKV';
const CHUNK_SIZE = 38000;
const MAX_CHUNKS = 12;

interface PersistedState {
  rev: number;
  store: Record<string, any>;
  timestamps: Record<string, number>;
}

// Ensure .data and .data/files directories exist
for (const dir of [DATA_DIR, FILES_DIR]) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
  }
}

function saveServerHostedFile(fileId: string, fileName: string, dataUrl: string): string {
  const safeId = String(fileId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeId || !dataUrl || !dataUrl.startsWith('data:')) return '';
  try {
    const filePath = path.join(FILES_DIR, `${safeId}.json`);
    fs.writeFileSync(
      filePath,
      JSON.stringify({ id: safeId, fileName: fileName || safeId, dataUrl, updatedAt: Date.now() }),
      'utf-8'
    );
    return `/api/files/${safeId}`;
  } catch {
    return '';
  }
}

function loadServerHostedFile(fileId: string): { id: string; fileName: string; dataUrl: string } | null {
  const safeId = String(fileId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeId) return null;
  try {
    const filePath = path.join(FILES_DIR, `${safeId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

// Load initial state from disk
let state: PersistedState = {
  rev: 1,
  store: {},
  timestamps: {}
};

if (fs.existsSync(STORE_FILE)) {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.store === 'object') {
      state = {
        rev: Number(parsed.rev) || 1,
        store: parsed.store || {},
        timestamps: parsed.timestamps || {}
      };
      const now = Date.now();
      for (const k of Object.keys(state.store)) {
        if (!state.timestamps[k]) {
          state.timestamps[k] = now - 60000;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load persisted realtime store, starting fresh:', err);
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDiskSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(state), 'utf-8');
    } catch (err) {
      console.warn('Failed to write realtime store to disk:', err);
    }
  }, 120);
}

// Connected SSE Clients for instant real-time broadcast across all devices & browsers
const sseClients = new Set<express.Response>();

function broadcastDelta(clientId: string, updates: Record<string, any>, timestamps: Record<string, number>) {
  const payload = JSON.stringify({
    type: 'delta',
    rev: state.rev,
    clientId,
    updates,
    timestamps,
    serverTime: Date.now()
  });
  const message = `data: ${payload}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(message);
    } catch {
      sseClients.delete(res);
    }
  }
}

// ============================================================================
// FIREBASE FIRESTORE CLOUD SYNC (Primary Global Multi-Device / Multi-Email Store)
// ============================================================================
function sanitizeDocKey(rawKey: string): string {
  const cleaned = String(rawKey || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || 'default_key';
}

async function pushKeyToFirestoreServer(rawKey: string, value: any, updatedAt: number): Promise<void> {
  if (!firestoreDb || serverFirestoreUnavailable || !rawKey || rawKey === 'ams_session') return;
  const docId = sanitizeDocKey(rawKey);
  let serialized = JSON.stringify(value ?? null);
  if (!serialized) return;
  if (serialized.length > SINGLE_DOC_MAX_CHARS * MAX_FIRESTORE_CHUNKS) {
    serialized = JSON.stringify(sanitizeForCloudKv(value));
  }
  if (lastServerFirestoreSerialized.get(docId) === serialized) return;

  const safeUpdatedAt = Number(updatedAt) > 0 ? Number(updatedAt) : Date.now();

  try {
    if (serialized.length <= SINGLE_DOC_MAX_CHARS) {
      await setDoc(doc(firestoreDb, KV_COLLECTION, docId), {
        id: docId,
        valueJson: serialized,
        updatedAt: safeUpdatedAt,
        chunkCount: 0,
        clientId: 'server-node'
      });
      lastServerFirestoreSerialized.set(docId, serialized);
      return;
    }

    const chunks: string[] = [];
    for (let i = 0; i < serialized.length; i += SINGLE_DOC_MAX_CHARS) {
      chunks.push(serialized.slice(i, i + SINGLE_DOC_MAX_CHARS));
    }
    if (chunks.length > MAX_FIRESTORE_CHUNKS) return;

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunkId = `${docId}__part_${idx}`;
      await setDoc(doc(firestoreDb, CHUNKS_COLLECTION, chunkId), {
        id: chunkId,
        parentKey: docId,
        partIndex: idx,
        data: chunks[idx],
        updatedAt: safeUpdatedAt
      });
    }

    await setDoc(doc(firestoreDb, KV_COLLECTION, docId), {
      id: docId,
      valueJson: '',
      updatedAt: safeUpdatedAt,
      chunkCount: chunks.length,
      clientId: 'server-node'
    });
    lastServerFirestoreSerialized.set(docId, serialized);
  } catch {
    tripServerFirestoreBreaker();
  }
}

async function resolveFirestoreDocServer(data: any): Promise<{ key: string; value: any; updatedAt: number } | null> {
  if (!firestoreDb || serverFirestoreUnavailable || !data || typeof data.id !== 'string') return null;
  const docId = data.id;
  const updatedAt = Number(data.updatedAt) || Date.now();
  const chunkCount = Number(data.chunkCount) || 0;

  try {
    let fullJson = typeof data.valueJson === 'string' ? data.valueJson : '';
    if (chunkCount > 0) {
      const parts: string[] = [];
      for (let idx = 0; idx < chunkCount; idx++) {
        const chunkSnap = await getDoc(doc(firestoreDb, CHUNKS_COLLECTION, `${docId}__part_${idx}`));
        if (!chunkSnap.exists()) return null;
        const cData = chunkSnap.data();
        parts.push(typeof cData.data === 'string' ? cData.data : '');
      }
      fullJson = parts.join('');
    }
    if (!fullJson) return null;
    lastServerFirestoreSerialized.set(docId, fullJson);
    return { key: docId, value: JSON.parse(fullJson), updatedAt };
  } catch {
    return null;
  }
}

let isSyncingFirestore = false;
async function syncWithFirestoreServer(seedMissingLocalToFirestore = false): Promise<number> {
  if (!firestoreDb || serverFirestoreUnavailable || isSyncingFirestore) return 0;
  isSyncingFirestore = true;
  let appliedCount = 0;

  try {
    const kvQuery = query(collection(firestoreDb, KV_COLLECTION), where('updatedAt', '>', 0));
    const snap = await getDocs(kvQuery);
    const remoteTimestamps = new Map<string, number>();
    const appliedUpdates: Record<string, any> = {};
    const appliedTimestamps: Record<string, number> = {};
    const keysToPushBack: string[] = [];

    const tasks: Promise<{ key: string; value: any; updatedAt: number } | null>[] = [];
    snap.forEach(docSnap => {
      tasks.push(resolveFirestoreDocServer(docSnap.data()));
    });

    const resolvedList = await Promise.all(tasks);
    for (const item of resolvedList) {
      if (!item) continue;
      remoteTimestamps.set(item.key, item.updatedAt);

      const localTs = Number(state.timestamps[item.key]) || 0;
      const isTask = isTaskKeyName(item.key);
      const nextValue = isTask && item.key in state.store ? mergeTaskListsServer(state.store[item.key], item.value) : item.value;
      const localSerialized = item.key in state.store ? JSON.stringify(state.store[item.key]) : undefined;
      const remoteSerialized = JSON.stringify(item.value);
      const nextSerialized = JSON.stringify(nextValue);

      if (!(item.key in state.store) || item.updatedAt > localTs || (isTask && nextSerialized !== localSerialized)) {
        const effTs = Math.max(localTs, item.updatedAt || Date.now());
        state.store[item.key] = nextValue;
        state.timestamps[item.key] = effTs;
        if (localSerialized !== nextSerialized) {
          appliedUpdates[item.key] = nextValue;
          appliedTimestamps[item.key] = effTs;
          appliedCount++;
        }
      }
      if (isTask && nextSerialized !== remoteSerialized) {
        keysToPushBack.push(item.key);
      }
    }

    if (appliedCount > 0) {
      state.rev += 1;
      scheduleDiskSave();
      broadcastDelta('firestore-cloud', appliedUpdates, appliedTimestamps);
    }

    if (keysToPushBack.length > 0) {
      scheduleCloudKvPush(keysToPushBack);
    }

    if (seedMissingLocalToFirestore && !serverFirestoreUnavailable) {
      for (const [key, val] of Object.entries(state.store)) {
        if (!key || key === 'ams_session' || serverFirestoreUnavailable) continue;
        const docId = sanitizeDocKey(key);
        if (!remoteTimestamps.has(docId)) {
          const localTs = Number(state.timestamps[key]) || Date.now();
          await pushKeyToFirestoreServer(key, val, localTs);
        }
      }
    }
  } catch {
    tripServerFirestoreBreaker();
  } finally {
    isSyncingFirestore = false;
  }

  return appliedCount;
}

function startServerFirestoreListener() {
  if (!firestoreDb || serverFirestoreUnavailable) return;
  try {
    const kvQuery = query(collection(firestoreDb, KV_COLLECTION), where('updatedAt', '>', 0));
    onSnapshot(
      kvQuery,
      async snapshot => {
        if (serverFirestoreUnavailable) return;
        const changes = snapshot.docChanges();
        if (changes.length === 0) return;

        const appliedUpdates: Record<string, any> = {};
        const appliedTimestamps: Record<string, number> = {};

        for (const change of changes) {
          if (change.type === 'added' || change.type === 'modified') {
            const raw = change.doc.data();
            if (raw.clientId === 'server-node') continue;
            const resolved = await resolveFirestoreDocServer(raw);
            if (!resolved) continue;

            const localTs = Number(state.timestamps[resolved.key]) || 0;
            const isTask = isTaskKeyName(resolved.key);
            const nextValue =
              isTask && resolved.key in state.store
                ? mergeTaskListsServer(state.store[resolved.key], resolved.value)
                : resolved.value;
            const prevSerialized =
              resolved.key in state.store ? JSON.stringify(state.store[resolved.key]) : undefined;
            const nextSerialized = JSON.stringify(nextValue);

            if (!(resolved.key in state.store) || resolved.updatedAt > localTs || (isTask && prevSerialized !== nextSerialized)) {
              const effTs = Math.max(localTs, resolved.updatedAt || Date.now());
              state.store[resolved.key] = nextValue;
              state.timestamps[resolved.key] = effTs;
              if (prevSerialized !== nextSerialized) {
                appliedUpdates[resolved.key] = nextValue;
                appliedTimestamps[resolved.key] = effTs;
              }
            }
          }
        }

        if (Object.keys(appliedUpdates).length > 0) {
          state.rev += 1;
          scheduleDiskSave();
          broadcastDelta('firestore-live', appliedUpdates, appliedTimestamps);
        }
      },
      () => {
        tripServerFirestoreBreaker();
      }
    );
  } catch {
    tripServerFirestoreBreaker();
  }
}

// ============================================================================
// GLOBAL CLOUD KV BRIDGE (Syncs with Firestore + Google Apps Script fallback)
// ============================================================================
function getGasWebAppUrl(): string {
  const cfg = state.store['ams_google_config'];
  if (cfg && typeof cfg.webAppUrl === 'string' && cfg.webAppUrl.startsWith('https://script.google.com/')) {
    return cfg.webAppUrl;
  }
  return DEFAULT_GAS_URL;
}

function getDriveFolderId(): string {
  const cfg = state.store['ams_google_config'];
  if (cfg && typeof cfg.driveFolderId === 'string' && cfg.driveFolderId.trim()) {
    return cfg.driveFolderId.trim();
  }
  return '11IXjrNHXyGpf3A-7ZT38t8B_jXtoFGS9';
}

const inFlightDriveUploads = new Set<string>();

function ensureTaskFilesHostedAndUploaded(key: string, tasksList: any): any {
  if (!isTaskKeyName(key) || !Array.isArray(tasksList)) return tasksList;
  const schoolId = key.includes('__') ? key.split('__').slice(1).join('__') : 'admin-school-01';
  const admins: any[] = Array.isArray(state.store['ams_school_admins']) ? state.store['ams_school_admins'] : [];
  const matchedAdmin = admins.find(a => a && a.id === schoolId);
  const schoolName = matchedAdmin?.schoolName || schoolId;

  for (const task of tasksList) {
    if (!task || typeof task !== 'object') continue;
    const subs: any[] = Array.isArray(task.submissions) ? task.submissions : [];
    for (const sub of subs) {
      if (!sub || typeof sub !== 'object') continue;
      const rawUrl = String(sub.fileUrl || '');
      if (rawUrl.startsWith('data:')) {
        const subIdClean = String(sub.memberId || sub.memberName || 'member').replace(/[^a-zA-Z0-9_-]/g, '_');
        const taskIdClean = String(task.id || 'task').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileId = `sub_${taskIdClean}_${subIdClean}`;
        // Save locally immediately so /api/files/:fileId works with 0ms latency
        const hostedPath = saveServerHostedFile(fileId, sub.fileName || 'submission', rawUrl);
        if (hostedPath) {
          sub.localHostedUrl = hostedPath;
        }

        // Upload to Google Drive in background so cross-container (ais-dev <-> ais-pre) & Google Sheets get a permanent Drive link
        const uploadLockKey = `${key}::${task.id}::${sub.memberId}::${sub.submittedAt || ''}`;
        if (!inFlightDriveUploads.has(uploadLockKey)) {
          inFlightDriveUploads.add(uploadLockKey);
          fetch(getGasWebAppUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'uploadDriveFile',
              spreadsheetId: matchedAdmin?.googleSheetId || '',
              schoolId,
              schoolName,
              schoolDriveFolderId: matchedAdmin?.driveFolderId || '',
              driveFolderId: getDriveFolderId(),
              category: `TaskSubmissions_${task.academicYear || '2569'}`,
              fileName: sub.fileName || `submission_${sub.memberId}`,
              fileBase64: rawUrl,
              uploadedBy: sub.memberName || sub.memberId || ''
            })
          })
            .then(r => r.json())
            .then((resData: any) => {
              if (resData && resData.status === 'success' && resData.fileUrl) {
                const driveUrl = String(resData.fileUrl);
                const curList = state.store[key];
                if (Array.isArray(curList)) {
                  let updatedAny = false;
                  const nextList = curList.map((t: any) => {
                    if (!t || t.id !== task.id) return t;
                    const nextSubs = (Array.isArray(t.submissions) ? t.submissions : []).map((s: any) => {
                      if (
                        s &&
                        (s.memberId === sub.memberId || s.memberName === sub.memberName) &&
                        (!s.fileUrl || String(s.fileUrl).startsWith('data:') || String(s.fileUrl).startsWith('/api/files/'))
                      ) {
                        updatedAny = true;
                        return {
                          ...s,
                          fileUrl: driveUrl,
                          driveFileId: resData.fileId || s.driveFileId,
                          downloadUrl: resData.downloadUrl || s.downloadUrl
                        };
                      }
                      return s;
                    });
                    return {
                      ...t,
                      submissions: nextSubs,
                      submittedFileUrl:
                        t.submittedBy === sub.memberId ? driveUrl : t.submittedFileUrl
                    };
                  });

                  if (updatedAny) {
                    const nowTs = Date.now();
                    state.store[key] = nextList;
                    state.timestamps[key] = Math.max(nowTs, (Number(state.timestamps[key]) || 0) + 1);
                    state.rev += 1;
                    scheduleDiskSave();
                    broadcastDelta('server-drive-sync', { [key]: nextList }, { [key]: state.timestamps[key] });
                    scheduleCloudKvPush([key]);
                  }
                }
              }
            })
            .catch(() => {})
            .finally(() => {
              inFlightDriveUploads.delete(uploadLockKey);
            });
        }
      }
    }
  }
  return tasksList;
}

function sanitizeForCloudKv(val: any): any {
  if (!val) return val;
  if (typeof val === 'string') {
    if (val.startsWith('data:') && val.length > 30000) {
      return '';
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(item => sanitizeForCloudKv(item));
  }
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === 'fileUrl' && typeof v === 'string' && v.startsWith('data:') && v.length > 30000 && val.localHostedUrl) {
        out[k] = val.localHostedUrl;
      } else {
        out[k] = sanitizeForCloudKv(v);
      }
    }
    return out;
  }
  return val;
}

function normalizeSubKeyServer(sub: any): string {
  if (!sub) return '';
  const idPart = String(sub.memberId || '').trim().toLowerCase();
  if (idPart) return idPart;
  return String(sub.memberName || '').trim().toLowerCase();
}

function mergeSingleTaskSubmissionsServer(existingTask: any, incomingTask: any): any {
  if (!existingTask || typeof existingTask !== 'object') return incomingTask;
  if (!incomingTask || typeof incomingTask !== 'object') return incomingTask;

  const deletedMap: Record<string, string> = {
    ...(existingTask.deletedSubmissionsMap || {}),
    ...(incomingTask.deletedSubmissionsMap || {})
  };

  const exSubs: any[] = Array.isArray(existingTask.submissions) ? existingTask.submissions : [];
  const incSubs: any[] = Array.isArray(incomingTask.submissions) ? incomingTask.submissions : [];

  const mergedSubsMap = new Map<string, any>();

  const considerSub = (sub: any) => {
    if (!sub || typeof sub !== 'object') return;
    const key = normalizeSubKeyServer(sub);
    if (!key) return;
    const subTime = String(sub.submittedAt || '');
    const delById = sub.memberId ? deletedMap[String(sub.memberId).trim().toLowerCase()] : undefined;
    const delByName = sub.memberName ? deletedMap[String(sub.memberName).trim().toLowerCase()] : undefined;
    const delTime = delById && delByName ? (delById > delByName ? delById : delByName) : (delById || delByName);
    if (delTime && (!subTime || delTime >= subTime)) {
      return;
    }

    const prev = mergedSubsMap.get(key);
    if (!prev) {
      const cloned = { ...sub };
      if (!cloned.fileUrl && (cloned.downloadUrl || cloned.driveFileId)) {
        cloned.fileUrl = cloned.downloadUrl || `https://lh3.googleusercontent.com/d/${cloned.driveFileId}`;
      }
      mergedSubsMap.set(key, cloned);
    } else {
      const prevTime = String(prev.submittedAt || '');
      const newer = subTime >= prevTime ? { ...prev, ...sub } : { ...sub, ...prev };
      // Preserve non-empty fileUrl (prefer http Drive URL over /api/files/ over data: over empty string)
      const prevUrl = String(prev.fileUrl || '');
      const subUrl = String(sub.fileUrl || '');
      if (subUrl.startsWith('http')) {
        newer.fileUrl = subUrl;
      } else if (prevUrl.startsWith('http') && subTime <= prevTime) {
        newer.fileUrl = prevUrl;
      } else if (subUrl.startsWith('/api/files/') && !prevUrl.startsWith('http')) {
        newer.fileUrl = subUrl;
      } else if (prevUrl.startsWith('/api/files/') && !subUrl.startsWith('http') && subTime <= prevTime) {
        newer.fileUrl = prevUrl;
      } else if (!newer.fileUrl && (subUrl || prevUrl)) {
        newer.fileUrl = subUrl || prevUrl;
      }
      if (!newer.fileUrl && (newer.downloadUrl || newer.driveFileId)) {
        newer.fileUrl = newer.downloadUrl || `https://lh3.googleusercontent.com/d/${newer.driveFileId}`;
      }
      mergedSubsMap.set(key, newer);
    }
  };

  exSubs.forEach(considerSub);
  incSubs.forEach(considerSub);

  const mergedSubmissions = Array.from(mergedSubsMap.values());
  const result: any = {
    ...existingTask,
    ...incomingTask,
    submissions: mergedSubmissions
  };
  if (Object.keys(deletedMap).length > 0) {
    result.deletedSubmissionsMap = deletedMap;
  }
  return result;
}

function mergeTaskListsServer(existingList: any, incomingList: any): any {
  if (!Array.isArray(incomingList)) return incomingList;
  if (!Array.isArray(existingList) || existingList.length === 0) return incomingList;

  const existingById = new Map<string, any>();
  for (const t of existingList) {
    if (t && t.id) {
      existingById.set(String(t.id), t);
    }
  }

  return incomingList.map(incTask => {
    if (!incTask || !incTask.id) return incTask;
    const exTask = existingById.get(String(incTask.id));
    if (!exTask) return incTask;
    return mergeSingleTaskSubmissionsServer(exTask, incTask);
  });
}

function isTaskKeyName(key: string): boolean {
  return key === 'ams_tasks' || key.startsWith('ams_tasks__');
}

function buildCloudKvRow(key: string, value: any, updatedAt: number): Record<string, any> | null {
  try {
    let serialized = JSON.stringify(value);
    if (serialized && serialized.length > CHUNK_SIZE * MAX_CHUNKS) {
      serialized = JSON.stringify(sanitizeForCloudKv(value));
    }
    if (!serialized || serialized.length > CHUNK_SIZE * MAX_CHUNKS) {
      return null;
    }
    const firstSlice = serialized.slice(0, CHUNK_SIZE);
    const row: Record<string, any> = {
      id: key,
      updatedAt,
      valueJson: firstSlice ? `~${firstSlice}` : ''
    };
    for (let i = 1; i < MAX_CHUNKS; i++) {
      const part = serialized.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      row[`c${i}`] = part ? `~${part}` : '';
    }
    return row;
  } catch {
    return null;
  }
}

function parseCloudKvRow(row: any): { key: string; value: any; updatedAt: number } | null {
  if (!row || !row.id || row.id === '_sync_test') return null;
  try {
    const stripTilde = (s: any): string => {
      if (s === undefined || s === null || s === '') return '';
      const str = String(s);
      return str.startsWith('~') ? str.slice(1) : str;
    };
    let fullJson = stripTilde(row.valueJson);
    for (let i = 1; i < MAX_CHUNKS; i++) {
      const part = stripTilde(row[`c${i}`]);
      if (part) fullJson += part;
    }
    if (!fullJson) return null;
    const value = JSON.parse(fullJson);
    const updatedAt = Number(row.updatedAt) || 0;
    return { key: String(row.id), value, updatedAt };
  } catch {
    return null;
  }
}

const pendingCloudPushKeys = new Set<string>();
const inFlightCloudPushKeys = new Set<string>();
let cloudPushTimer: ReturnType<typeof setTimeout> | null = null;
let isPushingToCloud = false;

function scheduleCloudKvPush(keys: string[]) {
  for (const k of keys) {
    if (k && k !== 'ams_session') {
      pendingCloudPushKeys.add(k);
      // Immediately push to Firebase Firestore
      if (k in state.store) {
        pushKeyToFirestoreServer(k, state.store[k], state.timestamps[k] || Date.now()).catch(() => {});
      }
    }
  }
  if (cloudPushTimer) clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(() => {
    flushCloudKvPush();
  }, 200);
}

async function flushCloudKvPush() {
  if (isPushingToCloud || pendingCloudPushKeys.size === 0) return;
  isPushingToCloud = true;

  const keysBatch = Array.from(pendingCloudPushKeys);
  pendingCloudPushKeys.clear();
  for (const k of keysBatch) {
    inFlightCloudPushKeys.add(k);
  }

  try {
    const records: Record<string, any>[] = [];
    for (const key of keysBatch) {
      if (!(key in state.store)) continue;
      const row = buildCloudKvRow(key, state.store[key], state.timestamps[key] || Date.now());
      if (row) records.push(row);
    }

    if (records.length > 0) {
      const url = getGasWebAppUrl();
      for (let i = 0; i < records.length; i += 8) {
        const slice = records.slice(i, i + 8);
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'batchSaveEntities',
            spreadsheetId: MASTER_SPREADSHEET_ID,
            sheetName: CLOUD_KV_SHEET,
            keyField: 'id',
            records: slice
          })
        });
      }
    }
  } catch {
    // ignore GAS fallback error since Firestore is primary
  } finally {
    for (const k of keysBatch) {
      inFlightCloudPushKeys.delete(k);
    }
    isPushingToCloud = false;
    if (pendingCloudPushKeys.size > 0) {
      scheduleCloudKvPush([]);
    }
  }
}

let isPullingFromCloud = false;
async function pullFromCloudKV(seedMissingToCloud = false): Promise<number> {
  // Always sync with Firebase Firestore first
  const firestoreApplied = await syncWithFirestoreServer(seedMissingToCloud);

  if (isPullingFromCloud) return firestoreApplied;
  isPullingFromCloud = true;
  let appliedCount = firestoreApplied;

  try {
    const url = `${getGasWebAppUrl()}?action=getSheet&spreadsheetId=${MASTER_SPREADSHEET_ID}&sheet=${CLOUD_KV_SHEET}&_t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) return appliedCount;
    const json: any = await res.json();
    if (!json || json.status !== 'success' || !Array.isArray(json.data)) return appliedCount;

    const appliedUpdates: Record<string, any> = {};
    const appliedTimestamps: Record<string, number> = {};
    const keysToPushBack: string[] = [];

    for (const rawRow of json.data) {
      const parsed = parseCloudKvRow(rawRow);
      if (!parsed) continue;
      const { key, value, updatedAt } = parsed;

      if (pendingCloudPushKeys.has(key) || inFlightCloudPushKeys.has(key)) continue;

      const localTs = Number(state.timestamps[key]) || 0;
      const isTask = isTaskKeyName(key);
      const nextValue = isTask ? mergeTaskListsServer(state.store[key], value) : value;
      const localSerialized = key in state.store ? JSON.stringify(state.store[key]) : undefined;
      const remoteSerialized = JSON.stringify(value);
      const cloudSerialized = JSON.stringify(nextValue);

      if (!(key in state.store) || updatedAt > localTs || (isTask && localSerialized !== cloudSerialized)) {
        const effTs = Math.max(localTs, updatedAt || Date.now());
        state.store[key] = nextValue;
        state.timestamps[key] = effTs;
        if (localSerialized !== cloudSerialized) {
          appliedUpdates[key] = nextValue;
          appliedTimestamps[key] = effTs;
          appliedCount++;
        }
      }

      if (isTask && cloudSerialized !== remoteSerialized) {
        keysToPushBack.push(key);
      }
    }

    if (Object.keys(appliedUpdates).length > 0) {
      state.rev += 1;
      scheduleDiskSave();
      broadcastDelta('cloud-kv', appliedUpdates, appliedTimestamps);
    }

    if (keysToPushBack.length > 0) {
      scheduleCloudKvPush(keysToPushBack);
    }

    // Automatically heal any task submission that has a fileName but empty fileUrl
    healMissingTaskSubmissionUrlsServer().catch(() => {});
  } catch {
    // ignore transient network errors
  } finally {
    isPullingFromCloud = false;
  }

  return appliedCount;
}

function getMimeByFilename(fileName: string, fallback = 'application/octet-stream'): string {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'zip':
      return 'application/zip';
    default:
      return fallback;
  }
}

function extractDriveIdServer(urlOrId: string): string {
  if (!urlOrId) return '';
  const m1 = urlOrId.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m1 && m1[1]) return m1[1];
  const m2 = urlOrId.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m2 && m2[1]) return m2[1];
  const m3 = urlOrId.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (m3 && m3[1]) return m3[1];
  return '';
}

const driveFilesCache = new Map<string, { fetchedAt: number; rows: any[] }>();
let isHealingTaskUrls = false;

async function fetchSchoolDriveFilesRows(schoolId: string): Promise<any[]> {
  const cacheKey = schoolId || 'default';
  const cached = driveFilesCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 15000) {
    return cached.rows;
  }

  const admins: any[] = Array.isArray(state.store['ams_school_admins']) ? state.store['ams_school_admins'] : [];
  const matchedAdmin = admins.find(a => a && a.id === schoolId);
  const spreadsheetId = matchedAdmin?.googleSheetId || '';

  const q = new URLSearchParams({
    action: 'getSheet',
    sheet: 'DriveFiles',
    ...(spreadsheetId ? { spreadsheetId } : {}),
    ...(schoolId ? { schoolId } : {}),
    _t: String(Date.now())
  });

  try {
    const res = await fetch(`${getGasWebAppUrl()}?${q.toString()}`);
    if (!res.ok) return cached?.rows || [];
    const json: any = await res.json();
    if (json && json.status === 'success' && Array.isArray(json.data)) {
      driveFilesCache.set(cacheKey, { fetchedAt: Date.now(), rows: json.data });
      return json.data;
    }
  } catch {
    // ignore
  }
  return cached?.rows || [];
}

async function healMissingTaskSubmissionUrlsServer(): Promise<void> {
  if (isHealingTaskUrls) return;
  isHealingTaskUrls = true;
  try {
    const changedKeys: string[] = [];
    for (const [key, val] of Object.entries(state.store)) {
      if (!isTaskKeyName(key) || !Array.isArray(val)) continue;
      const needsHeal = val.some(
        (t: any) =>
          t &&
          Array.isArray(t.submissions) &&
          t.submissions.some(
            (s: any) =>
              s &&
              s.fileName &&
              (!s.fileUrl || String(s.fileUrl).startsWith('/api/files/')) &&
              !s.driveFileId
          )
      );
      if (!needsHeal) continue;

      const schoolId = key.includes('__') ? key.split('__').slice(1).join('__') : 'admin-school-01';
      const driveRows = await fetchSchoolDriveFilesRows(schoolId);
      if (!driveRows || driveRows.length === 0) continue;

      let keyChanged = false;
      const nextTasks = val.map((t: any) => {
        if (!t || !Array.isArray(t.submissions)) return t;
        let taskChanged = false;
        let recoveredMainUrl = t.submittedFileUrl;
        const nextSubs = t.submissions.map((s: any) => {
          if (!s || !s.fileName) return s;
          if (s.fileUrl && String(s.fileUrl).startsWith('http')) return s;
          const targetName = String(s.fileName).trim().toLowerCase();
          for (let i = driveRows.length - 1; i >= 0; i--) {
            const row = driveRows[i];
            if (!row) continue;
            const rName = String(row.fileName || '').trim().toLowerCase();
            if (rName === targetName || rName.endsWith('_' + targetName) || rName.includes(targetName)) {
              const fid =
                String(row.driveFileId || '').trim() ||
                extractDriveIdServer(String(row.driveViewUrl || row.driveDownloadUrl || ''));
              if (fid) {
                const viewUrl = String(row.driveViewUrl || `https://lh3.googleusercontent.com/d/${fid}`);
                const dlUrl = String(row.driveDownloadUrl || `https://drive.google.com/uc?export=download&id=${fid}`);
                taskChanged = true;
                keyChanged = true;
                if (!recoveredMainUrl) recoveredMainUrl = viewUrl;
                return {
                  ...s,
                  fileUrl: viewUrl,
                  driveFileId: fid,
                  downloadUrl: dlUrl
                };
              }
            }
          }
          return s;
        });

        if (!taskChanged) return t;
        return {
          ...t,
          submissions: nextSubs,
          submittedFileUrl: recoveredMainUrl || t.submittedFileUrl
        };
      });

      if (keyChanged) {
        const nowTs = Date.now();
        state.store[key] = nextTasks;
        state.timestamps[key] = Math.max(nowTs, (Number(state.timestamps[key]) || 0) + 1);
        changedKeys.push(key);
      }
    }

    if (changedKeys.length > 0) {
      state.rev += 1;
      scheduleDiskSave();
      const updatesObj: Record<string, any> = {};
      const tsObj: Record<string, number> = {};
      for (const k of changedKeys) {
        updatesObj[k] = state.store[k];
        tsObj[k] = state.timestamps[k];
      }
      broadcastDelta('server-heal-urls', updatesObj, tsObj);
      scheduleCloudKvPush(changedKeys);
    }
  } finally {
    isHealingTaskUrls = false;
  }
}

async function resolveDriveIdFromStoreOrSheet(
  rawUrl: string,
  fileName: string,
  schoolIdHint?: string
): Promise<string> {
  const directId = extractDriveIdServer(rawUrl);
  if (directId) return directId;

  const cleanName = (fileName || '').trim().toLowerCase();

  // 1. Search in-memory state.store across all task submissions and documents
  for (const [k, v] of Object.entries(state.store)) {
    if (isTaskKeyName(k) && Array.isArray(v)) {
      for (const t of v) {
        if (!t || !Array.isArray(t.submissions)) continue;
        for (const s of t.submissions) {
          if (!s) continue;
          const matchUrl = rawUrl && (s.localHostedUrl === rawUrl || s.fileUrl === rawUrl);
          const matchName = cleanName && cleanName !== 'download' && String(s.fileName || '').trim().toLowerCase() === cleanName;
          if (matchUrl || matchName) {
            const fid = String(s.driveFileId || '').trim() || extractDriveIdServer(String(s.fileUrl || s.downloadUrl || ''));
            if (fid) return fid;
          }
        }
      }
    }
  }

  // 2. Search in DriveFiles sheet of the school (or all active schools if schoolIdHint not provided)
  if (cleanName && cleanName !== 'download') {
    const schoolIdsToCheck: string[] = [];
    if (schoolIdHint) schoolIdsToCheck.push(schoolIdHint);
    const admins: any[] = Array.isArray(state.store['ams_school_admins']) ? state.store['ams_school_admins'] : [];
    for (const adm of admins) {
      if (adm && adm.id && !schoolIdsToCheck.includes(adm.id)) {
        schoolIdsToCheck.push(adm.id);
      }
    }

    for (const sid of schoolIdsToCheck) {
      const rows = await fetchSchoolDriveFilesRows(sid);
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (!row) continue;
        const rName = String(row.fileName || '').trim().toLowerCase();
        if (rName === cleanName || rName.endsWith('_' + cleanName) || rName.includes(cleanName)) {
          const fid =
            String(row.driveFileId || '').trim() ||
            extractDriveIdServer(String(row.driveViewUrl || row.driveDownloadUrl || ''));
          if (fid) {
            // Trigger background heal so state.store gets updated too
            healMissingTaskSubmissionUrlsServer().catch(() => {});
            return fid;
          }
        }
      }
    }
  }

  return '';
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Support large payloads (up to 50MB for base64 documents, PDFs, school logos, task submissions)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Universal CORS headers so any preview/domain can reach the API
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // 0. Universal File Proxy & Hosted File Download/Preview Endpoint
  app.get('/api/files/download', async (req, res) => {
    const rawUrl = String(req.query.url || '');
    const explicitId = String(req.query.id || '').trim();
    const rawName = String(req.query.name || req.query.filename || 'download').trim() || 'download';
    const schoolIdHint = String(req.query.schoolId || '').trim();
    const isInline = req.query.inline === '1';
    const extMatch = rawName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    const isExpectedImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
    const isNonImageDoc = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'pptx', 'ppt', 'zip', 'rar', 'txt'].includes(ext);
    const safeAsciiName = rawName.replace(/[^\x20-\x7E]/g, '_').replace(/_+/g, '_').trim();
    const cleanAscii = safeAsciiName.replace(/^[_\.]+|[_\.]+$/g, '');
    const fallbackFilename = ext ? (cleanAscii && cleanAscii !== ext ? `${cleanAscii}.${ext}` : `document_${Date.now()}.${ext}`) : 'document.bin';
    const encodedName = encodeURIComponent(rawName);
    const disposition = `${isInline ? 'inline' : 'attachment'}; filename="${fallbackFilename}"; filename*=UTF-8''${encodedName}`;

    try {
      if (rawUrl.startsWith('/api/files/')) {
        const fileId = rawUrl.replace('/api/files/', '').split('?')[0];
        const record = loadServerHostedFile(fileId);
        if (record && record.dataUrl) {
          const parts = record.dataUrl.split(';base64,');
          const mime = getMimeByFilename(rawName, parts[0].replace('data:', '') || 'application/octet-stream');
          const buf = Buffer.from(parts[1] || '', 'base64');
          res.setHeader('Content-Type', mime);
          res.setHeader('Content-Length', String(buf.length));
          res.setHeader('Content-Disposition', disposition);
          res.send(buf);
          return;
        }
      }

      const driveId = explicitId || (await resolveDriveIdFromStoreOrSheet(rawUrl, rawName, schoolIdHint));
      const candidateUrls: string[] = [];
      if (driveId) {
        candidateUrls.push(`https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`);
        candidateUrls.push(`https://drive.google.com/uc?export=download&id=${driveId}&confirm=t`);
        if (isExpectedImage || !isNonImageDoc) {
          candidateUrls.push(`https://lh3.googleusercontent.com/d/${driveId}`);
        }
      } else if (rawUrl.startsWith('http')) {
        candidateUrls.push(rawUrl);
      }

      for (const fetchUrl of candidateUrls) {
        try {
          const upstream = await fetch(fetchUrl);
          const upstreamType = String(upstream.headers.get('content-type') || '').toLowerCase();
          if (upstream.ok && !upstreamType.includes('text/html')) {
            // Reject image thumbnails when the requested file is a PDF/Word/Excel/PowerPoint document
            if (isNonImageDoc && upstreamType.startsWith('image/')) {
              continue;
            }
            const arrayBuf = await upstream.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            if (buf.length > 0) {
              // Extra magic-byte guard: ensure PDF/Office files are not HTML or PNG thumbnails
              const headAscii = buf.slice(0, 16).toString('ascii');
              if (headAscii.startsWith('<!DOCTYPE') || headAscii.startsWith('<html')) {
                continue;
              }
              if (isNonImageDoc && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
                continue;
              }
              const mime = getMimeByFilename(rawName, upstreamType || 'application/octet-stream');
              res.setHeader('Content-Type', mime);
              res.setHeader('Content-Length', String(buf.length));
              res.setHeader('Content-Disposition', disposition);
              res.send(buf);
              return;
            }
          }
        } catch {
          // try next candidate URL
        }
      }

      if (driveId) {
        res.redirect(`https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`);
        return;
      }
      if (rawUrl.startsWith('http')) {
        res.redirect(rawUrl);
        return;
      }

      res.status(404).json({ status: 'error', message: 'File not found' });
    } catch {
      if (rawUrl.startsWith('http')) {
        res.redirect(rawUrl);
      } else {
        res.status(404).json({ status: 'error', message: 'File not found' });
      }
    }
  });

  app.get('/api/files/:fileId', async (req, res) => {
    const fileId = String(req.params.fileId || '');
    const record = loadServerHostedFile(fileId);
    if (record && record.dataUrl) {
      const parts = record.dataUrl.split(';base64,');
      const mime = getMimeByFilename(record.fileName, parts[0].replace('data:', '') || 'application/octet-stream');
      const buf = Buffer.from(parts[1] || '', 'base64');
      const isDownload = req.query.download === '1';
      const encodedName = encodeURIComponent(record.fileName || 'file');
      res.setHeader('Content-Type', mime);
      res.setHeader(
        'Content-Disposition',
        `${isDownload ? 'attachment' : 'inline'}; filename="file"; filename*=UTF-8''${encodedName}`
      );
      res.send(buf);
      return;
    }

    // Fallback: if local file is missing on this container, resolve via Drive ID in state.store
    const driveId = await resolveDriveIdFromStoreOrSheet(`/api/files/${fileId}`, '');
    if (driveId) {
      res.redirect(`/api/files/download?url=${encodeURIComponent(`https://lh3.googleusercontent.com/d/${driveId}`)}`);
      return;
    }

    res.status(404).json({ status: 'error', message: 'File not found' });
  });

  // 1. Server-Sent Events (SSE) Real-Time Stream
  app.get('/api/realtime/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        rev: state.rev,
        serverTime: Date.now()
      })}\n\n`
    );

    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // 2. Fast Authoritative State Fetch (supports ?sinceRev= and ?forceCloud=1)
  app.get('/api/realtime/state', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const forceCloud = req.query.forceCloud === '1';
    if (forceCloud) {
      pullFromCloudKV(false).catch(() => {});
    }

    const sinceRev = Number(req.query.sinceRev || 0);
    if (sinceRev > 0 && sinceRev === state.rev) {
      res.json({
        status: 'up_to_date',
        rev: state.rev,
        serverTime: Date.now()
      });
      return;
    }

    res.json({
      status: 'success',
      rev: state.rev,
      store: state.store,
      timestamps: state.timestamps,
      serverTime: Date.now()
    });
  });

  // 3. Real-Time Mutation Endpoint (optimistic update + instant SSE broadcast + Firestore & Cloud KV push)
  app.post('/api/realtime/mutate', (req, res) => {
    const { clientId = 'unknown', updates = {}, timestamps = {}, isInitialSeed = false } = req.body || {};
    if (!updates || typeof updates !== 'object') {
      res.status(400).json({ status: 'error', message: 'Invalid updates payload' });
      return;
    }

    const appliedUpdates: Record<string, any> = {};
    const appliedTimestamps: Record<string, number> = {};
    const now = Date.now();

    for (const [key, value] of Object.entries(updates)) {
      if (!key || key === 'ams_session') continue;

      if (isInitialSeed && key in state.store) {
        continue;
      }

      const incomingTs = Number(timestamps[key]) || now;
      const existingTs = Number(state.timestamps[key]) || 0;
      const effectiveTs = isInitialSeed ? incomingTs : Math.max(now, existingTs + 1, incomingTs);

      if (!isInitialSeed || effectiveTs >= existingTs || !(key in state.store)) {
        let finalValue = value;
        if (value === null || value === undefined) {
          delete state.store[key];
        } else {
          if (isTaskKeyName(key)) {
            if (key in state.store) {
              finalValue = mergeTaskListsServer(state.store[key], value);
            }
            finalValue = ensureTaskFilesHostedAndUploaded(key, finalValue);
          }
          state.store[key] = finalValue;
        }
        state.timestamps[key] = effectiveTs;
        appliedUpdates[key] = finalValue;
        appliedTimestamps[key] = effectiveTs;
      }
    }

    const updatedKeys = Object.keys(appliedUpdates);
    if (updatedKeys.length > 0) {
      state.rev += 1;
      scheduleDiskSave();
      broadcastDelta(clientId, appliedUpdates, appliedTimestamps);
      scheduleCloudKvPush(updatedKeys);
    }

    res.json({
      status: 'success',
      rev: state.rev,
      appliedCount: updatedKeys.length,
      mergedUpdates: appliedUpdates,
      serverTime: now
    });
  });

  // 4. Compatible /api/d1 Endpoint
  app.all('/api/d1', async (req, res) => {
    const action = String(req.query.action || 'ping');

    if (action === 'ping') {
      res.json({
        status: 'success',
        message: 'Firebase Firestore & Real-Time Cloud Sync is online',
        isD1Available: true,
        result: { isOnline: 1 }
      });
      return;
    }

    if (action === 'getAll') {
      await syncWithFirestoreServer(false);
      const developer = state.store['ams_developer_account'] || { username: 'airfan', password: '456789' };
      const admins = state.store['ams_school_admins'] || [];
      const members = state.store['ams_members'] || [];
      const academicYears = state.store['ams_academic_years'] || ['2568', '2569'];

      res.json({
        status: 'success',
        isD1Available: true,
        data: { developer, admins, members, academicYears }
      });
      return;
    }

    if (action === 'getRealtimeState') {
      res.json({
        status: 'success',
        isD1Available: true,
        rev: state.rev,
        store: state.store,
        timestamps: state.timestamps
      });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const now = Date.now();

      if (action === 'saveRealtimeState') {
        const { key, value, updatedAt = now, clientId = 'd1-client' } = body;
        if (key) {
          const finalVal = isTaskKeyName(key) && key in state.store ? mergeTaskListsServer(state.store[key], value) : value;
          const effTs = Math.max(now, Number(state.timestamps[key]) + 1 || 0, Number(updatedAt) || 0);
          state.store[key] = finalVal;
          state.timestamps[key] = effTs;
          state.rev += 1;
          scheduleDiskSave();
          broadcastDelta(clientId, { [key]: finalVal }, { [key]: effTs });
          scheduleCloudKvPush([key]);
        }
        res.json({ status: 'success', rev: state.rev });
        return;
      }

      if (action === 'updateDevPassword') {
        const dev = { username: 'airfan', password: body.password || '456789' };
        state.store['ams_developer_account'] = dev;
        state.timestamps['ams_developer_account'] = now;
        state.rev += 1;
        scheduleDiskSave();
        broadcastDelta('server-d1', { ams_developer_account: dev }, { ams_developer_account: now });
        scheduleCloudKvPush(['ams_developer_account']);
        res.json({ status: 'success', message: 'Updated developer password' });
        return;
      }

      if (action === 'saveAdmin') {
        const admins: any[] = Array.isArray(state.store['ams_school_admins']) ? [...state.store['ams_school_admins']] : [];
        const idx = admins.findIndex(a => a.id === body.id);
        if (idx >= 0) admins[idx] = { ...admins[idx], ...body };
        else admins.unshift(body);
        state.store['ams_school_admins'] = admins;
        state.timestamps['ams_school_admins'] = now;
        state.rev += 1;
        scheduleDiskSave();
        broadcastDelta('server-d1', { ams_school_admins: admins }, { ams_school_admins: now });
        scheduleCloudKvPush(['ams_school_admins']);
        res.json({ status: 'success', message: 'Saved admin' });
        return;
      }

      if (action === 'deleteAdmin') {
        const admins: any[] = Array.isArray(state.store['ams_school_admins']) ? state.store['ams_school_admins'] : [];
        const targetAdmin = admins.find(a => a.id === body.id);
        const members: any[] = Array.isArray(state.store['ams_members']) ? state.store['ams_members'] : [];
        const nextAdmins = admins.filter(a => a.id !== body.id);
        const nextMembers = members.filter(
          m => m.schoolId !== body.id && (!targetAdmin || m.schoolName !== targetAdmin.schoolName)
        );
        state.store['ams_school_admins'] = nextAdmins;
        state.store['ams_members'] = nextMembers;
        state.timestamps['ams_school_admins'] = now;
        state.timestamps['ams_members'] = now;

        const deltaUpdates: Record<string, any> = {
          ams_school_admins: nextAdmins,
          ams_members: nextMembers
        };
        const deltaTimestamps: Record<string, number> = {
          ams_school_admins: now,
          ams_members: now
        };

        // Cascade delete tenant-scoped keys for this school
        const suffix = `__${body.id}`;
        for (const k of Object.keys(state.store)) {
          if (k.endsWith(suffix)) {
            delete state.store[k];
            state.timestamps[k] = now;
            deltaUpdates[k] = null;
            deltaTimestamps[k] = now;
          }
        }

        state.rev += 1;
        scheduleDiskSave();
        broadcastDelta('server-d1', deltaUpdates, deltaTimestamps);
        scheduleCloudKvPush(['ams_school_admins', 'ams_members']);

        // Also trigger Google Sheets cleanup from server
        const gasUrl = getGasWebAppUrl();
        fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'deleteSchoolSheet',
            spreadsheetId: MASTER_SPREADSHEET_ID,
            masterSpreadsheetId: MASTER_SPREADSHEET_ID,
            schoolSpreadsheetId: targetAdmin?.googleSheetId || '',
            googleSheetId: targetAdmin?.googleSheetId || '',
            adminId: body.id,
            schoolName: targetAdmin?.schoolName || ''
          })
        }).catch(() => {});

        res.json({ status: 'success', message: 'Deleted admin, school sheet, and cascade members' });
        return;
      }

      if (action === 'saveMember') {
        const members: any[] = Array.isArray(state.store['ams_members']) ? [...state.store['ams_members']] : [];
        const idx = members.findIndex(m => m.id === body.id);
        if (idx >= 0) members[idx] = { ...members[idx], ...body };
        else members.unshift(body);
        state.store['ams_members'] = members;
        state.timestamps['ams_members'] = now;
        state.rev += 1;
        scheduleDiskSave();
        broadcastDelta('server-d1', { ams_members: members }, { ams_members: now });
        scheduleCloudKvPush(['ams_members']);
        res.json({ status: 'success', message: 'Saved member' });
        return;
      }

      if (action === 'deleteMember') {
        const members: any[] = Array.isArray(state.store['ams_members']) ? state.store['ams_members'] : [];
        const nextMembers = members.filter(m => m.id !== body.id);
        state.store['ams_members'] = nextMembers;
        state.timestamps['ams_members'] = now;
        state.rev += 1;
        scheduleDiskSave();
        broadcastDelta('server-d1', { ams_members: nextMembers }, { ams_members: now });
        scheduleCloudKvPush(['ams_members']);
        res.json({ status: 'success', message: 'Deleted member' });
        return;
      }

      if (action === 'saveYear') {
        const years: string[] = Array.isArray(state.store['ams_academic_years']) ? [...state.store['ams_academic_years']] : ['2568', '2569'];
        if (body.year && !years.includes(body.year)) {
          years.push(body.year);
          years.sort((a, b) => Number(a) - Number(b));
        }
        state.store['ams_academic_years'] = years;
        state.timestamps['ams_academic_years'] = now;
        state.rev += 1;
        scheduleDiskSave();
        broadcastDelta('server-d1', { ams_academic_years: years }, { ams_academic_years: now });
        scheduleCloudKvPush(['ams_academic_years']);
        res.json({ status: 'success', message: 'Saved academic year' });
        return;
      }

      if (action === 'deleteYear') {
        const targetYear = String(body.year || '').trim();
        const gregorianYear = String(Number(targetYear) - 543);
        const years: string[] = Array.isArray(state.store['ams_academic_years']) ? state.store['ams_academic_years'] : ['2568', '2569'];
        const nextYears = years.filter(y => y !== targetYear);
        const fallbackYear = nextYears[nextYears.length - 1] || '2568';

        const deltaUpdates: Record<string, any> = {
          ams_academic_years: nextYears.length > 0 ? nextYears : ['2568']
        };
        const deltaTimestamps: Record<string, number> = {
          ams_academic_years: now
        };

        state.store['ams_academic_years'] = deltaUpdates.ams_academic_years;
        state.timestamps['ams_academic_years'] = now;

        const isDateMatchingYear = (d?: string) => {
          if (!d || typeof d !== 'string') return false;
          if (d.includes(targetYear)) return true;
          if (!isNaN(Number(targetYear)) && d.includes(gregorianYear)) return true;
          return false;
        };

        // Sweep all keys in state.store across all school tenants
        for (const [k, v] of Object.entries(state.store)) {
          if (!k || k === 'ams_academic_years' || k === 'ams_school_admins' || k === 'ams_members' || k === 'ams_developer_account') continue;
          const baseKey = k.includes('__') ? k.split('__')[0] : k;

          if (baseKey === 'ams_school_info' && v && typeof v === 'object') {
            if (v.academicYear === targetYear) {
              const nextInfo = { ...v, academicYear: fallbackYear };
              state.store[k] = nextInfo;
              state.timestamps[k] = now;
              deltaUpdates[k] = nextInfo;
              deltaTimestamps[k] = now;
            }
          } else if (Array.isArray(v)) {
            if (
              baseKey === 'ams_students' ||
              baseKey === 'ams_personnel' ||
              baseKey === 'ams_websites' ||
              baseKey === 'ams_custom_buttons' ||
              baseKey === 'ams_custom_pages' ||
              baseKey === 'ams_duty_assignments_v1'
            ) {
              continue;
            }
            const filtered = v.filter((item: any) => {
              if (!item || typeof item !== 'object') return true;
              if (String(item.academicYear || '') === targetYear) return false;
              if (item.date && isDateMatchingYear(item.date)) return false;
              if (item.dueDate && isDateMatchingYear(item.dueDate)) return false;
              if (item.startDate && isDateMatchingYear(item.startDate)) return false;
              if (baseKey === 'ams_documents' && item.docNumber && String(item.docNumber).endsWith('/' + targetYear)) return false;
              return true;
            });
            if (filtered.length !== v.length) {
              state.store[k] = filtered;
              state.timestamps[k] = now;
              deltaUpdates[k] = filtered;
              deltaTimestamps[k] = now;
            }
          } else if (v && typeof v === 'object') {
            if (
              baseKey === 'ams_behavior_evaluations' ||
              baseKey === 'ams_attendance_configs_by_term' ||
              baseKey === 'ams_reading_writing_config_v2' ||
              baseKey === 'ams_assessment_3_booklets_v2' ||
              baseKey.startsWith('pp6_')
            ) {
              let modified = false;
              const nextObj: Record<string, any> = {};
              for (const [subK, subV] of Object.entries(v)) {
                const keyHasYear = subK.includes(targetYear);
                const valHasYear = subV && typeof subV === 'object' && String((subV as any).academicYear || '') === targetYear;
                if (keyHasYear || valHasYear) {
                  modified = true;
                } else {
                  nextObj[subK] = subV;
                }
              }
              if (modified) {
                state.store[k] = nextObj;
                state.timestamps[k] = now;
                deltaUpdates[k] = nextObj;
                deltaTimestamps[k] = now;
              }
            }
          }
        }

        state.rev += 1;
        scheduleDiskSave();
        broadcastDelta('server-d1', deltaUpdates, deltaTimestamps);
        scheduleCloudKvPush(Object.keys(deltaUpdates));
        res.json({ status: 'success', message: 'Deleted academic year and cascaded all store keys' });
        return;
      }
    }

    res.status(400).json({ status: 'error', message: 'Unknown action' });
  });

  // 5. Vite middleware in development, static files in production
  const distPath = path.join(__dirname, 'dist');
  if (process.env.NODE_ENV !== 'production' || !fs.existsSync(distPath)) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Ensure any persisted task submissions with base64 data URLs are hosted & uploaded to Google Drive
    for (const [k, v] of Object.entries(state.store)) {
      if (isTaskKeyName(k)) {
        state.store[k] = ensureTaskFilesHostedAndUploaded(k, v);
      }
    }
    // Initial global cloud sync
    syncWithFirestoreServer(false).catch(() => {});
    startServerFirestoreListener();
    pullFromCloudKV(false).catch(() => {});
    // Continuous background cloud KV reconciliation every 2.5 seconds
    setInterval(() => {
      pullFromCloudKV(false).catch(() => {});
    }, 2500);
  });
}

startServer();
