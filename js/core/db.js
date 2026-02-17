/**
 * SMPID DATABASE CORE
 * Menguruskan sambungan ke Supabase Client.
 * Refactored: Robust Error Handling & Singleton Pattern.
 */

import { APP_CONFIG } from '../config/app.config.js';

let supabaseInstance = null;

/**
 * Menginisialisasi dan mengembalikan klien Supabase.
 * Memastikan library Supabase telah dimuatkan melalui CDN di HTML.
 */
export function getDatabaseClient() {
    // 1. Return existing instance if available (Singleton)
    if (supabaseInstance) {
        return supabaseInstance;
    }

    // 2. Check if window.supabase exists (CDN Loaded)
    if (typeof window.supabase === 'undefined') {
        console.error("CRITICAL: Supabase library not found. Check internet connection or AdBlocker.");
        return null;
    }

    // 3. Create new instance
    try {
        supabaseInstance = window.supabase.createClient(
            APP_CONFIG.SUPABASE.URL,
            APP_CONFIG.SUPABASE.KEY
        );
        // console.log("✅ [Core] Supabase Connected.");
    } catch (error) {
        console.error("❌ [Core] Supabase Init Error:", error);
        return null;
    }

    return supabaseInstance;
}

// Helper untuk memastikan DB wujud sebelum query
export function requireDb() {
    const db = getDatabaseClient();
    if (!db) {
        throw new Error("Sambungan Pangkalan Data Gagal. Sila semak sambungan internet atau matikan AdBlocker.");
    }
    return db;
}