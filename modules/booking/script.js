/**
 * BOOKING MODULE CONTROLLER (BB)
 * Menguruskan kalendar interaktif dan logik tempahan sekolah.
 * Integrasi: Supabase + BookingService.
 */

import { BookingService } from '../../js/services/booking.service.js';
import { SchoolService } from '../../js/services/school.service.js';
import { APP_CONFIG } from '../../js/config/app.config.js';

// --- STATE MANAGEMENT ---
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDateISO = null;
let schoolInfo = { kod: '', nama: '' };

const ALLOWED_DAYS = [2, 3, 4, 6]; // Selasa, Rabu, Khamis, Sabtu
const MALAY_MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];

document.addEventListener('DOMContentLoaded', () => {
    initBookingPortal();
});

/**
 * Inisialisasi utama profil sekolah dan kalendar.
 */
async function initBookingPortal() {
    // 1. Ambil Identiti Sekolah dari Sesi SMPID
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    if (!kod) return window.location.replace('../../index.html');

    try {
        const data = await SchoolService.getByCode(kod);
        if (data) {
            schoolInfo.kod = data.kod_sekolah;
            schoolInfo.nama = data.nama_sekolah;
            
            document.getElementById('displayKod').innerText = schoolInfo.kod;
            document.getElementById('displayNama').innerText = schoolInfo.nama;
        }
    } catch (e) {
        console.error("Gagal muat info sekolah:", e);
    }

    // 2. Render Kalendar Pertama Kali
    renderCalendar();
}

/**
 * Membina grid kalendar bagi bulan dan tahun semasa.
 */
window.renderCalendar = async function() {
    const container = document.getElementById('calendarBody');
    const monthLabel = document.getElementById('monthDisplay');
    if (!container) return;

    // Papar Loading Ringkas
    container.innerHTML = `<div class="col-span-7 py-10 text-center text-slate-300 italic">Memuatkan slot...</div>`;
    monthLabel.innerText = `${MALAY_MONTHS[currentMonth]} ${currentYear}`.toUpperCase();

    try {
        // Ambil Data dari Database (Service Layer)
        const { bookedSlots, lockedDetails } = await BookingService.getMonthlyData(currentYear, currentMonth);

        container.innerHTML = ""; // Bersihkan container

        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Padding hari bulan lepas
        for (let i = 0; i < firstDay; i++) {
            const pad = document.createElement('div');
            pad.className = 'tile tile-other';
            container.appendChild(pad);
        }

        // 2. Bina Tile bagi setiap hari
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(currentYear, currentMonth, d);
            const isoDate = dateObj.toISOString().split('T')[0];
            const dayOfWeek = dateObj.getDay();
            
            const isAllowedDay = ALLOWED_DAYS.includes(dayOfWeek);
            const isLocked = lockedDetails.hasOwnProperty(isoDate);
            const slots = bookedSlots[isoDate] || [];
            
            // Peraturan: Tempahan mesti 3 hari ke depan
            const minNoticeDate = new Date();
            minNoticeDate.setDate(today.getDate() + 3);
            const isPast = dateObj < minNoticeDate;

            let status = 'closed';
            let availableSlots = [];

            if (isPast) {
                status = 'closed';
            } else if (!isAllowedDay) {
                status = 'closed';
            } else if (isLocked) {
                status = 'locked';
            } else if (slots.length >= 2) {
                status = 'booked';
            } else if (slots.length === 1) {
                status = 'partial';
                availableSlots = ['Pagi', 'Petang'].filter(s => !slots.includes(s));
            } else {
                status = 'open';
                availableSlots = ['Pagi', 'Petang'];
            }

            const tile = document.createElement('div');
            tile.className = `tile tile-${status} ${isoDate === selectedDateISO ? 'active-selection' : ''}`;
            
            let html = `<span class="date-num text-xs">${d}</span>`;
            
            if (status === 'locked') {
                html += `<div class="text-[8px] font-bold text-purple-400 mt-1 uppercase truncate">${lockedDetails[isoDate]}</div>`;
            } else if (status === 'booked') {
                html += `<div class="text-[8px] font-bold text-red-400 mt-1 uppercase">Penuh</div>`;
            } else if (status === 'partial') {
                const label = availableSlots[0];
                html += `<div class="slot-pill slot-${label.toLowerCase()} mt-1">${label} Sedia</div>`;
            } else if (status === 'open') {
                html += `<div class="text-[8px] font-bold text-emerald-500 mt-1 uppercase">2 Slot</div>`;
            }

            tile.innerHTML = html;

            // Klik hanya pada tarikh yang terbuka/sebahagian
            if (status === 'open' || status === 'partial') {
                tile.onclick = () => handleTileSelection(isoDate, availableSlots, tile);
            }

            container.appendChild(tile);
        }

    } catch (err) {
        console.error("Calendar Render Error:", err);
        container.innerHTML = `<div class="col-span-7 py-10 text-center text-red-400 font-bold">Gagal memuatkan data kalendar.</div>`;
    }
};

/**
 * Menguruskan pemilihan tarikh pada kalendar.
 */
function handleTileSelection(isoDate, availableSlots, element) {
    selectedDateISO = isoDate;

    // 1. Visual Feedback
    document.querySelectorAll('.tile').forEach(t => t.classList.remove('active-selection'));
    element.classList.add('active-selection');

    // 2. Kemaskini Borang
    document.getElementById('displayDate').value = new Date(isoDate).toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('rawDate').value = isoDate;

    // 3. Papar Slot
    const wrapper = document.getElementById('slotWrapper');
    wrapper.classList.remove('hidden');

    const radioPagi = document.querySelector('input[name="inputMasa"][value="Pagi"]');
    const radioPetang = document.querySelector('input[name="inputMasa"][value="Petang"]');

    radioPagi.disabled = !availableSlots.includes('Pagi');
    radioPetang.disabled = !availableSlots.includes('Petang');
    
    // Auto-check jika cuma ada 1 slot
    if (availableSlots.length === 1) {
        if (availableSlots[0] === 'Pagi') radioPagi.checked = true;
        else radioPetang.checked = true;
    } else {
        radioPagi.checked = false;
        radioPetang.checked = false;
    }

    // 4. Aktifkan Butang
    document.getElementById('btnSubmit').disabled = false;
}

/**
 * Penukaran bulan kalendar.
 */
window.changeMonth = function(offset) {
    currentMonth += offset;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
};

/**
 * Pengendali Penghantaran Borang Tempahan.
 */
window.handleBookingSubmit = async function() {
    const date = document.getElementById('rawDate').value;
    const masaInp = document.querySelector('input[name="inputMasa"]:checked');
    const picName = document.getElementById('picName').value.trim();
    const picPhone = document.getElementById('picPhone').value.trim();
    const btn = document.getElementById('btnSubmit');

    if (!date || !masaInp || !picName || !picPhone) {
        return Swal.fire("Tidak Lengkap", "Sila pastikan tarikh, slot dan butiran PIC diisi.", "warning");
    }

    const payload = {
        tarikh: date,
        masa: masaInp.value,
        nama_pic: picName,
        no_tel_pic: picPhone,
        kod_sekolah: schoolInfo.kod,
        nama_sekolah: schoolInfo.nama
    };

    // UI Loading
    document.getElementById('loadingOverlay').classList.remove('hidden');
    btn.disabled = true;

    try {
        const result = await BookingService.createBooking(payload);
        
        document.getElementById('loadingOverlay').classList.add('hidden');
        
        await Swal.fire({
            icon: 'success',
            title: 'Tempahan Berjaya!',
            html: `ID Tempahan anda: <b class="text-brand-600 font-mono">${result.bookingId}</b><br><br>Pegawai USTP akan menghubungi anda untuk pengesahan lanjut.`,
            confirmButtonColor: '#2563eb'
        });

        // Reset Borang & Refresh Kalendar
        document.getElementById('bookingForm').reset();
        document.getElementById('slotWrapper').classList.add('hidden');
        document.getElementById('displayDate').value = "";
        btn.disabled = true;
        selectedDateISO = null;
        
        renderCalendar();

    } catch (err) {
        document.getElementById('loadingOverlay').classList.add('hidden');
        btn.disabled = false;
        Swal.fire("Gagal", err.message || "Ralat sistem semasa memproses tempahan.", "error");
    }
};