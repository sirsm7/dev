/**
 * BOOKING MODULE CONTROLLER (BB) - VERSION 3.0 (WEEKLY TABS EDITION)
 * Refactor: Mengubah paparan Grid kepada Mingguan (M1-M5).
 * Memastikan paparan nama bengkel tidak terpotong pada mobile.
 */

import { BookingService } from '../../js/services/booking.service.js';
import { SchoolService } from '../../js/services/school.service.js';
import { APP_CONFIG } from '../../js/config/app.config.js';
import { populateDropdown } from '../../js/config/dropdowns.js';

// --- STATE MANAGEMENT ---
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let activeWeek = 1; // Minggu Aktif (1-5)
let selectedDateString = null; 
let schoolInfo = { kod: '', nama: '' };

const ALLOWED_DAYS = [2, 3, 4, 6]; // Selasa, Rabu, Khamis, Sabtu
const MALAY_MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const DAY_NAMES = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

document.addEventListener('DOMContentLoaded', () => {
    initBookingPortal();
});

/**
 * Inisialisasi utama profil sekolah, dropdown, kalendar dan sejarah.
 */
async function initBookingPortal() {
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    if (!kod) return window.location.replace('../../index.html');

    try {
        const data = await SchoolService.getByCode(kod);
        if (data) {
            schoolInfo.kod = data.kod_sekolah;
            schoolInfo.nama = data.nama_sekolah;
            document.getElementById('displayKod').innerText = schoolInfo.kod;
            document.getElementById('displayNama').innerText = schoolInfo.nama.toUpperCase();
            loadBookingHistory(schoolInfo.kod);
        }
    } catch (e) {
        console.error("[Booking] Gagal muat info sekolah:", e);
    }

    populateDropdown('tajukBengkel', 'BENGKEL');
    renderCalendar();
}

/**
 * Memuatkan sejarah tempahan sekolah.
 */
async function loadBookingHistory(kod) {
    const tbody = document.getElementById('historyTableBody');
    const countBadge = document.getElementById('historyCount');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-400 text-xs animate-pulse">Memuatkan sejarah...</td></tr>`;

    try {
        const data = await BookingService.getSchoolBookings(kod);
        if (countBadge) countBadge.innerText = `${data.length} REKOD`;

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-400 italic text-xs">Tiada sejarah permohonan.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(item => {
            const dateObj = new Date(item.tarikh);
            const dateStr = dateObj.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
            const statusBadge = item.status === 'AKTIF' 
                ? `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[9px] font-black border border-emerald-200">AKTIF</span>`
                : `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[9px] font-black border border-red-200">BATAL</span>`;

            return `
                <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                    <td class="px-6 py-4">
                        <div class="font-mono font-bold text-slate-600 text-xs">${dateStr}</div>
                        <div class="text-[9px] font-black text-slate-400 uppercase mt-1">${item.masa}</div>
                    </td>
                    <td class="px-6 py-4 text-xs font-bold text-slate-700 wrap-safe leading-tight uppercase">${item.tajuk_bengkel}</td>
                    <td class="px-6 py-4 text-center">${statusBadge}</td>
                </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-red-400 font-bold text-xs">Gagal memuatkan sejarah.</td></tr>`;
    }
}

/**
 * Render Utama: Kalendar & Tab Minggu.
 */
window.renderCalendar = async function() {
    const container = document.getElementById('calendarBody');
    const monthLabel = document.getElementById('monthDisplay');
    const tabsContainer = document.getElementById('weekTabsContainer');
    
    if (!container || !monthLabel || !tabsContainer) return;

    container.innerHTML = `<div class="py-20 text-center text-slate-300 italic text-sm animate-pulse">Menyusun jadual mingguan...</div>`;
    monthLabel.innerText = `${MALAY_MONTHS[currentMonth]} ${currentYear}`.toUpperCase();

    try {
        const { bookedSlots, lockedDetails } = await BookingService.getMonthlyData(currentYear, currentMonth);
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const pad = (n) => n.toString().padStart(2, '0');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Render Tab Minggu (M1-M5)
        const totalWeeks = Math.ceil(daysInMonth / 7);
        let tabsHtml = '';
        for (let w = 1; w <= totalWeeks; w++) {
            const isActive = activeWeek === w;
            tabsHtml += `
                <button onclick="switchWeek(${w})" 
                        class="week-tab ${isActive ? 'week-tab-active' : 'week-tab-inactive'}">
                    M${w}
                </button>`;
        }
        tabsContainer.innerHTML = tabsHtml;

        // 2. Tentukan julat hari untuk minggu aktif
        const startDay = (activeWeek - 1) * 7 + 1;
        const endDay = Math.min(activeWeek * 7, daysInMonth);

        container.innerHTML = ""; // Bersihkan body

        // 3. Render Baris Hari
        for (let d = startDay; d <= endDay; d++) {
            const dateString = `${currentYear}-${pad(currentMonth + 1)}-${pad(d)}`;
            const dateObj = new Date(currentYear, currentMonth, d);
            const dayOfWeek = dateObj.getDay();
            const isAllowedDay = ALLOWED_DAYS.includes(dayOfWeek);
            const isLocked = lockedDetails.hasOwnProperty(dateString);
            const slotsTaken = bookedSlots[dateString] || [];
            
            const minNoticeDate = new Date();
            minNoticeDate.setDate(today.getDate() + 3);
            minNoticeDate.setHours(0, 0, 0, 0);
            dateObj.setHours(0, 0, 0, 0);
            const isPastOrTooSoon = dateObj < minNoticeDate;

            let status = 'open';
            let availableSlots = ['Pagi', 'Petang'];

            if (isPastOrTooSoon || !isAllowedDay) {
                status = 'closed';
            } else if (isLocked) {
                status = 'locked';
            } else if (slotsTaken.length >= 2) {
                status = 'booked';
            } else if (slotsTaken.length === 1) {
                status = 'partial';
                availableSlots = ['Pagi', 'Petang'].filter(s => !slotsTaken.includes(s));
            }

            const isSelected = (dateString === selectedDateString);
            const row = document.createElement('div');
            row.className = `day-row row-${status} ${isSelected ? 'row-active' : ''} animate-fade-up`;
            
            // Generate Slot UI
            let slotUI = '';
            if (status === 'closed') {
                slotUI = `<span class="text-[10px] font-bold text-slate-300 uppercase italic">Tutup / Tiada Bimbingan</span>`;
            } else if (status === 'locked') {
                slotUI = `<div class="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl text-xs font-black uppercase shadow-sm border border-purple-200">${lockedDetails[dateString]}</div>`;
            } else if (status === 'booked') {
                slotUI = `<div class="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-xs font-black uppercase border border-red-100">Slot Telah Penuh</div>`;
            } else {
                slotUI = `<div class="flex gap-2">
                    ${availableSlots.map(s => `<span class="slot-pill ${s === 'Pagi' ? 'slot-pagi' : 'slot-petang'}">${s}</span>`).join('')}
                    <span class="text-[10px] font-bold text-brand-600 ml-2">Sedia Ditempah</span>
                </div>`;
            }

            row.innerHTML = `
                <div class="day-label">
                    <span class="text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-white' : 'text-slate-400'}">${DAY_NAMES[dayOfWeek]}</span>
                    <span class="text-xl font-black ${isSelected ? 'text-white' : 'text-slate-800'}">${d}</span>
                </div>
                <div class="slot-container">
                    ${slotUI}
                </div>
                <div class="hidden md:flex items-center px-6">
                    <i class="fas fa-chevron-right ${isSelected ? 'text-white' : 'text-slate-200'}"></i>
                </div>
            `;

            if (status === 'open' || status === 'partial') {
                row.onclick = () => handleRowSelection(dateString, availableSlots, row);
            }

            container.appendChild(row);
        }

    } catch (err) {
        console.error("[Booking] Error:", err);
        container.innerHTML = `<div class="py-20 text-center text-red-500 font-bold bg-red-50 rounded-2xl border-2 border-red-100">Ralat pangkalan data jadual.</div>`;
    }
};

/**
 * Handle pemilihan baris hari.
 */
function handleRowSelection(dateStr, availableSlots, element) {
    selectedDateString = dateStr;

    // UI Highlights
    document.querySelectorAll('.day-row').forEach(r => r.classList.remove('row-active'));
    element.classList.add('row-active');

    // Update Form Inputs
    const dateObj = new Date(dateStr);
    const dateReadable = dateObj.toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('displayDate').value = dateReadable.toUpperCase();
    document.getElementById('rawDate').value = dateStr;

    // Slot Selection Controller
    const wrapper = document.getElementById('slotWrapper');
    wrapper.classList.remove('hidden');

    const radioPagi = document.querySelector('input[name="inputMasa"][value="Pagi"]');
    const radioPetang = document.querySelector('input[name="inputMasa"][value="Petang"]');
    const labelPagi = document.getElementById('labelPagi');
    const labelPetang = document.getElementById('labelPetang');

    // Reset Slots
    radioPagi.disabled = true; radioPetang.disabled = true;
    labelPagi.classList.add('opacity-30', 'pointer-events-none', 'grayscale');
    labelPetang.classList.add('opacity-30', 'pointer-events-none', 'grayscale');
    radioPagi.checked = false; radioPetang.checked = false;

    if (availableSlots.includes('Pagi')) {
        radioPagi.disabled = false;
        labelPagi.classList.remove('opacity-30', 'pointer-events-none', 'grayscale');
    }
    if (availableSlots.includes('Petang')) {
        radioPetang.disabled = false;
        labelPetang.classList.remove('opacity-30', 'pointer-events-none', 'grayscale');
    }
    
    if (availableSlots.length === 1) {
        if (availableSlots[0] === 'Pagi') radioPagi.checked = true;
        else radioPetang.checked = true;
    }

    checkFormValidity();
    document.querySelectorAll('input[name="inputMasa"]').forEach(r => {
        r.addEventListener('change', checkFormValidity);
    });
}

function checkFormValidity() {
    const date = document.getElementById('rawDate').value;
    const masa = document.querySelector('input[name="inputMasa"]:checked');
    document.getElementById('btnSubmit').disabled = !(date && masa);
}

/**
 * Tukar Minggu Aktif.
 */
window.switchWeek = function(w) {
    activeWeek = w;
    selectedDateString = null;
    document.getElementById('btnSubmit').disabled = true;
    document.getElementById('slotWrapper').classList.add('hidden');
    document.getElementById('displayDate').value = "";
    renderCalendar();
};

/**
 * Navigasi Bulan.
 */
window.changeMonth = function(offset) {
    currentMonth += offset;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    
    activeWeek = 1;
    selectedDateString = null;
    document.getElementById('btnSubmit').disabled = true;
    document.getElementById('slotWrapper').classList.add('hidden');
    document.getElementById('displayDate').value = "";
    renderCalendar();
};

/**
 * Penghantaran Tempahan.
 */
window.handleBookingSubmit = async function() {
    const date = document.getElementById('rawDate').value;
    const tajukBengkel = document.getElementById('tajukBengkel').value;
    const masaInp = document.querySelector('input[name="inputMasa"]:checked');
    const picName = document.getElementById('picName').value.trim();
    const picPhone = document.getElementById('picPhone').value.trim();
    const btn = document.getElementById('btnSubmit');

    if (!date || !tajukBengkel || !masaInp || !picName || !picPhone) {
        return Swal.fire({ icon: "warning", title: "Data Tidak Lengkap", text: "Sila lengkapkan semua maklumat tempahan." });
    }

    const payload = {
        tarikh: date,
        masa: masaInp.value,
        tajuk_bengkel: tajukBengkel,
        nama_pic: picName.toUpperCase(),
        no_tel_pic: picPhone,
        kod_sekolah: schoolInfo.kod,
        nama_sekolah: schoolInfo.nama.toUpperCase()
    };

    document.getElementById('loadingOverlay').classList.remove('hidden');
    btn.disabled = true;

    try {
        const result = await BookingService.createBooking(payload);
        document.getElementById('loadingOverlay').classList.add('hidden');
        
        await Swal.fire({
            icon: 'success',
            title: 'Tempahan Berjaya!',
            html: `<div class="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-2">
                    <p class="text-[10px] text-blue-400 font-bold uppercase tracking-widest">ID Tempahan:</p>
                    <p class="text-lg font-black text-brand-600 font-mono">${result.bookingId}</p>
                   </div>`,
            confirmButtonColor: '#2563eb'
        });

        document.getElementById('bookingForm').reset();
        document.getElementById('slotWrapper').classList.add('hidden');
        document.getElementById('displayDate').value = "";
        btn.disabled = true;
        selectedDateString = null;
        
        renderCalendar();
        loadBookingHistory(schoolInfo.kod);
    } catch (err) {
        document.getElementById('loadingOverlay').classList.add('hidden');
        btn.disabled = false;
        Swal.fire({ icon: "error", title: "Gagal", text: err.message });
    }
};

SEMUA FAIL TELAH DISIAPKAN. PROJEK SELESAI.

Sistem kini menggunakan paparan mingguan (Weekly View) yang lebih mesra peranti mudah alih. Ruang lebar untuk nama bengkel dikekalkan dan navigasi antara minggu (M1-M5) membolehkan pengguna fokus kepada julat tarikh yang lebih spesifik.