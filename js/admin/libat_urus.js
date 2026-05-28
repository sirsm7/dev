/**
 * @file libat_urus.js
 * @description Controller for the Admin Libat Urus DELIMa Dashboard.
 * Handles data fetching, statistical aggregation, filtering, and gallery rendering.
 */

import { APP_CONFIG } from '../config/app.config.js';
import { libatUrusService } from '../services/libat_urus.service.js';
import { toggleLoading } from '../core/helpers.js';

// --- GLOBAL STATE ---
let allLibatUrusData = [];
let filteredLibatUrusData = [];

/**
 * Initializes and loads the Libat Urus dashboard data
 * Exposed to window so it can be called from main.js when the tab is clicked.
 */
window.loadAdminLibatUrus = async function() {
    toggleLoading(true);
    
    try {
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD); // PPD Code like M030
        
        let daerahFilter = null;
        const daerahWrapper = document.getElementById('luFilterDaerahWrapper');
        
        // RBAC: Set strict filtering based on roles
        if (userRole === 'SUPER_ADMIN' || userRole === 'JPNMEL') {
            if(daerahWrapper) daerahWrapper.classList.remove('hidden');
        } else if (userRole === 'ADMIN') {
            if(daerahWrapper) daerahWrapper.classList.add('hidden');
            daerahFilter = APP_CONFIG.PPD_MAPPING[userKod] || null;
        }

        // Fetch data from database via service
        allLibatUrusData = await libatUrusService.getAllReports(daerahFilter);
        
        // Initialize filters and UI
        resetLibatUrusFilters();
        populateSekolahDropdown(allLibatUrusData);
        processAndRender(allLibatUrusData);
        
    } catch (error) {
        console.error("Error loading Admin Libat Urus:", error);
        Swal.fire('Ralat Sistem', 'Sistem tidak dapat memuat turun data libat urus. Sila semak sambungan internet atau hubungi pembangun.', 'error');
    }
    
    toggleLoading(false);
};

/**
 * Reset dropdown filters to default
 */
function resetLibatUrusFilters() {
    const fDaerah = document.getElementById('filterLuDaerah');
    const fSekolah = document.getElementById('filterLuSekolah');
    const fBulan = document.getElementById('filterLuBulan');
    
    if(fDaerah) fDaerah.value = "ALL";
    if(fSekolah) fSekolah.value = "ALL";
    if(fBulan) fBulan.value = "ALL";
}

/**
 * Dynamically extract unique schools from the dataset and populate the dropdown
 * @param {Array} data - Array of records
 */
function populateSekolahDropdown(data) {
    const filterSekolah = document.getElementById('filterLuSekolah');
    if (!filterSekolah) return;

    // Get unique schools and sort alphabetically
    const uniqueSchools = [...new Set(data.map(item => item.school?.nama_sekolah || 'TIDAK DIKETAHUI'))].sort();
    
    let optionsHtml = `<option value="ALL">SEMUA SEKOLAH</option>`;
    uniqueSchools.forEach(school => {
        if(school !== 'TIDAK DIKETAHUI') {
            optionsHtml += `<option value="${school}">${school}</option>`;
        }
    });
    
    filterSekolah.innerHTML = optionsHtml;
}

/**
 * Filter mechanism triggered by onchange event in dropdowns
 */
window.filterLibatUrus = function() {
    const fDaerah = document.getElementById('filterLuDaerah')?.value || "ALL";
    const fSekolah = document.getElementById('filterLuSekolah')?.value || "ALL";
    const fBulan = document.getElementById('filterLuBulan')?.value || "ALL";

    filteredLibatUrusData = allLibatUrusData.filter(item => {
        let matchDaerah = true;
        let matchSekolah = true;
        let matchBulan = true;
        
        const schoolName = item.school?.nama_sekolah || "";
        const schoolDaerah = item.school?.daerah || "";

        if (fDaerah !== "ALL") matchDaerah = schoolDaerah.toUpperCase() === fDaerah.toUpperCase();
        if (fSekolah !== "ALL") matchSekolah = schoolName === fSekolah;
        if (fBulan !== "ALL") matchBulan = item.bulan === fBulan;

        return matchDaerah && matchSekolah && matchBulan;
    });

    processAndRender(filteredLibatUrusData);
};

/**
 * Process statistics and render the gallery
 * @param {Array} data - Filtered or full array of records
 */
function processAndRender(data) {
    calculateDashboardStats(data);
    renderLibatUrusGallery(data);
}

/**
 * Perform aggregations to calculate KPIs and update the dashboard cards
 * @param {Array} data - Array of records to process
 */
function calculateDashboardStats(data) {
    let sumGuru = 0;
    let sumMurid = 0;
    let sumIbuBapa = 0;
    
    const monthFrequency = {};
    let topMonth = '-';
    let maxFrequency = 0;

    data.forEach(item => {
        // Tally participants based on categories
        const cat = (item.kategori_sasar || '').toUpperCase();
        const pax = parseInt(item.jumlah_peserta) || 0;
        
        if (cat === 'GURU') sumGuru += pax;
        else if (cat === 'MURID') sumMurid += pax;
        else if (cat === 'IBU-BAPA (PIBG & PIBKS)' || cat.includes('IBU')) sumIbuBapa += pax;

        // Calculate Month Frequency
        if (item.bulan) {
            monthFrequency[item.bulan] = (monthFrequency[item.bulan] || 0) + 1;
            if (monthFrequency[item.bulan] > maxFrequency) {
                maxFrequency = monthFrequency[item.bulan];
                topMonth = item.bulan;
            }
        }
    });

    // Update DOM elements safely
    const statLuBulan = document.getElementById('statLuBulan');
    const statLuGuru = document.getElementById('statLuGuru');
    const statLuMurid = document.getElementById('statLuMurid');
    const statLuIbuBapa = document.getElementById('statLuIbuBapa');

    if(statLuBulan) statLuBulan.innerText = topMonth;
    if(statLuGuru) statLuGuru.innerText = sumGuru.toLocaleString('ms-MY');
    if(statLuMurid) statLuMurid.innerText = sumMurid.toLocaleString('ms-MY');
    if(statLuIbuBapa) statLuIbuBapa.innerText = sumIbuBapa.toLocaleString('ms-MY');
}

/**
 * Generate and display HTML cards for each record
 * @param {Array} data - Records to render
 */
function renderLibatUrusGallery(data) {
    const galleryContainer = document.getElementById('luAdminGallery');
    const emptyState = document.getElementById('luEmptyState');
    
    if (!galleryContainer || !emptyState) return;

    if (data.length === 0) {
        galleryContainer.innerHTML = "";
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    
    const htmlCards = data.map(item => {
        const cat = (item.kategori_sasar || '').toUpperCase();
        const dateStr = new Date(item.tarikh_laksana).toLocaleDateString('ms-MY');
        const schoolName = item.school?.nama_sekolah || item.kod_sekolah;
        const daerah = item.school?.daerah || 'N/A';
        
        let badgeStyle = 'bg-slate-100 text-slate-600 border-slate-200';
        let icon = '<i class="fas fa-users"></i>';
        
        if (cat === 'GURU') {
            badgeStyle = 'bg-blue-100 text-blue-700 border-blue-200';
            icon = '<i class="fas fa-chalkboard-teacher"></i>';
        } else if (cat === 'MURID') {
            badgeStyle = 'bg-cyan-100 text-cyan-700 border-cyan-200';
            icon = '<i class="fas fa-user-graduate"></i>';
        } else if (cat.includes('IBU')) {
            badgeStyle = 'bg-emerald-100 text-emerald-700 border-emerald-200';
            icon = '<i class="fas fa-people-arrows"></i>';
        }

        return `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden">
            <div class="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                <div>
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border shadow-sm ${badgeStyle}">
                        ${icon} ${cat}
                    </span>
                </div>
                <div class="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm uppercase">
                    ${daerah}
                </div>
            </div>
            <div class="p-5 flex-grow">
                <h4 class="font-bold text-slate-800 text-sm mb-1 leading-tight uppercase">${schoolName}</h4>
                <p class="text-[10px] font-mono font-bold text-slate-400 mb-3"><i class="fas fa-fingerprint mr-1"></i> ${item.kod_sekolah}</p>
                
                <div class="bg-orange-50 rounded-xl p-3 border border-orange-100 mb-4">
                    <p class="text-xs font-bold text-orange-900 mb-1 leading-snug uppercase">${item.tempat}</p>
                    <p class="text-[10px] text-orange-600 font-bold uppercase"><i class="far fa-calendar-alt mr-1"></i> ${dateStr} (${item.bulan})</p>
                </div>
                
                <div class="flex items-center justify-between mt-auto">
                    <div>
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Peserta</span>
                        <span class="text-xl font-black text-slate-700">${item.jumlah_peserta}</span>
                    </div>
                </div>
            </div>
            <div class="p-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <a href="${item.pautan_fail}" target="_blank" class="flex-1 text-center py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-all transform active:scale-95 flex items-center justify-center gap-2">
                    <i class="fas fa-file-pdf"></i> Lihat Laporan
                </a>
            </div>
        </div>
        `;
    }).join('');

    galleryContainer.innerHTML = htmlCards;
}

/**
 * Export current filtered data to CSV
 */
window.eksportLibatUrusCSV = function() {
    if (filteredLibatUrusData.length === 0) {
        return Swal.fire('Tiada Data', 'Sila pastikan jadual mempunyai data sebelum muat turun.', 'warning');
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    // Header
    csvContent += "ID_REKOD,KOD_SEKOLAH,NAMA_SEKOLAH,DAERAH,KATEGORI_SASAR,TARIKH_LAKSANA,BULAN,TEMPAT,JUMLAH_PESERTA,PAUTAN_FAIL\r\n";

    filteredLibatUrusData.forEach(item => {
        const id = item.id || '';
        const kod = item.kod_sekolah || '';
        const namaSekolah = `"${(item.school?.nama_sekolah || '').replace(/"/g, '""')}"`;
        const daerah = item.school?.daerah || '';
        const kategori = `"${(item.kategori_sasar || '').replace(/"/g, '""')}"`;
        const tarikh = item.tarikh_laksana || '';
        const bulan = item.bulan || '';
        const tempat = `"${(item.tempat || '').replace(/"/g, '""')}"`;
        const jumlah = item.jumlah_peserta || 0;
        const pautan = `"${(item.pautan_fail || '').replace(/"/g, '""')}"`;

        const row = [id, kod, namaSekolah, daerah, kategori, tarikh, bulan, tempat, jumlah, pautan].join(",");
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    // Naming logic based on filters
    const fDaerah = document.getElementById('filterLuDaerah')?.value || "SEMUA_DAERAH";
    const fBulan = document.getElementById('filterLuBulan')?.value || "SEMUA_BULAN";
    const dateMark = new Date().toISOString().slice(0,10).replace(/-/g,"");
    
    link.setAttribute("download", `LAPORAN_LIBAT_URUS_${fDaerah}_${fBulan}_${dateMark}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
};