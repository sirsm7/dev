/**
 * ADMIN MODULE: DASHBOARD
 * Menguruskan senarai sekolah, filter, dan status data.
 */

import { SchoolService } from '../services/school.service.js';
import { toggleLoading, generateWhatsAppLink } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

let dashboardData = [];
let currentFilteredList = [];
let activeStatus = 'ALL';
let activeType = 'ALL';
let searchTerm = ''; 
let reminderQueue = [];
let qIndex = 0;

// --- INITIALIZATION ---
// Fungsi ini dipanggil dari main.js atau onclick
window.fetchDashboardData = async function() {
    toggleLoading(true);
    try {
        // Guna Service
        const data = await SchoolService.getAll();
        
        // Simpan global untuk akses modul lain
        window.globalDashboardData = data; 
        
        // Filter out PPD (M030) untuk visual dashboard
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

// --- FILTER LOGIC ---
function renderFilters() {
    const types = [...new Set(dashboardData.map(i => i.jenis))].sort();
    let opts = `<option value="ALL">SEMUA JENIS SEKOLAH</option>`;
    types.forEach(t => opts += `<option value="${t}">${t}</option>`);
    
    const container = document.getElementById('filterContainer');
    if(container) {
        container.innerHTML = `
        <div class="row align-items-center g-3">
          <div class="col-md-9 col-12 d-flex flex-wrap gap-2">
            <span onclick="setFilter('ALL')" id="badgeAll" class="badge bg-secondary cursor-pointer filter-badge active p-2">Semua <span id="cntAll" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('LENGKAP')" id="badgeLengkap" class="badge bg-success cursor-pointer filter-badge p-2">Lengkap <span id="cntLengkap" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('BELUM')" id="badgeBelum" class="badge bg-danger cursor-pointer filter-badge p-2">Belum <span id="cntBelum" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('SAMA')" id="badgeSama" class="badge bg-purple cursor-pointer filter-badge p-2">Jawatan Sama <span id="cntSama" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('BERBEZA')" id="badgeBerbeza" class="badge bg-orange cursor-pointer filter-badge p-2">Jawatan Berbeza <span id="cntBerbeza" class="badge bg-light text-dark ms-1">0</span></span>
          </div>
          <div class="col-md-3"><select class="form-select rounded-pill shadow-sm" onchange="setType(this.value)">${opts}</select></div>
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
        const searchMatch = !searchTerm || i.kod_sekolah.includes(searchTerm) || i.nama_sekolah.includes(searchTerm);
        return statMatch && typeMatch && searchMatch;
    });

    currentFilteredList = filtered;
    updateBadgeCounts();
    renderGrid(filtered);
};

function updateBadgeCounts() {
    document.querySelectorAll('.filter-badge').forEach(e => e.classList.remove('active'));
    const map = { 'ALL': 'badgeAll', 'LENGKAP': 'badgeLengkap', 'BELUM': 'badgeBelum', 'SAMA': 'badgeSama', 'BERBEZA': 'badgeBerbeza' };
    if (map[activeStatus]) document.getElementById(map[activeStatus])?.classList.add('active');
    
    // Kiraan dinamik berdasarkan carian semasa
    const context = dashboardData.filter(i => {
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        const searchMatch = !searchTerm || i.kod_sekolah.includes(searchTerm) || i.nama_sekolah.includes(searchTerm);
        return typeMatch && searchMatch;
    });
    
    const setTxt = (id, count) => { if(document.getElementById(id)) document.getElementById(id).innerText = count; };
    setTxt('cntAll', context.length);
    setTxt('cntLengkap', context.filter(i => i.is_lengkap).length);
    setTxt('cntBelum', context.filter(i => !i.is_lengkap).length);
    setTxt('cntSama', context.filter(i => i.is_sama).length);
    setTxt('cntBerbeza', context.filter(i => i.is_berbeza).length);
}

function renderGrid(data) {
    const wrapper = document.getElementById('schoolGridWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = "";
    
    if (data.length === 0) { 
        wrapper.innerHTML = `<div class="alert alert-light text-center w-100 mt-4">Tiada data untuk paparan ini.</div>`; 
        return; 
    }

    const groups = data.reduce((acc, i) => { (acc[i.jenis] = acc[i.jenis] || []).push(i); return acc; }, {});

    Object.keys(groups).sort().forEach(jenis => {
        const items = groups[jenis];
        let html = `<div class="mb-4 fade-up"><h6 class="category-header">${jenis} (${items.length})</h6><div class="row g-3">`;
        
        items.forEach(s => {
            const statusBadge = s.is_lengkap 
                ? `<span class="badge bg-success status-badge p-2 shadow-sm"><i class="fas fa-check fa-lg"></i></span>` 
                : `<span class="badge bg-danger status-badge p-2 shadow-sm"><i class="fas fa-times fa-lg"></i></span>`;
            
            const linkG = generateWhatsAppLink(s.nama_gpict, s.no_telefon_gpict, true);
            const linkA = generateWhatsAppLink(s.nama_admin_delima, s.no_telefon_admin_delima, true);

            const renderActions = (linkRaw) => {
                return linkRaw ? `<a href="${linkRaw}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm btn-light border text-secondary"><i class="fas fa-comment"></i></a>` : `<span class="text-muted small">-</span>`;
            };

            html += `
            <div class="col-6 col-md-4 col-lg-3">
              <div class="card school-card h-100 position-relative" onclick="viewSchoolProfile('${s.kod_sekolah}')">
                <div class="card-body p-3 d-flex flex-column">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h6 class="fw-bold text-primary mb-0 text-truncate" style="max-width: 100%;">${s.kod_sekolah}</h6>
                        <button onclick="event.stopPropagation(); window.resetPasswordSekolah('${s.kod_sekolah}')" class="btn btn-sm btn-link text-warning p-0 text-decoration-none small fw-bold mt-1"><i class="fas fa-key me-1"></i>Reset</button>
                    </div>
                    ${statusBadge}
                  </div>
                  <p class="school-name mb-auto">${s.nama_sekolah}</p>
                </div>
                <div class="tele-status-row bg-light border-top">
                   <div class="row-item p-2"><span class="small fw-bold text-muted">GPICT</span> ${renderActions(linkG)}</div>
                   <div class="row-item p-2 border-top border-light"><span class="small fw-bold text-muted">Admin</span> ${renderActions(linkA)}</div>
                </div>
              </div>
            </div>`;
        });
        html += `</div></div>`;
        wrapper.innerHTML += html;
    });
}

// --- UTILS & EXPORTS ---
window.viewSchoolProfile = function(kod) {
    sessionStorage.setItem(APP_CONFIG.SESSION.USER_KOD, kod);
    window.location.href = 'user.html'; 
};

window.eksportDataTapis = function() {
    if (!currentFilteredList || currentFilteredList.length === 0) return Swal.fire('Tiada Data', '', 'info'); 
    let csvContent = "BIL,KOD,NAMA,JENIS,GPICT,TEL GPICT,ADMIN,TEL ADMIN,STATUS\n";
    currentFilteredList.forEach((s, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        let row = [
            index + 1, clean(s.kod_sekolah), clean(s.nama_sekolah), clean(s.jenis),
            clean(s.nama_gpict), clean(s.no_telefon_gpict), clean(s.nama_admin_delima), clean(s.no_telefon_admin_delima),
            s.is_lengkap ? 'LENGKAP' : 'BELUM'
        ];
        csvContent += row.join(",") + "\n";
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `SMPID_Eksport_${activeStatus}.csv`;
    link.click();
};

window.janaSenaraiTelegram = function() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    let txt = `**STATUS PENGISIAN SMPID (${activeType})**\n\n`;
    const pending = list.filter(i => !i.is_lengkap);
    
    if(pending.length === 0) return Swal.fire('Hebat', 'Semua lengkap!', 'success'); 
    
    pending.forEach(i => txt += `- ${i.kod_sekolah} ${i.nama_sekolah}\n`);
    navigator.clipboard.writeText(txt).then(() => Swal.fire('Disalin!', 'Senarai disalin.', 'success'));
};

// --- QUEUE SYSTEM ---
window.mulaTindakanPantas = function() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    reminderQueue = [];
    
    list.forEach(i => {
        if (!i.is_lengkap) {
            // Logic mudah: Jika tak lengkap, cari siapa yang ada no telefon
            if(i.no_telefon_gpict) reminderQueue.push({role:'GPICT', ...i, targetName: i.nama_gpict, targetTel: i.no_telefon_gpict});
            if(i.no_telefon_admin_delima) reminderQueue.push({role:'Admin', ...i, targetName: i.nama_admin_delima, targetTel: i.no_telefon_admin_delima});
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
    if (link) { btn.href = link; btn.classList.remove('disabled'); } 
    else { btn.removeAttribute('href'); btn.classList.add('disabled'); }
}

window.nextQueue = function() { qIndex++; renderQueue(); }
window.prevQueue = function() { if(qIndex > 0) qIndex--; renderQueue(); }