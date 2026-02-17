/**
 * BOOKING MODULE CONTROLLER (BB) - VERSION 3.4 (CLEAN & WRAP EDITION)
 * Fungsi: Menguruskan logik tempahan dengan paparan Grid Kad Interaktif.
 * Target HTML: modules/booking/index.html
 */

import { BookingService } from '../../js/services/booking.service.js';
import { SchoolService } from '../../js/services/school.service.js';
import { APP_CONFIG } from '../../js/config/app.config.js';
import { populateDropdown } from '../../js/config/dropdowns.js';

// --- STATE MANAGEMENT ---
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let activeWeek = 1; 
let selectedDateString = null; 
let schoolInfo = { kod: '', nama: '' };

// Konfigurasi Hari: 0=Ahad, 1=Isnin, 2=Selasa, 3=Rabu, 4=Khamis, 5=Jumaat, 6=Sabtu
const ALLOWED_DAYS = [2, 3, 4, 6]; 
const MALAY_MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const DAY_NAMES = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

document.addEventListener('DOMContentLoaded', () => {
    initBookingPortal();
});

/**
 * Inisialisasi profil sekolah dan komponen UI.
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
            
            // Integriti Teks: Nama sekolah dalam badge di-set sebagai wrap-safe
            const dispNama = document.getElementById('displayNama');
            if (dispNama) {
                dispNama.innerText = schoolInfo.nama.toUpperCase();
                dispNama.classList.add('wrap-safe');
            }
            
            loadBookingHistory(schoolInfo.kod);
        }
    } catch (e) {
        console.error("[Booking] Gagal muat info sekolah:", e);
    }

    populateDropdown('tajukBengkel', 'BENGKEL');
    renderCalendar();
}

/**
 * Memuatkan sejarah tempahan sekolah semasa.
 */
async function loadBookingHistory(kod) {
    const tbody = document.getElementById('historyTableBody');
    const countBadge = document.getElementById('historyCount');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-400 text-xs animate-pulse">Memuatkan rekod...</td></tr>`;

    try {
        const data = await BookingService.getSchoolBookings(kod);
        if (countBadge) countBadge.innerText = `${data.length} Permohonan`;

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-400 italic">Tiada rekod ditemui.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(item => {
            const dateObj = new Date(item.tarikh);
            const dateStr = dateObj.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
            
            let statusBadge = `<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-black border border-emerald-200">AKTIF</span>`;
            if (item.status !== 'AKTIF') {
                statusBadge = `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-black border border-red-200">BATAL</span>`;
            }

            return `
                <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0 group">
                    <td class="px-6 py-4">
                        <div class="font-mono font-bold text-slate-600">${dateStr}</div>
                        <div class="text-[9px] font-black text-brand-500 uppercase mt-0.5">${item.masa}</div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-xs font-bold text-slate-700 uppercase leading-tight wrap-safe" title="${item.tajuk_bengkel}">${item.tajuk_bengkel}</div>
                    </td>
                    <td class="px-6 py-4 text-center">${statusBadge}</td>
                </tr>`;
        }).join('');
    } catch (e) {
        console.error("[BookingHistory] Error:", e);
        tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-red-400 font-bold">Ralat memuatkan sejarah.</td></tr>`;
    }
}

/**
 * Render Utama: Kalendar Berasaskan Kad.
 */
window.renderCalendar = async function() {
    const container = document.getElementById('calendarBody');
    const monthLabel = document.getElementById('monthDisplay');
    const tabsContainer = document.getElementById('weekTabsContainer');
    
    if (!container || !monthLabel || !tabsContainer) return;

    // Loading State UI
    container.innerHTML = `
        <div class="col-span-full py-20 text-center flex flex-col items-center justify-center">
            <i class="fas fa-circle-notch fa-spin text-slate-300 text-3xl mb-4"></i>
            <p class="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Menjana Jadual...</p>
        </div>`;
    
    monthLabel.innerText = `${MALAY_MONTHS[currentMonth]} ${currentYear}`.toUpperCase();

    try {
        const { bookedSlots, lockedDetails } = await BookingService.getMonthlyData(currentYear, currentMonth);
        
        // Kira hari dalam bulan
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const pad = (n) => n.toString().padStart(2, '0');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Render Tab Minggu (Navigasi M1-M5)
        const totalWeeks = Math.ceil(daysInMonth / 7);
        if (activeWeek > totalWeeks) activeWeek = 1;

        let tabsHtml = '';
        for (let w = 1; w <= totalWeeks; w++) {
            const isActive = activeWeek === w;
            tabsHtml += `
                <button onclick="switchWeek(${w})" 
                        class="week-tab ${isActive ? 'week-tab-active' : 'week-tab-inactive'}">
                    MINGGU ${w}
                </button>`;
        }
        tabsContainer.innerHTML = tabsHtml;

        // 2. Tentukan Julat Hari untuk Minggu Aktif
        const startDay = (activeWeek - 1) * 7 + 1;
        const endDay = Math.min(activeWeek * 7, daysInMonth);

        container.innerHTML = ""; 

        // 3. Render Kad Hari
        let hasContent = false;

        for (let d = startDay; d <= endDay; d++) {
            const dateString = `${currentYear}-${pad(currentMonth + 1)}-${pad(d)}`;
            const dateObj = new Date(currentYear, currentMonth, d);
            dateObj.setHours(0, 0, 0, 0);

            const dayOfWeek = dateObj.getDay();
            
            // Logik Status & Tapisan
            const isAllowedDay = ALLOWED_DAYS.includes(dayOfWeek);
            const isLocked = lockedDetails.hasOwnProperty(dateString);
            const slotsTaken = bookedSlots[dateString] || [];
            
            // Polisi: Tempahan mesti dibuat 3 hari sebelum
            const minNoticeDate = new Date();
            minNoticeDate.setDate(today.getDate() + 3);
            minNoticeDate.setHours(0, 0, 0, 0);
            
            const isPast = dateObj < today;
            const isTooSoon = dateObj < minNoticeDate;

            let status = 'open';
            let statusText = 'KOSONG';
            let statusIcon = 'fa-check-circle';
            let availableSlots = ['Pagi', 'Petang'];

            // Logik Penentuan Status Visual
            if (isPast) {
                status = 'closed';
                statusText = 'LEPAS';
                statusIcon = 'fa-history';
            } else if (isTooSoon) {
                status = 'closed'; 
                statusText = 'TUTUP';
                statusIcon = 'fa-clock'; 
            } else if (!isAllowedDay) {
                status = 'closed';
                statusText = 'TIADA SESI';
                statusIcon = 'fa-ban';
            } else if (isLocked) {
                status = 'locked';
                statusText = 'DIKUNCI'; 
                statusIcon = 'fa-lock';
            } else if (slotsTaken.length >= 2) {
                status = 'full';
                statusText = 'PENUH';
                statusIcon = 'fa-users-slash';
            } else if (slotsTaken.length === 1) {
                status = 'partial';
                statusText = '1 SLOT BAKI';
                statusIcon = 'fa-exclamation-circle';
                availableSlots = ['Pagi', 'Petang'].filter(s => !slotsTaken.includes(s));
            }

            const isSelected = (dateString === selectedDateString);
            
            // Bina Kad HTML
            const card = document.createElement('div');
            card.className = `day-card card-${status} ${isSelected ? 'card-active' : ''} animate-fade-in group`;
            
            // Tentukan warna ikon dan teks - brand-500 digunakan bagi menggantikan 400
            let statusColorClass = 'text-brand-600 bg-brand-50 border-brand-200';
            if (status === 'full') statusColorClass = 'text-red-500 bg-red-50 border-red-200';
            if (status === 'locked') statusColorClass = 'text-purple-600 bg-purple-50 border-purple-200';
            if (status === 'partial') statusColorClass = 'text-amber-600 bg-amber-50 border-amber-200';
            if (status === 'closed') statusColorClass = 'text-slate-400 bg-slate-100 border-slate-200';

            const lockedMsg = isLocked ? `<div class="text-[9px] text-purple-500 font-bold mt-1 uppercase wrap-safe leading-tight">${lockedDetails[dateString]}</div>` : '';

            // PERUBAHAN: Teks "PILIH" telah dibuang sepenuhnya.
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">${DAY_NAMES[dayOfWeek]}</span>
                        <span class="text-3xl font-black text-slate-800 leading-none">${d}</span>
                    </div>
                    <div class="${statusColorClass} w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-sm shadow-sm transition-transform group-hover:rotate-12">
                        <i class="fas ${statusIcon}"></i>
                    </div>
                </div>
                
                <div class="mt-4">
                    <span class="inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${statusColorClass} border">
                        ${statusText}
                    </span>
                    ${lockedMsg}
                </div>
            `;

            // Hanya benarkan klik jika status OPEN atau PARTIAL (bukan tarikh lepas/tutup)
            if (status === 'open' || status === 'partial') {
                card.onclick = () => handleCardSelection(dateString, availableSlots, card);
            }

            container.appendChild(card);
            hasContent = true;
        }

        if (!hasContent) {
            container.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400 text-sm italic border-2 border-dashed border-slate-200 rounded-xl">Tiada tarikh aktif dalam minggu ini.</div>`;
        }

    } catch (err) {
        console.error("[Booking] Calendar Error:", err);
        container.innerHTML = `<div class="col-span-full py-20 text-center text-red-500 font-bold bg-red-50 rounded-2xl border-2 border-red-100">Gagal memuatkan data kalendar.</div>`;
    }
};

/**
 * Pengurusan Pemilihan Kad.
 */
function handleCardSelection(dateStr, availableSlots, element) {
    selectedDateString = dateStr;

    // Reset visual selection
    document.querySelectorAll('.day-card').forEach(r => r.classList.remove('card-active'));
    element.classList.add('card-active');

    // Update Form UI
    const dateObj = new Date(dateStr);
    const dateReadable = dateObj.toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const displayInput = document.getElementById('displayDate');
    displayInput.value = dateReadable.toUpperCase();
    displayInput.classList.remove('bg-brand-50/50', 'cursor-not-allowed', 'text-brand-700');
    displayInput.classList.add('bg-white', 'text-slate-800', 'border-brand-500');
    
    document.getElementById('rawDate').value = dateStr;

    // Show Slot Wrapper
    const wrapper = document.getElementById('slotWrapper');
    wrapper.classList.remove('hidden');

    // Configure Slot Radio Buttons
    const radioPagi = document.querySelector('input[name="inputMasa"][value="Pagi"]');
    const radioPetang = document.querySelector('input[name="inputMasa"][value="Petang"]');
    const labelPagi = document.getElementById('labelPagi');
    const labelPetang = document.getElementById('labelPetang');

    // Reset State
    radioPagi.disabled = true; radioPetang.disabled = true;
    labelPagi.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
    labelPetang.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
    radioPagi.checked = false; radioPetang.checked = false;

    // Enable Available Slots
    if (availableSlots.includes('Pagi')) {
        radioPagi.disabled = false;
        labelPagi.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
    }
    if (availableSlots.includes('Petang')) {
        radioPetang.disabled = false;
        labelPetang.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
    }
    
    // Auto-select if only one slot remains
    if (availableSlots.length === 1) {
        if (availableSlots[0] === 'Pagi') radioPagi.checked = true;
        else radioPetang.checked = true;
    }

    checkFormValidity();
    
    // Listen for slot changes
    document.querySelectorAll('input[name="inputMasa"]').forEach(r => {
        r.addEventListener('change', checkFormValidity);
    });
}

function checkFormValidity() {
    const date = document.getElementById('rawDate').value;
    const masa = document.querySelector('input[name="inputMasa"]:checked');
    const btn = document.getElementById('btnSubmit');
    
    if (date && masa) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

/**
 * Navigasi Minggu & Bulan.
 */
window.switchWeek = function(w) {
    activeWeek = w;
    resetSelection();
    renderCalendar();
};

window.changeMonth = function(offset) {
    currentMonth += offset;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    
    activeWeek = 1; 
    resetSelection();
    renderCalendar();
};

function resetSelection() {
    selectedDateString = null;
    document.getElementById('btnSubmit').disabled = true;
    document.getElementById('slotWrapper').classList.add('hidden');
    
    const disp = document.getElementById('displayDate');
    disp.value = "";
    disp.classList.add('bg-brand-50/50', 'cursor-not-allowed');
    disp.classList.remove('bg-white', 'text-slate-800', 'border-brand-500');
    disp.placeholder = "SILA PILIH TARIKH DI KIRI";
}

/**
 * Penghantaran Borang.
 */
window.handleBookingSubmit = async function() {
    const date = document.getElementById('rawDate').value;
    const tajukBengkel = document.getElementById('tajukBengkel').value;
    const masaInp = document.querySelector('input[name="inputMasa"]:checked');
    const picName = document.getElementById('picName').value.trim();
    const picPhone = document.getElementById('picPhone').value.trim();
    const btn = document.getElementById('btnSubmit');

    if (!date || !tajukBengkel || !masaInp || !picName || !picPhone) {
        // Peringatan: Swal.fire hanya berfungsi jika CDN SweetAlert2 ada dalam HTML
        return Swal.fire({ icon: "warning", title: "Tidak Lengkap", text: "Sila isi semua maklumat bertanda." });
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
            html: `Nombor Rujukan: <br><b class="text-xl font-mono text-brand-600 mt-2 block">${result.bookingId}</b><br><span class="text-sm text-slate-500 wrap-safe">Sila simpan nombor ini untuk rujukan urusan bimbingan.</span>`,
            confirmButtonColor: '#2563eb'
        });

        // Reset UI
        document.getElementById('bookingForm').reset();
        resetSelection();
        
        // Refresh Data
        renderCalendar();
        loadBookingHistory(schoolInfo.kod);
        
    } catch (err) {
        document.getElementById('loadingOverlay').classList.add('hidden');
        btn.disabled = false;
        Swal.fire({ icon: "error", title: "Gagal", text: err.message });
    }
};

// Global Exposure for HTML Event Handlers
window.changeMonth = changeMonth;
window.switchWeek = switchWeek;
window.handleBookingSubmit = handleBookingSubmit;