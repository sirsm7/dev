/**
 * ADMIN MODULE: BOOKING MANAGER (BB)
 * Menguruskan sistem tempahan bimbingan bagi pihak PPD.
 * Fungsi: Lock/Unlock tarikh, Batal tempahan, Lihat senarai aktif.
 */

import { BookingService } from '../services/booking.service.js';
import { toggleLoading } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

// --- STATE ---
let adminCurrentMonth = new Date().getMonth();
let adminCurrentYear = new Date().getFullYear();
let activeBookings = [];

const ALLOWED_DAYS = [2, 3, 4, 6]; // Sel, Rab, Kha, Sab
const MALAY_MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];

/**
 * Inisialisasi Modul Booking Admin
 */
window.initAdminBooking = async function() {
    const wrapper = document.getElementById('tab-tempahan');
    if (!wrapper) return;

    // Bina struktur asas dalam tab (Jika belum wujud)
    if (!document.getElementById('bookingAdminContent')) {
        wrapper.innerHTML = `
            <div class="p-6 md:p-8" id="bookingAdminContent">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-100 pb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-800">Pengurusan Bimbingan & Bengkel</h2>
                        <p class="text-slate-500 text-sm">Urus baki slot dan tarikh kunci daerah.</p>
                    </div>
                    <div class="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                        <button onclick="switchAdminBookingView('calendar')" id="btnViewCal" class="px-4 py-2 rounded-lg text-xs font-black bg-white text-brand-600 shadow-sm transition-all">KALENDAR</button>
                        <button onclick="switchAdminBookingView('list')" id="btnViewList" class="px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-brand-600 transition-all">SENARAI AKTIF</button>
                    </div>
                </div>

                <!-- VIEW 1: CALENDAR (LOCKING SYSTEM) -->
                <div id="adminBookingCalendarView" class="animate-fade-up">
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div class="lg:col-span-2">
                            <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                <div class="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                    <button onclick="changeAdminMonth(-1)" class="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center text-slate-400"><i class="fas fa-chevron-left"></i></button>
                                    <h3 id="adminMonthLabel" class="font-black text-slate-700 uppercase tracking-tighter text-sm">Bulan</h3>
                                    <button onclick="changeAdminMonth(1)" class="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center text-slate-400"><i class="fas fa-chevron-right"></i></button>
                                </div>
                                <div class="p-4">
                                    <div class="grid grid-cols-7 mb-2">
                                        ${['Aha','Isn','Sel','Rab','Kha','Jum','Sab'].map(d => `<div class="text-center text-[10px] font-black text-slate-300 uppercase py-2">${d}</div>`).join('')}
                                    </div>
                                    <div id="adminCalendarGrid" class="grid grid-cols-7 gap-1"></div>
                                </div>
                            </div>
                        </div>
                        <div class="space-y-4">
                            <div class="bg-purple-50 p-6 rounded-2xl border border-purple-100">
                                <h4 class="font-bold text-purple-700 text-sm mb-2 flex items-center gap-2"><i class="fas fa-lock"></i> Mod Kunci Tarikh</h4>
                                <p class="text-xs text-purple-600/80 leading-relaxed mb-4">Klik pada mana-mana tarikh (Selasa, Rabu, Khamis, Sabtu) untuk mengunci atau membuka tarikh tersebut bagi seluruh daerah.</p>
                                <div class="flex items-center gap-2 text-[10px] font-black text-purple-400 uppercase">
                                    <div class="w-2 h-2 rounded-full bg-purple-500"></div> Tarikh Dikunci
                                </div>
                            </div>
                            <div class="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                                <h4 class="font-bold text-blue-700 text-sm mb-2">Petunjuk Slot</h4>
                                <div class="space-y-2">
                                    <div class="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                        <span>Hijau (2 Slot Sedia)</span>
                                        <div class="w-3 h-3 rounded bg-emerald-500"></div>
                                    </div>
                                    <div class="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                        <span>Kuning (1 Slot Sedia)</span>
                                        <div class="w-3 h-3 rounded bg-amber-500"></div>
                                    </div>
                                    <div class="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                        <span>Merah (Penuh)</span>
                                        <div class="w-3 h-3 rounded bg-red-500"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- VIEW 2: LIST (CANCELLATION SYSTEM) -->
                <div id="adminBookingListView" class="hidden animate-fade-up">
                    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                                <tr>
                                    <th class="px-6 py-4">Tarikh & Masa</th>
                                    <th class="px-6 py-4">Sekolah</th>
                                    <th class="px-6 py-4">PIC</th>
                                    <th class="px-6 py-4 text-center">Tindakan</th>
                                </tr>
                            </thead>
                            <tbody id="adminBookingTableBody" class="divide-y divide-slate-100"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    // Muat data awal
    window.renderAdminBookingCalendar();
    window.loadAdminBookingList();
};

/**
 * Tukar paparan (Kalendar vs Senarai)
 */
window.switchAdminBookingView = function(view) {
    const btnCal = document.getElementById('btnViewCal');
    const btnList = document.getElementById('btnViewList');
    const viewCal = document.getElementById('adminBookingCalendarView');
    const viewList = document.getElementById('adminBookingListView');

    if (view === 'calendar') {
        btnCal.className = "px-4 py-2 rounded-lg text-xs font-black bg-white text-brand-600 shadow-sm transition-all";
        btnList.className = "px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-brand-600 transition-all";
        viewCal.classList.remove('hidden');
        viewList.classList.add('hidden');
    } else {
        btnList.className = "px-4 py-2 rounded-lg text-xs font-black bg-white text-brand-600 shadow-sm transition-all";
        btnCal.className = "px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-brand-600 transition-all";
        viewList.classList.remove('hidden');
        viewCal.classList.add('hidden');
    }
};

/**
 * Render Kalendar Mod Admin (Locking)
 */
window.renderAdminBookingCalendar = async function() {
    const grid = document.getElementById('adminCalendarGrid');
    const label = document.getElementById('adminMonthLabel');
    if (!grid) return;

    grid.innerHTML = `<div class="col-span-7 py-10 text-center text-slate-300 italic text-xs">Memproses data...</div>`;
    label.innerText = `${MALAY_MONTHS[adminCurrentMonth]} ${adminCurrentYear}`;

    try {
        const { bookedSlots, lockedDetails } = await BookingService.getMonthlyData(adminCurrentYear, adminCurrentMonth);
        grid.innerHTML = "";

        const firstDay = new Date(adminCurrentYear, adminCurrentMonth, 1).getDay();
        const daysInMonth = new Date(adminCurrentYear, adminCurrentMonth + 1, 0).getDate();

        // Padding
        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div class="aspect-square bg-slate-50/30"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(adminCurrentYear, adminCurrentMonth, d);
            const iso = dateObj.toISOString().split('T')[0];
            const dow = dateObj.getDay();
            const isAllowed = ALLOWED_DAYS.includes(dow);
            const isLocked = lockedDetails.hasOwnProperty(iso);
            const slots = bookedSlots[iso] || [];

            let bgClass = "bg-white border-slate-100";
            let textClass = "text-slate-400";
            let indicator = "";

            if (isLocked) {
                bgClass = "bg-purple-600 border-purple-600 shadow-inner";
                textClass = "text-white";
                indicator = `<div class="text-[7px] font-black uppercase text-purple-200 mt-1 truncate px-1">${lockedDetails[iso]}</div>`;
            } else if (isAllowed) {
                textClass = "text-slate-700 font-bold";
                if (slots.length >= 2) indicator = `<div class="w-1.5 h-1.5 rounded-full bg-red-500 mx-auto mt-1"></div>`;
                else if (slots.length === 1) indicator = `<div class="w-1.5 h-1.5 rounded-full bg-amber-500 mx-auto mt-1"></div>`;
                else indicator = `<div class="w-1.5 h-1.5 rounded-full bg-emerald-500 mx-auto mt-1"></div>`;
            }

            const tile = document.createElement('div');
            tile.className = `aspect-square border rounded-lg p-1.5 flex flex-col justify-between transition-all hover:border-brand-400 cursor-pointer ${bgClass}`;
            tile.innerHTML = `<span class="text-[10px] ${textClass}">${d}</span>${indicator}`;
            
            tile.onclick = () => handleAdminDateAction(iso, isLocked);
            grid.appendChild(tile);
        }
    } catch (e) {
        console.error(e);
        grid.innerHTML = `<div class="col-span-7 py-10 text-center text-red-400 font-bold">Ralat data.</div>`;
    }
};

/**
 * Handle Kunci/Buka Tarikh
 */
async function handleAdminDateAction(iso, currentlyLocked) {
    if (currentlyLocked) {
        Swal.fire({
            title: 'Buka Kunci Tarikh?',
            text: `Adakah anda ingin membenarkan semula tempahan bagi tarikh ${iso}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Ya, Buka Kunci'
        }).then(async (r) => {
            if (r.isConfirmed) {
                toggleLoading(true);
                await BookingService.toggleDateLock(iso, '', localStorage.getItem(APP_CONFIG.SESSION.USER_ID));
                toggleLoading(false);
                window.renderAdminBookingCalendar();
            }
        });
    } else {
        const { value: note } = await Swal.fire({
            title: 'Kunci Tarikh Ini?',
            text: `Semua tempahan baharu pada ${iso} akan dihalang.`,
            input: 'text',
            inputLabel: 'Sebab Kunci (Cth: Cuti Umum, Mesyuarat PPD)',
            inputPlaceholder: 'Taip catatan di sini...',
            showCancelButton: true,
            confirmButtonColor: '#7c3aed',
            confirmButtonText: 'Kunci Tarikh'
        });

        if (note !== undefined) {
            toggleLoading(true);
            await BookingService.toggleDateLock(iso, note || 'TIADA CATATAN', localStorage.getItem(APP_CONFIG.SESSION.USER_ID));
            toggleLoading(false);
            window.renderAdminBookingCalendar();
        }
    }
}

/**
 * Muat Senarai Tempahan Aktif
 */
window.loadAdminBookingList = async function() {
    const tbody = document.getElementById('adminBookingTableBody');
    if (!tbody) return;

    try {
        const data = await BookingService.getAllActiveBookings();
        activeBookings = data;

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-400 italic">Tiada tempahan aktif buat masa ini.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(b => {
            const dateStr = new Date(b.tarikh).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
            return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4">
                        <div class="font-bold text-slate-700 text-xs">${dateStr}</div>
                        <div class="text-[10px] font-black uppercase text-brand-600 mt-0.5">${b.masa}</div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="font-bold text-slate-800 text-xs leading-tight">${b.nama_sekolah}</div>
                        <div class="text-[9px] font-mono font-bold text-slate-400">${b.kod_sekolah}</div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="font-bold text-slate-600 text-xs">${b.nama_pic}</div>
                        <div class="text-[10px] text-blue-500 font-bold"><i class="fab fa-whatsapp"></i> ${b.no_tel_pic}</div>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="cancelBookingAdmin(${b.id}, '${b.id_tempahan}')" class="p-2 rounded-lg text-slate-300 hover:text-red-500 transition" title="Batal Tempahan">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-red-500">Gagal memuat senarai.</td></tr>`;
    }
};

/**
 * Batal Tempahan (Admin)
 */
window.cancelBookingAdmin = async function(dbId, bookingId) {
    const { value: reason } = await Swal.fire({
        title: 'Batal Tempahan?',
        html: `Anda ingin membatalkan tempahan <b class="text-red-600 font-mono">${bookingId}</b>?`,
        icon: 'warning',
        input: 'text',
        inputLabel: 'Sebab Pembatalan (Wajib)',
        inputPlaceholder: 'Taip sebab di sini...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Batalkan',
        preConfirm: (value) => {
            if (!value) return Swal.showValidationMessage('Sila nyatakan sebab pembatalan.');
            return value;
        }
    });

    if (reason) {
        toggleLoading(true);
        try {
            await BookingService.adminCancelBooking(dbId, reason);
            toggleLoading(false);
            Swal.fire({ icon: 'success', title: 'Dibatalkan', timer: 1500, showConfirmButton: false });
            window.loadAdminBookingList();
            window.renderAdminBookingCalendar();
        } catch (e) {
            toggleLoading(false);
            Swal.fire('Ralat', 'Gagal membatalkan tempahan.', 'error');
        }
    }
};

window.changeAdminMonth = function(offset) {
    adminCurrentMonth += offset;
    if (adminCurrentMonth > 11) { adminCurrentMonth = 0; adminCurrentYear++; }
    else if (adminCurrentMonth < 0) { adminCurrentMonth = 11; adminCurrentYear--; }
    window.renderAdminBookingCalendar();
};