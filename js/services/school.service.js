/**
 * SCHOOL SERVICE
 * Menguruskan data profil sekolah dan dashboard.
 */

import { getDatabaseClient } from '../core/db.js';
import { cleanPhone } from '../core/helpers.js';

const db = getDatabaseClient();

export const SchoolService = {
    /**
     * Dapatkan semua data sekolah (Untuk Dashboard & Public List)
     * Termasuk logik pemprosesan status (Lengkap/Tidak).
     */
    async getAll() {
        const { data, error } = await db
            .from('smpid_sekolah_data')
            .select('*')
            .order('kod_sekolah', { ascending: true });

        if (error) throw error;

        // Proses data untuk tambah flag status (Business Logic dipindahkan ke sini)
        return data.map(item => {
            const requiredFields = [
                item.nama_gpict, item.no_telefon_gpict, item.emel_delima_gpict,
                item.nama_admin_delima, item.no_telefon_admin_delima, item.emel_delima_admin_delima
            ];
            
            const isDataComplete = requiredFields.every(f => f && f.trim() !== "");
            const telG = cleanPhone(item.no_telefon_gpict);
            const telA = cleanPhone(item.no_telefon_admin_delima);
            const isSama = (telG && telA) && (telG === telA);

            return {
                ...item,
                jenis: item.jenis_sekolah || 'LAIN-LAIN',
                is_lengkap: isDataComplete,
                is_sama: isSama,
                is_berbeza: (telG && telA) && !isSama
            };
        });
    },

    /**
     * Dapatkan profil satu sekolah
     */
    async getByCode(kodSekolah) {
        const { data, error } = await db
            .from('smpid_sekolah_data')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Kemaskini profil sekolah (GPICT/Admin)
     */
    async updateProfile(kodSekolah, payload) {
        const { error } = await db
            .from('smpid_sekolah_data')
            .update(payload)
            .eq('kod_sekolah', kodSekolah);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Reset data sekolah kepada NULL (Admin Action)
     */
    async resetData(kodSekolah) {
        const payload = {
            nama_gpict: null, no_telefon_gpict: null, emel_delima_gpict: null, telegram_id_gpict: null,
            nama_admin_delima: null, no_telefon_admin_delima: null, emel_delima_admin_delima: null, telegram_id_admin: null
        };
        
        const { error } = await db
            .from('smpid_sekolah_data')
            .update(payload)
            .eq('kod_sekolah', kodSekolah);

        if (error) throw error;
        return { success: true };
    }
};