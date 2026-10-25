import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '.data');
const STORE_FILE = path.join(DATA_DIR, 'realtime-store.json');

// Global Cloud KV Bridge (Google Apps Script + Google Sheets)
// Connects ais-dev, ais-pre, Cloudflare Pages, and all browsers/emails/devices globally
const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbzol007NNSB5uYI_no15j6GB5Ej3IQ2MuN50Sud7mQKMYloHBYxoxv6N8PVLgSfsNjlZw/exec';
const MASTER_SPREADSHEET_ID = '1mVJl2FSHiJmQlOR8t-7h1Z4wXfbMWepUU_Qzkd1FSAM';
const CLOUD_KV_SHEET = 'RealtimeCloudKV';
const CHUNK_SIZE = 38000;
const MAX_CHUNKS = 12; // ~456KB per key across columns valueJson, c1..c11

interface PersistedState {
  rev: number;
  store: Record<string, any>;
  timestamps: Record<string, number>;
}

// Ensure .data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // ignore
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
      // Ensure every existing key has a valid timestamp
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
// GLOBAL CLOUD KV BRIDGE (Syncs across ais-dev, ais-pre, Cloudflare, all emails)
// ============================================================================
function getGasWebAppUrl(): string {
  const cfg = state.store['ams_google_config'];
  if (cfg && typeof cfg.webAppUrl === 'string' && cfg.webAppUrl.startsWith('https://script.google.com/')) {
    return cfg.webAppUrl;
  }
  return DEFAULT_GAS_URL;
}

function buildCloudKvRow(key: string, value: any, updatedAt: number): Record<string, any> | null {
  try {
    const serialized = JSON.stringify(value);
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
let cloudPushTimer: ReturnType<typeof setTimeout> | null = null;
let isPushingToCloud = false;

function scheduleCloudKvPush(keys: string[]) {
  for (const k of keys) {
    if (k && k !== 'ams_session') {
      pendingCloudPushKeys.add(k);
    }
  }
  if (cloudPushTimer) clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(() => {
    flushCloudKvPush();
  }, 250);
}

async function flushCloudKvPush() {
  if (isPushingToCloud || pendingCloudPushKeys.size === 0) return;
  isPushingToCloud = true;

  const keysBatch = Array.from(pendingCloudPushKeys);
  pendingCloudPushKeys.clear();

  try {
    const records: Record<string, any>[] = [];
    for (const key of keysBatch) {
      if (!(key in state.store)) continue;
      const row = buildCloudKvRow(key, state.store[key], state.timestamps[key] || Date.now());
      if (row) records.push(row);
    }

    if (records.length > 0) {
      // Push in batches of 8 rows to keep each request fast and reliable
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
  } catch (err) {
    // Re-queue on transient error
    for (const k of keysBatch) pendingCloudPushKeys.add(k);
  } finally {
    isPushingToCloud = false;
    if (pendingCloudPushKeys.size > 0) {
      scheduleCloudKvPush([]);
    }
  }
}

let isPullingFromCloud = false;
async function pullFromCloudKV(seedMissingToCloud = false): Promise<number> {
  if (isPullingFromCloud) return 0;
  isPullingFromCloud = true;
  let appliedCount = 0;

  try {
    const url = `${getGasWebAppUrl()}?action=getSheet&spreadsheetId=${MASTER_SPREADSHEET_ID}&sheet=${CLOUD_KV_SHEET}&_t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) return 0;
    const json: any = await res.json();
    if (!json || json.status !== 'success' || !Array.isArray(json.data)) return 0;

    const appliedUpdates: Record<string, any> = {};
    const appliedTimestamps: Record<string, number> = {};
    const cloudTimestamps = new Map<string, number>();

    for (const rawRow of json.data) {
      const parsed = parseCloudKvRow(rawRow);
      if (!parsed) continue;
      const { key, value, updatedAt } = parsed;
      cloudTimestamps.set(key, updatedAt);

      // Skip if this key is currently queued to be pushed from local server
      if (pendingCloudPushKeys.has(key)) continue;

      const localTs = Number(state.timestamps[key]) || 0;
      const localSerialized = key in state.store ? JSON.stringify(state.store[key]) : undefined;
      const cloudSerialized = JSON.stringify(value);

      if (!(key in state.store) || updatedAt > localTs) {
        state.store[key] = value;
        state.timestamps[key] = updatedAt || Date.now();
        if (localSerialized !== cloudSerialized) {
          appliedUpdates[key] = value;
          appliedTimestamps[key] = state.timestamps[key];
          appliedCount++;
        }
      }
    }

    if (appliedCount > 0) {
      state.rev += 1;
      scheduleDiskSave();
      broadcastDelta('cloud-kv', appliedUpdates, appliedTimestamps);
    }

    if (seedMissingToCloud) {
      const missingOrNewerLocalKeys: string[] = [];
      for (const key of Object.keys(state.store)) {
        const localTs = Number(state.timestamps[key]) || 0;
        const cloudTs = cloudTimestamps.get(key) || 0;
        if (!cloudTimestamps.has(key) || localTs > cloudTs) {
          missingOrNewerLocalKeys.push(key);
        }
      }
      if (missingOrNewerLocalKeys.length > 0) {
        scheduleCloudKvPush(missingOrNewerLocalKeys);
      }
    }
  } catch {
    // ignore transient network errors
  } finally {
    isPullingFromCloud = false;
  }

  return appliedCount;
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

  // 1. Server-Sent Events (SSE) Real-Time Stream
  app.get('/api/realtime/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Send initial connection handshake with current revision
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
  app.get('/api/realtime/state', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const forceCloud = req.query.forceCloud === '1' || req.query.sinceRev === '0';
    if (forceCloud) {
      await pullFromCloudKV(false);
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

  // 3. Real-Time Mutation Endpoint (optimistic update + instant SSE broadcast + Global Cloud KV push)
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

      // If this is only an initial seed from a client, do not overwrite keys that already exist on server
      if (isInitialSeed && key in state.store) {
        continue;
      }

      const incomingTs = Number(timestamps[key]) || now;
      const existingTs = Number(state.timestamps[key]) || 0;

      // Apply update if newer or equal (or key doesn't exist yet)
      if (incomingTs >= existingTs || !(key in state.store)) {
        if (value === null || value === undefined) {
          delete state.store[key];
        } else {
          state.store[key] = value;
        }
        state.timestamps[key] = incomingTs;
        appliedUpdates[key] = value;
        appliedTimestamps[key] = incomingTs;
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
      serverTime: now
    });
  });

  // 4. Compatible /api/d1 Endpoint (works in Node/Cloud Run dev & prod and mirrors Cloudflare D1)
  app.all('/api/d1', async (req, res) => {
    const action = String(req.query.action || 'ping');

    if (action === 'ping') {
      res.json({
        status: 'success',
        message: 'Real-Time Cloud Sync & D1 Store is online',
        isD1Available: true,
        result: { isOnline: 1 }
      });
      return;
    }

    if (action === 'getAll') {
      await pullFromCloudKV(false);
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
          state.store[key] = value;
          state.timestamps[key] = updatedAt;
          state.rev += 1;
          scheduleDiskSave();
          broadcastDelta(clientId, { [key]: value }, { [key]: updatedAt });
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
        const members: any[] = Array.isArray(state.store['ams_members']) ? state.store['ams_members'] : [];
        const nextAdmins = admins.filter(a => a.id !== body.id);
        const nextMembers = members.filter(m => m.schoolId !== body.id);
        state.store['ams_school_admins'] = nextAdmins;
        state.store['ams_members'] = nextMembers;
        state.timestamps['ams_school_admins'] = now;
        state.timestamps['ams_members'] = now;
        state.rev += 1;
        scheduleDiskSave();
        broadcastDelta(
          'server-d1',
          { ams_school_admins: nextAdmins, ams_members: nextMembers },
          { ams_school_admins: now, ams_members: now }
        );
        scheduleCloudKvPush(['ams_school_admins', 'ams_members']);
        res.json({ status: 'success', message: 'Deleted admin and cascade members' });
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
        const years: string[] = Array.isArray(state.store['ams_academic_years']) ? state.store['ams_academic_years'] : ['2568', '2569'];
        const nextYears = years.filter(y => y !== body.year);
        state.store['ams_academic_years'] = nextYears;
        state.timestamps['ams_academic_years'] = now;
        state.rev += 1;
        scheduleDiskSave();
        broadcastDelta('server-d1', { ams_academic_years: nextYears }, { ams_academic_years: now });
        scheduleCloudKvPush(['ams_academic_years']);
        res.json({ status: 'success', message: 'Deleted academic year' });
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
    // Initial global cloud sync & seed missing local keys to RealtimeCloudKV
    pullFromCloudKV(true).catch(() => {});
    // Continuous cross-container / cross-domain sync every 2.5 seconds
    setInterval(() => {
      pullFromCloudKV(false).catch(() => {});
    }, 2500);
  });
}

startServer();
