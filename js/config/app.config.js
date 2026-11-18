import { envReady, getEnv } from "./config.js";

function readEnvValue(key) {
  const env = getEnv() || (typeof window !== "undefined" ? window.__ENV : null);
  if (!env || typeof env[key] !== "string") {
    return "";
  }
  return env[key].trim();
}

const supabaseConfig = {};
Object.defineProperties(supabaseConfig, {
  URL: {
    enumerable: true,
    configurable: false,
    get() {
      return readEnvValue("SUPABASE_URL");
    }
  },
  ANON_KEY: {
    enumerable: true,
    configurable: false,
    get() {
      return readEnvValue("SUPABASE_ANON_KEY");
    }
  },
  KEY: {
    enumerable: true,
    configurable: false,
    get() {
      return readEnvValue("SUPABASE_ANON_KEY");
    }
  }
});

const apiConfig = {};
Object.defineProperties(apiConfig, {
  GAS_ENDPOINT_URL: {
    enumerable: true,
    configurable: false,
    get() {
      return readEnvValue("GAS_ENDPOINT_URL");
    }
  },
  GAS_URL: {
    enumerable: true,
    configurable: false,
    get() {
      return readEnvValue("GAS_ENDPOINT_URL");
    }
  },
  GAS_UPLOAD_URL: {
    enumerable: true,
    configurable: false,
    get() {
      return readEnvValue("GAS_UPLOAD_URL") || readEnvValue("GAS_ENDPOINT_URL");
    }
  },
  GAS_EMAIL_URL: {
    enumerable: true,
    configurable: false,
    get() {
      return readEnvValue("GAS_EMAIL_URL") || readEnvValue("GAS_ENDPOINT_URL");
    }
  },
  GAS_LIBAT_URUS_URL: {
    enumerable: true,
    configurable: false,
    get() {
      return readEnvValue("GAS_LIBAT_URUS_URL") || readEnvValue("GAS_ENDPOINT_URL");
    }
  },
  DENO_URL: {
    enumerable: true,
    configurable: false,
    get() {
      return readEnvValue("DENO_API_URL");
    }
  }
});

const defaultsConfig = {};
Object.defineProperties(defaultsConfig, {
  PASSWORD: {
    enumerable: true,
    configurable: false,
    get() {
      return readEnvValue("DEFAULT_PASSWORD");
    }
  },
  AVATAR_URL: {
    value: "assets/img/default-avatar.png",
    enumerable: true,
    writable: false,
    configurable: false
  },
  ROLE: {
    value: "user",
    enumerable: true,
    writable: false,
    configurable: false
  },
  PPD: {
    value: "Alor Gajah",
    enumerable: true,
    writable: false,
    configurable: false
  },
  STATUS: {
    value: "active",
    enumerable: true,
    writable: false,
    configurable: false
  }
});

export const APP_CONFIG = {
  APP_NAME: "Nadi Analitik, Digital & Inovasi Melaka (NaDIM)",
  APP_VERSION: "2.7.0",
  ADMIN_TABLE_LIMIT: 50,
  IDB: {
    DB_NAME: "nadim_storage_v2",
    DB_VERSION: 2,
    CACHE_TTL_MS: 86400000,
    STORES: {
      SCHOOLS: "schools_cache",
      ACHIEVEMENTS: "achievements_cache",
      META: "system_meta"
    }
  },
  SUPABASE: supabaseConfig,
  API: apiConfig,
  SESSION: {
    AUTH_FLAG: "smpid_auth",
    USER_ROLE: "smpid_user_role",
    USER_KOD: "smpid_user_kod",
    USER_ID: "smpid_user_id",
    ACTIVE_SCHOOL: "smpid_active_school",
    APP_VERSION_KEY: "smpid_app_version",
    LAST_SYNC_KEY: "smpid_last_sync"
  },
  PPD_MAPPING: {
    M010: "JASIN",
    M020: "MELAKA TENGAH",
    M030: "ALOR GAJAH"
  },
  DEFAULTS: defaultsConfig,
  DB_TABLES: {
    USERS: "smpid_users",
    SCHOOLS: "smpid_schools",
    ACHIEVEMENTS: "smpid_achievements",
    GALLERY: "smpid_gallery",
    BOOKINGS: "smpid_bookings",
    PENATARAN: "smpid_penataran",
    SETTINGS: "smpid_settings",
    LIBAT_URUS: "smpid_libat_urus"
  },
  PAGINATION: {
    ITEMS_PER_PAGE: 10,
    MAX_PAGES_SHOWN: 5,
    ADMIN_TABLE_LIMIT: 50
  },
  UPLOADS: {
    MAX_FILE_SIZE_MB: 5,
    ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
    ALLOWED_DOC_TYPES: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
  },
  ALERTS: {
    TIMER_SHORT: 1500,
    TIMER_NORMAL: 3000,
    TIMER_LONG: 5000
  }
};

Object.freeze(APP_CONFIG);
Object.freeze(APP_CONFIG.IDB);
Object.freeze(APP_CONFIG.IDB.STORES);
Object.freeze(APP_CONFIG.SUPABASE);
Object.freeze(APP_CONFIG.API);
Object.freeze(APP_CONFIG.SESSION);
Object.freeze(APP_CONFIG.PPD_MAPPING);
Object.freeze(APP_CONFIG.DEFAULTS);
Object.freeze(APP_CONFIG.DB_TABLES);
Object.freeze(APP_CONFIG.PAGINATION);
Object.freeze(APP_CONFIG.UPLOADS);
Object.freeze(APP_CONFIG.ALERTS);

if (typeof window !== "undefined") {
  window.APP_CONFIG = APP_CONFIG;
}

export async function initAppConfig() {
  await envReady;
  return APP_CONFIG;
}