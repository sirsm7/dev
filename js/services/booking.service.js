/**
 * BOOKING SERVICE (MODUL BIMBINGAN & BENGKEL - BB)
 * Fungsi: Menguruskan CRUD bagi tempahan bengkel dan kunci tarikh admin.
 * Seni Bina: Multi-Stack Production Grade (Supabase).
 * Peraturan: Slot hanya pada Selasa, Rabu, Khamis dan Sabtu.
 */

import { getDatabaseClient } from '../core/db.js';

const db = getDatabaseClient();

export const BookingService = {
    /**
     * Mengambil data tempahan dan tarikh dikunci untuk paparan kalendar.
     * @param {number} year 
     * @param {number} month (0-11)
     */
    async getMonthlyData(year, month) {
        const startDate = new Date(year, month, 1).toISOString();
        const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

        // 1. Ambil Tempahan Aktif
        const { data: bookings, error: errB } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('status', 'AKTIF')
            .gte('tarikh', startDate)
            .lte('tarikh', endDate);

        if (errB) throw errB;

        // 2. Ambil Tarikh Dikunci Admin
        const { data: locks, error: errL } = await db
            .from('smpid_bb_kunci')
            .select('*')
            .gte('tarikh', startDate)
            .lte('tarikh', endDate);

        if (errL) throw errL;

        // Proses data tempahan ke format objek { 'YYYY-MM-DD': ['Pagi', 'Petang'] }
        const bookedSlots = {};
        bookings.forEach(b => {
            const iso = b.tarikh;
            if (!bookedSlots[iso]) bookedSlots[iso] = [];
            bookedSlots[iso].push(b.masa);
        });

        // Proses data kunci ke format objek { 'YYYY-MM-DD': 'Sebab' }
        const lockedDetails = {};
        locks.forEach(l => {
            lockedDetails[l.tarikh] = l.komen;
        });

        return { bookedSlots, lockedDetails };
    },

    /**
     * Menghantar tempahan baharu dengan validasi slot.
     */
    async createBooking(payload) {
        const { tarikh, masa, kod_sekolah } = payload;

        // 1. Validasi Hari (2=Selasa, 3=Rabu, 4=Khamis, 6=Sabtu)
        const day = new Date(tarikh).getDay();
        const allowedDays = [2, 3, 4, 6];
        if (!allowedDays.includes(day)) {
            throw new Error("Tempahan hanya dibenarkan pada hari Selasa, Rabu, Khamis dan Sabtu sahaja.");
        }

        // 2. Semak jika tarikh dikunci
        const { data: isLocked } = await db
            .from('smpid_bb_kunci')
            .select('id')
            .eq('tarikh', tarikh)
            .maybeSingle();
        
        if (isLocked) throw new Error("Maaf, tarikh ini telah dikunci oleh pentadbir.");

        // 3. Semak ketersediaan slot
        const { data: existing } = await db
            .from('smpid_bb_tempahan')
            .select('id')
            .eq('tarikh', tarikh)
            .eq('masa', masa)
            .eq('status', 'AKTIF')
            .maybeSingle();

        if (existing) throw new Error(`Slot ${masa} pada tarikh tersebut telah ditempah.`);

        // 4. Jana ID Tempahan Unik (Format: YYMMDD-KOD-RAND)
        const ymd = tarikh.replace(/-/g, '').substring(2);
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const bookingId = `${ymd}-${kod_sekolah.slice(-3)}-${rand}`;

        // 5. Simpan ke Database
        const { error } = await db
            .from('smpid_bb_tempahan')
            .insert([{
                id_tempahan: bookingId,
                ...payload,
                status: 'AKTIF',
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;
        return { success: true, bookingId };
    },

    /**
     * Mendapatkan semua tempahan aktif untuk Panel Admin.
     */
    async getAllActiveBookings() {
        const { data, error } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('status', 'AKTIF')
            .order('tarikh', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * Admin: Membatalkan tempahan.
     */
    async adminCancelBooking(id, reason) {
        const newNote = `Dibatalkan oleh Admin pada ${new Date().toLocaleString('ms-MY')}. Sebab: ${reason}`;
        
        const { error } = await db
            .from('smpid_bb_tempahan')
            .update({ 
                status: 'BATAL',
                catatan: newNote
            })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Admin: Kunci atau Buka Kunci Tarikh.
     */
    async toggleDateLock(tarikh, note, adminEmail) {
        // Semak jika sudah wujud kunci
        const { data: existing } = await db
            .from('smpid_bb_kunci')
            .select('id')
            .eq('tarikh', tarikh)
            .maybeSingle();

        if (existing) {
            // Buka Kunci (Padam Rekod)
            const { error } = await db
                .from('smpid_bb_kunci')
                .delete()
                .eq('tarikh', tarikh);
            
            if (error) throw error;
            return { success: true, action: 'UNLOCKED' };
        } else {
            // Kunci Tarikh (Tambah Rekod)
            const { error } = await db
                .from('smpid_bb_kunci')
                .insert([{
                    tarikh,
                    komen: note,
                    admin_email: adminEmail,
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;
            return { success: true, action: 'LOCKED' };
        }
    }
};