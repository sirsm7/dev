import { envReady, getEnv } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient } from "./db.js";
import { IDBCache } from "./idb.js";
import { RealtimeManager } from "./realtime.js";

const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 200;
const SEQUENCE_RESET_RPC = "nadim_reset_sequences";

const CORE_TABLE_REGISTRY = {
  smpid_sekolah_data: {
    table_name: "smpid_sekolah_data",
    primary_key: "kod_sekolah",
    unique_keys: ["kod_sekolah"],
    depends_on: [],
    fallback_headers: ["kod_sekolah", "nama_sekolah"],
    fallback_optional: ["jenis", "daerah", "created_at", "updated_at"]
  },
  smpid_pppdm_program: {
    table_name: "smpid_pppdm_program",
    primary_key: "id",
    unique_keys: ["id", "kod_program"],
    depends_on: [],
    fallback_headers: ["kod_program", "nama_program"],
    fallback_optional: ["id", "created_at", "updated_at"]
  },
  smpid_admin_users: {
    table_name: "smpid_admin_users",
    primary_key: "role",
    unique_keys: ["role", "telegram_id"],
    depends_on: [],
    fallback_headers: ["role"],
    fallback_optional: ["telegram_id", "created_at", "updated_at"]
  },
  smpid_users: {
    table_name: "smpid_users",
    primary_key: "id",
    unique_keys: ["id"],
    depends_on: [],
    fallback_headers: ["email"],
    fallback_optional: ["id", "role", "kod_sekolah", "created_at", "updated_at"]
  },
  smpid_dcs_analisa: {
    table_name: "smpid_dcs_analisa",
    primary_key: "id",
    unique_keys: ["id", "kod_sekolah"],
    depends_on: [],
    fallback_headers: ["kod_sekolah"],
    fallback_optional: ["id", "nama_sekolah", "daerah", "created_at", "updated_at"]
  },
  smpid_penataran_digital: {
    table_name: "smpid_penataran_digital",
    primary_key: "id",
    unique_keys: ["id", "kod_sekolah"],
    depends_on: [],
    fallback_headers: ["kod_sekolah"],
    fallback_optional: ["id", "created_at", "updated_at"]
  },
  smpid_bb_kunci: {
    table_name: "smpid_bb_kunci",
    primary_key: "id",
    unique_keys: ["id", "tarikh"],
    depends_on: [],
    fallback_headers: ["tarikh"],
    fallback_optional: ["id", "kod_ppd", "komen", "dikunci_oleh", "created_at", "updated_at"]
  },
  smpid_bb_tempahan: {
    table_name: "smpid_bb_tempahan",
    primary_key: "id",
    unique_keys: ["id", "id_tempahan"],
    depends_on: [],
    fallback_headers: ["id_tempahan", "kod_sekolah", "tarikh"],
    fallback_optional: ["id", "nama_sekolah", "masa", "tajuk_bengkel", "nama_pic", "no_tel_pic", "status", "created_at", "updated_at"]
  },
  smpid_aduan: {
    table_name: "smpid_aduan",
    primary_key: "id",
    unique_keys: ["id"],
    depends_on: [],
    fallback_headers: ["kod_sekolah", "tajuk"],
    fallback_optional: ["id", "peranan_pengirim", "butiran_masalah", "status", "balasan_admin", "tarikh_balas", "created_at", "updated_at"]
  },
  smpid_delima_status: {
    table_name: "smpid_delima_status",
    primary_key: "id",
    unique_keys: ["id"],
    depends_on: [],
    fallback_headers: ["kod_sekolah"],
    fallback_optional: ["id", "kategori", "status", "catatan", "created_at", "updated_at"]
  },
  smpid_libat_urus: {
    table_name: "smpid_libat_urus",
    primary_key: "id",
    unique_keys: ["id"],
    depends_on: [],
    fallback_headers: ["kod_sekolah"],
    fallback_optional: ["id", "bulan", "tahun", "created_at", "updated_at"]
  },
  smpid_pencapaian: {
    table_name: "smpid_pencapaian",
    primary_key: "id",
    unique_keys: ["id"],
    depends_on: ["smpid_sekolah_data"],
    fallback_headers: ["kod_sekolah", "kategori", "nama_peserta", "nama_pertandingan", "pencapaian", "tahun"],
    fallback_optional: ["id", "jawatan", "peringkat", "penyedia", "jenis_rekod", "pautan_bukti", "created_at", "updated_at"]
  },
  smpid_impak_bbm: {
    table_name: "smpid_impak_bbm",
    primary_key: "id",
    unique_keys: ["id"],
    depends_on: ["smpid_sekolah_data"],
    fallback_headers: ["kod_sekolah"],
    fallback_optional: ["id", "created_at", "updated_at"]
  },
  smpid_pppdm_penyertaan: {
    table_name: "smpid_pppdm_penyertaan",
    primary_key: "id",
    unique_keys: ["id", "kod_sekolah,program_id,tahun"],
    depends_on: ["smpid_sekolah_data", "smpid_pppdm_program"],
    fallback_headers: ["kod_sekolah", "program_id", "tahun"],
    fallback_optional: ["id", "created_at", "updated_at"]
  }
};

let activeMigrationController = null;
let operationInProgress = false;

function sortTablesByDependency(tableNames) {
  const uniqueNames = Array.from(new Set(tableNames));
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];

  function visit(name) {
    if (visited.has(name)) {
      return;
    }
    if (visiting.has(name)) {
      return;
    }
    visiting.add(name);
    const meta = CORE_TABLE_REGISTRY[name];
    const parents = meta && Array.isArray(meta.depends_on) ? meta.depends_on : [];
    for (let i = 0; i < parents.length; i += 1) {
      if (uniqueNames.includes(parents[i])) {
        visit(parents[i]);
      }
    }
    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
  }

  for (let i = 0; i < uniqueNames.length; i += 1) {
    visit(uniqueNames[i]);
  }

  return ordered;
}

async function fetchOpenApiDefinitions(signal) {
  await envReady;
  const runtimeEnv = getEnv() || (typeof window !== "undefined" ? window.__ENV : null);
  const supabaseUrl =
    (runtimeEnv && typeof runtimeEnv.SUPABASE_URL === "string" ? runtimeEnv.SUPABASE_URL.trim() : "") ||
    APP_CONFIG.SUPABASE.URL;
  const supabaseAnonKey =
    (runtimeEnv && typeof runtimeEnv.SUPABASE_ANON_KEY === "string"
      ? runtimeEnv.SUPABASE_ANON_KEY.trim()
      : "") || APP_CONFIG.SUPABASE.ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/`;
    const response = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: "application/openapi+json"
      },
      signal
    });

    if (!response.ok) {
      return null;
    }

    const spec = await response.json();
    if (spec && typeof spec.definitions === "object" && spec.definitions !== null) {
      return spec.definitions;
    }
    return null;
  } catch {
    return null;
  }
}

function inferPrimaryKeyFromDefinition(tableName, definition, fallbackPk) {
  if (fallbackPk) {
    return fallbackPk;
  }
  const props = definition && definition.properties ? definition.properties : {};
  if (Object.prototype.hasOwnProperty.call(props, "id")) {
    return "id";
  }
  if (Object.prototype.hasOwnProperty.call(props, "kod_sekolah")) {
    return "kod_sekolah";
  }
  const keys = Object.keys(props);
  return keys.length > 0 ? keys[0] : "id";
}

async function resolveProjectSchemas(signal) {
  const definitions = await fetchOpenApiDefinitions(signal);
  const targetNames = Object.keys(CORE_TABLE_REGISTRY);
  const orderedNames = sortTablesByDependency(targetNames);
  const schemas = {};

  for (let i = 0; i < orderedNames.length; i += 1) {
    const tableName = orderedNames[i];
    const reg = CORE_TABLE_REGISTRY[tableName];
    const def = definitions && definitions[tableName] ? definitions[tableName] : null;
    const primaryKey = inferPrimaryKeyFromDefinition(tableName, def, reg ? reg.primary_key : "id");

    let headers = [];
    let optionalHeaders = [];
    let allColumns = [];

    if (def && def.properties && typeof def.properties === "object") {
      allColumns = Object.keys(def.properties);
      const requiredList = Array.isArray(def.required) ? def.required : [];
      headers = allColumns.filter((col) => requiredList.includes(col));
      optionalHeaders = allColumns.filter((col) => !requiredList.includes(col));
    } else if (reg) {
      headers = [...reg.fallback_headers];
      optionalHeaders = [...reg.fallback_optional];
      allColumns = Array.from(new Set([...headers, ...optionalHeaders]));
    }

    schemas[tableName] = {
      table_name: tableName,
      primary_key: primaryKey,
      unique_keys: reg && Array.isArray(reg.unique_keys) ? [...reg.unique_keys] : [primaryKey],
      depends_on: reg && Array.isArray(reg.depends_on) ? [...reg.depends_on] : [],
      headers,
      optional_headers: optionalHeaders,
      all_columns: allColumns,
      properties: def && def.properties ? def.properties : {}
    };
  }

  return {
    tableOrder: orderedNames,
    schemas
  };
}

function renderStatusFeedback(container, entries) {
  if (!container || typeof document === "undefined") {
    return;
  }

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < entries.length; i += 1) {
    const item = entries[i];
    const line = document.createElement("div");
    line.className = "py-1 text-xs font-mono border-b border-slate-100 last:border-0";

    if (item.level === "error") {
      line.classList.add("text-red-600", "font-bold");
    } else if (item.level === "success") {
      line.classList.add("text-emerald-600", "font-bold");
    } else if (item.level === "warn") {
      line.classList.add("text-amber-600");
    } else {
      line.classList.add("text-slate-600");
    }

    line.textContent = item.text;
    fragment.appendChild(line);
  }

  container.appendChild(fragment);
}

function reportProgress(onProgress, statusContainer, logBuffer, level, text, extra = {}) {
  const entry = {
    level,
    text,
    timestamp: new Date().toISOString(),
    ...extra
  };
  logBuffer.push(entry);

  if (statusContainer) {
    renderStatusFeedback(statusContainer, logBuffer);
  }
  if (typeof onProgress === "function") {
    try {
      onProgress(entry);
    } catch {}
  }
}

async function fetchAllTableRows(client, tableName, signal) {
  const rows = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    if (signal && signal.aborted) {
      throw new DOMException("Operasi eksport dibatalkan.", "AbortError");
    }

    const to = from + PAGE_SIZE - 1;
    let query = client.from(tableName).select("*").range(from, to);
    if (signal && typeof query.abortSignal === "function") {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return { rows: [], skipped: true };
      }
      throw new Error(`Gagal membaca jadual ${tableName}: ${error.message}`);
    }

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      from += PAGE_SIZE;
    }
  }

  return { rows, skipped: false };
}

function deriveColumnsFromRows(rows, schema) {
  const discovered = new Set(schema.all_columns);
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row && typeof row === "object") {
      Object.keys(row).forEach((col) => discovered.add(col));
    }
  }

  const allCols = Array.from(discovered);
  const requiredSet = new Set(schema.headers);
  const headers = allCols.filter((col) => requiredSet.has(col));
  const optionalHeaders = allCols.filter((col) => !requiredSet.has(col));

  return {
    headers,
    optionalHeaders,
    allColumns: allCols
  };
}

function triggerJsonFileDownload(filename, jsonString) {
  const blob = new Blob([jsonString], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 0);
  }
}

function resolveConflictTarget(schema, sampleRow) {
  const uniqueKeys = Array.isArray(schema.unique_keys) ? schema.unique_keys : [schema.primary_key];
  const pk = schema.primary_key;

  if (
    pk &&
    sampleRow &&
    Object.prototype.hasOwnProperty.call(sampleRow, pk) &&
    sampleRow[pk] !== null &&
    sampleRow[pk] !== undefined &&
    sampleRow[pk] !== ""
  ) {
    return pk;
  }

  for (let i = 0; i < uniqueKeys.length; i += 1) {
    const candidate = uniqueKeys[i];
    if (candidate === pk) {
      continue;
    }
    const parts = candidate.split(",").map((p) => p.trim());
    const allPresent =
      sampleRow &&
      parts.every(
        (col) =>
          Object.prototype.hasOwnProperty.call(sampleRow, col) &&
          sampleRow[col] !== null &&
          sampleRow[col] !== undefined &&
          sampleRow[col] !== ""
      );
    if (allPresent) {
      return candidate;
    }
  }

  return pk;
}

function validateAndNormalizeBackupPayload(rawJson, liveSchemas) {
  if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) {
    throw new Error("Struktur fail sandaran tidak sah: objek JSON utama diperlukan.");
  }

  const metadata = rawJson.metadata;
  const tablesObj = rawJson.tables;

  if (!metadata || typeof metadata !== "object") {
    throw new Error("Struktur fail sandaran tidak sah: bahagian 'metadata' tiada.");
  }
  if (!Array.isArray(metadata.table_order) || metadata.table_order.length === 0) {
    throw new Error("Struktur fail sandaran tidak sah: 'metadata.table_order' kosong atau tiada.");
  }
  if (!tablesObj || typeof tablesObj !== "object" || Array.isArray(tablesObj)) {
    throw new Error("Struktur fail sandaran tidak sah: bahagian 'tables' tiada.");
  }

  const sortedOrder = sortTablesByDependency(metadata.table_order);
  const normalizedTables = {};

  for (let i = 0; i < sortedOrder.length; i += 1) {
    const tableName = sortedOrder[i];
    const tableEntry = tablesObj[tableName];

    if (!tableEntry || typeof tableEntry !== "object") {
      throw new Error(`Definisi jadual '${tableName}' tiada dalam bahagian 'tables'.`);
    }
    if (tableEntry.table_name !== tableName) {
      throw new Error(
        `Ketidaksepadanan nama jadual: dijangka '${tableName}', ditemui '${tableEntry.table_name || ""}'.`
      );
    }
    if (typeof tableEntry.primary_key !== "string" || !tableEntry.primary_key.trim()) {
      throw new Error(`Jadual '${tableName}' tidak mempunyai takrifan 'primary_key' yang sah.`);
    }
    if (!Array.isArray(tableEntry.headers)) {
      throw new Error(`Jadual '${tableName}' tidak mempunyai tatasusunan 'headers' yang sah.`);
    }
    if (!Array.isArray(tableEntry.rows)) {
      throw new Error(`Jadual '${tableName}' tidak mempunyai tatasusunan 'rows' yang sah.`);
    }

    const liveSchema = liveSchemas[tableName];
    if (!liveSchema) {
      continue;
    }

    const declaredOptional = Array.isArray(tableEntry.optional_headers)
      ? tableEntry.optional_headers
      : [];
    const allowedInBackup = new Set([...tableEntry.headers, ...declaredOptional]);
    const validTargetColumns =
      liveSchema.all_columns.length > 0 ? new Set(liveSchema.all_columns) : allowedInBackup;

    const missingRequiredInBackup = liveSchema.headers.filter(
      (reqCol) => !allowedInBackup.has(reqCol)
    );
    if (missingRequiredInBackup.length > 0) {
      throw new Error(
        `Jadual '${tableName}' kehilangan lajur wajib (NOT NULL): ${missingRequiredInBackup.join(", ")}.`
      );
    }

    const seenUniqueValues = new Map();
    liveSchema.unique_keys.forEach((uk) => seenUniqueValues.set(uk, new Set()));

    const normalizedRows = [];

    for (let r = 0; r < tableEntry.rows.length; r += 1) {
      const sourceRow = tableEntry.rows[r];
      if (!sourceRow || typeof sourceRow !== "object" || Array.isArray(sourceRow)) {
        throw new Error(`Baris ke-${r + 1} dalam jadual '${tableName}' bukan objek rekod yang sah.`);
      }

      for (let h = 0; h < liveSchema.headers.length; h += 1) {
        const reqCol = liveSchema.headers[h];
        const val = sourceRow[reqCol];
        if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
          throw new Error(
            `Pelanggaran kekangan NOT NULL pada jadual '${tableName}', baris ke-${r + 1}, lajur '${reqCol}'.`
          );
        }
      }

      for (let u = 0; u < liveSchema.unique_keys.length; u += 1) {
        const uk = liveSchema.unique_keys[u];
        const ukCols = uk.split(",").map((c) => c.trim());
        const hasAllValues = ukCols.every(
          (col) => sourceRow[col] !== undefined && sourceRow[col] !== null && sourceRow[col] !== ""
        );
        if (hasAllValues) {
          const compositeVal = ukCols.map((col) => String(sourceRow[col])).join("::");
          const tracker = seenUniqueValues.get(uk);
          if (tracker.has(compositeVal)) {
            throw new Error(
              `Pelanggaran kekangan UNIQUE (${uk}) pada jadual '${tableName}', baris ke-${r + 1}: nilai pendua '${compositeVal}'.`
            );
          }
          tracker.add(compositeVal);
        }
      }

      const cleanRow = {};
      allowedInBackup.forEach((col) => {
        if (
          validTargetColumns.has(col) &&
          Object.prototype.hasOwnProperty.call(sourceRow, col) &&
          sourceRow[col] !== undefined
        ) {
          cleanRow[col] = sourceRow[col];
        }
      });

      normalizedRows.push(cleanRow);
    }

    normalizedTables[tableName] = {
      schema: liveSchema,
      rows: normalizedRows
    };
  }

  return {
    tableOrder: sortedOrder.filter((name) => Boolean(normalizedTables[name])),
    tables: normalizedTables
  };
}

export const MigrationManager = {
  isBusy() {
    return operationInProgress;
  },

  cancelActiveOperation() {
    if (activeMigrationController) {
      activeMigrationController.abort();
      activeMigrationController = null;
    }
  },

  async exportBackupJson(options = {}) {
    if (operationInProgress) {
      throw new Error("Operasi sandaran atau pemulihan sedang berjalan. Sila tunggu sehingga selesai.");
    }

    operationInProgress = true;
    const controller = new AbortController();
    activeMigrationController = controller;
    const logBuffer = [];
    const statusContainer = options.statusContainer || null;
    const onProgress = options.onProgress || null;

    try {
      reportProgress(
        onProgress,
        statusContainer,
        logBuffer,
        "info",
        "Memulakan pengesanan skema pangkalan data Supabase..."
      );

      await envReady;
      const client = await initDatabaseClient();
      if (!client) {
        throw new Error("Sambungan pangkalan data Supabase tidak tersedia.");
      }

      const { tableOrder, schemas } = await resolveProjectSchemas(controller.signal);
      const activeOrder = [];
      const exportedTables = {};
      let totalRowsExported = 0;

      for (let i = 0; i < tableOrder.length; i += 1) {
        const tableName = tableOrder[i];
        const schema = schemas[tableName];

        reportProgress(
          onProgress,
          statusContainer,
          logBuffer,
          "info",
          `Mengeksport jadual [${i + 1}/${tableOrder.length}]: ${tableName}...`,
          { table: tableName, step: i + 1, total: tableOrder.length }
        );

        const { rows, skipped } = await fetchAllTableRows(client, tableName, controller.signal);
        if (skipped) {
          continue;
        }

        const { headers, optionalHeaders, allColumns } = deriveColumnsFromRows(rows, schema);
        const normalizedRows = rows.map((row) => {
          const item = {};
          for (let c = 0; c < allColumns.length; c += 1) {
            const col = allColumns[c];
            item[col] = Object.prototype.hasOwnProperty.call(row, col) ? row[col] : null;
          }
          return item;
        });

        activeOrder.push(tableName);
        totalRowsExported += normalizedRows.length;

        exportedTables[tableName] = {
          table_name: tableName,
          primary_key: schema.primary_key,
          headers,
          optional_headers: optionalHeaders,
          rows: normalizedRows
        };
      }

      const backupDocument = {
        metadata: {
          app: "nadim",
          schema_version: APP_CONFIG.APP_VERSION || "2.7.0",
          exported_at: new Date().toISOString(),
          table_order: activeOrder
        },
        tables: exportedTables
      };

      const timestampSlug = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = options.filename || `nadim_backup_${timestampSlug}.json`;
      const jsonContent = JSON.stringify(backupDocument, null, 2);

      triggerJsonFileDownload(filename, jsonContent);

      reportProgress(
        onProgress,
        statusContainer,
        logBuffer,
        "success",
        `Eksport selesai: ${activeOrder.length} jadual (${totalRowsExported} rekod) dimuat turun ke ${filename}.`
      );

      return {
        filename,
        tableCount: activeOrder.length,
        totalRows: totalRowsExported,
        document: backupDocument
      };
    } catch (error) {
      const msg =
        error && error.name === "AbortError"
          ? "Eksport sandaran dibatalkan oleh pengguna."
          : error && error.message
            ? error.message
            : "Ralat tidak diketahui semasa eksport sandaran.";
      reportProgress(onProgress, statusContainer, logBuffer, "error", msg);
      throw new Error(msg);
    } finally {
      operationInProgress = false;
      activeMigrationController = null;
    }
  },

  async importBackupJson(file, options = {}) {
    if (operationInProgress) {
      throw new Error("Operasi sandaran atau pemulihan sedang berjalan. Sila tunggu sehingga selesai.");
    }

    if (!file) {
      throw new Error("Sila pilih fail sandaran .json terlebih dahulu.");
    }

    const fileName = typeof file.name === "string" ? file.name.trim().toLowerCase() : "";
    const fileType = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
    const validExtension = fileName.endsWith(".json");
    const validMime = fileType === "" || fileType === "application/json" || fileType === "text/json";

    if (!validExtension || !validMime) {
      throw new Error("Format fail tidak sah. Hanya fail sambungan .json (application/json) diterima.");
    }

    operationInProgress = true;
    const controller = new AbortController();
    activeMigrationController = controller;
    const logBuffer = [];
    const statusContainer = options.statusContainer || null;
    const onProgress = options.onProgress || null;

    try {
      reportProgress(
        onProgress,
        statusContainer,
        logBuffer,
        "info",
        `Membaca dan mengesahkan fail ${file.name}...`
      );

      const rawText = await file.text();
      if (controller.signal.aborted) {
        throw new DOMException("Operasi pemulihan dibatalkan.", "AbortError");
      }

      let parsedJson;
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        throw new Error("Fail .json rosak atau mempunyai ralat sintaks JSON.");
      }

      await envReady;
      const client = await initDatabaseClient();
      if (!client) {
        throw new Error("Sambungan pangkalan data Supabase tidak tersedia.");
      }

      const { schemas } = await resolveProjectSchemas(controller.signal);
      const validated = validateAndNormalizeBackupPayload(parsedJson, schemas);

      if (validated.tableOrder.length === 0) {
        throw new Error("Tiada jadual sasaran yang sepadan ditemui dalam fail sandaran.");
      }

      let totalRestoredRows = 0;

      for (let i = 0; i < validated.tableOrder.length; i += 1) {
        if (controller.signal.aborted) {
          throw new DOMException("Operasi pemulihan dibatalkan.", "AbortError");
        }

        const tableName = validated.tableOrder[i];
        const tableBundle = validated.tables[tableName];
        const rows = tableBundle.rows;

        if (rows.length === 0) {
          reportProgress(
            onProgress,
            statusContainer,
            logBuffer,
            "info",
            `Melangkau jadual kosong [${i + 1}/${validated.tableOrder.length}]: ${tableName} (0 rekod).`
          );
          continue;
        }

        reportProgress(
          onProgress,
          statusContainer,
          logBuffer,
          "info",
          `Memulihkan jadual [${i + 1}/${validated.tableOrder.length}]: ${tableName} (${rows.length} rekod)...`,
          { table: tableName, step: i + 1, total: validated.tableOrder.length }
        );

        const conflictTarget = resolveConflictTarget(tableBundle.schema, rows[0]);

        for (let start = 0; start < rows.length; start += UPSERT_BATCH_SIZE) {
          if (controller.signal.aborted) {
            throw new DOMException("Operasi pemulihan dibatalkan.", "AbortError");
          }

          const batch = rows.slice(start, start + UPSERT_BATCH_SIZE);
          let query = client
            .from(tableName)
            .upsert(batch, { onConflict: conflictTarget, ignoreDuplicates: false });

          if (typeof query.abortSignal === "function") {
            query = query.abortSignal(controller.signal);
          }

          const { error } = await query;
          if (error) {
            throw new Error(`Ralat pemulihan pada jadual ${tableName}: ${error.message}`);
          }
        }

        totalRestoredRows += rows.length;
      }

      reportProgress(
        onProgress,
        statusContainer,
        logBuffer,
        "info",
        "Menyelaraskan jujukan ID pangkalan data (setval)..."
      );

      const { error: rpcError } = await client.rpc(SEQUENCE_RESET_RPC, {
        p_tables: validated.tableOrder
      });

      if (rpcError) {
        throw new Error(`Pemulihan baris selesai tetapi penyelarasan jujukan gagal: ${rpcError.message}`);
      }

      if (IDBCache && typeof IDBCache.clearAll === "function") {
        await IDBCache.clearAll();
      }

      if (RealtimeManager && typeof RealtimeManager.syncNow === "function") {
        await RealtimeManager.syncNow();
      }

      if (typeof options.onCompleted === "function") {
        try {
          await options.onCompleted({
            tableOrder: validated.tableOrder,
            totalRows: totalRestoredRows
          });
        } catch {}
      }

      reportProgress(
        onProgress,
        statusContainer,
        logBuffer,
        "success",
        `Pemulihan 1-ke-1 berjaya: ${validated.tableOrder.length} jadual (${totalRestoredRows} rekod) dipulihkan dan jujukan diselaraskan.`
      );

      return {
        tableCount: validated.tableOrder.length,
        totalRows: totalRestoredRows,
        tableOrder: validated.tableOrder
      };
    } catch (error) {
      const msg =
        error && error.name === "AbortError"
          ? "Pemulihan data dibatalkan oleh pengguna."
          : error && error.message
            ? error.message
            : "Ralat tidak diketahui semasa pemulihan data.";
      reportProgress(onProgress, statusContainer, logBuffer, "error", msg);
      throw new Error(msg);
    } finally {
      operationInProgress = false;
      activeMigrationController = null;
    }
  }
};

if (typeof window !== "undefined") {
  window.MigrationManager = MigrationManager;
}