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
        // Fix: Construct Local Date Strings for DB Query to avoid Timezone Shift
        // Kita guna string format YYYY-MM-DD untuk query range
        
        const pad = (n) => n.toString().padStart(2, '0');
        // Bulan dalam JS 0-11, perlu +1 untuk string
        const startStr = `${year}-${pad(month + 1)}-01`;
        
        // Cari hari terakhir bulan
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endStr = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

        // 1. Ambil Tempahan Aktif
        const { data: bookings, error: errB } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('status', 'AKTIF')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr);

        if (errB) throw errB;

        // 2. Ambil Tarikh Dikunci Admin
        const { data: locks, error: errL } = await db
            .from('smpid_bb_kunci')
            .select('*')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr);

        if (errL) throw errL;

        // Proses data tempahan ke format objek { 'YYYY-MM-DD': ['Pagi', 'Petang'] }
        const bookedSlots = {};
        bookings.forEach(b => {
            // Pastikan kita ambil tarikh sahaja (YYYY-MM-DD)
            // Split untuk keselamatan jika DB return full ISO timestamp
            const dateOnly = b.tarikh.split('T')[0]; 
            
            if (!bookedSlots[dateOnly]) bookedSlots[dateOnly] = [];
            bookedSlots[dateOnly].push(b.masa);
        });

        // Proses data kunci ke format objek { 'YYYY-MM-DD': 'Sebab' }
        const lockedDetails = {};
        locks.forEach(l => {
            const dateOnly = l.tarikh.split('T')[0];
            lockedDetails[dateOnly] = l.komen;
        });

        return { bookedSlots, lockedDetails };
    },

    /**
     * Menghantar tempahan baharu dengan validasi slot.
     */
    async createBooking(payload) {
        const { tarikh, masa, kod_sekolah } = payload;

        // 1. Validasi Hari (2=Selasa, 3=Rabu, 4=Khamis, 6=Sabtu)
        // Nota: new Date('YYYY-MM-DD') menganggap UTC 00:00.
        // Hari minggu adalah konsisten secara global untuk tarikh yang sama.
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
        // Format tarikh YYYY-MM-DD -> YYMMDD
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
     * Mendapatkan sejarah tempahan sekolah tertentu (User View).
     */
    async getSchoolBookings(kodSekolah) {
        const { data, error } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            // Papar semua status (AKTIF/BATAL) untuk sejarah sekolah
            .order('created_at', { ascending: false });

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