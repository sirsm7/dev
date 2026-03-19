/**
 * PENATARAN DIGITAL SERVICE (V1.0)
 * Menguruskan rekod penilaian kendiri sekolah bagi Modul Penataran Sekolah Digital.
 * Menggantikan operasi legasi Google Apps Script dengan sambungan terus ke Supabase.
 */

import { getDatabaseClient } from '../core/db.js';

const db = getDatabaseClient();

export const PenataranService = {
    /**
     * Menyimpan atau mengemaskini (Upsert) laporan penataran sekolah.
     * Sistem memastikan hanya satu rekod terkini disimpan bagi setiap sekolah (berdasarkan kod_sekolah).
     * * @param {Object} payload - Data laporan penataran lengkap (Skor, Peratus, Dimensi)
     */
    async submitReport(payload) {
        // Semak sama ada sekolah ini telah menghantar laporan sebelum ini
        const { data: existing } = await db
            .from('smpid_penataran_digital')
            .select('id')
            .eq('kod_sekolah', payload.kod_sekolah)
            .maybeSingle();

        // Suntik masa kemaskini terkini
        payload.updated_at = new Date().toISOString();

        if (existing) {
            // Lakukan proses Kemaskini (Update)
            const { error } = await db
                .from('smpid_penataran_digital')
                .update(payload)
                .eq('id', existing.id);
                
            if (error) throw error;
            return { success: true, action: 'UPDATED' };
        } else {
            // Lakukan proses Sisipan Baharu (Insert)
            const { error } = await db
                .from('smpid_penataran_digital')
                .insert([payload]);
                
            if (error) throw error;
            return { success: true, action: 'INSERTED' };
        }
    },

    /**
     * Mendapatkan laporan terkini yang telah dihantar oleh sekolah tertentu.
     * Digunakan dalam Portal Sekolah untuk memaparkan semula keputusan sedia ada.
     * * @param {string} kodSekolah - Kod sekolah pengguna (Cth: MBA0001)
     */
    async getBySchool(kodSekolah) {
        const { data, error } = await db
            .from('smpid_penataran_digital')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Mendapatkan senarai penuh semua laporan sekolah.
     * Digunakan oleh Admin PPD untuk pemantauan daerah.
     * Disusun mengikut jumlah skor tertinggi secara lalai.
     */
    async getAll() {
        const { data, error } = await db
            .from('smpid_penataran_digital')
            .select('*')
            .order('jumlah_skor', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Memadam rekod penataran bagi sekolah tertentu.
     * Kegunaan eksklusif untuk fungsi 'Reset Data' oleh Admin PPD.
     * * @param {string} kodSekolah - Kod sekolah sasaran
     */
    async deleteRecord(kodSekolah) {
        const { error } = await db
            .from('smpid_penataran_digital')
            .delete()
            .eq('kod_sekolah', kodSekolah);

        if (error) throw error;
        return { success: true };
    }
};