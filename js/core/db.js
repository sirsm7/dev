import { envReady, getEnv } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { IDBCache } from "./idb.js";

let supabaseInstance = null;
let initPromise = null;
let idbInitialized = false;

function ensureStorageLayer() {
  if (idbInitialized) {
    return;
  }
  idbInitialized = true;
  try {
    if (IDBCache && typeof IDBCache.initDB === "function") {
      IDBCache.initDB().catch(() => {});
    }
  } catch {
    idbInitialized = false;
  }
}

function waitForSupabaseSdk(timeoutMs = 5000) {
  if (
    typeof window !== "undefined" &&
    window.supabase &&
    typeof window.supabase.createClient === "function"
  ) {
    return Promise.resolve(window.supabase);
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    const intervalId = setInterval(() => {
      if (
        typeof window !== "undefined" &&
        window.supabase &&
        typeof window.supabase.createClient === "function"
      ) {
        clearInterval(intervalId);
        resolve(window.supabase);
      } else if (Date.now() - startTime >= timeoutMs) {
        clearInterval(intervalId);
        resolve(null);
      }
    }, 50);
  });
}

function createClientInstance() {
  ensureStorageLayer();

  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (
    typeof window === "undefined" ||
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    return null;
  }

  const runtimeEnv = getEnv() || window.__ENV || null;
  const supabaseUrl =
    (runtimeEnv && typeof runtimeEnv.SUPABASE_URL === "string"
      ? runtimeEnv.SUPABASE_URL.trim()
      : "") || APP_CONFIG.SUPABASE.URL;
  const supabaseAnonKey =
    (runtimeEnv && typeof runtimeEnv.SUPABASE_ANON_KEY === "string"
      ? runtimeEnv.SUPABASE_ANON_KEY.trim()
      : "") || APP_CONFIG.SUPABASE.ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    supabaseInstance = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    window._supabase = supabaseInstance;
    window.supabaseClient = supabaseInstance;
  } catch {
    supabaseInstance = null;
    return null;
  }

  return supabaseInstance;
}

export async function initDatabaseClient() {
  ensureStorageLayer();

  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (!initPromise) {
    initPromise = (async () => {
      await envReady;
      await waitForSupabaseSdk();
      return createClientInstance();
    })().finally(() => {
      if (!supabaseInstance) {
        initPromise = null;
      }
    });

    if (typeof window !== "undefined") {
      window.DB_READY = initPromise;
    }
  }

  return initPromise;
}

export async function getDatabaseClientAsync() {
  return initDatabaseClient();
}

export function getDatabaseClient() {
  ensureStorageLayer();

  if (supabaseInstance) {
    return supabaseInstance;
  }

  return createClientInstance();
}

export function requireDb() {
  const db = getDatabaseClient();
  if (!db) {
    throw new Error(
      "Sambungan pangkalan data disekat atau belum sedia. Sila periksa sambungan internet anda."
    );
  }
  return db;
}

export async function requireDbAsync() {
  const db = await initDatabaseClient();
  if (!db) {
    throw new Error(
      "Sambungan pangkalan data disekat atau belum sedia. Sila periksa sambungan internet anda."
    );
  }
  return db;
}

if (typeof window !== "undefined") {
  initDatabaseClient().catch(() => {});

  window.addEventListener("online", () => {
    if (!supabaseInstance) {
      initDatabaseClient().catch(() => {});
    }
  });
}