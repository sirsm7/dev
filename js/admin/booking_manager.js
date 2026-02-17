/**
 * ADMIN MODULE: BOOKING MANAGER (PRO EDITION - V2.0 REFACTOR)
 * Fungsi: Menguruskan sistem tempahan bimbingan bagi pihak PPD.
 * --- UPDATE V2.0 ---
 * 1. Visual Upgrade: Menggunakan reka bentuk 'Day Card' (Jubin) selaras dengan modul pengguna.
 * 2. Date Fix: Membaiki ralat 'off-by-one' dengan membina tarikh secara manual (Local Time) bukannya UTC.
 * 3. UX: Indikator status visual yang lebih jelas (Ikon, Warna, Label).
 */

import { BookingService } from '../services/booking.service.js';
import { toggleLoading } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

// --- STATE MANAGEMENT ---
let adminCurrentMonth = new Date().getMonth();
let adminCurrentYear = new Date().getFullYear();
let activeBookings = [];
let adminSelectedDate = null; 

const ALLOWED_DAYS = [2, 3, 4, 6]; // Selasa, Rabu, Khamis, Sabtu
const MALAY_MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const DAY_NAMES = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

/**
 * Inisialisasi Modul Booking Admin (EntryPoint)
 * Hanya dijalankan apabila Tab Tempahan dibuka.
 */
window.initAdminBooking = async function() {
    const wrapper = document.getElementById('tab-tempahan');
    if (!wrapper) return;

    // Bina struktur HTML asas jika belum wujud dalam tab
    if (!document.getElementById('bookingAdminContent')) {
        wrapper.innerHTML = `
            <div class="p-6 md:p-8" id="bookingAdminContent">
                <!-- HEADER SEKSYEN -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-100 pb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-800 tracking-tight">Pengurusan Bimbingan & Bengkel</h2>
                        <p class="text-slate-500 text-sm">Kawal baki slot, kunci tarikh daerah, dan semak tempahan aktif.</p>
                    </div>
                    <div class="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
                        <button onclick="switchAdminBookingView('calendar')" id="btnViewCal" class="px-6 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md transition-all transform scale-105">KALENDAR</button>
                        <button onclick="switchAdminBookingView('list')" id="btnViewList" class="px-6 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 transition-all">SENARAI AKTIF</button>
                    </div>
                </div>

                <!-- VIEW 1: KALENDAR (LOCKING SYSTEM) -->
                <div id="adminBookingCalendarView" class="animate-fade-up">
                    <div class="grid grid-cols-1 lg:grid-cols-1 gap-8">
                        <div>
                            <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <div class="p-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                    <button onclick="changeAdminMonth(-1)" class="w-10 h-10 rounded-full bg-white hover:shadow-md border border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-600 transition-all"><i class="fas fa-chevron-left"></i></button>
                                    <h3 id="adminMonthLabel" class="font-black text-slate-800 uppercase tracking-tighter text-base">Bulan</h3>
                                    <button onclick="changeAdminMonth(1)" class="w-10 h-10 rounded-full bg-white hover:shadow-md border border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-600 transition-all"><i class="fas fa-chevron-right"></i></button>
                                </div>
                                <div class="p-6">
                                    <!-- Legend -->
                                    <div class="flex flex-wrap gap-4 justify-center mb-6 bg-slate-100/50 p-3 rounded-xl border border-slate-200/50">
                                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-white border-2 border-slate-300 shadow-sm"></span> <span class="text-[10px] font-bold text-slate-500 uppercase">Kosong</span></div>
                                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-amber-100 border-2 border-amber-400 shadow-sm"></span> <span class="text-[10px] font-bold text-slate-500 uppercase">1 Slot</span></div>
                                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-red-100 border-2 border-red-400 shadow-sm"></span> <span class="text-[10px] font-bold text-slate-500 uppercase">Penuh</span></div>
                                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-purple-100 border-2 border-purple-400 shadow-sm"></span> <span class="text-[10px] font-bold text-slate-500 uppercase">Dikunci</span></div>
                                    </div>

                                    <div id="adminCalendarGrid" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- VIEW 2: SENARAI AKTIF (JADUAL) -->
                <div id="adminBookingListView" class="hidden animate-fade-up">
                    <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm text-left">
                                <thead class="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                                    <tr>
                                        <th class="px-8 py-5">Tarikh & Masa</th>
                                        <th class="px-8 py-5">Sekolah / Tajuk Bengkel</th>
                                        <th class="px-8 py-5">PIC Hubungan</th>
                                        <th class="px-8 py-5 text-center">Tindakan</th>
                                    </tr>
                                </thead>
                                <tbody id="adminBookingTableBody" class="divide-y divide-slate-100"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Papar data permulaan
    window.renderAdminBookingCalendar();
    window.loadAdminBookingList();
};

/**
 * Menukar antara paparan Kalendar dan Senarai
 */
window.switchAdminBookingView = function(view) {
    const btnCal = document.getElementById('btnViewCal');
    const btnList = document.getElementById('btnViewList');
    const viewCal = document.getElementById('adminBookingCalendarView');
    const viewList = document.getElementById('adminBookingListView');

    if (!btnCal || !btnList || !viewCal || !viewList) return;

    if (view === 'calendar') {
        btnCal.className = "px-6 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md transition-all transform scale-105";
        btnList.className = "px-6 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 transition-all";
        viewCal.classList.remove('hidden');
        viewList.classList.add('hidden');
    } else {
        btnList.className = "px-6 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md transition-all transform scale-105";
        btnCal.className = "px-6 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 transition-all";
        viewList.classList.remove('hidden');
        viewCal.classList.add('hidden');
    }
};

/**
 * Membina Grid Kalendar (Admin Side) - VERSI JUBIN VISUAL
 * Fix: Menggunakan pembinaan tarikh manual YYYY-MM-DD untuk elak isu zon masa.
 */
window.renderAdminBookingCalendar = async function() {
    const grid = document.getElementById('adminCalendarGrid');
    const label = document.getElementById('adminMonthLabel');
    if (!grid || !label) return;

    grid.innerHTML = `<div class="col-span-full py-20 text-center flex flex-col items-center justify-center">
        <i class="fas fa-circle-notch fa-spin text-slate-300 text-3xl mb-4"></i>
        <p class="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Menjana Kalendar...</p>
    </div>`;
    
    label.innerText = `${MALAY_MONTHS[adminCurrentMonth]} ${adminCurrentYear}`;

    try {
        const { bookedSlots, lockedDetails } = await BookingService.getMonthlyData(adminCurrentYear, adminCurrentMonth);
        grid.innerHTML = "";

        const daysInMonth = new Date(adminCurrentYear, adminCurrentMonth + 1, 0).getDate();
        const pad = (n) => n.toString().padStart(2, '0');
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset masa untuk perbandingan tarikh bersih

        // Jana Jubin Tarikh (Tanpa Padding Hari Kosong untuk paparan grid moden)
        for (let d = 1; d <= daysInMonth; d++) {
            // FIX DATE BUG: Bina string tarikh manual ikut tahun/bulan semasa
            const dateString = `${adminCurrentYear}-${pad(adminCurrentMonth + 1)}-${pad(d)}`;
            
            // Objek tarikh untuk perbandingan logik (bukan untuk string)
            const dateObj = new Date(adminCurrentYear, adminCurrentMonth, d);
            const dayOfWeek = dateObj.getDay(); // 0=Ahad, 1=Isnin...
            
            const isAllowedDay = ALLOWED_DAYS.includes(dayOfWeek);
            const isLocked = lockedDetails.hasOwnProperty(dateString);
            const slotsTaken = bookedSlots[dateString] || [];
            
            // Logik Status Visual
            let status = 'open';
            let statusText = 'KOSONG';
            let statusIcon = 'fa-check-circle';
            
            // Keutamaan Status
            if (isLocked) {
                status = 'locked';
                statusText = 'DIKUNCI';
                statusIcon = 'fa-lock';
            } else if (!isAllowedDay) {
                status = 'closed';
                statusText = 'TIADA SESI';
                statusIcon = 'fa-ban';
            } else if (slotsTaken.length >= 2) {
                status = 'full';
                statusText = 'PENUH';
                statusIcon = 'fa-users-slash';
            } else if (slotsTaken.length === 1) {
                status = 'partial';
                statusText = '1 SLOT BAKI';
                statusIcon = 'fa-exclamation-circle';
            }

            // Warna Ikon & Badge (Mengikut CSS admin.html)
            let iconColor = 'text-brand-600 bg-brand-100';
            if (status === 'full') iconColor = 'text-red-600 bg-red-100';
            if (status === 'locked') iconColor = 'text-purple-600 bg-purple-100';
            if (status === 'partial') iconColor = 'text-amber-600 bg-amber-100';
            if (status === 'closed') iconColor = 'text-slate-400 bg-slate-200';

            const lockedMsg = isLocked ? `<div class="text-[9px] text-purple-600 font-black mt-1 uppercase wrap-safe leading-tight bg-purple-50 p-1 rounded border border-purple-100">${lockedDetails[dateString] || 'ADMIN LOCK'}</div>` : '';

            const isSelected = (dateString === adminSelectedDate);
            
            const card = document.createElement('div');
            // Guna kelas CSS .day-card dan .card-* dari admin.html
            card.className = `day-card card-${status} ${isSelected ? 'card-active' : ''}`;
            
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">${DAY_NAMES[dayOfWeek]}</span>
                        <span class="text-3xl font-black text-slate-800 leading-none">${d}</span>
                    </div>
                    <div class="${iconColor} w-9 h-9 rounded-2xl flex items-center justify-center text-sm shadow-sm transition-transform group-hover:rotate-12">
                        <i class="fas ${statusIcon}"></i>
                    </div>
                </div>
                
                <div class="mt-auto pt-4">
                    <span class="inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${iconColor} border border-black/5">
                        ${statusText}
                    </span>
                    ${lockedMsg}
                </div>
            `;

            // Admin boleh klik untuk kunci/buka kunci pada mana-mana hari (kecuali hari tutup kekal jika mahu)
            // Logik: Admin boleh override hari tutup juga jika perlu, tapi kita fokus hari bimbingan dulu.
            // Untuk memudahkan, kita benarkan admin klik SEMUA hari yang 'Allowed' ATAU 'Locked'.
            if (isAllowedDay || isLocked) {
                card.onclick = () => {
                    adminSelectedDate = dateString;
                    window.renderAdminBookingCalendar(); 
                    handleAdminDateAction(dateString, isLocked);
                };
            }

            grid.appendChild(card);
        }
    } catch (e) {
        console.error("[AdminBooking] Calendar Error:", e);
        grid.innerHTML = `<div class="col-span-full py-20 text-center text-red-500 font-bold bg-red-50 rounded-2xl border border-red-100">Ralat pangkalan data kalendar.</div>`;
    }
};

/**
 * Handle Kunci/Buka Tarikh
 * Integriti: Memaksa catatan menjadi UPPERCASE secara automatik.
 */
async function handleAdminDateAction(iso, currentlyLocked) {
    if (currentlyLocked) {
        Swal.fire({
            title: 'Buka Kunci Tarikh?',
            html: `<div class="text-center mb-4"><span class="text-3xl font-black text-slate-800">${iso}</span></div>
                   <p class="text-sm text-slate-500">Adakah anda pasti mahu membuka semula tarikh ini untuk tempahan sekolah?</p>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Ya, Buka Akses',
            cancelButtonText: 'Batal',
            customClass: { popup: 'rounded-3xl' }
        }).then(async (r) => {
            if (r.isConfirmed) {
                toggleLoading(true);
                try {
                    // Gunakan ID dari localStorage jika ada, fallback ke 'ADMIN'
                    const adminId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID) || 'ADMIN';
                    await BookingService.toggleDateLock(iso, '', adminId);
                    toggleLoading(false);
                    adminSelectedDate = null;
                    window.renderAdminBookingCalendar();
                    Swal.fire({ icon: 'success', title: 'Dibuka', timer: 1000, showConfirmButton: false });
                } catch (err) {
                    toggleLoading(false);
                    Swal.fire('Ralat', 'Gagal membuka kunci tarikh.', 'error');
                }
            } else {
                adminSelectedDate = null;
                window.renderAdminBookingCalendar();
            }
        });
    } else {
        const { value: note } = await Swal.fire({
            title: 'Kunci Tarikh Ini?',
            html: `<div class="text-center mb-4"><span class="text-3xl font-black text-purple-600">${iso}</span></div>
                   <p class="text-sm text-slate-500 mb-4 px-4">Nyatakan sebab (Contoh: CUTI UMUM). Tempahan sekolah akan disekat.</p>`,
            input: 'text',
            inputPlaceholder: 'Sila masukkan sebab kunci...',
            showCancelButton: true,
            confirmButtonColor: '#7c3aed',
            confirmButtonText: 'KUNCI SEKARANG',
            cancelButtonText: 'Batal',
            customClass: { popup: 'rounded-3xl', input: 'rounded-xl font-bold uppercase mx-4 shadow-sm' },
            preConfirm: (val) => {
                if (!val) return Swal.showValidationMessage('Sebab atau catatan wajib diisi.');
                return val.toUpperCase(); // AUTO UPPERCASE
            }
        });

        if (note) {
            toggleLoading(true);
            try {
                const adminId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID) || 'ADMIN';
                await BookingService.toggleDateLock(iso, note, adminId);
                toggleLoading(false);
                adminSelectedDate = null;
                window.renderAdminBookingCalendar();
                Swal.fire({ icon: 'success', title: 'Dikunci', timer: 1000, showConfirmButton: false });
            } catch (err) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal mengunci tarikh.', 'error');
            }
        } else {
            adminSelectedDate = null;
            window.renderAdminBookingCalendar();
        }
    }
}

/**
 * Memuatkan Senarai Tempahan Aktif ke dalam Jadual
 * Integriti: Menggunakan 'wrap-safe' untuk memastikan teks panjang tidak terpotong.
 */
window.loadAdminBookingList = async function() {
    const tbody = document.getElementById('adminBookingTableBody');
    if (!tbody) return;

    try {
        const data = await BookingService.getAllActiveBookings();
        activeBookings = data;

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-24 text-center text-slate-400 font-medium italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">Tiada permohonan tempahan buat masa ini.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(b => {
            const dateStr = new Date(b.tarikh).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
            return `
                <tr class="hover:bg-slate-50/80 transition-all group">
                    <td class="px-8 py-6">
                        <div class="font-black text-slate-800 text-sm tracking-tight uppercase">${dateStr}</div>
                        <div class="flex items-center gap-2 mt-1.5">
                            <span class="text-[9px] font-black px-2 py-0.5 rounded ${b.masa === 'Pagi' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'} uppercase tracking-tighter">${b.masa}</span>
                            <span class="text-[10px] text-slate-400 font-mono font-bold">${b.id_tempahan}</span>
                        </div>
                    </td>
                    <td class="px-8 py-6">
                        <!-- Integriti Teks: wrap-safe class used -->
                        <div class="font-bold text-brand-600 text-sm leading-snug mb-1.5 wrap-safe max-w-xs group-hover:text-brand-700 transition-colors uppercase">${b.nama_sekolah}</div>
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest wrap-safe leading-relaxed">${b.tajuk_bengkel || 'TIADA TAJUK SPESIFIK'}</div>
                    </td>
                    <td class="px-8 py-6">
                        <div class="font-bold text-slate-700 text-xs uppercase wrap-safe">${b.nama_pic}</div>
                        <a href="https://wa.me/${b.no_tel_pic.replace(/[^0-9]/g, '')}" target="_blank" class="text-[10px] text-blue-500 font-black hover:underline inline-flex items-center gap-1.5 mt-1">
                            <i class="fab fa-whatsapp"></i> ${b.no_tel_pic}
                        </a>
                    </td>
                    <td class="px-8 py-6 text-center">
                        <button onclick="cancelBookingAdmin(${b.id}, '${b.id_tempahan}')" class="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center mx-auto group-active:scale-95" title="Batal Tempahan">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error("[AdminBooking] List Load Error:", e);
        tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-red-500 font-bold bg-red-50 border border-red-100">Gagal memproses senarai tempahan dari pelayan.</td></tr>`;
    }
};

/**
 * Membatalkan Tempahan (Aksi Pentadbir)
 */
window.cancelBookingAdmin = async function(dbId, bookingId) {
    const { value: reason } = await Swal.fire({
        title: 'Batal Tempahan?',
        html: `<div class="text-center p-5 bg-red-50 rounded-2xl border border-red-100 mb-4 shadow-inner">
                 <p class="text-xs text-red-400 font-bold uppercase tracking-widest mb-1">ID Permohonan:</p>
                 <p class="text-xl font-black text-red-600 font-mono">${bookingId}</p>
               </div>
               <p class="text-sm text-slate-500 leading-relaxed px-4">Tindakan ini kekal. Sila nyatakan sebab pembatalan bagi tujuan rekod sistem.</p>`,
        icon: 'warning',
        input: 'text',
        inputPlaceholder: 'Taip sebab pembatalan...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'YA, BATALKAN',
        cancelButtonText: 'TUTUP',
        customClass: { popup: 'rounded-[2rem]', input: 'rounded-xl font-bold uppercase mx-4 shadow-sm' },
        preConfirm: (value) => {
            if (!value) return Swal.showValidationMessage('Sila nyatakan sebab pembatalan.');
            return value.toUpperCase(); // AUTO UPPERCASE
        }
    });

    if (reason) {
        toggleLoading(true);
        try {
            await BookingService.adminCancelBooking(dbId, reason);
            toggleLoading(false);
            Swal.fire({ icon: 'success', title: 'Berjaya Dibatalkan', text: 'Permohonan telah dimansuhkan.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
            window.loadAdminBookingList();
            window.renderAdminBookingCalendar(); // Refresh calendar to free up slots
        } catch (e) {
            toggleLoading(false);
            Swal.fire({ icon: 'error', title: 'Ralat Pembatalan', text: 'Gagal mengemaskini status tempahan.', customClass: { popup: 'rounded-[2rem]' } });
        }
    }
};

/**
 * Navigasi Bulan Kalendar Admin
 */
window.changeAdminMonth = function(offset) {
    adminCurrentMonth += offset;
    adminSelectedDate = null; // Reset pemilihan tarikh bila tukar bulan
    
    if (adminCurrentMonth > 11) { 
        adminCurrentMonth = 0; 
        adminCurrentYear++; 
    } else if (adminCurrentMonth < 0) { 
        adminCurrentMonth = 11; 
        adminCurrentYear--; 
    }
    window.renderAdminBookingCalendar();
};