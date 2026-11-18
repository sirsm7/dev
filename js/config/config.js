const CONFIG_ENDPOINT = "/api/config";
const REQUEST_TIMEOUT_MS = 10000;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateAndFreezeEnv(rawPayload) {
  const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const supabaseUrl = normalizeString(payload.SUPABASE_URL);
  const supabaseAnonKey = normalizeString(payload.SUPABASE_ANON_KEY);
  const gasEndpointUrl = normalizeString(payload.GAS_ENDPOINT_URL || payload.GAS_URL);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Konfigurasi pelayan tidak lengkap: SUPABASE_URL atau SUPABASE_ANON_KEY tiada.");
  }

  const normalizedEnv = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey
  };

  if (gasEndpointUrl) {
    normalizedEnv.GAS_ENDPOINT_URL = gasEndpointUrl;
  }

  const frozenEnv = Object.freeze(normalizedEnv);
  window.__ENV = frozenEnv;
  window.SUPABASE_URL = frozenEnv.SUPABASE_URL;
  window.SUPABASE_ANON_KEY = frozenEnv.SUPABASE_ANON_KEY;

  if (frozenEnv.GAS_ENDPOINT_URL) {
    window.GAS_URL = frozenEnv.GAS_ENDPOINT_URL;
  }

  return frozenEnv;
}

async function fetchRuntimeConfig() {
  if (window.__ENV && window.__ENV.SUPABASE_URL && window.__ENV.SUPABASE_ANON_KEY) {
    return window.__ENV;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      },
      signal: controller.signal
    });

    const rawText = await response.text();
    let parsedData = null;

    try {
      parsedData = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error("Tindak balas konfigurasi bukan format JSON yang sah.");
    }

    if (!response.ok) {
      const serverMsg =
        parsedData && typeof parsedData.message === "string"
          ? parsedData.message
          : `Gagal mendapatkan konfigurasi pelayan (HTTP ${response.status}).`;
      throw new Error(serverMsg);
    }

    return validateAndFreezeEnv(parsedData);
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("Permintaan konfigurasi /api/config melebihi had masa.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

if (!window.ENV_READY) {
  window.ENV_READY = fetchRuntimeConfig();
}

export const envReady = window.ENV_READY;

export function getEnv() {
  return window.__ENV || null;
}

export function reloadEnv() {
  if (window.__ENV && window.__ENV.SUPABASE_URL && window.__ENV.SUPABASE_ANON_KEY) {
    window.ENV_READY = Promise.resolve(window.__ENV);
    return window.ENV_READY;
  }
  window.ENV_READY = fetchRuntimeConfig();
  return window.ENV_READY;
}

window.addEventListener("online", () => {
  if (!window.__ENV) {
    reloadEnv().catch(() => {});
  }
});