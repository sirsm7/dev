/**
 * ADMIN MODULE: DASHBOARD (TAILWIND EDITION - COMPREHENSIVE V3.1 TABLE VIEW)
 * Menguruskan senarai sekolah, filter berwarna, dan status data.
 * --- UPDATE V3.1 (TABLE REWRITE) ---
 * 1. UI: Kad grid dirombak sepenuhnya menjadi jadual data komprehensif (12 Lajur).
 * 2. Carian: Menyokong carian terus nama PGB dan GPK.
 * 3. Logik: Penambahan butang WhatsApp bertingkat dan butang Reset Password individu (Bypass Auth).
 */

import { SchoolService } from '../services/school.service.js';
import { toggleLoading, generateWhatsAppLink } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';
import { getDatabaseClient } from '../core/db.js'; // Disuntik untuk direct DB query

let dashboardData = [];
let currentFilteredList = [];
let activeStatus = 'ALL';
let activeType = 'ALL';
let searchTerm = ''; 
let reminderQueue = [];
let qIndex = 0;

// --- INITIALIZATION ---
window.fetchDashboardData = async function() {
    toggleLoading(true);
    try {
        const data = await SchoolService.getAll();
        window.globalDashboardData = data; 
        
        // Asingkan PPD (M030) daripada visual dashboard utama
        dashboardData = data.filter(item => item.kod_sekolah !== 'M030');
        
        renderFilters();
        window.runFilter();

    } catch (err) { 
        console.error("Dashboard Error:", err);
        Swal.fire('Ralat', 'Gagal memuatkan data dashboard.', 'error'); 
    } finally {
        toggleLoading(false); 
    }
};

// --- FILTER LOGIC (COLORFUL UI) ---
function renderFilters() {
    const types = [...new Set(dashboardData.map(i => i.jenis))].sort();
    let opts = `<option value="ALL">SEMUA JENIS</option>`;
    types.forEach(t => opts += `<option value="${t}">${t}</option>`);
    
    const container = document.getElementById('filterContainer');
    if(container) {
        container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div class="flex flex-wrap gap-2 justify-center md:justify-start">
            
            <!-- Butang SEMUA (Kelabu) -->
            <button onclick="setFilter('ALL')" id="badgeAll" class="filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200">
                Semua <span id="cntAll" class="bg-white text-slate-600 px-2 py-0.5 rounded-full text-[10px] shadow-sm">0</span>
            </button>

            <!-- Butang LENGKAP (Hijau) -->
            <button onclick="setFilter('LENGKAP')" id="badgeLengkap" class="filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                Lengkap <span id="cntLengkap" class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">0</span>
            </button>

            <!-- Butang BELUM (Merah) -->
            <button onclick="setFilter('BELUM')" id="badgeBelum" class="filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-red-200 text-red-600 hover:bg-red-50">
                Belum <span id="cntBelum" class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px]">0</span>
            </button>

            <!-- Butang SAMA (Ungu) -->
            <button onclick="setFilter('SAMA')" id="badgeSama" class="filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-purple-200 text-purple-600 hover:bg-purple-50">
                Sama <span id="cntSama" class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px]">0</span>
            </button>

            <!-- Butang BERBEZA (Oren/Amber) -->
            <button onclick="setFilter('BERBEZA')" id="badgeBerbeza" class="filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-amber-200 text-amber-600 hover:bg-amber-50">
                Berbeza <span id="cntBerbeza" class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px]">0</span>
            </button>

          </div>
          <div class="w-full md:w-auto">
            <select class="w-full md:w-48 px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-brand-500 bg-slate-50" onchange="setType(this.value)">${opts}</select>
          </div>
        </div>`;
    }
}

window.setFilter = function(s) { activeStatus = s; window.runFilter(); }
window.setType = function(t) { activeType = t; window.runFilter(); }
window.handleSearch = function(val) { searchTerm = val.toUpperCase().trim(); window.runFilter(); }

window.runFilter = function() {
    const filtered = dashboardData.filter(i => {
        const statMatch = (activeStatus === 'ALL') || 
                          (activeStatus === 'LENGKAP' && i.is_lengkap) || 
                          (activeStatus === 'BELUM' && !i.is_lengkap) ||
                          (activeStatus === 'SAMA' && i.is_sama) ||
                          (activeStatus === 'BERBEZA' && i.is_berbeza); 
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        
        // Carian Super: Merangkumi Nama Sekolah, Kod, PGB dan GPK
        const searchMatch = !searchTerm || 
                            i.kod_sekolah.includes(searchTerm) || 
                            i.nama_sekolah.includes(searchTerm) ||
                            (i.nama_pgb && i.nama_pgb.includes(searchTerm)) ||
                            (i.nama_gpk && i.nama_gpk.includes(searchTerm));
                            
        return statMatch && typeMatch && searchMatch;
    });

    currentFilteredList = filtered;
    updateBadgeCounts();
    renderGrid(filtered);
};

function updateBadgeCounts() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-offset-1', 'shadow-md', 'scale-105');
        if(btn.id === 'badgeAll') btn.className = "filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200";
        if(btn.id === 'badgeLengkap') btn.className = "filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50";
        if(btn.id === 'badgeBelum') btn.className = "filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-red-200 text-red-600 hover:bg-red-50";
        if(btn.id === 'badgeSama') btn.className = "filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-purple-200 text-purple-600 hover:bg-purple-50";
        if(btn.id === 'badgeBerbeza') btn.className = "filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-amber-200 text-amber-600 hover:bg-amber-50";
    });

    const map = { 'ALL': 'badgeAll', 'LENGKAP': 'badgeLengkap', 'BELUM': 'badgeBelum', 'SAMA': 'badgeSama', 'BERBEZA': 'badgeBerbeza' };
    const activeId = map[activeStatus];
    if (activeId) {
        const btn = document.getElementById(activeId);
        if (btn) {
            if(activeStatus === 'ALL') btn.className = "filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-slate-600 text-white border-slate-600 shadow-md scale-105";
            if(activeStatus === 'LENGKAP') btn.className = "filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-emerald-500 text-white border-emerald-500 shadow-md scale-105";
            if(activeStatus === 'BELUM') btn.className = "filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-red-500 text-white border-red-500 shadow-md scale-105";
            if(activeStatus === 'SAMA') btn.className = "filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-purple-500 text-white border-purple-500 shadow-md scale-105";
            if(activeStatus === 'BERBEZA') btn.className = "filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-amber-500 text-white border-amber-500 shadow-md scale-105";
            
            const span = btn.querySelector('span');
            if(span) span.className = "bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px]";
        }
    }
    
    const context = dashboardData.filter(i => {
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        const searchMatch = !searchTerm || 
                            i.kod_sekolah.includes(searchTerm) || 
                            i.nama_sekolah.includes(searchTerm) ||
                            (i.nama_pgb && i.nama_pgb.includes(searchTerm)) ||
                            (i.nama_gpk && i.nama_gpk.includes(searchTerm));
        return typeMatch && searchMatch;
    });
    
    const setTxt = (id, count) => { if(document.getElementById(id)) document.getElementById(id).innerText = count; };
    setTxt('cntAll', context.length);
    setTxt('cntLengkap', context.filter(i => i.is_lengkap).length);
    setTxt('cntBelum', context.filter(i => !i.is_lengkap).length);
    setTxt('cntSama', context.filter(i => i.is_sama).length);
    setTxt('cntBerbeza', context.filter(i => i.is_berbeza).length);
}

// --- RENDERING TABLE (TABLE VIEW INJECTION) ---
function renderWaBtn(nama, tel, label) {
    const link = generateWhatsAppLink(nama, tel, true);
    if (link) {
        return `<a href="${link}" target="_blank" onclick="event.stopPropagation()" class="px-2 py-1.5 bg-green-50 text-green-700 hover:bg-green-500 hover:text-white rounded-lg text-[9px] font-black border border-green-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full uppercase tracking-wider"><i class="fab fa-whatsapp text-sm"></i> ${label}</a>`;
    } else {
        return `<span class="px-2 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-bold border border-slate-200 cursor-not-allowed flex items-center justify-center gap-1.5 w-full uppercase"><i class="fab fa-whatsapp text-sm"></i> TIADA TEL</span>`;
    }
}

function renderResetBtn(emel, peranan, label) {
    if (emel) {
        return `<button onclick="event.stopPropagation(); resetPasswordSpesifik('${emel}', '${peranan}')" class="px-2 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white rounded-lg text-[9px] font-black border border-amber-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm w-full uppercase tracking-wider"><i class="fas fa-key"></i> ${label}</button>`;
    } else {
        return `<span class="px-2 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-bold border border-slate-200 cursor-not-allowed flex items-center justify-center gap-1.5 w-full uppercase"><i class="fas fa-key"></i> TIADA EMEL</span>`;
    }
}

function renderGrid(data) {
    const wrapper = document.getElementById('schoolGridWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = "";
    
    if (data.length === 0) { 
        wrapper.innerHTML = `<div class="col-span-full text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 font-medium">Tiada data untuk paparan ini.</div>`; 
        return; 
    }

    // Suntikan pembungkus (wrapper) membatalkan kesan grid ibu (col-span-full) dan membina jadual tatalan x (overflow-x-auto)
    let tableHTML = `
    <div class="col-span-full overflow-x-auto bg-white rounded-3xl border border-slate-200 shadow-xl custom-scrollbar relative">
        <table class="w-full text-xs text-left whitespace-nowrap">
            <thead class="text-[10px] text-slate-500 uppercase bg-slate-100 border-b-2 border-slate-200 sticky top-0 z-10 tracking-widest font-black">
                <tr>
                    <th class="px-4 py-4 text-center border-r border-slate-200">BIL</th>
                    <th class="px-4 py-4 border-r border-slate-200">JENIS SEKOLAH</th>
                    <th class="px-4 py-4 border-r border-slate-200 text-brand-600">KOD SEKOLAH</th>
                    <th class="px-5 py-4 border-r border-slate-200 min-w-[250px]">NAMA SEKOLAH</th>
                    <th class="px-4 py-4 border-r border-slate-200 text-center">DAERAH</th>
                    <th class="px-4 py-4 border-r border-slate-200 min-w-[160px]">NAMA PENGARAH KV /<br>PGB</th>
                    <th class="px-4 py-4 border-r border-slate-200 min-w-[160px]">NAMA TIMB PENGARAH KV /<br>GPK PENTADBIRAN</th>
                    <th class="px-4 py-4 border-r border-slate-200 min-w-[160px]">NAMA GPICT</th>
                    <th class="px-4 py-4 border-r border-slate-200 min-w-[160px]">NAMA ADMIN DELIMa</th>
                    <th class="px-4 py-4 text-center border-r border-slate-200 w-36">RESET PASSWORD</th>
                    <th class="px-4 py-4 text-center border-r border-slate-200 w-36">LINK WHATSAPP</th>
                    <th class="px-4 py-4 text-center w-32">EDIT REKOD</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
    `;

    data.forEach((s, index) => {
        // Jana susunan bertingkat untuk WhatsApp
        const btnWaPGB = renderWaBtn(s.nama_pgb, s.no_telefon_pgb, 'PGB');
        const btnWaGPK = renderWaBtn(s.nama_gpk, s.no_telefon_gpk, 'GPK');
        const btnWaICT = renderWaBtn(s.nama_gpict, s.no_telefon_gpict, 'GPICT');
        const btnWaADM = renderWaBtn(s.nama_admin_delima, s.no_telefon_admin_delima, 'ADMIN');

        // Jana susunan bertingkat untuk Reset
        const btnResetPGB = renderResetBtn(s.emel_delima_pgb, 'PGB', 'PGB');
        const btnResetGPK = renderResetBtn(s.emel_delima_gpk, 'GPK', 'GPK');
        const btnResetICT = renderResetBtn(s.emel_delima_gpict, 'GPICT', 'GPICT');
        const btnResetADM = renderResetBtn(s.emel_delima_admin_delima, 'Admin DELIMa', 'ADMIN');

        // Status Penanda Visual
        const rowClass = s.is_lengkap ? "bg-white hover:bg-emerald-50/30" : "bg-red-50/10 hover:bg-red-50/50";

        tableHTML += `
        <tr class="${rowClass} transition-colors group">
            <td class="px-4 py-4 text-center font-mono font-bold text-slate-400 border-r border-slate-100 align-top">${index + 1}</td>
            
            <td class="px-4 py-4 font-black text-slate-600 border-r border-slate-100 align-top">${s.jenis || '-'}</td>
            
            <td class="px-4 py-4 border-r border-slate-100 align-top">
                <span class="inline-block bg-brand-50 text-brand-700 font-mono font-black px-2 py-1 rounded border border-brand-200 shadow-sm">${s.kod_sekolah}</span>
            </td>
            
            <td class="px-5 py-4 font-bold text-slate-800 whitespace-normal leading-relaxed border-r border-slate-100 align-top">${s.nama_sekolah}</td>
            
            <td class="px-4 py-4 font-bold text-slate-500 border-r border-slate-100 align-top text-center uppercase tracking-wider">${s.daerah || 'ALOR GAJAH'}</td>
            
            <td class="px-4 py-4 border-r border-slate-100 align-top">
                <div class="font-bold text-slate-700 whitespace-normal leading-snug text-xs">${s.nama_pgb || '<span class="text-slate-300 italic">Tiada Rekod</span>'}</div>
            </td>
            <td class="px-4 py-4 border-r border-slate-100 align-top">
                <div class="font-bold text-slate-700 whitespace-normal leading-snug text-xs">${s.nama_gpk || '<span class="text-slate-300 italic">Tiada Rekod</span>'}</div>
            </td>
            <td class="px-4 py-4 border-r border-slate-100 align-top">
                <div class="font-bold text-slate-700 whitespace-normal leading-snug text-xs">${s.nama_gpict || '<span class="text-slate-300 italic">Tiada Rekod</span>'}</div>
            </td>
            <td class="px-4 py-4 border-r border-slate-100 align-top">
                <div class="font-bold text-slate-700 whitespace-normal leading-snug text-xs">${s.nama_admin_delima || '<span class="text-slate-300 italic">Tiada Rekod</span>'}</div>
            </td>

            <td class="px-3 py-3 border-r border-slate-100 align-top bg-slate-50/50">
                <div class="flex flex-col gap-2 w-full">
                    ${btnResetPGB}
                    ${btnResetGPK}
                    ${btnResetICT}
                    ${btnResetADM}
                </div>
            </td>

            <td class="px-3 py-3 border-r border-slate-100 align-top bg-slate-50/50">
                <div class="flex flex-col gap-2 w-full">
                    ${btnWaPGB}
                    ${btnWaGPK}
                    ${btnWaICT}
                    ${btnWaADM}
                </div>
            </td>

            <td class="px-4 py-4 text-center align-top">
                <button onclick="viewSchoolProfile('${s.kod_sekolah}')" class="px-4 py-3 bg-slate-800 hover:bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 w-full transform active:scale-95">
                    <i class="fas fa-edit"></i> EDIT REKOD
                </button>
            </td>
        </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    </div>
    `;

    wrapper.innerHTML = tableHTML;
}

// --- UTILS & EXPORTS ---

/**
 * FIXED: Menghalakan pandangan admin ke profil sekolah yang dipilih.
 * Menggunakan localStorage untuk integriti data silang modul.
 */
window.viewSchoolProfile = function(kod) {
    localStorage.setItem(APP_CONFIG.SESSION.USER_KOD, kod);
    window.location.href = 'user.html'; 
};

/**
 * NEW: Modul Penetapan Semula Kata Laluan Berdasarkan Emel Peranan
 * Bypass kepada pangkalan data pengguna (smpid_users).
 */
window.resetPasswordSpesifik = async function(emel, peranan) {
    if (!emel || emel === 'undefined') {
        return Swal.fire({
            icon: 'warning',
            title: 'Tiada Rekod Emel',
            text: `Sila pastikan maklumat profil ${peranan} dilengkapkan dengan emel terlebih dahulu sebelum menetapkan semula kata laluan.`
        });
    }

    Swal.fire({
        title: `Reset Password ${peranan}?`,
        html: `Kata laluan untuk akaun <b>${emel}</b> akan ditetapkan semula kepada kata laluan lalai: <br><br><span class="font-mono bg-slate-100 px-3 py-1 rounded text-brand-600 font-bold border border-slate-200">ppdag@12345</span>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        confirmButtonText: 'Ya, Sahkan Reset',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-3xl' }
    }).then(async (r) => {
        if (r.isConfirmed) {
            toggleLoading(true);
            try {
                // Initialize database client on the fly for admin override
                const db = getDatabaseClient();
                const { error } = await db
                    .from('smpid_users')
                    .update({ password: APP_CONFIG.DEFAULTS.PASSWORD })
                    .eq('email', emel.toLowerCase());
                
                toggleLoading(false);
                
                if (error) throw error;
                
                Swal.fire({
                    icon: 'success',
                    title: 'Berjaya Direset',
                    text: `Kata laluan untuk ${peranan} berjaya dikembalikan kepada lalai.`,
                    confirmButtonColor: '#10b981',
                    customClass: { popup: 'rounded-3xl' }
                });
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat Sistem', 'Gagal menetapkan semula kata laluan di pangkalan data.', 'error');
            }
        }
    });
};

window.eksportDataTapis = function() {
    if (!currentFilteredList || currentFilteredList.length === 0) return Swal.fire('Tiada Data', '', 'info'); 
    
    // Kemas kini tajuk CSV untuk merangkumi profil PGB dan GPK
    let csvContent = "BIL,KOD,NAMA,JENIS,NAMA PGB,TEL PGB,NAMA GPK,TEL GPK,NAMA GPICT,TEL GPICT,NAMA ADMIN,TEL ADMIN,STATUS PENGISIAN\n";
    
    currentFilteredList.forEach((s, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        let row = [
            index + 1, clean(s.kod_sekolah), clean(s.nama_sekolah), clean(s.jenis),
            clean(s.nama_pgb), clean(s.no_telefon_pgb),
            clean(s.nama_gpk), clean(s.no_telefon_gpk),
            clean(s.nama_gpict), clean(s.no_telefon_gpict), 
            clean(s.nama_admin_delima), clean(s.no_telefon_admin_delima),
            s.is_lengkap ? 'LENGKAP' : 'BELUM'
        ];
        csvContent += row.join(",") + "\n";
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Profil_Penuh_Sekolah_${activeStatus}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
};

window.janaSenaraiTelegram = function() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    let txt = `**STATUS PENGISIAN SMPID (${activeType})**\n\n`;
    const pending = list.filter(i => !i.is_lengkap);
    
    if(pending.length === 0) return Swal.fire('Hebat', 'Semua lengkap!', 'success'); 
    
    pending.forEach(i => txt += `- ${i.kod_sekolah} ${i.nama_sekolah}\n`);
    txt += `\nMohon tindakan segera.`;
    navigator.clipboard.writeText(txt).then(() => Swal.fire('Disalin!', 'Senarai disalin.', 'success'));
};

// --- QUEUE SYSTEM (MODAL CONTROL) ---
window.mulaTindakanPantas = function() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    reminderQueue = [];
    
    list.forEach(i => {
        if (i.no_telefon_gpict && !i.telegram_id_gpict) {
            reminderQueue.push({role:'GPICT', ...i, targetName: i.nama_gpict, targetTel: i.no_telefon_gpict});
        }
        if (i.no_telefon_admin_delima && !i.telegram_id_admin) {
            reminderQueue.push({role:'Admin', ...i, targetName: i.nama_admin_delima, targetTel: i.no_telefon_admin_delima});
        }
    });
    
    if (reminderQueue.length === 0) return Swal.fire('Tiada Sasaran', 'Tiada data untuk disusuli.', 'info'); 
    qIndex = 0; 
    document.getElementById('queueModal').classList.remove('hidden'); 
    renderQueue();
};

function renderQueue() {
    if (qIndex >= reminderQueue.length) { 
        document.getElementById('queueModal').classList.add('hidden'); 
        Swal.fire('Selesai', 'Semakan tamat.', 'success'); 
        return; 
    }
    const item = reminderQueue[qIndex];
    document.getElementById('qProgress').innerText = `${qIndex + 1} / ${reminderQueue.length}`;
    document.getElementById('qRoleBadge').innerText = item.role;
    document.getElementById('qSchoolName').innerText = item.nama_sekolah;
    document.getElementById('qCode').innerText = item.kod_sekolah;
    document.getElementById('qPersonName').innerText = item.targetName || "-";
    
    const link = generateWhatsAppLink(item.targetName, item.targetTel);
    const btn = document.getElementById('qWaBtn');
    
    if (link) { 
        btn.href = link; 
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else { 
        btn.removeAttribute('href'); 
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

window.nextQueue = function() { qIndex++; renderQueue(); }
window.prevQueue = function() { if(qIndex > 0) qIndex--; renderQueue(); }