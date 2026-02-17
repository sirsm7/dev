/**
 * BOOKING MODULE CONTROLLER (BB) - VERSION 1.6 (FINAL FIX)
 * Menguruskan kalendar interaktif, pengisian dropdown tajuk bengkel,
 * dan logik tempahan sekolah dengan integriti visual dan data penuh.
 * --- UPDATE V1.6 ---
 * 1. UI Sync: Menggunakan kelas CSS baharu (tile-base, tile-open, wrap-safe) dari index.html.
 * 2. Text Handling: Memastikan teks nota kunci dan status dipaparkan penuh tanpa truncate.
 * 3. Logic: Pemilihan tarikh kini lebih responsif dan tepat.
 */

import { BookingService } from '../../js/services/booking.service.js';
import { SchoolService } from '../../js/services/school.service.js';
import { APP_CONFIG } from '../../js/config/app.config.js';
import { populateDropdown } from '../../js/config/dropdowns.js';

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
 * Inisialisasi utama profil sekolah, dropdown, dan kalendar.
 */
async function initBookingPortal() {
    // 1. Ambil Identiti Sekolah dari Sesi SMPID (Local Storage)
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    if (!kod) return window.location.replace('../../index.html');

    try {
        const data = await SchoolService.getByCode(kod);
        if (data) {
            schoolInfo.kod = data.kod_sekolah;
            schoolInfo.nama = data.nama_sekolah;
            
            // Paparan identiti sekolah
            document.getElementById('displayKod').innerText = schoolInfo.kod;
            document.getElementById('displayNama').innerText = schoolInfo.nama.toUpperCase();
        }
    } catch (e) {
        console.error("[Booking] Gagal muat info sekolah:", e);
    }

    // 2. Isi Dropdown Tajuk Bengkel (A-Z)
    populateDropdown('tajukBengkel', 'BENGKEL');

    // 3. Render Kalendar
    renderCalendar();
}

/**
 * Membina grid kalendar dengan struktur HTML yang dikemaskini.
 */
window.renderCalendar = async function() {
    const container = document.getElementById('calendarBody');
    const monthLabel = document.getElementById('monthDisplay');
    if (!container) return;

    // Papar Loading State
    container.innerHTML = `<div class="col-span-7 py-20 text-center text-slate-300 italic text-sm animate-pulse flex items-center justify-center h-full">Menyemak ketersediaan slot...</div>`;
    monthLabel.innerText = `${MALAY_MONTHS[currentMonth]} ${currentYear}`.toUpperCase();

    try {
        // Ambil Data dari Database
        const { bookedSlots, lockedDetails } = await BookingService.getMonthlyData(currentYear, currentMonth);

        container.innerHTML = ""; // Bersihkan grid

        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Padding hari bulan sebelumnya
        for (let i = 0; i < firstDay; i++) {
            const pad = document.createElement('div');
            pad.className = 'tile-base tile-other';
            container.appendChild(pad);
        }

        // 2. Jana Jubin Tarikh
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(currentYear, currentMonth, d);
            const isoDate = dateObj.toISOString().split('T')[0];
            const dayOfWeek = dateObj.getDay();
            
            const isAllowedDay = ALLOWED_DAYS.includes(dayOfWeek);
            const isLocked = lockedDetails.hasOwnProperty(isoDate);
            const slots = bookedSlots[isoDate] || [];
            
            // Peraturan: Tempahan minima 3 hari ke hadapan
            const minNoticeDate = new Date();
            minNoticeDate.setDate(today.getDate() + 3);
            minNoticeDate.setHours(0, 0, 0, 0);
            const isPast = dateObj < minNoticeDate;

            let status = 'closed';
            let availableSlots = [];

            if (isPast || !isAllowedDay) {
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

            const isSelected = (isoDate === selectedDateISO);
            const tile = document.createElement('div');
            
            // Gabungan class mengikut status dan pemilihan
            tile.className = `tile-base tile-${status} ${isSelected ? 'active-selection' : ''}`;
            
            let html = `<span class="date-num text-xs font-bold ${status === 'locked' ? 'text-white' : 'text-slate-600'}">${d}</span>`;
            
            if (status === 'locked') {
                // Teks dibenarkan wrap sepenuhnya (wrap-safe)
                html += `<div class="text-[9px] font-black uppercase text-purple-100 mt-1 wrap-safe leading-tight bg-black/10 p-1.5 rounded w-full flex-grow flex items-center justify-center text-center">${lockedDetails[isoDate]}</div>`;
            } else if (status === 'booked') {
                html += `<div class="mt-auto w-full"><div class="text-[9px] font-black text-red-500 bg-red-50 px-1 py-0.5 rounded text-center uppercase tracking-tighter">PENUH</div></div>`;
            } else if (status === 'partial') {
                const label = availableSlots[0];
                html += `<div class="mt-auto w-full space-y-1">
                            <div class="slot-pill slot-${label.toLowerCase()}">${label.toUpperCase()}</div>
                         </div>`;
            } else if (status === 'open') {
                html += `<div class="mt-auto w-full space-y-1">
                            <div class="slot-pill slot-pagi">PAGI</div>
                            <div class="slot-pill slot-petang">PETANG</div>
                         </div>`;
            }

            tile.innerHTML = html;

            // Logik Klik (Hanya untuk slot yang masih ada kekosongan)
            if (status === 'open' || status === 'partial') {
                tile.onclick = () => handleTileSelection(isoDate, availableSlots, tile);
            }

            container.appendChild(tile);
        }

    } catch (err) {
        console.error("[Booking] Error:", err);
        container.innerHTML = `<div class="col-span-7 py-20 text-center text-red-500 font-bold bg-red-50 rounded-2xl flex items-center justify-center h-full">Ralat memuatkan data kalendar.</div>`;
    }
};

/**
 * Menguruskan pemilihan tarikh dan kemaskini UI borang.
 */
function handleTileSelection(isoDate, availableSlots, element) {
    selectedDateISO = isoDate;

    // 1. Visual Feedback: Reset dan set Highlight
    document.querySelectorAll('.tile-base').forEach(t => t.classList.remove('active-selection'));
    element.classList.add('active-selection');

    // 2. Kemaskini Input Paparan (Format UPPERCASE)
    const dateReadable = new Date(isoDate).toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('displayDate').value = dateReadable.toUpperCase();
    document.getElementById('rawDate').value = isoDate;

    // 3. Papar Pilihan Slot Masa
    const wrapper = document.getElementById('slotWrapper');
    wrapper.classList.remove('hidden');

    const radioPagi = document.querySelector('input[name="inputMasa"][value="Pagi"]');
    const radioPetang = document.querySelector('input[name="inputMasa"][value="Petang"]');
    const labelPagi = document.getElementById('labelPagi');
    const labelPetang = document.getElementById('labelPetang');

    // Reset State
    radioPagi.disabled = true;
    radioPetang.disabled = true;
    labelPagi.classList.add('opacity-50', 'pointer-events-none', 'grayscale');
    labelPetang.classList.add('opacity-50', 'pointer-events-none', 'grayscale');
    radioPagi.checked = false;
    radioPetang.checked = false;

    // Enable Available Slots
    if (availableSlots.includes('Pagi')) {
        radioPagi.disabled = false;
        labelPagi.classList.remove('opacity-50', 'pointer-events-none', 'grayscale');
    }
    if (availableSlots.includes('Petang')) {
        radioPetang.disabled = false;
        labelPetang.classList.remove('opacity-50', 'pointer-events-none', 'grayscale');
    }
    
    // Auto-check jika hanya satu slot tersedia
    if (availableSlots.length === 1) {
        if (availableSlots[0] === 'Pagi') radioPagi.checked = true;
        else radioPetang.checked = true;
    }

    // 4. Aktifkan Butang Hantar (jika slot dipilih)
    checkFormValidity();
    
    // Listener untuk radio button change
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
 * Navigasi Bulan (Sebelum/Seterusnya).
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
    // Pemilihan dibatalkan jika tukar bulan
    selectedDateISO = null; 
    document.getElementById('btnSubmit').disabled = true;
    document.getElementById('slotWrapper').classList.add('hidden');
    document.getElementById('displayDate').value = "";
    
    renderCalendar();
};

/**
 * Pengendali Penghantaran Borang ke Database.
 */
window.handleBookingSubmit = async function() {
    const date = document.getElementById('rawDate').value;
    const tajukBengkel = document.getElementById('tajukBengkel').value;
    const masaInp = document.querySelector('input[name="inputMasa"]:checked');
    const picName = document.getElementById('picName').value.trim();
    const picPhone = document.getElementById('picPhone').value.trim();
    const btn = document.getElementById('btnSubmit');

    if (!date || !tajukBengkel || !masaInp || !picName || !picPhone) {
        return Swal.fire({
            icon: "warning",
            title: "Maklumat Tidak Lengkap",
            text: "Sila pastikan tarikh, tajuk bimbingan, slot masa dan butiran PIC diisi.",
            confirmButtonColor: '#3b82f6',
            customClass: { popup: 'rounded-[2rem]' }
        });
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

    // UI Feedback
    document.getElementById('loadingOverlay').classList.remove('hidden');
    btn.disabled = true;

    try {
        const result = await BookingService.createBooking(payload);
        
        document.getElementById('loadingOverlay').classList.add('hidden');
        
        await Swal.fire({
            icon: 'success',
            title: 'Permohonan Diterima!',
            html: `<div class="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-2">
                    <p class="text-xs text-blue-400 font-bold uppercase tracking-widest">ID Tempahan Anda:</p>
                    <p class="text-lg font-black text-brand-600 font-mono">${result.bookingId}</p>
                   </div>
                   <p class="text-sm text-slate-500 wrap-safe">Sila tunggu maklum balas daripada Pegawai USTP untuk pengesahan slot bimbingan ini.</p>`,
            confirmButtonColor: '#2563eb',
            customClass: { popup: 'rounded-[2rem]' }
        });

        // Reset Borang
        document.getElementById('bookingForm').reset();
        document.getElementById('slotWrapper').classList.add('hidden');
        document.getElementById('displayDate').value = "";
        btn.disabled = true;
        selectedDateISO = null;
        
        renderCalendar();

    } catch (err) {
        document.getElementById('loadingOverlay').classList.add('hidden');
        btn.disabled = false;
        Swal.fire({
            icon: "error",
            title: "Gagal Menghantar",
            text: err.message || "Ralat sistem pangkalan data.",
            confirmButtonColor: '#ef4444',
            customClass: { popup: 'rounded-[2rem]' }
        });
    }
};