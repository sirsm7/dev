import { AchievementService } from '../services/achievement.service.js';

let adminGalleryData = [];

window.initAdminGallery = function() {
    if (window.globalDashboardData) {
        populateGallerySchoolList();
    }
};

function populateGallerySchoolList() {
    const select = document.getElementById('gallerySchoolSelector');
    if (!select) return;
    
    select.innerHTML = '<option value="M030">PPD ALOR GAJAH (M030)</option>';
    window.globalDashboardData.filter(s => s.kod_sekolah !== 'M030').forEach(s => {
        select.innerHTML += `<option value="${s.kod_sekolah}">${s.nama_sekolah}</option>`;
    });
    
    window.loadAdminGalleryGrid('M030');
}

window.loadAdminGalleryGrid = async function(kod) {
    const grid = document.getElementById('adminGalleryGrid');
    grid.innerHTML = `<div class="col-12 text-center py-5"><div class="spinner-border"></div></div>`;
    document.getElementById('galleryTotalCount').innerText = "0";

    // Update Header
    if (kod === 'M030') {
        document.getElementById('galleryHeaderTitle').innerText = "PPD ALOR GAJAH";
        document.getElementById('galleryHeaderSubtitle').innerHTML = `<span class="badge bg-indigo me-2">M030</span> Unit Sumber Teknologi Pendidikan`;
    } else {
        const s = window.globalDashboardData?.find(x => x.kod_sekolah === kod);
        document.getElementById('galleryHeaderTitle').innerText = s ? s.nama_sekolah : kod;
        document.getElementById('galleryHeaderSubtitle').innerHTML = `<span class="badge bg-indigo me-2">${kod}</span> Galeri Sekolah`;
    }

    try {
        const data = await AchievementService.getBySchool(kod);
        adminGalleryData = data;
        
        // Generate Filter Buttons
        const cats = [...new Set(data.map(i => i.kategori))].sort();
        let btns = `<button class="btn btn-sm btn-dark rounded-pill px-3 active" onclick="filterAdminGallery('ALL', this)">SEMUA</button>`;
        cats.forEach(c => btns += `<button class="btn btn-sm btn-outline-secondary rounded-pill px-3 ms-1" onclick="filterAdminGallery('${c}', this)">${c}</button>`);
        document.getElementById('galleryFilterContainer').innerHTML = btns;

        renderAdminCards('ALL');
    } catch (e) {
        grid.innerHTML = `<div class="text-danger text-center">Gagal memuatkan galeri.</div>`;
    }
};

window.filterAdminGallery = function(type, btn) {
    if(btn) {
        document.querySelectorAll('#galleryFilterContainer button').forEach(b => b.classList.replace('btn-dark', 'btn-outline-secondary'));
        btn.classList.replace('btn-outline-secondary', 'btn-dark');
    }
    renderAdminCards(type);
};

function renderAdminCards(type) {
    const grid = document.getElementById('adminGalleryGrid');
    grid.innerHTML = '';
    
    const filtered = type === 'ALL' ? adminGalleryData : adminGalleryData.filter(i => i.kategori === type);
    document.getElementById('galleryTotalCount').innerText = filtered.length;

    if(filtered.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center py-5 text-muted">Tiada rekod.</div>`;
        return;
    }

    const years = [...new Set(filtered.map(i => i.tahun))].sort((a,b) => b - a);
    years.forEach(year => {
        grid.innerHTML += `<div class="col-12 mt-3 mb-2"><span class="badge bg-light text-dark border">${year}</span><hr class="my-1"></div>`;
        filtered.filter(i => i.tahun === year).forEach(item => {
            // HTML Kad (Ringkas)
            const link = item.pautan_bukti || '#';
            let icon = link.includes('drive') ? 'fa-folder' : 'fa-link';
            grid.innerHTML += `
            <div class="col-6 col-md-3 mb-3 fade-up">
                <div class="card h-100 shadow-sm border-top border-3 border-indigo" onclick="window.open('${link}')">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between mb-2"><span class="badge bg-light text-dark">${item.kategori}</span><i class="fas ${icon} text-muted"></i></div>
                        <h6 class="fw-bold text-truncate mb-1">${item.nama_pertandingan}</h6>
                        <p class="small text-muted mb-1 text-truncate">${item.nama_peserta}</p>
                        <small class="fw-bold text-primary">${item.pencapaian}</small>
                    </div>
                </div>
            </div>`;
        });
    });
}

window.handleGallerySchoolSearch = function(val) {
    // Implementasi debounce ringkas untuk carian
    // ...
};

window.resetGallery = function() {
    document.getElementById('gallerySchoolSelector').value = 'M030';
    window.loadAdminGalleryGrid('M030');
};