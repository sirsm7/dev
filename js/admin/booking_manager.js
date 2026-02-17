/**
 * ADMIN MODULE: BOOKING MANAGER (BB) - VERSION 1.5
 * Menguruskan sistem tempahan bimbingan bagi pihak PPD.
 * --- UPDATE V1.5 ---
 * 1. Visual Enhancement: Jubin kalendar mempunyai animasi hover (scale/shadow) dan highlight pilihan.
 * 2. Data Integrity: Input catatan kunci tarikh (lock date) dipaksa ke UPPERCASE secara automatik.
 * 3. UX Fix: Menambah transisi halus pada penukaran status tarikh.
 */

import { BookingService } from '../services/booking.service.js';
import { toggleLoading } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

// --- STATE ---
let adminCurrentMonth = new Date().getMonth();
let adminCurrentYear = new Date().getFullYear();
let activeBookings = [];
let adminSelectedDate = null; // Menyimpan tarikh yang sedang diuruskan

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
                        <h2 class="text-2xl font-bold text-slate-800 tracking-tight">Pengurusan Bimbingan & Bengkel</h2>
                        <p class="text-slate-500 text-sm">Kawal baki slot, kunci tarikh daerah, dan batal tempahan.</p>
                    </div>
                    <div class="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
                        <button onclick="switchAdminBookingView('calendar')" id="btnViewCal" class="px-6 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md transition-all transform scale-105">KALENDAR</button>
                        <button onclick="switchAdminBookingView('list')" id="btnViewList" class="px-6 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 transition-all">SENARAI AKTIF</button>
                    </div>
                </div>

                <!-- VIEW 1: CALENDAR (LOCKING SYSTEM) -->
                <div id="adminBookingCalendarView" class="animate-fade-up">
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div class="lg:col-span-2">
                            <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <div class="p-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                    <button onclick="changeAdminMonth(-1)" class="w-10 h-10 rounded-full bg-white hover:shadow-md border border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-600 transition-all"><i class="fas fa-chevron-left"></i></button>
                                    <h3 id="adminMonthLabel" class="font-black text-slate-800 uppercase tracking-tighter text-base">Bulan</h3>
                                    <button onclick="changeAdminMonth(1)" class="w-10 h-10 rounded-full bg-white hover:shadow-md border border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-600 transition-all"><i class="fas fa-chevron-right"></i></button>
                                </div>
                                <div class="p-6">
                                    <div class="grid grid-cols-7 mb-3">
                                        ${['Aha','Isn','Sel','Rab','Kha','Jum','Sab'].map(d => `<div class="text-center text-[10px] font-black text-slate-300 uppercase py-2 tracking-widest">${d}</div>`).join('')}
                                    </div>
                                    <div id="adminCalendarGrid" class="grid grid-cols-7 gap-2"></div>
                                </div>
                            </div>
                        </div>
                        <div class="space-y-4">
                            <div class="bg-purple-600 rounded-3xl p-8 text-white shadow-xl shadow-purple-500/20 relative overflow-hidden group">
                                <div class="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                                <h4 class="font-bold text-purple-100 text-sm mb-3 flex items-center gap-2 uppercase tracking-widest"><i class="fas fa-lock"></i> Mod Kunci Tarikh</h4>
                                <p class="text-xs text-purple-50/80 leading-relaxed mb-6 font-medium">Klik pada mana-mana tarikh (Sel, Rab, Kha, Sab) untuk mengunci atau membuka tarikh tersebut bagi seluruh daerah.</p>
                                <div class="flex items-center gap-2 text-[10px] font-black text-purple-200 uppercase bg-black/20 p-2 rounded-lg inline-block">
                                    <div class="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></div> Tarikh Dikunci
                                </div>
                            </div>
                            <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <h4 class="font-black text-slate-800 text-xs uppercase tracking-widest mb-4 border-b border-slate-50 pb-2">Petunjuk Status Slot</h4>
                                <div class="space-y-3">
                                    <div class="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                                        <span class="text-[10px] font-black text-emerald-700 uppercase">2 Slot Kosong</span>
                                        <div class="w-4 h-4 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30"></div>
                                    </div>
                                    <div class="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-100">
                                        <span class="text-[10px] font-black text-amber-700 uppercase">1 Slot Kosong</span>
                                        <div class="w-4 h-4 rounded-full bg-amber-500 shadow-sm shadow-amber-500/30"></div>
                                    </div>
                                    <div class="flex items-center justify-between p-2 rounded-xl bg-red-50 border border-red-100">
                                        <span class="text-[10px] font-black text-red-700 uppercase">Slot Penuh</span>
                                        <div class="w-4 h-4 rounded-full bg-red-500 shadow-sm shadow-red-500/30"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- VIEW 2: LIST (CANCELLATION SYSTEM) -->
                <div id="adminBookingListView" class="hidden animate-fade-up">
                    <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
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
 * Render Kalendar Mod Admin (Locking)
 * Peningkatan Visual: Animasi hover dan kesan 'active-selection'.
 */
window.renderAdminBookingCalendar = async function() {
    const grid = document.getElementById('adminCalendarGrid');
    const label = document.getElementById('adminMonthLabel');
    if (!grid) return;

    grid.innerHTML = `<div class="col-span-7 py-20 text-center text-slate-300 italic text-sm animate-pulse">Memuatkan data bimbingan...</div>`;
    label.innerText = `${MALAY_MONTHS[adminCurrentMonth]} ${adminCurrentYear}`;

    try {
        const { bookedSlots, lockedDetails } = await BookingService.getMonthlyData(adminCurrentYear, adminCurrentMonth);
        grid.innerHTML = "";

        const firstDay = new Date(adminCurrentYear, adminCurrentMonth, 1).getDay();
        const daysInMonth = new Date(adminCurrentYear, adminCurrentMonth + 1, 0).getDate();

        // 1. Padding hari kosong
        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div class="aspect-square bg-slate-50/20 rounded-xl border border-slate-50"></div>`;
        }

        // 2. Jana Jubin Tarikh
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(adminCurrentYear, adminCurrentMonth, d);
            const iso = dateObj.toISOString().split('T')[0];
            const dow = dateObj.getDay();
            const isAllowed = ALLOWED_DAYS.includes(dow);
            const isLocked = lockedDetails.hasOwnProperty(iso);
            const slots = bookedSlots[iso] || [];

            let statusClasses = "bg-white border-slate-100 hover:border-brand-300 hover:scale-105 hover:shadow-lg";
            let textClass = "text-slate-300";
            let indicator = "";

            if (isLocked) {
                statusClasses = "bg-purple-600 border-purple-600 shadow-md shadow-purple-500/20 hover:scale-105";
                textClass = "text-white";
                indicator = `<div class="text-[7px] font-black uppercase text-purple-200 mt-1 truncate px-1 text-center bg-black/10 rounded">${lockedDetails[iso]}</div>`;
            } else if (isAllowed) {
                textClass = "text-slate-800 font-black";
                if (slots.length >= 2) indicator = `<div class="w-2 h-2 rounded-full bg-red-500 mx-auto mt-1 shadow-sm shadow-red-500/50"></div>`;
                else if (slots.length === 1) indicator = `<div class="w-2 h-2 rounded-full bg-amber-500 mx-auto mt-1 shadow-sm shadow-amber-500/50"></div>`;
                else indicator = `<div class="w-2 h-2 rounded-full bg-emerald-500 mx-auto mt-1 shadow-sm shadow-emerald-500/50"></div>`;
            } else {
                // Hari ditutup (Isn, Jum, Aha)
                statusClasses = "bg-slate-50/50 border-slate-100 opacity-50 cursor-not-allowed";
            }

            const isSelected = adminSelectedDate === iso;
            const activeClass = isSelected ? "ring-4 ring-brand-500 ring-offset-2 z-10 !border-brand-500" : "";

            const tile = document.createElement('div');
            tile.className = `aspect-square border-2 rounded-2xl p-2 flex flex-col justify-between transition-all duration-300 cursor-pointer ${statusClasses} ${activeClass}`;
            tile.innerHTML = `<span class="text-xs ${textClass}">${d}</span>${indicator}`;
            
            // Klik hanya dibenarkan pada hari yang boleh dibimbing (atau yang sudah dikunci)
            if (isAllowed || isLocked) {
                tile.onclick = () => {
                    adminSelectedDate = iso;
                    window.renderAdminBookingCalendar(); // Re-render untuk tunjuk highlight
                    handleAdminDateAction(iso, isLocked);
                };
            } else {
                tile.onclick = () => {
                    Swal.fire({ text: 'Slot bimbingan tidak dibuka pada hari ini.', icon: 'info', toast: true, position: 'top', showConfirmButton: false, timer: 1500 });
                };
            }
            
            grid.appendChild(tile);
        }
    } catch (e) {
        console.error("[AdminBooking] Error:", e);
        grid.innerHTML = `<div class="col-span-7 py-20 text-center text-red-500 font-bold bg-red-50 rounded-2xl">Gagal memproses pangkalan data.</div>`;
    }
};

/**
 * Handle Kunci/Buka Tarikh (Mod Admin)
 * Logic: Catatan dipaksa ke UPPERCASE secara automatik.
 */
async function handleAdminDateAction(iso, currentlyLocked) {
    if (currentlyLocked) {
        Swal.fire({
            title: 'Buka Kunci Tarikh?',
            html: `Tarikh <span class="text-brand-600 font-bold">${iso}</span> akan dibuka semula untuk tempahan sekolah.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Ya, Buka Semula',
            cancelButtonText: 'Batal',
            customClass: { popup: 'rounded-3xl' }
        }).then(async (r) => {
            if (r.isConfirmed) {
                toggleLoading(true);
                await BookingService.toggleDateLock(iso, '', localStorage.getItem(APP_CONFIG.SESSION.USER_ID));
                toggleLoading(false);
                adminSelectedDate = null;
                window.renderAdminBookingCalendar();
            } else {
                adminSelectedDate = null;
                window.renderAdminBookingCalendar();
            }
        });
    } else {
        const { value: note } = await Swal.fire({
            title: 'Kunci Tarikh Ini?',
            html: `<p class="text-sm text-slate-500 mb-4">Sila berikan sebab (Cth: Cuti Umum, Bengkel Daerah). Tempahan baharu akan disekat.</p>`,
            input: 'text',
            inputPlaceholder: 'Sila masukkan catatan...',
            showCancelButton: true,
            confirmButtonColor: '#7c3aed',
            confirmButtonText: 'SAHKAN KUNCI',
            cancelButtonText: 'Batal',
            customClass: { popup: 'rounded-3xl', input: 'rounded-xl font-bold uppercase' },
            preConfirm: (val) => {
                if (!val) return Swal.showValidationMessage('Catatan wajib diisi.');
                return val.toUpperCase(); // FORCE UPPERCASE
            }
        });

        if (note) {
            toggleLoading(true);
            await BookingService.toggleDateLock(iso, note, localStorage.getItem(APP_CONFIG.SESSION.USER_ID));
            toggleLoading(false);
            adminSelectedDate = null;
            window.renderAdminBookingCalendar();
        } else {
            adminSelectedDate = null;
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
            tbody.innerHTML = `<tr><td colspan="4" class="p-20 text-center text-slate-400 font-medium italic">Tiada tempahan aktif dikesan buat masa ini.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(b => {
            const dateStr = new Date(b.tarikh).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
            return `
                <tr class="hover:bg-slate-50/80 transition-all group">
                    <td class="px-8 py-5">
                        <div class="font-black text-slate-800 text-sm tracking-tight">${dateStr}</div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[9px] font-black px-1.5 py-0.5 rounded ${b.masa === 'Pagi' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'} uppercase tracking-tighter">${b.masa}</span>
                            <span class="text-[10px] text-slate-400 font-bold">${b.id_tempahan}</span>
                        </div>
                    </td>
                    <td class="px-8 py-5">
                        <div class="font-bold text-brand-600 text-sm leading-tight mb-1 group-hover:text-brand-700">${b.nama_sekolah}</div>
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${b.tajuk_bengkel || 'TIADA TAJUK'}</div>
                    </td>
                    <td class="px-8 py-5">
                        <div class="font-bold text-slate-700 text-xs">${b.nama_pic}</div>
                        <a href="https://wa.me/${b.no_tel_pic.replace(/[^0-9]/g, '')}" target="_blank" class="text-[10px] text-blue-500 font-black hover:underline inline-flex items-center gap-1 mt-0.5">
                            <i class="fab fa-whatsapp"></i> ${b.no_tel_pic}
                        </a>
                    </td>
                    <td class="px-8 py-5 text-center">
                        <button onclick="cancelBookingAdmin(${b.id}, '${b.id_tempahan}')" class="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center mx-auto group-active:scale-90" title="Batal Tempahan">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error("[AdminBooking] List Error:", e);
        tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-red-500 font-bold bg-red-50">Gagal memuatkan senarai tempahan.</td></tr>`;
    }
};

/**
 * Batal Tempahan (Admin)
 */
window.cancelBookingAdmin = async function(dbId, bookingId) {
    const { value: reason } = await Swal.fire({
        title: 'Batal Tempahan?',
        html: `<div class="text-center p-4 bg-red-50 rounded-2xl border border-red-100 mb-4">
                 <p class="text-xs text-red-400 font-bold uppercase tracking-widest mb-1">ID Tempahan:</p>
                 <p class="text-lg font-black text-red-600 font-mono">${bookingId}</p>
               </div>
               <p class="text-sm text-slate-500">Tindakan ini tidak boleh dikembalikan. Sila nyatakan sebab pembatalan.</p>`,
        icon: 'warning',
        input: 'text',
        inputPlaceholder: 'Sebab Pembatalan (Wajib)...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'SAHKAN BATAL',
        cancelButtonText: 'Kembali',
        customClass: { popup: 'rounded-3xl', input: 'rounded-xl font-bold uppercase' },
        preConfirm: (value) => {
            if (!value) return Swal.showValidationMessage('Sila nyatakan sebab pembatalan.');
            return value.toUpperCase();
        }
    });

    if (reason) {
        toggleLoading(true);
        try {
            await BookingService.adminCancelBooking(dbId, reason);
            toggleLoading(false);
            Swal.fire({ icon: 'success', title: 'Berjaya Dibatalkan', text: 'Rekod telah dikemaskini.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } });
            window.loadAdminBookingList();
            window.renderAdminBookingCalendar();
        } catch (e) {
            toggleLoading(false);
            Swal.fire({ icon: 'error', title: 'Ralat Pembatalan', text: 'Gagal menghubungi pangkalan data.', customClass: { popup: 'rounded-3xl' } });
        }
    }
};

/**
 * Navigasi Bulan Kalendar
 */
window.changeAdminMonth = function(offset) {
    adminCurrentMonth += offset;
    adminSelectedDate = null; // Reset selection bila tukar bulan
    
    if (adminCurrentMonth > 11) { 
        adminCurrentMonth = 0; 
        adminCurrentYear++; 
    } else if (adminCurrentMonth < 0) { 
        adminCurrentMonth = 11; 
        adminCurrentYear--; 
    }
    window.renderAdminBookingCalendar();
};