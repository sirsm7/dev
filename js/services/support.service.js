/**
 * SUPPORT SERVICE
 * Menguruskan tiket aduan dan helpdesk.
 */

import { getDatabaseClient } from '../core/db.js';
import { APP_CONFIG } from '../config/app.config.js';

const db = getDatabaseClient();

export const SupportService = {
    /**
     * Hantar tiket baru
     */
    async createTicket(payload) {
        const { error } = await db
            .from('smpid_aduan')
            .insert([payload]);

        if (error) throw error;

        // Notifikasi ke Telegram (Jika API wujud)
        if (APP_CONFIG.API.DENO_URL) {
            fetch(`${APP_CONFIG.API.DENO_URL}/notify-ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    kod: payload.kod_sekolah, 
                    peranan: payload.peranan_pengirim, 
                    tajuk: payload.tajuk, 
                    mesej: payload.butiran_masalah 
                })
            }).catch(e => console.warn("Bot offline:", e));
        }

        return { success: true };
    },

    /**
     * Dapatkan tiket mengikut sekolah (User View)
     */
    async getBySchool(kodSekolah) {
        const { data, error } = await db
            .from('smpid_aduan')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Dapatkan semua tiket (Admin View)
     */
    async getAll(statusFilter = 'ALL') {
        let query = db.from('smpid_aduan').select('*').order('created_at', { ascending: false });
        
        if (statusFilter !== 'ALL') {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }
};