/**
 * BOOKING MODULE CONTROLLER (BB) - VERSION 3.2
 * Fungsi: Menguruskan logik tempahan dengan sistem jubin interaktif.
 * --- UPDATE V3.2 ---
 * 1. Visual Fix: Memastikan jubin kalendar menyokong wrapping teks (.wrap-safe).
 * 2. CSS Integration: Membiarkan CSS (index.html) mengawal warna status untuk integriti tema.
 * 3. UX Fix: Menghapuskan 'line-clamp' pada sejarah tempahan supaya butiran lengkap kelihatan.
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

const ALLOWED_DAYS = [2, 3, 4, 6]; // Selasa, Rabu, Khamis, Sabtu
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
            
            const dispNama = document.getElementById('displayNama');
            if (dispNama) dispNama.innerText = schoolInfo.nama.toUpperCase();
            
            loadBookingHistory(schoolInfo.kod);
        }
    } catch (e) {
        console.error("[Booking] Gagal muat info sekolah:", e);
    }

    // Isi dropdown bimbingan
    populateDropdown('tajukBengkel', 'BENGKEL');
    
    // Render kalendar permulaan
    renderCalendar();
}

/**
 * Memuatkan sejarah tempahan sekolah semasa.
 * FIX: Menghapuskan line-clamp untuk paparan teks penuh.
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
                        <!-- FIX: Teks Penuh Tanpa Truncate -->
                        <div class="text-xs font-bold text-slate-700 uppercase leading-tight wrap-safe" title="${item.tajuk_bengkel}">${item.tajuk_bengkel}</div>
                    </td>
                    <td class="px-6 py-4 text-center">${statusBadge}</td>
                </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-red-400 font-bold">Ralat memuatkan sejarah.</td></tr>`;
    }
}

/**
 * Render Utama: Kalendar Berasaskan Kad.
 * FIX: Menggunakan kelas status CSS untuk pewarnaan dan border.
 */
window.renderCalendar = async function() {
    const container = document.getElementById('calendarBody');
    const monthLabel = document.getElementById('monthDisplay');
    const tabsContainer = document.getElementById('weekTabsContainer');
    
    if (!container || !monthLabel || !tabsContainer) return;

    container.innerHTML = `
        <div class="col-span-full py-20 text-center flex flex-col items-center justify-center">
            <i class="fas fa-circle-notch fa-spin text-slate-300 text-3xl mb-4"></i>
            <p class="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Menjana Jadual...</p>
        </div>`;
    
    monthLabel.innerText = `${MALAY_MONTHS[currentMonth]} ${currentYear}`.toUpperCase();

    try {
        const { bookedSlots, lockedDetails } = await BookingService.getMonthlyData(currentYear, currentMonth);
        
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const pad = (n) => n.toString().padStart(2, '0');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Render Tab Minggu
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

        // 2. T Julat Hari
        const startDay = (activeWeek - 1) * 7 + 1;
        const endDay = Math.min(activeWeek * 7, daysInMonth);

        container.innerHTML = ""; 

        // 3. Render Kad Hari
        let hasContent = false;

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
            let statusText = 'KOSONG';
            let statusIcon = 'fa-check-circle';
            let availableSlots = ['Pagi', 'Petang'];

            if (isPastOrTooSoon) {
                status = 'closed';
                statusText = 'TUTUP';
                statusIcon = 'fa-lock';
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
            const card = document.createElement('div');
            
            // FIX: Menggunakan kelas status daripada index.html
            card.className = `day-card card-${status} ${isSelected ? 'card-active' : ''} animate-fade-in group`;
            
            // Warna Ikon & Badge (Sync dengan CSS)
            let iconColor = 'text-brand-600 bg-brand-100';
            if (status === 'full') iconColor = 'text-red-600 bg-red-100';
            if (status === 'locked') iconColor = 'text-purple-600 bg-purple-100';
            if (status === 'partial') iconColor = 'text-amber-600 bg-amber-100';
            if (status === 'closed') iconColor = 'text-slate-400 bg-slate-200';

            const lockedMsg = isLocked ? `<div class="text-[9px] text-purple-600 font-black mt-1 uppercase wrap-safe">${lockedDetails[dateString]}</div>` : '';

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
                
                <div class="mt-4">
                    <span class="inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${iconColor} border border-black/5">
                        ${statusText}
                    </span>
                    ${lockedMsg}
                </div>
                
                ${(status === 'open' || status === 'partial') ? 
                  `<div class="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                      <span class="text-brand-600 text-xs font-black flex items-center gap-1">PILIH <i class="fas fa-arrow-right"></i></span>
                   </div>` : ''}
            `;

            if (status === 'open' || status === 'partial') {
                card.onclick = () => handleCardSelection(dateString, availableSlots, card);
            }

            container.appendChild(card);
            hasContent = true;
        }

        if (!hasContent) {
            container.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400 text-sm">Tiada tarikh dalam minggu ini.</div>`;
        }

    } catch (err) {
        console.error("[Booking] Calendar Error:", err);
        container.innerHTML = `<div class="col-span-full py-20 text-center text-red-500 font-bold bg-red-50 rounded-3xl border-2 border-red-200">Gagal memuatkan data kalendar. Sila muat semula.</div>`;
    }
};

/**
 * Pengurusan Pemilihan Kad.
 */
function handleCardSelection(dateStr, availableSlots, element) {
    selectedDateString = dateStr;

    // Reset visual
    document.querySelectorAll('.day-card').forEach(r => r.classList.remove('card-active'));
    element.classList.add('card-active');

    // Update UI Borang
    const dateObj = new Date(dateStr);
    const dateReadable = dateObj.toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const dispInput = document.getElementById('displayDate');
    dispInput.value = dateReadable.toUpperCase();
    dispInput.classList.remove('bg-brand-50/50', 'cursor-not-allowed', 'text-brand-700');
    dispInput.classList.add('bg-white', 'text-slate-800', 'border-brand-500');
    
    document.getElementById('rawDate').value = dateStr;

    // Papar pemilih sesi
    const wrapper = document.getElementById('slotWrapper');
    wrapper.classList.remove('hidden');

    const radioPagi = document.querySelector('input[name="inputMasa"][value="Pagi"]');
    const radioPetang = document.querySelector('input[name="inputMasa"][value="Petang"]');
    const labelPagi = document.getElementById('labelPagi');
    const labelPetang = document.getElementById('labelPetang');

    // Reset State Sesi
    radioPagi.disabled = true; radioPetang.disabled = true;
    labelPagi.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
    labelPetang.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
    radioPagi.checked = false; radioPetang.checked = false;

    if (availableSlots.includes('Pagi')) {
        radioPagi.disabled = false;
        labelPagi.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
    }
    if (availableSlots.includes('Petang')) {
        radioPetang.disabled = false;
        labelPetang.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
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
 * Navigasi.
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
    const btn = document.getElementById('btnSubmit');
    if (btn) btn.disabled = true;
    
    const wrapper = document.getElementById('slotWrapper');
    if (wrapper) wrapper.classList.add('hidden');
    
    const disp = document.getElementById('displayDate');
    if (disp) {
        disp.value = "";
        disp.classList.add('bg-brand-50/50', 'cursor-not-allowed');
        disp.classList.remove('bg-white', 'text-slate-800', 'border-brand-500');
        disp.placeholder = "SILA PILIH TARIKH DI KIRI";
    }
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
        return Swal.fire({ icon: "warning", title: "Tidak Lengkap", text: "Sila pastikan semua ruangan wajib diisi." });
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
            title: 'Permohonan Berjaya!',
            html: `Kod Rujukan: <br><b class="text-2xl font-mono text-brand-600 mt-2 block tracking-tighter">${result.bookingId}</b><br><span class="text-xs text-slate-500 font-bold">USTP akan menghubungi PIC untuk pengesahan lanjut.</span>`,
            confirmButtonColor: '#2563eb',
            customClass: { popup: 'rounded-[2rem]' }
        });

        document.getElementById('bookingForm').reset();
        resetSelection();
        renderCalendar();
        loadBookingHistory(schoolInfo.kod);
        
    } catch (err) {
        document.getElementById('loadingOverlay').classList.add('hidden');
        btn.disabled = false;
        Swal.fire({ icon: "error", title: "Gagal", text: err.message, customClass: { popup: 'rounded-[2rem]' } });
    }
};