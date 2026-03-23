/**
 * BOOKING SERVICE (MODUL BIMBINGAN & BENGKEL - BB)
 * Purpose: Manages CRUD operations for workshop bookings and admin date locks.
 * Version: 7.0 (Statewide Schema Optimization & Audit Trail)
 * --- UPDATE V7.0 ---
 * 1. Menggantikan penggunaan `admin_email` kepada `kod_ppd` ('ALL' atau kod daerah) untuk kunci tarikh.
 * 2. Menambah jejak audit menggunakan lajur `dikunci_oleh`.
 * 3. Logik pengesahan silang yang dioptimumkan menggunakan klausa `.or()`.
 */

import { getDatabaseClient } from '../core/db.js';
import { APP_CONFIG } from '../config/app.config.js';

export const BookingService = {
    /**
     * Mengambil data tempahan dan tarikh dikunci untuk bulan tertentu.
     * Digunakan untuk menjana grid kalendar interaktif.
     * @param {number} year - Tahun yang dipilih.
     * @param {number} month - Indeks bulan (0-11).
     */
    async getMonthlyData(year, month) {
        const db = getDatabaseClient();
        
        // Memastikan format bulan 2 digit dan menentukan julat tarikh
        const pad = (n) => n.toString().padStart(2, '0');
        const startStr = `${year}-${pad(month + 1)}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endStr = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

        // --- RBAC DAERAH INJECTION ---
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
        let validCodes = [];
        let ppdOwner = 'M030'; // Lalai
        
        // Kenal pasti daerah sekolah yang mengakses kalendar
        if (userKod) {
            const { data: sData } = await db.from('smpid_sekolah_data').select('daerah').eq('kod_sekolah', userKod).maybeSingle();
            const daerah = sData ? sData.daerah : 'ALOR GAJAH';
            
            if (APP_CONFIG.PPD_MAPPING) {
                for (const [k, v] of Object.entries(APP_CONFIG.PPD_MAPPING)) {
                    if (v === daerah) { ppdOwner = k; break; }
                }
            }
            
            // Senaraikan semua sekolah dalam daerah yang sama
            const { data: sList } = await db.from('smpid_sekolah_data').select('kod_sekolah').eq('daerah', daerah);
            if (sList) validCodes = sList.map(x => x.kod_sekolah);
        }

        // 1. Ambil Tempahan Aktif (Ditapis mengikut daerah)
        let queryB = db.from('smpid_bb_tempahan')
            .select('*')
            .eq('status', 'AKTIF')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr);
            
        if (validCodes.length > 0) {
            queryB = queryB.in('kod_sekolah', validCodes);
        }

        const { data: bookings, error: errB } = await queryB;

        if (errB) {
            console.error("[BookingService] Ralat mengambil data tempahan:", errB);
            throw errB;
        }

        // 2. Ambil Kunci Tarikh Admin (Statewide 'ALL' atau Spesifik PPD)
        const { data: locks, error: errL } = await db
            .from('smpid_bb_kunci')
            .select('*')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr)
            .or(`kod_ppd.eq.ALL,kod_ppd.eq.${ppdOwner}`); 

        if (errL) {
            console.error("[BookingService] Ralat mengambil data kunci:", errL);
            throw errL;
        }

        // Susun tempahan ke dalam objek mengikut tarikh (ISO string)
        const bookedSlots = {};
        bookings.forEach(b => {
            const dateOnly = b.tarikh.split('T')[0]; 
            if (!bookedSlots[dateOnly]) bookedSlots[dateOnly] = [];
            // Masukkan nilai slot ('Pagi', 'Petang', atau '1 HARI')
            bookedSlots[dateOnly].push(b.masa);
        });

        // Susun kunci tarikh ke dalam objek mengikut tarikh (ISO string)
        const lockedDetails = {};
        locks.forEach(l => {
            const dateOnly = l.tarikh.split('T')[0];
            lockedDetails[dateOnly] = l.komen;
        });

        return { bookedSlots, lockedDetails };
    },

    /**
     * Menghantar tempahan baharu dengan validasi ketat dan notifikasi Telegram.
     * @param {Object} payload - Data butiran tempahan.
     */
    async createBooking(payload) {
        const db = getDatabaseClient();
        const { tarikh, masa, kod_sekolah, nama_sekolah, tajuk_bengkel, nama_pic, no_tel_pic } = payload;

        // Validasi 1: Hari Operasi yang Dibenarkan (Sel, Rab, Kha, Sab)
        const day = new Date(tarikh).getDay();
        const allowedDays = [2, 3, 4, 6];
        
        if (!allowedDays.includes(day)) {
            throw new Error("Sesi bimbingan hanya dibenarkan pada hari Selasa, Rabu, Khamis dan Sabtu sahaja.");
        }

        // Validasi 2: Logik Spesifik Hari & Masa
        // Sabtu: Hanya Pagi
        if (day === 6 && masa !== 'Pagi') {
            throw new Error("Maaf, sesi bimbingan pada hari Sabtu hanya dibuka untuk slot PAGI sahaja.");
        }
        // '1 HARI': Hanya Selasa (2), Rabu (3), Khamis (4)
        if (masa === '1 HARI' && ![2, 3, 4].includes(day)) {
            throw new Error("Opsyen '1 HARI' hanya tersedia untuk hari Selasa, Rabu, dan Khamis sahaja.");
        }

        // --- RBAC DAERAH INJECTION UNTUK KAWALAN PERTINDIHAN (COLLISION) ---
        const { data: sData } = await db.from('smpid_sekolah_data').select('daerah').eq('kod_sekolah', kod_sekolah).maybeSingle();
        const daerah = sData ? sData.daerah : 'ALOR GAJAH';
        
        let ppdOwner = 'M030';
        if (APP_CONFIG.PPD_MAPPING) {
            for (const [k, v] of Object.entries(APP_CONFIG.PPD_MAPPING)) {
                if (v === daerah) { ppdOwner = k; break; }
            }
        }
        
        const { data: sList } = await db.from('smpid_sekolah_data').select('kod_sekolah').eq('daerah', daerah);
        const validCodes = sList ? sList.map(x => x.kod_sekolah) : [kod_sekolah];

        // Validasi 3: Semak jika tarikh telah dikunci oleh Admin (Global atau Daerah ini)
        const { data: isLocked } = await db
            .from('smpid_bb_kunci')
            .select('id')
            .eq('tarikh', tarikh)
            .or(`kod_ppd.eq.ALL,kod_ppd.eq.${ppdOwner}`)
            .maybeSingle();
        
        if (isLocked) {
            throw new Error("Tarikh ini telah dikunci oleh pentadbir bagi urusan rasmi jabatan.");
        }

        // Validasi 4: Konflik Masa & Kapasiti (Saringan Khusus Daerah)
        if (masa === '1 HARI') {
            // Jika user minta 1 HARI, pastikan TIADA sebarang tempahan lain (Pagi atau Petang) dalam daerah ini
            const { data: anyBooking } = await db
                .from('smpid_bb_tempahan')
                .select('id')
                .eq('tarikh', tarikh)
                .eq('status', 'AKTIF')
                .in('kod_sekolah', validCodes)
                .maybeSingle();
            
            if (anyBooking) {
                throw new Error("Permohonan '1 HARI' gagal kerana terdapat sesi lain (Pagi/Petang) yang telah ditempah pada tarikh ini.");
            }
        } else {
            // A. Cek konflik langsung (Slot sama diambil dalam daerah yang sama)
            const { data: sameSlot } = await db
                .from('smpid_bb_tempahan')
                .select('id')
                .eq('tarikh', tarikh)
                .eq('masa', masa)
                .eq('status', 'AKTIF')
                .in('kod_sekolah', validCodes)
                .maybeSingle();

            if (sameSlot) {
                throw new Error(`Maaf, slot ${masa.toUpperCase()} pada tarikh tersebut telah ditempah.`);
            }

            // B. Cek konflik dengan '1 HARI' (Slot Full Day diambil oleh orang lain di daerah sama)
            const { data: fullDayBooking } = await db
                .from('smpid_bb_tempahan')
                .select('id')
                .eq('tarikh', tarikh)
                .eq('masa', '1 HARI')
                .eq('status', 'AKTIF')
                .in('kod_sekolah', validCodes)
                .maybeSingle();
            
            if (fullDayBooking) {
                throw new Error("Tarikh ini telah ditempah PENUH (1 HARI) oleh sekolah lain.");
            }
        }

        // Logik: Jana ID Tempahan Unik (Format: YYMMDD-SCH-RAND)
        const ymd = tarikh.replace(/-/g, '').substring(2); 
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const bookingId = `${ymd}-${kod_sekolah.slice(-3)}-${rand}`;

        // Tindakan DB: Masukkan rekod baharu
        const { error } = await db
            .from('smpid_bb_tempahan')
            .insert([{
                id_tempahan: bookingId,
                tarikh: tarikh,
                masa: masa,
                kod_sekolah: kod_sekolah,
                nama_sekolah: nama_sekolah,
                tajuk_bengkel: tajuk_bengkel,
                nama_pic: nama_pic,
                no_tel_pic: no_tel_pic,
                status: 'AKTIF',
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;

        // Enjin Notifikasi Telegram
        if (APP_CONFIG.API.DENO_URL) {
            fetch(`${APP_CONFIG.API.DENO_URL}/notify-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kod: kod_sekolah,
                    nama: nama_sekolah,
                    tajuk: tajuk_bengkel,
                    tarikh: tarikh,
                    masa: masa,
                    pic: nama_pic,
                    tel: no_tel_pic
                })
            }).catch(err => console.warn("[BookingService] Kegagalan notifikasi senyap:", err));
        }

        return { success: true, bookingId };
    },

    /**
     * Admin Function: Mengambil semua tempahan aktif untuk paparan senarai.
     */
    async getAllActiveBookings() {
        const db = getDatabaseClient();
        const { data, error } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('status', 'AKTIF')
            .order('tarikh', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * Admin Function: Mengambil semua data tarikh yang dikunci secara global.
     * Ditapis mengikut PPD supaya paparan senarai terkawal.
     */
    async getAllLocks() {
        const db = getDatabaseClient();
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        
        let query = db.from('smpid_bb_kunci').select('*').order('tarikh', { ascending: true });

        // Tapis mengikut PPD jika pengguna bukan Super Admin / JPNMEL
        // Tambahkan klausa '.or' untuk melihat kunci 'ALL' dan PPD sendiri sahaja
        if (['ADMIN', 'PPD_UNIT'].includes(userRole) && userKod) {
            query = query.or(`kod_ppd.eq.ALL,kod_ppd.eq.${userKod}`);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    },

    /**
     * User Function: Mengambil sejarah tempahan mengikut kod sekolah.
     * @param {string} kodSekolah - Kod sekolah pengguna.
     */
    async getSchoolBookings(kodSekolah) {
        const db = getDatabaseClient();
        const { data, error } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Admin Function: Memadam rekod tempahan secara kekal (Hard Delete).
     * @param {number} id - Kunci utama dalam pangkalan data.
     */
    async adminCancelBooking(id) {
        const db = getDatabaseClient();
        
        // Menjalankan operasi DELETE secara fizikal pada pangkalan data
        const { error } = await db
            .from('smpid_bb_tempahan')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Admin Function: Menguruskan kunci tarikh secara anjal.
     * Boleh mengunci (LOCK), buka kunci (UNLOCK), atau kemaskini ulasan (UPDATE).
     * Menggunakan lajur 'kod_ppd' dan menyimpan rekod auditable 'dikunci_oleh'.
     * @param {string} action - 'LOCK', 'UNLOCK', atau 'UPDATE'
     * @param {string} tarikh - Rentetan tarikh ISO.
     * @param {string} note - Sebab atau ulasan kunci.
     * @param {Array<string>} ppdCodes - Senarai kod PPD.
     */
    async manageDateLock(action, tarikh, note, ppdCodes) {
        const db = getDatabaseClient();

        // Logik Penentuan Skop Keseluruhan Negeri vs Daerah Spesifik
        let scope = 'M030';
        if (Array.isArray(ppdCodes)) {
            // Jika array mengandungi pelbagai PPD (lebih dari 1), anggap ia adalah 'ALL'
            if (ppdCodes.length > 1) scope = 'ALL';
            else if (ppdCodes.length === 1) scope = ppdCodes[0];
        }

        // Dapatkan Identiti Pentadbir untuk Jejak Audit
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE) || 'ADMIN';
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || 'PPD';
        const dikunciOlehIdentifier = `${userRole} (${userKod})`;

        if (action === 'UNLOCK') {
            const { error } = await db
                .from('smpid_bb_kunci')
                .delete()
                .eq('tarikh', tarikh)
                .eq('kod_ppd', scope);
            
            if (error) throw error;
            return { success: true, action: 'UNLOCKED' };
        }

        if (action === 'UPDATE') {
            const { error } = await db
                .from('smpid_bb_kunci')
                .update({ 
                    komen: note,
                    dikunci_oleh: dikunciOlehIdentifier
                })
                .eq('tarikh', tarikh)
                .eq('kod_ppd', scope);
            
            if (error) throw error;
            return { success: true, action: 'UPDATED' };
        }

        if (action === 'LOCK') {
            // Buang kunci sedia ada untuk skop yang sama bagi mengelak duplikasi pangkalan data
            await db
                .from('smpid_bb_kunci')
                .delete()
                .eq('tarikh', tarikh)
                .eq('kod_ppd', scope);

            const { error } = await db
                .from('smpid_bb_kunci')
                .insert([{
                    tarikh: tarikh,
                    komen: note,
                    kod_ppd: scope,
                    dikunci_oleh: dikunciOlehIdentifier,
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;
            return { success: true, action: 'LOCKED' };
        }
        
        throw new Error("Tindakan pengurusan kunci tarikh tidak sah.");
    }
};