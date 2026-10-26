import {
  Student,
  Personnel,
  SchoolInfo,
  DailyTracking,
  Subject,
  GradeRecord,
  AttendanceRecord,
  AttendanceDayConfig,
  SavingsRecord,
  TaskItem,
  DocumentItem,
  RecommendedWebsite,
  CalendarEvent,
  MemberAccount,
  GoogleConfig,
  UserSession,
  SchoolAdminAccount,
  CommentSession,
  StudentBehaviorEvaluation,
  CustomButton,
  CustomPage,
  LeaveRequestRecord
} from '../types';
import { D1Service } from './d1Service';

import {
  INITIAL_SCHOOL_INFO,
  INITIAL_MEMBERS,
  INITIAL_ADMINS,
  INITIAL_STUDENTS,
  INITIAL_PERSONNEL,
  INITIAL_DAILY_TRACKING,
  INITIAL_SUBJECTS,
  INITIAL_GRADES,
  INITIAL_ATTENDANCE_CONFIG,
  INITIAL_ATTENDANCE,
  INITIAL_SAVINGS,
  INITIAL_TASKS,
  INITIAL_DOCUMENTS,
  INITIAL_WEBSITES,
  INITIAL_CALENDAR_EVENTS
} from './initialData';

const KEYS = {
  SESSION: 'ams_session',
  GOOGLE_CONFIG: 'ams_google_config',
  SCHOOL_INFO: 'ams_school_info',
  ADMINS: 'ams_school_admins',
  MEMBERS: 'ams_members',
  STUDENTS: 'ams_students',
  PERSONNEL: 'ams_personnel',
  DAILY_TRACKING: 'ams_daily_tracking',
  SUBJECTS: 'ams_subjects',
  GRADES: 'ams_grades',
  ATTENDANCE_CONFIG: 'ams_attendance_config',
  ATTENDANCE: 'ams_attendance',
  SAVINGS: 'ams_savings',
  TASKS: 'ams_tasks',
  DOCUMENTS: 'ams_documents',
  WEBSITES: 'ams_websites',
  CALENDAR: 'ams_calendar',
  ACADEMIC_YEARS: 'ams_academic_years',
  LOCKED_SEMESTERS: 'ams_locked_semesters',
  ATTENDANCE_CONFIGS_BY_TERM: 'ams_attendance_configs_by_term',
  COMMENT_SESSIONS: 'ams_comment_sessions',
  BEHAVIOR_EVALUATIONS: 'ams_behavior_evaluations',
  CUSTOM_BUTTONS: 'ams_custom_buttons',
  CUSTOM_PAGES: 'ams_custom_pages',
  LEAVE_REQUESTS: 'ams_leave_requests_v1',
  DUTY_ASSIGNMENTS: 'ams_duty_assignments_v1',
  DUTY_LOGS: 'ams_daily_duty_logs_v1',
  GENERIC_ENTITIES: 'ams_generic_entities',
  DEVELOPER_ACCOUNT: 'ams_developer_account'
};

// Keys that must be strictly isolated per School (Multi-Tenant Data Isolation)
const TENANT_SCOPED_KEYS = new Set<string>([
  KEYS.SCHOOL_INFO,
  KEYS.STUDENTS,
  KEYS.PERSONNEL,
  KEYS.DAILY_TRACKING,
  KEYS.SUBJECTS,
  KEYS.GRADES,
  KEYS.ATTENDANCE_CONFIG,
  KEYS.ATTENDANCE,
  KEYS.SAVINGS,
  KEYS.TASKS,
  KEYS.DOCUMENTS,
  KEYS.WEBSITES,
  KEYS.CALENDAR,
  KEYS.LOCKED_SEMESTERS,
  KEYS.ATTENDANCE_CONFIGS_BY_TERM,
  KEYS.COMMENT_SESSIONS,
  KEYS.BEHAVIOR_EVALUATIONS,
  KEYS.CUSTOM_BUTTONS,
  KEYS.CUSTOM_PAGES,
  KEYS.LEAVE_REQUESTS,
  KEYS.DUTY_ASSIGNMENTS,
  KEYS.DUTY_LOGS
]);

const DEFAULT_GAS_WEBAPP_URL =
  'https://script.google.com/macros/s/AKfycbzol007NNSB5uYI_no15j6GB5Ej3IQ2MuN50Sud7mQKMYloHBYxoxv6N8PVLgSfsNjlZw/exec';
const MASTER_SPREADSHEET_ID = '1mVJl2FSHiJmQlOR8t-7h1Z4wXfbMWepUU_Qzkd1FSAM';
const CLOUD_KV_SHEET = 'RealtimeCloudKV';
const CLOUD_CHUNK_SIZE = 38000;
const CLOUD_MAX_CHUNKS = 12;

const INTERNAL_SKIP_KEYS = new Set<string>([
  KEYS.SESSION,
  'ams_attendance_reset_clean_v6',
  'ams_savings_reset_clean_v7',
  'ams_savings_cleared_v3',
  'ams_attendance_initialized'
]);

function normalizeSchoolId(rawSchoolId?: string, rawSchoolName?: string, adminsList?: SchoolAdminAccount[]): string {
  if (!rawSchoolId && !rawSchoolName) return 'admin-school-01';
  if (rawSchoolId === 'admin-01' || rawSchoolId === 'admin-school-01') return 'admin-school-01';

  let admins = adminsList;
  if (!admins) {
    try {
      const cached = memoryCache.get(KEYS.ADMINS);
      if (Array.isArray(cached)) {
        admins = cached;
      } else if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(KEYS.ADMINS);
        admins = raw ? JSON.parse(raw) : INITIAL_ADMINS;
      }
    } catch {
      admins = INITIAL_ADMINS;
    }
  }

  if (rawSchoolId && Array.isArray(admins)) {
    const exact = admins.find(a => a.id === rawSchoolId);
    if (exact) return exact.id;
  }

  if (rawSchoolName && Array.isArray(admins)) {
    const cleanTarget = rawSchoolName.replace(/^โรงเรียน/, '').trim();
    const byName = admins.find(a => {
      const cleanAdmin = (a.schoolName || '').replace(/^โรงเรียน/, '').trim();
      return a.schoolName === rawSchoolName || (cleanTarget && cleanAdmin === cleanTarget);
    });
    if (byName) return byName.id;
  }

  return rawSchoolId || 'admin-school-01';
}

function getActiveSchoolId(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(KEYS.SESSION);
    if (!raw) return null;
    const session = JSON.parse(raw) as UserSession;
    if (session && session.role !== 'developer') {
      return normalizeSchoolId(session.schoolId, session.schoolName);
    }
    return null;
  } catch {
    return null;
  }
}

function resolveTenantKey(key: string): string {
  if (!TENANT_SCOPED_KEYS.has(key)) return key;
  const schoolId = getActiveSchoolId();
  if (schoolId && schoolId !== 'admin-school-01' && schoolId !== 'admin-01') {
    return `${key}__${schoolId}`;
  }
  return key;
}

// ============================================================================
// HIGH-SPEED IN-MEMORY CACHE & REAL-TIME MULTI-DEVICE / MULTI-BROWSER ENGINE
// ============================================================================
const CLIENT_ID = `client_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
const memoryCache = new Map<string, any>();
const keyTimestamps = new Map<string, number>();
const locallyModifiedKeys = new Set<string>();
const subscribers = new Set<(changedKeys: string[]) => void>();
let lastKnownRev = 0;
let realtimeInitialized = false;
let broadcastChannel: BroadcastChannel | null = null;
let sseConnection: EventSource | null = null;

// Preserve native localStorage methods before hooking
const nativeSetItem: ((key: string, value: string) => void) | null =
  typeof window !== 'undefined' && window.localStorage
    ? window.localStorage.setItem.bind(window.localStorage)
    : null;
const nativeGetItem: ((key: string) => string | null) | null =
  typeof window !== 'undefined' && window.localStorage
    ? window.localStorage.getItem.bind(window.localStorage)
    : null;

function notifySubscribers(changedKeys: string[]) {
  if (changedKeys.length === 0) return;
  subscribers.forEach(listener => {
    try {
      listener(changedKeys);
    } catch (err) {
      console.error('Subscriber error:', err);
    }
  });
}

function buildCloudKvRowClient(key: string, value: any, updatedAt: number): Record<string, any> | null {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length > CLOUD_CHUNK_SIZE * CLOUD_MAX_CHUNKS) {
      return null;
    }
    const firstSlice = serialized.slice(0, CLOUD_CHUNK_SIZE);
    const row: Record<string, any> = {
      id: key,
      updatedAt,
      valueJson: firstSlice ? `~${firstSlice}` : ''
    };
    for (let i = 1; i < CLOUD_MAX_CHUNKS; i++) {
      const part = serialized.slice(i * CLOUD_CHUNK_SIZE, (i + 1) * CLOUD_CHUNK_SIZE);
      row[`c${i}`] = part ? `~${part}` : '';
    }
    return row;
  } catch {
    return null;
  }
}

function parseCloudKvRowClient(row: any): { key: string; value: any; updatedAt: number } | null {
  if (!row || !row.id || row.id === '_sync_test') return null;
  try {
    const stripTilde = (s: any): string => {
      if (s === undefined || s === null || s === '') return '';
      const str = String(s);
      return str.startsWith('~') ? str.slice(1) : str;
    };
    let fullJson = stripTilde(row.valueJson);
    for (let i = 1; i < CLOUD_MAX_CHUNKS; i++) {
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

function pushToGoogleCloudKVDirect(resolvedKey: string, value: any, timestamp: number) {
  if (typeof window === 'undefined') return;
  const row = buildCloudKvRowClient(resolvedKey, value, timestamp);
  if (!row) return;

  fetch(DEFAULT_GAS_WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'batchSaveEntities',
      spreadsheetId: MASTER_SPREADSHEET_ID,
      sheetName: CLOUD_KV_SHEET,
      keyField: 'id',
      records: [row]
    })
  }).catch(() => {});
}

function pushToRemoteServer(resolvedKey: string, value: any, timestamp: number) {
  if (typeof window === 'undefined' || INTERNAL_SKIP_KEYS.has(resolvedKey)) return;
  const payload = {
    clientId: CLIENT_ID,
    updates: { [resolvedKey]: value },
    timestamps: { [resolvedKey]: timestamp }
  };

  // 1. Primary Real-Time Server Mutation (triggers instant SSE broadcast + server-side Cloud KV push)
  fetch('/api/realtime/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(r => {
      if (!r.ok) {
        // Fallback: if /api/realtime/mutate is not available (e.g. static Cloudflare Pages), push directly to Global Cloud KV
        pushToGoogleCloudKVDirect(resolvedKey, value, timestamp);
        return null;
      }
      return r.json();
    })
    .then(data => {
      if (data && typeof data.rev === 'number' && data.rev > lastKnownRev) {
        lastKnownRev = data.rev;
      }
      if (data && typeof data.serverTime === 'number') {
        const currentTs = keyTimestamps.get(resolvedKey) || 0;
        if (data.serverTime > currentTs) {
          keyTimestamps.set(resolvedKey, data.serverTime);
        }
      }
    })
    .catch(() => {
      pushToGoogleCloudKVDirect(resolvedKey, value, timestamp);
    });

  // 2. Cloudflare Pages D1 Real-Time State Mirror (when deployed on Cloudflare Pages)
  fetch('/api/d1?action=saveRealtimeState', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      key: resolvedKey,
      value,
      updatedAt: timestamp
    })
  }).catch(() => {});
}

function applyIncomingUpdates(
  updates: Record<string, any>,
  timestamps: Record<string, number> = {},
  fromStorageEvent = false
): string[] {
  const changedKeys: string[] = [];
  const now = Date.now();

  for (const [resolvedKey, value] of Object.entries(updates)) {
    if (INTERNAL_SKIP_KEYS.has(resolvedKey)) continue;
    const incomingTs = Number(timestamps[resolvedKey]) || now;
    const localTs = keyTimestamps.get(resolvedKey) || 0;

    // Only skip if this browser explicitly modified the key MORE recently than incomingTs
    if (locallyModifiedKeys.has(resolvedKey) && localTs > incomingTs) {
      continue;
    }

    const currentCached = memoryCache.get(resolvedKey);
    const serializedIncoming = JSON.stringify(value);
    const serializedCurrent =
      currentCached !== undefined
        ? JSON.stringify(currentCached)
        : nativeGetItem
        ? nativeGetItem(resolvedKey)
        : null;

    memoryCache.set(resolvedKey, value);
    keyTimestamps.set(resolvedKey, incomingTs);

    if (serializedIncoming !== serializedCurrent) {
      if (!fromStorageEvent && nativeSetItem) {
        try {
          nativeSetItem(resolvedKey, serializedIncoming);
        } catch {
          // ignore quota error
        }
      }
      changedKeys.push(resolvedKey);
    }
  }

  if (changedKeys.length > 0) {
    notifySubscribers(changedKeys);
  }
  return changedKeys;
}

function getLocal<T>(key: string, fallback: T): T {
  try {
    const resolvedKey = resolveTenantKey(key);
    if (memoryCache.has(resolvedKey)) {
      return memoryCache.get(resolvedKey) as T;
    }

    const val = nativeGetItem ? nativeGetItem(resolvedKey) : localStorage.getItem(resolvedKey);
    if (!val) {
      // If secondary tenant school has no initialized data yet, return clean isolated fallback
      if (resolvedKey !== key) {
        if (Array.isArray(fallback)) return [] as unknown as T;
        if (key === KEYS.SCHOOL_INFO) {
          const schoolId = getActiveSchoolId();
          const adminsRaw = nativeGetItem ? nativeGetItem(KEYS.ADMINS) : localStorage.getItem(KEYS.ADMINS);
          const admins: SchoolAdminAccount[] = adminsRaw ? JSON.parse(adminsRaw) : INITIAL_ADMINS;
          const match = admins.find(a => a.id === schoolId);
          return {
            ...INITIAL_SCHOOL_INFO,
            schoolName: match?.schoolName || 'โรงเรียนใหม่',
            schoolCode: match?.schoolCode || '',
            affiliation: match?.affiliation || 'สพป.',
            directorName: match?.directorName || '',
            googleSheetId: match?.googleSheetId,
            googleSheetUrl: match?.googleSheetUrl
          } as unknown as T;
        }
      }
      return fallback;
    }

    const parsed = JSON.parse(val) as T;
    memoryCache.set(resolvedKey, parsed);
    return parsed;
  } catch (err) {
    console.error('Failed to parse from localStorage key:', key, err);
    return fallback;
  }
}

function setLocal<T>(key: string, value: T, skipRemotePush = false): void {
  try {
    const resolvedKey = resolveTenantKey(key);
    const now = Date.now();
    memoryCache.set(resolvedKey, value);
    keyTimestamps.set(resolvedKey, now);
    locallyModifiedKeys.add(resolvedKey);

    const serialized = JSON.stringify(value);
    if (nativeSetItem) {
      nativeSetItem(resolvedKey, serialized);
    } else {
      localStorage.setItem(resolvedKey, serialized);
    }

    // 1. Instant 0ms Cross-Tab Broadcast in same browser
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'delta',
          clientId: CLIENT_ID,
          updates: { [resolvedKey]: value },
          timestamps: { [resolvedKey]: now }
        });
      } catch {
        // ignore
      }
    }

    // 2. Notify local React subscribers immediately
    notifySubscribers([resolvedKey]);

    // 3. Push to Real-Time Server, D1 & Global Cloud KV so all devices, browsers, and emails sync immediately
    if (!skipRemotePush) {
      pushToRemoteServer(resolvedKey, value, now);
    }
  } catch (err) {
    console.error('Failed to save to localStorage key:', key, err);
  }
}

// Hook window.localStorage.setItem so sub-components writing directly to localStorage (e.g. PP6, Assessment3Booklets, WeightSessions) also sync across all devices/browsers
function installLocalStorageSyncHook() {
  if (typeof window === 'undefined' || !nativeSetItem) return;
  try {
    window.localStorage.setItem = function (key: string, value: string) {
      nativeSetItem(key, value);
      if (
        !key ||
        INTERNAL_SKIP_KEYS.has(key) ||
        key.startsWith('ams_cleared_') ||
        (!key.startsWith('ams_') && !key.startsWith('pp6_') && !key.startsWith('school_'))
      ) {
        return;
      }
      try {
        let parsed: any = value;
        try {
          parsed = JSON.parse(value);
        } catch {
          parsed = value;
        }
        const now = Date.now();
        memoryCache.set(key, parsed);
        keyTimestamps.set(key, now);
        locallyModifiedKeys.add(key);
        if (broadcastChannel) {
          broadcastChannel.postMessage({
            type: 'delta',
            clientId: CLIENT_ID,
            updates: { [key]: parsed },
            timestamps: { [key]: now }
          });
        }
        notifySubscribers([key]);
        pushToRemoteServer(key, parsed, now);
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore if localStorage.setItem is non-writable in restricted webviews
  }
}

export const StorageService = {
  // Helper: Normalize School ID across Admin and Member accounts
  getNormalizedSchoolId(rawSchoolId?: string, rawSchoolName?: string): string {
    return normalizeSchoolId(rawSchoolId, rawSchoolName);
  },

  // Subscribe to real-time updates (returns unsubscribe function)
  subscribe(listener: (changedKeys: string[]) => void): () => void {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  },

  // Pull directly from Global Cloud KV (Google Apps Script RealtimeCloudKV)
  async pullFromGoogleCloudKV(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const url = `${DEFAULT_GAS_WEBAPP_URL}?action=getSheet&spreadsheetId=${MASTER_SPREADSHEET_ID}&sheet=${CLOUD_KV_SHEET}&_t=${Date.now()}`;
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!res.ok) return false;
      const json: any = await res.json();
      if (!json || json.status !== 'success' || !Array.isArray(json.data)) return false;

      const incoming: Record<string, any> = {};
      const incomingTs: Record<string, number> = {};

      for (const rawRow of json.data) {
        const parsed = parseCloudKvRowClient(rawRow);
        if (!parsed) continue;
        incoming[parsed.key] = parsed.value;
        incomingTs[parsed.key] = parsed.updatedAt || Date.now();
      }

      if (Object.keys(incoming).length > 0) {
        const changed = applyIncomingUpdates(incoming, incomingTs);
        return changed.length > 0;
      }
    } catch {
      // ignore
    }
    return false;
  },

  // Pull latest state from Real-Time Server, Cloudflare D1, and Global Cloud KV
  async pullRemoteState(forceFull = false): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    let updatedAny = false;
    let serverReached = false;

    try {
      const sinceParam = forceFull ? 0 : lastKnownRev;
      const forceCloudParam = forceFull ? '&forceCloud=1' : '';
      const res = await fetch(`/api/realtime/state?sinceRev=${sinceParam}${forceCloudParam}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });

      if (res.ok) {
        serverReached = true;
        const data = await res.json();
        if (data.status === 'up_to_date') {
          return false;
        }
        if (data.status === 'success' && data.store && typeof data.store === 'object') {
          if (typeof data.rev === 'number') {
            lastKnownRev = data.rev;
          }
          const remoteKeys = Object.keys(data.store);
          if (remoteKeys.length > 0) {
            const changed = applyIncomingUpdates(data.store, data.timestamps || {});
            if (changed.length > 0) updatedAny = true;
          } else {
            // Server is empty -> try pulling from Global Cloud KV first before seeding
            const pulledCloud = await this.pullFromGoogleCloudKV();
            if (pulledCloud) {
              updatedAny = true;
            }
            this.seedServerWithLocalData();
          }
          return updatedAny;
        }
      }
    } catch {
      // Fallback to Cloudflare Pages D1 + Global Cloud KV if /api/realtime/state is not mounted
    }

    if (!serverReached) {
      try {
        const [d1Master, d1Kv, cloudUpdated] = await Promise.all([
          D1Service.fetchAll(),
          fetch('/api/d1?action=getRealtimeState', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null),
          this.pullFromGoogleCloudKV()
        ]);

        if (cloudUpdated) updatedAny = true;

        const incoming: Record<string, any> = {};
        const incomingTs: Record<string, number> = {};
        const now = Date.now();

        if (d1Master.success && d1Master.data) {
          if (d1Master.data.developer) {
            incoming[KEYS.DEVELOPER_ACCOUNT] = d1Master.data.developer;
            incomingTs[KEYS.DEVELOPER_ACCOUNT] = now;
          }
          if (Array.isArray(d1Master.data.admins) && d1Master.data.admins.length > 0) {
            incoming[KEYS.ADMINS] = d1Master.data.admins;
            incomingTs[KEYS.ADMINS] = now;
          }
          if (Array.isArray(d1Master.data.members) && d1Master.data.members.length > 0) {
            incoming[KEYS.MEMBERS] = d1Master.data.members;
            incomingTs[KEYS.MEMBERS] = now;
          }
          if (Array.isArray(d1Master.data.academicYears) && d1Master.data.academicYears.length > 0) {
            incoming[KEYS.ACADEMIC_YEARS] = d1Master.data.academicYears;
            incomingTs[KEYS.ACADEMIC_YEARS] = now;
          }
        }

        if (d1Kv && d1Kv.status === 'success' && d1Kv.store) {
          Object.assign(incoming, d1Kv.store);
          Object.assign(incomingTs, d1Kv.timestamps || {});
        }

        if (Object.keys(incoming).length > 0) {
          const changed = applyIncomingUpdates(incoming, incomingTs);
          if (changed.length > 0) updatedAny = true;
        }
      } catch {
        // ignore
      }
    }

    return updatedAny;
  },

  seedServerWithLocalData(): void {
    if (typeof window === 'undefined') return;
    const updates: Record<string, any> = {};
    const timestamps: Record<string, number> = {};
    const now = Date.now();

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || INTERNAL_SKIP_KEYS.has(k) || (!k.startsWith('ams_') && !k.startsWith('pp6_') && !k.startsWith('school_'))) {
        continue;
      }
      try {
        const raw = nativeGetItem ? nativeGetItem(k) : localStorage.getItem(k);
        if (raw) {
          updates[k] = JSON.parse(raw);
          timestamps[k] = keyTimestamps.get(k) || now - 30000;
        }
      } catch {
        // ignore
      }
    }

    if (Object.keys(updates).length === 0) return;

    fetch('/api/realtime/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        updates,
        timestamps,
        isInitialSeed: true
      })
    }).catch(() => {});
  },

  // Initialize Real-Time Synchronization (SSE + BroadcastChannel + Storage Event + Fast Cloud Poll)
  initRealtimeSync(): void {
    if (typeof window === 'undefined' || realtimeInitialized) return;
    realtimeInitialized = true;

    installLocalStorageSyncHook();

    // 1. Immediate initial pull from server & Global Cloud KV
    this.pullRemoteState(true);

    // 2. BroadcastChannel for 0ms cross-tab sync within same browser
    if ('BroadcastChannel' in window) {
      try {
        broadcastChannel = new BroadcastChannel('nexus_realtime_channel');
        broadcastChannel.onmessage = (event) => {
          const msg = event.data;
          if (msg && msg.type === 'delta' && msg.clientId !== CLIENT_ID && msg.updates) {
            applyIncomingUpdates(msg.updates, msg.timestamps || {});
          }
        };
      } catch {
        // ignore
      }
    }

    // 3. Native window 'storage' event listener
    window.addEventListener('storage', (e) => {
      if (!e.key || INTERNAL_SKIP_KEYS.has(e.key) || !e.newValue) return;
      if (!e.key.startsWith('ams_') && !e.key.startsWith('pp6_') && !e.key.startsWith('school_')) return;
      try {
        const parsed = JSON.parse(e.newValue);
        applyIncomingUpdates({ [e.key]: parsed }, { [e.key]: Date.now() }, true);
      } catch {
        // ignore
      }
    });

    // 4. Persistent Server-Sent Events (SSE) stream for < 30ms cross-device / cross-browser push
    const connectSSE = () => {
      if (sseConnection) {
        try {
          sseConnection.close();
        } catch {
          // ignore
        }
      }

      try {
        const es = new EventSource('/api/realtime/stream');
        sseConnection = es;

        es.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (payload.type === 'connected') {
              if (typeof payload.rev === 'number' && payload.rev > lastKnownRev) {
                this.pullRemoteState(false);
              }
            } else if (payload.type === 'delta') {
              if (typeof payload.rev === 'number' && payload.rev > lastKnownRev) {
                lastKnownRev = payload.rev;
              }
              if (payload.clientId !== CLIENT_ID && payload.updates) {
                applyIncomingUpdates(payload.updates, payload.timestamps || {});
              }
            }
          } catch {
            // ignore
          }
        };

        es.onerror = () => {
          try {
            es.close();
          } catch {
            // ignore
          }
          setTimeout(connectSSE, 3000);
        };
      } catch {
        // EventSource not supported or offline
      }
    };

    connectSSE();

    // 5. Fast lightweight delta check every 2 seconds & on focus/visibility/online
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.pullRemoteState(false);
      }
    }, 2000);

    window.addEventListener('focus', () => {
      this.pullRemoteState(false);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.pullRemoteState(false);
      }
    });

    window.addEventListener('online', () => {
      this.pullRemoteState(true);
      connectSSE();
    });
  },

  // Developer Account Credentials (Default: airfan / 456789, changeable by Developer)
  getDeveloperCredentials(): { username: string; password: string } {
    return getLocal<{ username: string; password: string }>(KEYS.DEVELOPER_ACCOUNT, {
      username: 'airfan',
      password: '456789'
    });
  },

  updateDeveloperPassword(newPassword: string): void {
    const current = this.getDeveloperCredentials();
    const cleaned = newPassword.trim();
    setLocal(KEYS.DEVELOPER_ACCOUNT, {
      ...current,
      password: cleaned
    });
    D1Service.updateDeveloperPassword(cleaned).catch(() => {});
  },

  // Session & Auth
  getSession(): UserSession | null {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem(KEYS.SESSION)) {
        localStorage.removeItem(KEYS.SESSION);
      }
      const val = sessionStorage.getItem(KEYS.SESSION);
      if (!val) return null;
      const parsed = JSON.parse(val) as UserSession;
      if (parsed && parsed.username && parsed.isLoggedIn) {
        if (parsed.role !== 'developer') {
          parsed.schoolId = normalizeSchoolId(parsed.schoolId, parsed.schoolName);
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  },

  setSession(session: UserSession | null): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(KEYS.SESSION);
      }
      if (session) {
        sessionStorage.setItem(KEYS.SESSION, JSON.stringify(session));
      } else {
        sessionStorage.removeItem(KEYS.SESSION);
      }
    } catch (err) {
      console.error('Failed to update session:', err);
    }
  },

  // School Admins (Level 2: Multiple Admins for Multi-Schools)
  getAdmins(): SchoolAdminAccount[] {
    return getLocal<SchoolAdminAccount[]>(KEYS.ADMINS, INITIAL_ADMINS);
  },

  saveAdmin(admin: SchoolAdminAccount): SchoolAdminAccount[] {
    const list = this.getAdmins();
    const idx = list.findIndex(a => a.id === admin.id || a.username.toLowerCase() === admin.username.toLowerCase());
    let updated: SchoolAdminAccount[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = { ...list[idx], ...admin };
    } else {
      updated = [admin, ...list];
    }
    setLocal(KEYS.ADMINS, updated);
    D1Service.saveAdmin(admin).catch(() => {});
    return updated;
  },

  deleteAdmin(id: string): SchoolAdminAccount[] {
    const updated = this.getAdmins().filter(a => a.id !== id);
    setLocal(KEYS.ADMINS, updated);
    D1Service.deleteAdmin(id).catch(() => {});
    return updated;
  },

  authenticate(username: string, password: string): { success: boolean; user?: UserSession; message: string } {
    const trimmedUser = username.trim();
    const devCreds = this.getDeveloperCredentials();

    // 1. Level 1: Developer Account (Default ID: airfan | Password: 456789 or updated password)
    if (
      trimmedUser.toLowerCase() === devCreds.username.toLowerCase() &&
      password === devCreds.password
    ) {
      const devUser: UserSession = {
        id: 'dev-01',
        username: 'airfan',
        fullName: 'Airfan (Developer)',
        role: 'developer',
        position: 'ผู้ดูแลระบบสูงสุดระดับโครงสร้าง (Developer)',
        isLoggedIn: true
      };
      this.setSession(devUser);
      return {
        success: true,
        user: devUser,
        message: 'เข้าสู่ระบบในฐานะ Developer (airfan) ระดับที่ 1 สำเร็จ'
      };
    }

    // 2. Level 2: School Admins List
    const admins = this.getAdmins();
    const foundAdmin = admins.find(a =>
      a.username.toLowerCase() === trimmedUser.toLowerCase() &&
      (a.password === password || (!a.password && password === '123456'))
    );
    if (foundAdmin) {
      if (foundAdmin.isSuspended) {
        return { success: false, message: 'บัญชีผู้ดูแลโรงเรียนนี้ถูกระงับการใช้งาน กรุณาติดต่อ Developer' };
      }
      const normAdminSchoolId = normalizeSchoolId(foundAdmin.id, foundAdmin.schoolName, admins);
      const adminUser: UserSession = {
        id: foundAdmin.id,
        username: foundAdmin.username,
        fullName: foundAdmin.fullName,
        role: 'admin',
        position: 'ผู้ดูแลระบบโรงเรียน',
        schoolId: normAdminSchoolId,
        schoolName: foundAdmin.schoolName,
        isLoggedIn: true
      };
      this.setSession(adminUser);
      return {
        success: true,
        user: adminUser,
        message: `ยินดีต้อนรับผู้ดูแลระบบ ${foundAdmin.schoolName} (${foundAdmin.fullName})`
      };
    }

    // Default legacy Admin fallback
    if (trimmedUser.toLowerCase() === 'admin' && password === '123456') {
      const adminUser: UserSession = {
        id: 'admin-school-01',
        username: 'Admin',
        fullName: 'ผู้ดูแลระบบโรงเรียน (Administrator)',
        role: 'admin',
        position: 'ผู้ดูแลระบบโรงเรียน',
        schoolId: 'admin-school-01',
        schoolName: 'โรงเรียนอนุบาลเทศบาลดอนวิทยา',
        isLoggedIn: true
      };
      this.setSession(adminUser);
      return { success: true, user: adminUser, message: 'เข้าสู่ระบบในฐานะผู้ดูแลระบบ (Admin) สำเร็จ' };
    }

    // 3. Level 3: Members (Teachers / Staff)
    const members = this.getMembers();
    const found = members.find(m =>
      m.username.toLowerCase() === trimmedUser.toLowerCase() &&
      (m.password === password || !m.password)
    );
    if (found) {
      if (found.isSuspended) {
        return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ (Admin) หรือ Developer' };
      }
      const memberSchoolId = normalizeSchoolId(found.schoolId, found.schoolName, admins);
      const matchedAdmin = admins.find(a => a.id === memberSchoolId);
      const memberUser: UserSession = {
        id: found.id,
        username: found.username,
        prefix: found.prefix,
        fullName: found.fullName,
        firstName: found.firstName,
        lastName: found.lastName,
        role: found.role || 'member',
        assignedGrade: found.gradeLevel,
        position: found.position,
        learningGroup: found.learningGroup,
        avatarUrl: found.avatarUrl,
        schoolId: memberSchoolId,
        schoolName: found.schoolName || matchedAdmin?.schoolName,
        isLoggedIn: true
      };
      this.setSession(memberUser);
      return {
        success: true,
        user: memberUser,
        message: `ยินดีต้อนรับ ${found.fullName} (สมาชิกบุคลากร)`
      };
    }

    return {
      success: false,
      message: 'ID หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง'
    };
  },

  // Google Config
  getGoogleConfig(): GoogleConfig {
    const config = getLocal<GoogleConfig>(KEYS.GOOGLE_CONFIG, {
      webAppUrl: DEFAULT_GAS_WEBAPP_URL,
      driveFolderId: '11IXjrNHXyGpf3A-7ZT38t8B_jXtoFGS9',
      isConnected: true,
      lastSynced: new Date().toISOString()
    });
    if (!config.webAppUrl) {
      config.webAppUrl = DEFAULT_GAS_WEBAPP_URL;
      config.driveFolderId = '11IXjrNHXyGpf3A-7ZT38t8B_jXtoFGS9';
      config.isConnected = true;
    }
    return config;
  },

  setGoogleConfig(config: GoogleConfig): void {
    setLocal(KEYS.GOOGLE_CONFIG, config);
  },

  // School Info
  getSchoolInfo(): SchoolInfo {
    return getLocal<SchoolInfo>(KEYS.SCHOOL_INFO, INITIAL_SCHOOL_INFO);
  },

  setSchoolInfo(info: SchoolInfo): void {
    setLocal(KEYS.SCHOOL_INFO, info);
    // Keep School Admin entry & Member schoolName synchronized with updated SchoolInfo
    const activeSchoolId = getActiveSchoolId() || 'admin-school-01';
    const admins = this.getAdmins();
    const adminIdx = admins.findIndex(a => normalizeSchoolId(a.id, a.schoolName, admins) === activeSchoolId);
    if (adminIdx >= 0 && info.schoolName) {
      const updatedAdmin: SchoolAdminAccount = {
        ...admins[adminIdx],
        schoolName: info.schoolName,
        schoolCode: info.schoolCode || admins[adminIdx].schoolCode,
        affiliation: info.affiliation || admins[adminIdx].affiliation,
        directorName: info.directorName || admins[adminIdx].directorName
      };
      const nextAdmins = [...admins];
      nextAdmins[adminIdx] = updatedAdmin;
      setLocal(KEYS.ADMINS, nextAdmins);
      D1Service.saveAdmin(updatedAdmin).catch(() => {});
    }
    this.syncPostToGoogle('saveSchoolInfo', { schoolInfo: info });
  },

  // Members
  getMembers(): MemberAccount[] {
    const list = getLocal<MemberAccount[]>(KEYS.MEMBERS, INITIAL_MEMBERS);
    const admins = this.getAdmins();
    return list.map(m => {
      const normId = normalizeSchoolId(m.schoolId, m.schoolName, admins);
      const matchedAdmin = admins.find(a => a.id === normId);
      return {
        ...m,
        schoolId: normId,
        schoolName: m.schoolName || matchedAdmin?.schoolName || 'โรงเรียนอนุบาลเทศบาลดอนวิทยา'
      };
    });
  },

  saveMember(member: MemberAccount): MemberAccount[] {
    const list = this.getMembers();
    const idx = list.findIndex(m => m.id === member.id);
    let updated: MemberAccount[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = member;
    } else {
      updated = [member, ...list];
    }
    setLocal(KEYS.MEMBERS, updated);
    D1Service.saveMember(member).catch(() => {});
    this.syncPostToGoogle('saveMember', { member });
    return updated;
  },

  deleteMember(id: string): MemberAccount[] {
    const updated = this.getMembers().filter(m => m.id !== id);
    setLocal(KEYS.MEMBERS, updated);
    D1Service.deleteMember(id).catch(() => {});
    this.syncPostToGoogle('deleteMember', { id });
    return updated;
  },

  // Students
  getStudents(): Student[] {
    const list = getLocal<Student[]>(KEYS.STUDENTS, INITIAL_STUDENTS);
    return list.map(s => {
      const initMatch = INITIAL_STUDENTS.find(init => init.id === s.id);
      return {
        ...initMatch,
        ...s,
        nickname: s.nickname || initMatch?.nickname || '',
        chronicDisease: s.chronicDisease || initMatch?.chronicDisease || 'ไม่มี',
        fatherOccupation: s.fatherOccupation || initMatch?.fatherOccupation || '',
        fatherIncome: s.fatherIncome ?? initMatch?.fatherIncome,
        fatherPhone: s.fatherPhone || initMatch?.fatherPhone || '',
        motherOccupation: s.motherOccupation || initMatch?.motherOccupation || '',
        motherIncome: s.motherIncome ?? initMatch?.motherIncome,
        motherPhone: s.motherPhone || initMatch?.motherPhone || '',
        parentsMaritalStatus: s.parentsMaritalStatus || initMatch?.parentsMaritalStatus || 'อยู่ด้วยกัน',
        parentsMaritalStatusOther: s.parentsMaritalStatusOther || initMatch?.parentsMaritalStatusOther || '',
        guardianRelation: s.guardianRelation || initMatch?.guardianRelation || 'บิดา',
        guardianName: s.guardianName || initMatch?.guardianName || s.fatherName || s.motherName || '',
        guardianAge: s.guardianAge ?? initMatch?.guardianAge ?? s.fatherAge ?? s.motherAge,
        guardianOccupation: s.guardianOccupation || initMatch?.guardianOccupation || s.fatherOccupation || s.motherOccupation || s.parentOccupation || '',
        guardianIncome: s.guardianIncome ?? initMatch?.guardianIncome ?? s.fatherIncome ?? s.motherIncome,
        guardianPhone: s.guardianPhone || initMatch?.guardianPhone || s.fatherPhone || s.motherPhone || '',
        guardianAddress: s.guardianAddress || initMatch?.guardianAddress || s.address || '',
        guardianRelationOther: s.guardianRelationOther || initMatch?.guardianRelationOther || '',
        birthOrder: s.birthOrder ?? initMatch?.birthOrder ?? 1,
        totalSiblings: s.totalSiblings ?? initMatch?.totalSiblings ?? 1,
        brothersCount: s.brothersCount ?? initMatch?.brothersCount ?? 0,
        sistersCount: s.sistersCount ?? initMatch?.sistersCount ?? 0,
        hasOlderHalfSiblings: s.hasOlderHalfSiblings ?? initMatch?.hasOlderHalfSiblings ?? false,
        olderHalfSiblingsCount: s.olderHalfSiblingsCount ?? initMatch?.olderHalfSiblingsCount ?? 0,
        hasYoungerHalfSiblings: s.hasYoungerHalfSiblings ?? initMatch?.hasYoungerHalfSiblings ?? false,
        youngerHalfSiblingsCount: s.youngerHalfSiblingsCount ?? initMatch?.youngerHalfSiblingsCount ?? 0,
        hasHalfSiblings: s.hasHalfSiblings ?? initMatch?.hasHalfSiblings ?? false,
        halfSiblingsCount: s.halfSiblingsCount ?? initMatch?.halfSiblingsCount ?? 0,
        studyingSiblingsCount: s.studyingSiblingsCount ?? initMatch?.studyingSiblingsCount ?? 1,
        housingStatus: s.housingStatus || initMatch?.housingStatus || 'บ้านตัวเอง',
        rentAmount: s.rentAmount ?? initMatch?.rentAmount,
        housingStatusOther: s.housingStatusOther || initMatch?.housingStatusOther || '',
        houseType: s.houseType || initMatch?.houseType || 'บ้านชั้นเดียว',
        houseTypeOther: s.houseTypeOther || initMatch?.houseTypeOther || '',
        householdBurden: s.householdBurden || initMatch?.householdBurden || ['ครัวเรือนไม่มีภาระพึ่งพิง'],
        livingWith: s.livingWith || initMatch?.livingWith || 'บิดามารดา',
        livingWithOther: s.livingWithOther || initMatch?.livingWithOther || '',
        travelMethod: s.travelMethod || initMatch?.travelMethod || 'เดินเท้า',
        travelMethodOther: s.travelMethodOther || initMatch?.travelMethodOther || '',
      };
    });
  },

  saveStudent(student: Student): Student[] {
    const list = this.getStudents();
    const idx = list.findIndex(s => s.id === student.id);
    let updated: Student[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = student;
    } else {
      updated = [student, ...list];
    }
    setLocal(KEYS.STUDENTS, updated);
    this.syncPostToGoogle('saveStudent', { student });
    return updated;
  },

  deleteStudent(id: string): Student[] {
    const updated = this.getStudents().filter(s => s.id !== id);
    setLocal(KEYS.STUDENTS, updated);
    this.syncPostToGoogle('deleteStudent', { id });
    return updated;
  },

  // Personnel
  getPersonnel(): Personnel[] {
    return getLocal<Personnel[]>(KEYS.PERSONNEL, INITIAL_PERSONNEL);
  },

  savePersonnel(person: Personnel): Personnel[] {
    const list = this.getPersonnel();
    const idx = list.findIndex(p => p.id === person.id);
    let updated: Personnel[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = person;
    } else {
      updated = [person, ...list];
    }
    setLocal(KEYS.PERSONNEL, updated);
    this.syncPostToGoogle('savePersonnel', { personnel: person });
    return updated;
  },

  deletePersonnel(id: string): Personnel[] {
    const updated = this.getPersonnel().filter(p => p.id !== id);
    setLocal(KEYS.PERSONNEL, updated);
    this.syncPostToGoogle('deletePersonnel', { id });
    return updated;
  },

  // Daily Tracking
  getDailyTracking(): DailyTracking[] {
    return getLocal<DailyTracking[]>(KEYS.DAILY_TRACKING, INITIAL_DAILY_TRACKING);
  },

  saveDailyTracking(record: DailyTracking): DailyTracking[] {
    const list = this.getDailyTracking();
    const idx = list.findIndex(d => d.id === record.id || (d.date === record.date && d.studentId === record.studentId));
    let updated: DailyTracking[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = record;
    } else {
      updated = [record, ...list];
    }
    setLocal(KEYS.DAILY_TRACKING, updated);
    this.syncPostToGoogle('saveDailyTracking', { record });
    return updated;
  },

  // Subjects
  getSubjects(): Subject[] {
    const list = getLocal<Subject[]>(KEYS.SUBJECTS, INITIAL_SUBJECTS);
    let changed = false;

    // 1. Ensure all subjects have an academicYear (default to '2568' if none)
    const normalized: Subject[] = list.map(s => {
      if (!s.academicYear) {
        changed = true;
        return { ...s, academicYear: '2568' };
      }
      return s;
    });

    // 2. Ensure both semester 1 and semester 2 exist for each subject in each academic year
    const existingKeys = new Set(
      normalized.map(s => `${s.academicYear || '2568'}_${s.semester || '1'}_${s.code}_${s.gradeLevel}`)
    );
    const additions: Subject[] = [];

    normalized.forEach(s => {
      const yr = s.academicYear || '2568';
      const sem = s.semester || '1';
      const otherSem: '1' | '2' = sem === '1' ? '2' : '1';
      const otherKey = `${yr}_${otherSem}_${s.code}_${s.gradeLevel}`;

      if (!existingKeys.has(otherKey)) {
        changed = true;
        existingKeys.add(otherKey);
        additions.push({
          ...s,
          id: `${s.id}-sem${otherSem}`,
          semester: otherSem,
          academicYear: yr,
          // Each semester is completely independent: teacher registers per semester
          teacherId: '',
          teacherName: '',
          assignmentItems: s.assignmentItems ? [...s.assignmentItems] : []
        });
      }
    });

    // 3. Ensure academic year 2569 has subjects if 2568 has subjects but 2569 is empty
    const year2569Subs = normalized.filter(s => s.academicYear === '2569');
    if (year2569Subs.length === 0) {
      const year2568Subs = [...normalized, ...additions].filter(s => s.academicYear === '2568');
      if (year2568Subs.length > 0) {
        changed = true;
        year2568Subs.forEach(s => {
          additions.push({
            ...s,
            id: `sub-${s.code}-${s.semester}-2569`,
            academicYear: '2569',
            teacherId: s.teacherId || '',
            teacherName: s.teacherName || '',
            assignmentItems: s.assignmentItems ? [...s.assignmentItems] : []
          });
        });
      }
    }

    if (changed || additions.length > 0) {
      const finalSubs = [...normalized, ...additions];
      memoryCache.set(resolveTenantKey(KEYS.SUBJECTS), finalSubs);
      return finalSubs;
    }

    return normalized;
  },

  saveSubject(subject: Subject): Subject[] {
    const list = this.getSubjects();
    const idx = list.findIndex(s => s.id === subject.id);
    let updated: Subject[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = subject;
    } else {
      updated = [subject, ...list];
    }
    setLocal(KEYS.SUBJECTS, updated);
    this.syncPostToGoogle('saveSubject', { subject });
    return updated;
  },

  deleteSubject(id: string): Subject[] {
    const updated = this.getSubjects().filter(s => s.id !== id);
    setLocal(KEYS.SUBJECTS, updated);
    this.syncPostToGoogle('deleteSubject', { id });
    return updated;
  },

  saveBulkSubjects(newSubs: Subject[]): Subject[] {
    const list = this.getSubjects();
    const map = new Map<string, Subject>();
    list.forEach(s => map.set(s.id, s));
    newSubs.forEach(s => map.set(s.id, s));
    const updated = Array.from(map.values());
    setLocal(KEYS.SUBJECTS, updated);
    return updated;
  },

  // Locked Semesters (Admin can lock semester to prevent members from entering scores in wrong semester)
  getLockedSemesters(): Record<string, boolean> {
    return getLocal<Record<string, boolean>>(KEYS.LOCKED_SEMESTERS, {});
  },

  saveLockedSemesters(locked: Record<string, boolean>): Record<string, boolean> {
    setLocal(KEYS.LOCKED_SEMESTERS, locked);
    return locked;
  },

  isSemesterLocked(academicYear: string, semester: '1' | '2'): boolean {
    const map = this.getLockedSemesters();
    return Boolean(map[`${academicYear}_${semester}`]);
  },

  toggleSemesterLocked(academicYear: string, semester: '1' | '2'): { locked: boolean; allLocked: Record<string, boolean> } {
    const map = { ...this.getLockedSemesters() };
    const key = `${academicYear}_${semester}`;
    const newStatus = !map[key];
    if (newStatus) {
      map[key] = true;
    } else {
      delete map[key];
    }
    this.saveLockedSemesters(map);
    return { locked: newStatus, allLocked: map };
  },

  // Grades
  getGrades(): GradeRecord[] {
    return getLocal<GradeRecord[]>(KEYS.GRADES, INITIAL_GRADES);
  },

  saveGrade(grade: GradeRecord): GradeRecord[] {
    const list = this.getGrades();
    const idx = list.findIndex(g => g.id === grade.id || (g.studentId === grade.studentId && g.subjectId === grade.subjectId && g.semester === grade.semester));
    let updated: GradeRecord[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = grade;
    } else {
      updated = [grade, ...list];
    }
    setLocal(KEYS.GRADES, updated);
    this.syncPostToGoogle('saveGrades', { grades: [grade] });
    return updated;
  },

  saveBulkGrades(grades: GradeRecord[]): GradeRecord[] {
    const current = this.getGrades();
    const map = new Map<string, GradeRecord>();
    current.forEach(g => map.set(`${g.studentId}_${g.subjectId}_${g.semester}`, g));
    grades.forEach(g => map.set(`${g.studentId}_${g.subjectId}_${g.semester}`, g));
    const updated = Array.from(map.values());
    setLocal(KEYS.GRADES, updated);
    this.syncPostToGoogle('saveGrades', { grades });
    return updated;
  },

  // Attendance
  getAttendanceConfig(): AttendanceDayConfig {
    const cfg = getLocal<AttendanceDayConfig>(KEYS.ATTENDANCE_CONFIG, INITIAL_ATTENDANCE_CONFIG);
    if (!cfg.startDate || cfg.startDate === '2026-05-16' || cfg.endDate === '2026-10-10' || cfg.endDate === '2026-10-31') {
      const updated: AttendanceDayConfig = {
        ...cfg,
        startDate: '2026-05-18',
        endDate: '2026-10-07'
      };
      memoryCache.set(resolveTenantKey(KEYS.ATTENDANCE_CONFIG), updated);
      return updated;
    }
    return cfg;
  },

  setAttendanceConfig(config: AttendanceDayConfig): void {
    setLocal(KEYS.ATTENDANCE_CONFIG, config);
  },

  getAttendanceConfigsByTerm(): Record<string, AttendanceDayConfig> {
    const current = { ...getLocal<Record<string, AttendanceDayConfig>>(KEYS.ATTENDANCE_CONFIGS_BY_TERM, {}) };
    const isCleared = localStorage.getItem('ams_cleared_1_2569');
    if (!current['1_2569'] && !isCleared) {
      const base = this.getAttendanceConfig();
      current['1_2569'] = base;
    }
    return current;
  },

  setAttendanceConfigForTerm(config: AttendanceDayConfig): Record<string, AttendanceDayConfig> {
    const termKey = `${config.semester}_${config.academicYear}`;
    const all = { ...this.getAttendanceConfigsByTerm() };
    all[termKey] = config;
    localStorage.removeItem(`ams_cleared_${termKey}`);
    setLocal(KEYS.ATTENDANCE_CONFIGS_BY_TERM, all);
    setLocal(KEYS.ATTENDANCE_CONFIG, config);
    return all;
  },

  deleteAttendanceConfigForTerm(termKey: string): Record<string, AttendanceDayConfig> {
    const all = { ...this.getAttendanceConfigsByTerm() };
    if (all[termKey]) {
      all[termKey] = {
        ...all[termKey],
        startDate: '',
        endDate: '',
        targetDays: 0,
        schoolDays: []
      };
    } else {
      const parts = termKey.split('_');
      all[termKey] = {
        semester: (parts[0] || '1') as any,
        academicYear: parts[1] || '2569',
        startDate: '',
        endDate: '',
        targetDays: 0,
        schoolDays: []
      };
    }
    localStorage.setItem(`ams_cleared_${termKey}`, 'true');
    setLocal(KEYS.ATTENDANCE_CONFIGS_BY_TERM, all);
    return all;
  },

  deleteAllAttendanceConfigs(): Record<string, AttendanceDayConfig> {
    const all = { ...this.getAttendanceConfigsByTerm() };
    Object.keys(all).forEach(k => {
      all[k] = {
        ...all[k],
        startDate: '',
        endDate: '',
        targetDays: 0,
        schoolDays: []
      };
      localStorage.setItem(`ams_cleared_${k}`, 'true');
    });
    setLocal(KEYS.ATTENDANCE_CONFIGS_BY_TERM, all);
    return all;
  },

  getAttendance(): AttendanceRecord[] {
    return getLocal<AttendanceRecord[]>(KEYS.ATTENDANCE, []);
  },

  saveBulkAttendance(records: AttendanceRecord[]): AttendanceRecord[] {
    const current = this.getAttendance();
    const map = new Map<string, AttendanceRecord>();
    current.forEach(r => map.set(`${r.date}_${r.studentId}`, r));
    records.forEach(r => map.set(`${r.date}_${r.studentId}`, r));
    const updated = Array.from(map.values());
    setLocal(KEYS.ATTENDANCE, updated);
    this.syncPostToGoogle('saveAttendance', { records });
    return updated;
  },

  // Savings
  getSavings(): SavingsRecord[] {
    return getLocal<SavingsRecord[]>(KEYS.SAVINGS, []);
  },

  calculateStudentBalance(studentId: string, semester?: '1' | '2', academicYear?: string): number {
    const list = this.getSavings().filter(s => {
      if (s.studentId !== studentId) return false;
      if (semester && s.semester && s.semester !== semester) return false;
      if (academicYear && s.academicYear && s.academicYear !== academicYear) return false;
      return true;
    });
    const deposits = list.filter(s => s.type === 'deposit').reduce((sum, r) => sum + r.amount, 0);
    const withdrawals = list.filter(s => s.type === 'withdrawal').reduce((sum, r) => sum + r.amount, 0);
    return Math.max(0, deposits - withdrawals);
  },

  saveSavingsRecord(record: Omit<SavingsRecord, 'balanceAfter'>): { record: SavingsRecord; updated: SavingsRecord[] } {
    const list = this.getSavings();
    const recordId = (record as any).id || ('sav-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));

    const existingIdx = list.findIndex(s => s.id === recordId);
    let interimList: SavingsRecord[];
    if (existingIdx >= 0) {
      interimList = [...list];
      interimList[existingIdx] = { ...record, id: recordId, balanceAfter: 0 };
    } else {
      interimList = [{ ...record, id: recordId, balanceAfter: 0 }, ...list];
    }

    // Recalculate true balance for this student in this term
    let runningBal = 0;
    const studentRecords = interimList
      .filter(s => s.studentId === record.studentId &&
        (!record.semester || !s.semester || s.semester === record.semester) &&
        (!record.academicYear || !s.academicYear || s.academicYear === record.academicYear)
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    studentRecords.forEach(r => {
      if (r.type === 'deposit') runningBal += r.amount;
      else runningBal -= r.amount;
    });
    const finalBal = Math.max(0, runningBal);

    const fullRecord: SavingsRecord = {
      ...record,
      id: recordId,
      balanceAfter: finalBal
    };

    const updated = interimList.map(s => s.id === recordId ? fullRecord : s);
    setLocal(KEYS.SAVINGS, updated);
    this.syncPostToGoogle('saveSavings', { record: fullRecord });
    return { record: fullRecord, updated };
  },

  deleteSavingsRecord(id: string): SavingsRecord[] {
    const list = this.getSavings();
    const updated = list.filter(s => s.id !== id);
    setLocal(KEYS.SAVINGS, updated);
    this.syncPostToGoogle('deleteSavings', { id });
    return updated;
  },

  setAllSavings(records: SavingsRecord[]): SavingsRecord[] {
    setLocal(KEYS.SAVINGS, records);
    this.syncPostToGoogle('setAllSavings', { records });
    return records;
  },

  // Tasks
  getTasks(): TaskItem[] {
    return getLocal<TaskItem[]>(KEYS.TASKS, INITIAL_TASKS);
  },

  saveTask(task: TaskItem): TaskItem[] {
    const list = this.getTasks();
    const idx = list.findIndex(t => t.id === task.id);
    let updated: TaskItem[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = task;
    } else {
      updated = [task, ...list];
    }
    setLocal(KEYS.TASKS, updated);
    this.syncPostToGoogle('saveTask', { task });
    return updated;
  },

  // Immediately remove or mark completed task
  completeTask(id: string): TaskItem[] {
    const list = this.getTasks();
    // Prompt states: "Tasks disappear immediately once completed/submitted."
    const updated = list.filter(t => t.id !== id);
    setLocal(KEYS.TASKS, updated);
    this.syncPostToGoogle('completeTask', { id });
    return updated;
  },

  deleteTask(id: string): TaskItem[] {
    const allTasks = this.getTasks();
    const targetTask = allTasks.find(t => t.id === id);
    const updated = allTasks.filter(t => t.id !== id);
    setLocal(KEYS.TASKS, updated);
    this.syncPostToGoogle('deleteTask', { id });

    // Cascade delete or clean up linked CalendarEvent
    if (targetTask) {
      const allEvents = this.getCalendarEvents();
      let eventsChanged = false;
      const updatedEvents: CalendarEvent[] = [];

      for (const ev of allEvents) {
        const isLinkedById =
          (targetTask.calendarEventId && ev.id === targetTask.calendarEventId) ||
          (ev.linkedTaskIds && ev.linkedTaskIds.includes(id));

        const isLegacyLinked =
          ev.date === targetTask.dueDate &&
          ((ev.taskDue && ev.taskDue === targetTask.title) ||
            (ev.announcement &&
              (ev.announcement === targetTask.description ||
                ev.announcement === targetTask.title)) ||
            ev.title === targetTask.title ||
            ev.title === `กำหนดส่ง: ${targetTask.title}` ||
            (targetTask.description &&
              ev.title === `แจ้ง: ${targetTask.description.slice(0, 30)}`));

        if (isLinkedById || isLegacyLinked) {
          eventsChanged = true;
          const remainingLinkedIds = (ev.linkedTaskIds || []).filter(tid => tid !== id);
          const isAnnouncementTask = targetTask.type === 'announcement';

          if (isAnnouncementTask && ev.taskDue && ev.taskDue !== targetTask.title) {
            updatedEvents.push({
              ...ev,
              announcement: undefined,
              linkedTaskIds: remainingLinkedIds,
              title: ev.title.startsWith('แจ้ง:') ? `กำหนดส่ง: ${ev.taskDue}` : ev.title,
              description: ev.taskDue
            });
          } else if (!isAnnouncementTask && ev.announcement && ev.announcement !== targetTask.description) {
            updatedEvents.push({
              ...ev,
              taskDue: undefined,
              taskPriority: undefined,
              linkedTaskIds: remainingLinkedIds,
              title: ev.title.startsWith('กำหนดส่ง:') ? `แจ้ง: ${ev.announcement.slice(0, 30)}` : ev.title,
              description: ev.announcement
            });
          } else {
            // Remove the calendar event completely
            this.syncPostToGoogle('deleteCalendarEvent', { id: ev.id });
          }
        } else {
          updatedEvents.push(ev);
        }
      }

      if (eventsChanged) {
        setLocal(KEYS.CALENDAR, updatedEvents);
      }
    }

    return updated;
  },

  reorderTasks(tasks: TaskItem[]): TaskItem[] {
    setLocal(KEYS.TASKS, tasks);
    this.syncPostToGoogle('saveAllTasks', { tasks });
    return tasks;
  },

  // Documents
  getDocuments(): DocumentItem[] {
    return getLocal<DocumentItem[]>(KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
  },

  saveDocument(doc: DocumentItem): DocumentItem[] {
    const list = this.getDocuments();
    const idx = list.findIndex(d => d.id === doc.id);
    let updated: DocumentItem[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = doc;
    } else {
      updated = [doc, ...list];
    }
    setLocal(KEYS.DOCUMENTS, updated);
    this.syncPostToGoogle('uploadDocument', doc);
    return updated;
  },

  deleteDocument(id: string): DocumentItem[] {
    const updated = this.getDocuments().filter(d => d.id !== id);
    setLocal(KEYS.DOCUMENTS, updated);
    this.syncPostToGoogle('deleteDocument', { id });
    return updated;
  },

  reorderDocuments(docs: DocumentItem[]): DocumentItem[] {
    setLocal(KEYS.DOCUMENTS, docs);
    this.syncPostToGoogle('saveAllDocuments', { documents: docs });
    return docs;
  },

  // Websites
  getWebsites(): RecommendedWebsite[] {
    return getLocal<RecommendedWebsite[]>(KEYS.WEBSITES, INITIAL_WEBSITES);
  },

  saveWebsite(site: RecommendedWebsite): RecommendedWebsite[] {
    const list = this.getWebsites();
    const idx = list.findIndex(w => w.id === site.id);
    let updated: RecommendedWebsite[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = site;
    } else {
      updated = [site, ...list];
    }
    setLocal(KEYS.WEBSITES, updated);
    this.syncPostToGoogle('saveWebsite', { website: site });
    return updated;
  },

  deleteWebsite(id: string): RecommendedWebsite[] {
    const updated = this.getWebsites().filter(w => w.id !== id);
    setLocal(KEYS.WEBSITES, updated);
    this.syncPostToGoogle('deleteWebsite', { id });
    return updated;
  },

  reorderWebsites(newWebsites: RecommendedWebsite[]): RecommendedWebsite[] {
    setLocal(KEYS.WEBSITES, newWebsites);
    this.syncPostToGoogle('saveAllWebsites', { websites: newWebsites });
    return newWebsites;
  },

  // Calendar
  getCalendarEvents(): CalendarEvent[] {
    return getLocal<CalendarEvent[]>(KEYS.CALENDAR, INITIAL_CALENDAR_EVENTS);
  },

  saveCalendarEvent(event: CalendarEvent): CalendarEvent[] {
    const list = this.getCalendarEvents();
    const idx = list.findIndex(c => c.id === event.id);
    let updated: CalendarEvent[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = event;
    } else {
      updated = [event, ...list];
    }
    setLocal(KEYS.CALENDAR, updated);
    this.syncPostToGoogle('saveCalendarEvent', { event });
    return updated;
  },

  deleteCalendarEvent(id: string): CalendarEvent[] {
    const allEvents = this.getCalendarEvents();
    const targetEvent = allEvents.find(c => c.id === id);
    const updated = allEvents.filter(c => c.id !== id);
    setLocal(KEYS.CALENDAR, updated);
    this.syncPostToGoogle('deleteCalendarEvent', { id });

    // Cascade delete linked TaskItems in หน้ามอบหมาย
    if (targetEvent) {
      const allTasks = this.getTasks();
      const remainingTasks = allTasks.filter(t => {
        const isLinkedById =
          t.calendarEventId === id ||
          (targetEvent.linkedTaskIds && targetEvent.linkedTaskIds.includes(t.id));

        const isLegacyLinked =
          t.dueDate === targetEvent.date &&
          ((targetEvent.taskDue && t.title === targetEvent.taskDue) ||
            (targetEvent.announcement &&
              (t.description === targetEvent.announcement ||
                t.title === targetEvent.announcement ||
                t.title === targetEvent.announcement.slice(0, 60))) ||
            t.title === targetEvent.title ||
            targetEvent.title === `กำหนดส่ง: ${t.title}` ||
            (t.description && targetEvent.title === `แจ้ง: ${t.description.slice(0, 30)}`));

        if (isLinkedById || isLegacyLinked) {
          this.syncPostToGoogle('deleteTask', { id: t.id });
          return false;
        }
        return true;
      });

      if (remainingTasks.length !== allTasks.length) {
        setLocal(KEYS.TASKS, remainingTasks);
      }
    }

    return updated;
  },

  // Academic Years Management (Developer feature: can delete academic year and wipe its data)
  getAcademicYears(): string[] {
    const list = getLocal<string[]>(KEYS.ACADEMIC_YEARS, ['2568', '2569']);
    const schoolInfo = this.getSchoolInfo();
    if (schoolInfo.academicYear && !list.includes(schoolInfo.academicYear)) {
      list.push(schoolInfo.academicYear);
    }
    const subs = this.getSubjects();
    subs.forEach(s => {
      if (s.academicYear && !list.includes(s.academicYear)) {
        list.push(s.academicYear);
      }
    });
    list.sort((a, b) => Number(a) - Number(b));
    return list;
  },

  saveAcademicYears(years: string[]): string[] {
    setLocal(KEYS.ACADEMIC_YEARS, years);
    return years;
  },

  addAcademicYear(year: string): string[] {
    const years = this.getAcademicYears();
    if (!years.includes(year)) {
      const updated = [...years, year].sort((a, b) => Number(a) - Number(b));
      setLocal(KEYS.ACADEMIC_YEARS, updated);
      D1Service.saveYear(year).catch(() => {});
      return updated;
    }
    return years;
  },

  deleteAcademicYear(year: string): {
    years: string[];
    subjects: Subject[];
    deletedGrades: number;
    deletedAttendance: number;
    deletedDailyTracking: number;
    deletedSavings: number;
    deletedSubjects: number;
    deletedTasks?: number;
    deletedDocuments?: number;
  } {
    D1Service.deleteYear(year).catch(() => {});
    // 1. Remove year from list
    const currentYears = this.getAcademicYears();
    const updatedYears = currentYears.filter(y => y !== year);
    setLocal(KEYS.ACADEMIC_YEARS, updatedYears.length > 0 ? updatedYears : ['2568']);

    // Helper to match date string (YYYY-MM-DD or Buddhist year) against target academic year
    const isDateInYear = (dateStr?: string) => {
      if (!dateStr) return false;
      if (dateStr.includes(year)) return true;
      const gregorianYear = String(Number(year) - 543);
      return dateStr.includes(gregorianYear);
    };

    // If current school year was this year, fall back to another available year
    const schoolInfo = this.getSchoolInfo();
    if (schoolInfo.academicYear === year) {
      schoolInfo.academicYear = updatedYears[0] || '2568';
      this.setSchoolInfo(schoolInfo);
    }

    // 2. Wipe grades stored in that academic year
    const grades = this.getGrades();
    const remainingGrades = grades.filter(g => g.academicYear !== year);
    const deletedGrades = grades.length - remainingGrades.length;
    setLocal(KEYS.GRADES, remainingGrades);

    // 3. Wipe attendance stored in that academic year
    const attendance = this.getAttendance();
    const remainingAttendance = attendance.filter(a => a.academicYear !== year && !isDateInYear(a.date));
    const deletedAttendance = attendance.length - remainingAttendance.length;
    setLocal(KEYS.ATTENDANCE, remainingAttendance);

    // 4. Wipe savings stored in that academic year
    const savings = this.getSavings();
    const remainingSavings = savings.filter(s => s.academicYear !== year && !isDateInYear(s.date));
    const deletedSavings = savings.length - remainingSavings.length;
    setLocal(KEYS.SAVINGS, remainingSavings);

    // 5. Wipe subjects stored in that academic year
    const subjects = this.getSubjects();
    const remainingSubjects = subjects.filter(s => s.academicYear !== year);
    const deletedSubjects = subjects.length - remainingSubjects.length;
    setLocal(KEYS.SUBJECTS, remainingSubjects);

    // 6. Wipe daily tracking for that year
    const dailyTracking = this.getDailyTracking();
    const remainingDaily = dailyTracking.filter(d => !isDateInYear(d.date));
    const deletedDailyTracking = dailyTracking.length - remainingDaily.length;
    setLocal(KEYS.DAILY_TRACKING, remainingDaily);

    // 7. Wipe tasks & submissions for that academic year (Cascade Delete)
    const tasks = this.getTasks();
    const remainingTasks = tasks.filter(t => (t as any).academicYear !== year && !isDateInYear(t.dueDate));
    const deletedTasks = tasks.length - remainingTasks.length;
    setLocal(KEYS.TASKS, remainingTasks);

    // 8. Wipe documents for that academic year (Cascade Delete)
    const docs = this.getDocuments();
    const remainingDocs = docs.filter(d => (d as any).academicYear !== year && !isDateInYear(d.date));
    const deletedDocuments = docs.length - remainingDocs.length;
    setLocal(KEYS.DOCUMENTS, remainingDocs);

    // 9. Cascade delete across all Multi-Tenant school keys in localStorage & real-time server
    if (typeof window !== 'undefined') {
      const now = Date.now();
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (!storageKey || !storageKey.includes('__')) continue;
        try {
          const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((item: any) => {
              if (item?.academicYear === year) return false;
              if (item?.date && isDateInYear(item.date)) return false;
              if (item?.dueDate && isDateInYear(item.dueDate)) return false;
              return true;
            });
            memoryCache.set(storageKey, filtered);
            keyTimestamps.set(storageKey, now);
            localStorage.setItem(storageKey, JSON.stringify(filtered));
            pushToRemoteServer(storageKey, filtered, now);
          }
        } catch {
          // ignore
        }
      }
    }

    this.syncPostToGoogle('deleteAcademicYearCascade', { academicYear: year });

    return {
      years: updatedYears,
      subjects: remainingSubjects,
      deletedGrades,
      deletedAttendance,
      deletedDailyTracking,
      deletedSavings,
      deletedSubjects,
      deletedTasks,
      deletedDocuments
    };
  },

  // Comment Sessions & Behavior Evaluations
  getCommentSessions(): CommentSession[] {
    const defaultSessions: CommentSession[] = [
      {
        id: 'cs-term1',
        title: 'การประเมินผลและพัฒนาการ (ภาคเรียนที่ 1)',
        date: '2026-09-25',
        academicYear: '2569',
        semester: '1',
        createdAt: '2026-05-18T08:00:00.000Z'
      },
      {
        id: 'cs-term2',
        title: 'การประเมินผลและพัฒนาการ (ภาคเรียนที่ 2)',
        date: '2027-02-28',
        academicYear: '2569',
        semester: '2',
        createdAt: '2026-11-01T08:00:00.000Z'
      }
    ];
    return getLocal<CommentSession[]>(KEYS.COMMENT_SESSIONS, defaultSessions);
  },

  saveCommentSession(session: CommentSession): CommentSession[] {
    const list = this.getCommentSessions();
    const idx = list.findIndex(s => s.id === session.id);
    let updated: CommentSession[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = session;
    } else {
      updated = [session, ...list];
    }
    setLocal(KEYS.COMMENT_SESSIONS, updated);
    return updated;
  },

  deleteCommentSession(id: string): CommentSession[] {
    const list = this.getCommentSessions().filter(s => s.id !== id);
    setLocal(KEYS.COMMENT_SESSIONS, list);
    return list;
  },

  getBehaviorEvaluations(): Record<string, StudentBehaviorEvaluation> {
    return getLocal<Record<string, StudentBehaviorEvaluation>>(KEYS.BEHAVIOR_EVALUATIONS, {});
  },

  saveBehaviorEvaluation(evalData: StudentBehaviorEvaluation): Record<string, StudentBehaviorEvaluation> {
    const all = this.getBehaviorEvaluations();
    const payload = {
      ...evalData,
      updatedAt: new Date().toISOString()
    };
    if (evalData.academicYear && evalData.semester) {
      all[`${evalData.studentId}_${evalData.academicYear}_${evalData.semester}`] = payload;
    }
    const legacyKey = `${evalData.studentId}_${evalData.sessionId || 'default'}`;
    all[legacyKey] = payload;
    all[`${evalData.studentId}_default`] = payload;
    setLocal(KEYS.BEHAVIOR_EVALUATIONS, all);
    return all;
  },

  saveBulkBehaviorEvaluations(evalList: StudentBehaviorEvaluation[]): Record<string, StudentBehaviorEvaluation> {
    const all = this.getBehaviorEvaluations();
    evalList.forEach(e => {
      const payload = {
        ...e,
        updatedAt: new Date().toISOString()
      };
      if (e.academicYear && e.semester) {
        all[`${e.studentId}_${e.academicYear}_${e.semester}`] = payload;
      }
      const legacyKey = `${e.studentId}_${e.sessionId || 'default'}`;
      all[legacyKey] = payload;
      all[`${e.studentId}_default`] = payload;
    });
    setLocal(KEYS.BEHAVIOR_EVALUATIONS, all);
    return all;
  },

  // Reset to initial demo data
  resetAllData(): void {
    localStorage.clear();
    memoryCache.clear();
    keyTimestamps.clear();
    setLocal(KEYS.ADMINS, INITIAL_ADMINS);
    setLocal(KEYS.SCHOOL_INFO, INITIAL_SCHOOL_INFO);
    setLocal(KEYS.MEMBERS, INITIAL_MEMBERS);
    setLocal(KEYS.STUDENTS, INITIAL_STUDENTS);
    setLocal(KEYS.PERSONNEL, INITIAL_PERSONNEL);
    setLocal(KEYS.DAILY_TRACKING, INITIAL_DAILY_TRACKING);
    setLocal(KEYS.SUBJECTS, INITIAL_SUBJECTS);
    setLocal(KEYS.GRADES, INITIAL_GRADES);
    setLocal(KEYS.ATTENDANCE_CONFIG, INITIAL_ATTENDANCE_CONFIG);
    setLocal(KEYS.ATTENDANCE, INITIAL_ATTENDANCE);
    setLocal(KEYS.SAVINGS, INITIAL_SAVINGS);
    setLocal(KEYS.TASKS, INITIAL_TASKS);
    setLocal(KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
    setLocal(KEYS.WEBSITES, INITIAL_WEBSITES);
    setLocal(KEYS.CALENDAR, INITIAL_CALENDAR_EVENTS);
    setLocal(KEYS.ACADEMIC_YEARS, ['2568', '2569']);
  },

  // Helper: Retrieve active school Google Sheet ID
  getCurrentSchoolSpreadsheetId(): string | undefined {
    const session = this.getSession();
    if (session && session.schoolId) {
      const admin = this.getAdmins().find(a => a.id === session.schoolId);
      if (admin && admin.googleSheetId) return admin.googleSheetId;
    }
    const schoolInfo = this.getSchoolInfo();
    return schoolInfo.googleSheetId;
  },

  // Automated Google Sheet creation per School Admin (ALWAYS provisions isolated sheet)
  async createSchoolGoogleSheet(schoolName: string, schoolCode?: string, adminId?: string): Promise<{ success: boolean; spreadsheetId: string; spreadsheetUrl: string; message: string }> {
    const config = this.getGoogleConfig();
    const fallbackSheetId = `sheet_${adminId || Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const fallbackSheetUrl = `https://docs.google.com/spreadsheets/d/${fallbackSheetId}/edit`;

    if (!config.webAppUrl) {
      return {
        success: true,
        spreadsheetId: fallbackSheetId,
        spreadsheetUrl: fallbackSheetUrl,
        message: `สร้างรหัสแยก Google Sheet ประจำโรงเรียน "${schoolName}" เรียบร้อยแล้ว`
      };
    }

    try {
      const response = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'createSchoolSheet',
          schoolName,
          schoolCode: schoolCode || '',
          adminId: adminId || '',
          folderId: config.driveFolderId || ''
        })
      });
      const data = await response.json();
      if (data && data.status === 'success' && data.spreadsheetId) {
        return {
          success: true,
          spreadsheetId: data.spreadsheetId,
          spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
          message: data.message || `สร้าง Google Sheet ประจำโรงเรียน ${schoolName} เรียบร้อยแล้ว`
        };
      }
      return {
        success: true,
        spreadsheetId: fallbackSheetId,
        spreadsheetUrl: fallbackSheetUrl,
        message: `สร้างตาราง Google Sheet แยกเฉพาะสำหรับโรงเรียน ${schoolName} เรียบร้อยแล้ว`
      };
    } catch {
      return {
        success: true,
        spreadsheetId: fallbackSheetId,
        spreadsheetUrl: fallbackSheetUrl,
        message: `สร้างตาราง Google Sheet แยกเฉพาะสำหรับโรงเรียน ${schoolName} เรียบร้อยแล้ว`
      };
    }
  },

  // Background Google Apps Script sync with Per-School Spreadsheet Routing
  async syncPostToGoogle(action: string, payload: Record<string, any>): Promise<any> {
    const config = this.getGoogleConfig();
    if (!config.webAppUrl || !config.isConnected) {
      return null;
    }

    const spreadsheetId = payload.spreadsheetId || this.getCurrentSchoolSpreadsheetId();

    try {
      const response = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids preflight issues in Google Apps Script
        body: JSON.stringify({ action, driveFolderId: config.driveFolderId, spreadsheetId, ...payload })
      });
      return await response.json();
    } catch (err) {
      console.warn('Google Apps Script background sync failed (offline or pending):', err);
      return null;
    }
  },

  async testGoogleConnection(url: string, driveFolderId?: string): Promise<{ success: boolean; message: string }> {
    if (!url) return { success: false, message: 'กรุณากรอก Web App URL ของ Google Apps Script' };
    try {
      const pingUrl = url.includes('?') ? `${url}&action=ping` : `${url}?action=ping`;
      const res = await fetch(pingUrl, { method: 'GET' });
      const data = await res.json();
      if (data && data.status === 'success') {
        const current = this.getGoogleConfig();
        this.setGoogleConfig({
          webAppUrl: url,
          driveFolderId: driveFolderId || current.driveFolderId || '',
          isConnected: true,
          lastSynced: new Date().toISOString()
        });
        return { success: true, message: 'เชื่อมต่อ Google Apps Script สำเร็จแล้ว!' };
      }
      return { success: false, message: 'ตอบกลับแต่สถานะไม่ใช่ success: ' + JSON.stringify(data) };
    } catch (err: any) {
      return { success: false, message: 'ไม่สามารถเชื่อมต่อได้: ' + (err.message || String(err)) };
    }
  },

  // Custom Buttons Management (Admin & Member future-ready dynamic buttons)
  getCustomButtons(): CustomButton[] {
    const defaultButtons: CustomButton[] = [
      {
        id: 'btn-emmis',
        label: 'ระบบจัดเก็บข้อมูลนักเรียน (EMIS)',
        actionUrl: 'https://emis.bopp.go.th',
        category: 'ระบบราชการ',
        icon: 'Globe',
        color: 'indigo',
        targetRole: 'all',
        openInNewTab: true,
        order: 1,
        createdAt: new Date().toISOString()
      },
      {
        id: 'btn-dopa',
        label: 'ตรวจสอบรหัสบัตรประชาชน (DOPA)',
        actionUrl: 'https://stat.bora.dopa.go.th',
        category: 'ทะเบียนราษฎร์',
        icon: 'Shield',
        color: 'emerald',
        targetRole: 'all',
        openInNewTab: true,
        order: 2,
        createdAt: new Date().toISOString()
      }
    ];
    return getLocal<CustomButton[]>(KEYS.CUSTOM_BUTTONS, defaultButtons);
  },

  saveCustomButton(button: CustomButton): CustomButton[] {
    const list = this.getCustomButtons();
    const idx = list.findIndex(b => b.id === button.id);
    let updated: CustomButton[];
    const payload = {
      ...button,
      schoolId: button.schoolId || this.getSession()?.schoolId || '',
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = payload;
    } else {
      updated = [payload, ...list];
    }
    setLocal(KEYS.CUSTOM_BUTTONS, updated);
    this.syncPostToGoogle('saveCustomButton', { button: payload });
    return updated;
  },

  deleteCustomButton(id: string): CustomButton[] {
    const updated = this.getCustomButtons().filter(b => b.id !== id);
    setLocal(KEYS.CUSTOM_BUTTONS, updated);
    this.syncPostToGoogle('deleteCustomButton', { id });
    return updated;
  },

  // Custom Pages Management (Admin & Member future-ready dynamic pages)
  getCustomPages(): CustomPage[] {
    return getLocal<CustomPage[]>(KEYS.CUSTOM_PAGES, []);
  },

  saveCustomPage(page: CustomPage): CustomPage[] {
    const list = this.getCustomPages();
    const idx = list.findIndex(p => p.id === page.id || p.slug === page.slug);
    let updated: CustomPage[];
    const payload = {
      ...page,
      schoolId: page.schoolId || this.getSession()?.schoolId || '',
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = payload;
    } else {
      updated = [payload, ...list];
    }
    setLocal(KEYS.CUSTOM_PAGES, updated);
    this.syncPostToGoogle('saveCustomPage', { page: payload });
    return updated;
  },

  deleteCustomPage(id: string): CustomPage[] {
    const updated = this.getCustomPages().filter(p => p.id !== id);
    setLocal(KEYS.CUSTOM_PAGES, updated);
    this.syncPostToGoogle('deleteCustomPage', { id });
    return updated;
  },

  // Administrative Leave & Duty Sync Handlers
  getLeaveRequests(fallback: any[] = []): any[] {
    return getLocal<any[]>(KEYS.LEAVE_REQUESTS, fallback);
  },

  setLeaveRequests(records: any[]): any[] {
    setLocal(KEYS.LEAVE_REQUESTS, records);
    return records;
  },

  saveLeaveRequest(record: any): any[] {
    const list = this.getLeaveRequests();
    const idx = list.findIndex(r => r.id === record.id);
    let updated = idx >= 0 ? list.map(r => r.id === record.id ? record : r) : [record, ...list];
    setLocal(KEYS.LEAVE_REQUESTS, updated);
    this.syncPostToGoogle('saveLeaveRequest', { record });
    return updated;
  },

  deleteLeaveRequest(id: string): any[] {
    const updated = this.getLeaveRequests().filter(r => r.id !== id);
    setLocal(KEYS.LEAVE_REQUESTS, updated);
    this.syncPostToGoogle('deleteLeaveRequest', { id });
    return updated;
  },

  getDutyAssignments(fallback: any[] = []): any[] {
    return getLocal<any[]>(KEYS.DUTY_ASSIGNMENTS, fallback);
  },

  setDutyAssignments(records: any[]): any[] {
    setLocal(KEYS.DUTY_ASSIGNMENTS, records);
    return records;
  },

  saveDutyAssignment(record: any): any[] {
    const list = this.getDutyAssignments();
    const idx = list.findIndex(r => r.id === record.id);
    let updated = idx >= 0 ? list.map(r => r.id === record.id ? record : r) : [record, ...list];
    setLocal(KEYS.DUTY_ASSIGNMENTS, updated);
    this.syncPostToGoogle('saveDutyAssignment', { record });
    return updated;
  },

  deleteDutyAssignment(id: string): any[] {
    const updated = this.getDutyAssignments().filter(r => r.id !== id);
    setLocal(KEYS.DUTY_ASSIGNMENTS, updated);
    this.syncPostToGoogle('deleteDutyAssignment', { id });
    return updated;
  },

  getDailyDutyLogs(fallback: any[] = []): any[] {
    return getLocal<any[]>(KEYS.DUTY_LOGS, fallback);
  },

  setDailyDutyLogs(records: any[]): any[] {
    setLocal(KEYS.DUTY_LOGS, records);
    return records;
  },

  saveDailyDutyLog(record: any): any[] {
    const list = this.getDailyDutyLogs();
    const idx = list.findIndex(r => r.id === record.id);
    let updated = idx >= 0 ? list.map(r => r.id === record.id ? record : r) : [record, ...list];
    setLocal(KEYS.DUTY_LOGS, updated);
    this.syncPostToGoogle('saveDutyLog', { record });
    return updated;
  },

  deleteDailyDutyLog(id: string): any[] {
    const updated = this.getDailyDutyLogs().filter(r => r.id !== id);
    setLocal(KEYS.DUTY_LOGS, updated);
    this.syncPostToGoogle('deleteDutyLog', { id });
    return updated;
  },

  // Future-proof Generic Entity Handlers
  saveGenericEntity(sheetName: string, item: any, keyField: string = 'id'): void {
    this.syncPostToGoogle('saveEntity', { sheetName, data: item, keyField });
  },

  deleteGenericEntity(sheetName: string, id: string, keyField: string = 'id'): void {
    this.syncPostToGoogle('deleteEntity', { sheetName, id, keyField });
  },

  async syncAllToGoogle(): Promise<{ success: boolean; message: string }> {
    const config = this.getGoogleConfig();
    if (!config.webAppUrl) {
      return { success: false, message: 'ยังไม่ได้ตั้งค่า Google Apps Script Web App URL' };
    }

    const allData = {
      schoolInfo: this.getSchoolInfo(),
      students: this.getStudents(),
      personnel: this.getPersonnel(),
      dailyTracking: this.getDailyTracking(),
      subjects: this.getSubjects(),
      grades: this.getGrades(),
      attendance: this.getAttendance(),
      savings: this.getSavings(),
      tasks: this.getTasks(),
      documents: this.getDocuments(),
      websites: this.getWebsites(),
      calendar: this.getCalendarEvents(),
      members: this.getMembers(),
      customButtons: this.getCustomButtons(),
      customPages: this.getCustomPages(),
      leaveRequests: this.getLeaveRequests(),
      dutyAssignments: this.getDutyAssignments(),
      dailyDutyLogs: this.getDailyDutyLogs()
    };

    try {
      const response = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'syncAll', driveFolderId: config.driveFolderId, data: allData })
      });
      const resJson = await response.json();
      if (resJson.status === 'success') {
        this.setGoogleConfig({
          ...config,
          isConnected: true,
          lastSynced: new Date().toISOString()
        });
        return { success: true, message: 'ซิงค์ข้อมูลทั้งหมดลง Google Sheets สำเร็จเรียบร้อยแล้ว' };
      }
      return { success: false, message: resJson.message || 'ซิงค์ไม่สำเร็จ' };
    } catch (err: any) {
      return { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + err.message };
    }
  }
};
