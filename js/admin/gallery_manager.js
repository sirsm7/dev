/**
 * ADMIN MODULE: GALLERY MANAGER (TAILWIND EDITION)
 * Menguruskan paparan galeri admin, carian sekolah, dan tapisan.
 */

import { AchievementService } from '../services/achievement.service.js';

let adminGalleryData = [];
let gallerySchoolListCache = [];
let searchDebounceTimer;
let currentGalleryJawatanFilter = 'ALL'; 

// --- 1. INITIALIZATION ---
window.initAdminGallery = function() {
    currentGalleryJawatanFilter = 'ALL';
    
    if (window.globalDashboardData && window.globalDashboardData.length > 0) {
        populateGallerySchoolList();
    } else {
        console.warn("Gallery: Global data missing. Waiting...");
    }
};

// --- 2. POPULATE & SEARCH LOGIC ---
function populateGallerySchoolList() {
    const select = document.getElementById('gallerySchoolSelector');
    if (!select) return;

    gallerySchoolListCache = window.globalDashboardData.filter(s => s.kod_sekolah !== 'M030');
    renderGalleryDropdown();
    
    // Default load M030
    window.loadAdminGalleryGrid('M030');
}

function renderGalleryDropdown(filterText = '') {
    const select = document.getElementById('gallerySchoolSelector');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="M030">PPD ALOR GAJAH (M030)</option>';

    const listToRender = filterText 
        ? gallerySchoolListCache.filter(s => 
            s.nama_sekolah.toUpperCase().includes(filterText.toUpperCase()) || 
            s.kod_sekolah.toUpperCase().includes(filterText.toUpperCase())
          )
        : gallerySchoolListCache;

    listToRender.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.kod_sekolah;
        opt.innerText = s.nama_sekolah;
        select.appendChild(opt);
    });

    // Kekalkan pilihan jika masih wujud dalam hasil carian
    const exists = Array.from(select.options).some(o => o.value === currentValue);
    if (exists && currentValue) {
        select.value = currentValue;
    } else if (listToRender.length > 0 && filterText) {
        // Auto-select first match if searching
        select.value = listToRender[0].kod_sekolah;
    }
}

window.handleGallerySchoolSearch = function(val) {
    renderGalleryDropdown(val);
    const select = document.getElementById('gallerySchoolSelector');
    const selectedKod = select.value;

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        if(selectedKod) {
            window.loadAdminGalleryGrid(selectedKod);
        }
    }, 500);
};

window.resetGallery = function() {
    const select = document.getElementById('gallerySchoolSelector');
    const searchInput = document.getElementById('gallerySearchInput');

    if(select) {
        clearTimeout(searchDebounceTimer);
        if(searchInput) searchInput.value = "";
        renderGalleryDropdown(''); 
        select.value = "M030";
        window.loadAdminGalleryGrid("M030");
    }
};

// --- 3. DATA LOADING & RENDERING ---
window.loadAdminGalleryGrid = async function(kod) {
    const grid = document.getElementById('adminGalleryGrid');
    const filterContainer = document.getElementById('galleryFilterContainer');
    const counterEl = document.getElementById('galleryTotalCount');
    
    // Cloud wrapper elements (jika ada dalam admin.html masa depan)
    // const cloudWrapper = document.getElementById('galleryCloudWrapper');

    if(!grid) return;

    updateGalleryHeader(kod);

    // Reset UI
    grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400 font-medium animate-pulse">Memuatkan galeri...</div>`;
    if(counterEl) counterEl.innerText = "0";
    filterContainer.innerHTML = '';
    
    currentGalleryJawatanFilter = 'ALL';

    try {
        const data = await AchievementService.getBySchool(kod);
        adminGalleryData = data;

        const categories = [...new Set(data.map(item => item.kategori))].filter(c => c).sort();
        
        // Filter Buttons (Tailwind)
        let filterHtml = `<button class="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-white shadow-sm transition transform scale-105" onclick="filterAdminGallery('ALL', this)">SEMUA</button>`;
        
        categories.forEach(cat => {
            let btnClass = 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700';
            // Optional: Colour coding based on category
            if (cat === 'MURID') btnClass = 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-50';
            else if (cat === 'GURU') btnClass = 'bg-white border border-amber-200 text-amber-600 hover:bg-amber-50';
            else if (cat === 'SEKOLAH') btnClass = 'bg-white border border-green-200 text-green-600 hover:bg-green-50';
            
            filterHtml += `<button class="px-3 py-1 rounded-full text-xs font-bold transition shadow-sm ${btnClass}" onclick="filterAdminGallery('${cat}', this)">${cat}</button>`;
        });
        
        filterContainer.innerHTML = filterHtml;
        renderAdminCards('ALL');

    } catch (e) {
        console.error(e);
        grid.innerHTML = `<div class="col-span-full text-center text-red-500 font-bold py-10">Gagal memuatkan data.</div>`;
    }
};

function updateGalleryHeader(kod) {
    const lblTitle = document.getElementById('galleryHeaderTitle');
    const lblSub = document.getElementById('galleryHeaderSubtitle');
    
    if (kod === 'M030') {
        lblTitle.innerText = "PPD ALOR GAJAH";
        lblSub.innerHTML = `<span class="inline-block bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold mr-2">M030</span> Unit Sumber Teknologi Pendidikan`;
    } else {
        let nama = kod;
        const s = window.globalDashboardData?.find(x => x.kod_sekolah === kod);
        if(s) nama = s.nama_sekolah;
        
        lblTitle.innerText = nama;
        lblSub.innerHTML = `<span class="inline-block bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold mr-2">${kod}</span> Galeri Sekolah`;
    }
}

// --- 4. FILTERING & CARDS ---
window.filterAdminGallery = function(type, btn) {
    if (btn) {
        // Reset all buttons style
        const btns = document.getElementById('galleryFilterContainer').children;
        for (let b of btns) {
            b.className = "px-3 py-1 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition shadow-sm";
        }
        // Set active style
        btn.className = "px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-white shadow-md transition transform scale-105";
    }

    currentGalleryJawatanFilter = 'ALL';
    // Logic Cloud Jawatan boleh ditambah di sini jika perlu (seperti achievement.js)

    renderAdminCards(type);
};

function renderAdminCards(filterType) {
    const grid = document.getElementById('adminGalleryGrid');
    const counterEl = document.getElementById('galleryTotalCount');
    grid.innerHTML = '';

    // Filter Utama
    let filtered = (filterType === 'ALL') 
        ? adminGalleryData 
        : adminGalleryData.filter(item => item.kategori === filterType);

    if(counterEl) counterEl.innerText = filtered.length;

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400 font-medium italic">Tiada rekod untuk kategori ini.</div>`;
        return;
    }

    const uniqueYears = [...new Set(filtered.map(item => item.tahun))].sort((a, b) => b - a);

    uniqueYears.forEach(year => {
        // Year Header
        grid.innerHTML += `
            <div class="col-span-full flex items-center gap-4 mt-4 mb-2">
                <span class="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 shadow-sm">
                    <i class="fas fa-calendar-alt mr-1"></i> ${year}
                </span>
                <div class="h-px bg-slate-200 flex-grow"></div>
            </div>`;

        const itemsInYear = filtered.filter(item => item.tahun === year);
        itemsInYear.forEach(item => {
            grid.innerHTML += createAdminCardHTML(item);
        });
    });
}

function createAdminCardHTML(item) {
    const link = item.pautan_bukti || "";
    let thumbnailArea = "";
    let iconType = "fa-link";
    
    let borderClass = "border-t-4 border-slate-400";
    let textClass = "text-slate-600";
    let catIcon = "fa-folder";
    let bgIcon = "bg-slate-50";

    if (item.kategori === 'MURID') {
        borderClass = "border-t-4 border-blue-500"; textClass = "text-blue-600"; catIcon = "fa-user-graduate"; bgIcon = "bg-blue-50";
    } else if (item.kategori === 'GURU') {
        borderClass = "border-t-4 border-amber-500"; textClass = "text-amber-600"; catIcon = "fa-chalkboard-user"; bgIcon = "bg-amber-50";
    } else if (item.kategori === 'SEKOLAH') {
        borderClass = "border-t-4 border-green-500"; textClass = "text-green-600"; catIcon = "fa-school"; bgIcon = "bg-green-50";
    } else if (item.kategori === 'PPD') {
        borderClass = "border-t-4 border-indigo-500"; textClass = "text-indigo-600"; catIcon = "fa-building"; bgIcon = "bg-indigo-50";
    }

    const fileIdMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const youtubeMatch = link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);

    if (folderMatch) {
        iconType = "fa-folder";
        thumbnailArea = `<div class="aspect-video bg-slate-100 flex items-center justify-center text-amber-400 text-4xl"><i class="fas fa-folder"></i></div>`;
    } else if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        const thumbUrl = `https://lh3.googleusercontent.com/d/${fileId}=s400`;
        iconType = "fa-image";
        thumbnailArea = `<div class="aspect-video bg-slate-100 overflow-hidden relative"><img src="${thumbUrl}" class="w-full h-full object-cover transform hover:scale-110 transition duration-500" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'aspect-video bg-slate-100 flex items-center justify-center text-slate-300 text-3xl\\'><i class=\\'fas fa-image\\'></i></div>'"></div>`;
    } else if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`; 
        iconType = "fa-play";
        thumbnailArea = `<div class="aspect-video bg-black overflow-hidden relative group"><img src="${thumbUrl}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"><div class="absolute inset-0 flex items-center justify-center text-white/80"><i class="fas fa-play-circle text-4xl shadow-xl"></i></div></div>`;
    } else {
        iconType = "fa-globe";
        thumbnailArea = `<div class="aspect-video bg-slate-100 flex items-center justify-center text-slate-400 text-3xl"><i class="fas fa-globe"></i></div>`;
    }

    return `
    <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full ${borderClass}" onclick="window.open('${link}', '_blank')">
        ${thumbnailArea}
        <div class="p-4 flex flex-col flex-grow relative">
            <span class="absolute top-[-12px] right-3 bg-white p-1 rounded-full shadow-sm text-slate-400 text-xs w-6 h-6 flex items-center justify-center border border-slate-100">
                <i class="fas ${iconType}"></i>
            </span>
            <div class="flex items-center gap-1 mb-2">
                <i class="fas ${catIcon} text-[10px] ${textClass}"></i>
                <span class="text-[10px] font-bold ${textClass}">${item.kategori}</span>
            </div>
            <h6 class="font-bold text-slate-800 text-xs leading-snug mb-1 line-clamp-2" title="${item.nama_pertandingan}">${item.nama_pertandingan}</h6>
            <p class="text-[10px] text-slate-500 font-medium mb-3 line-clamp-1">${item.nama_peserta}</p>
            <div class="mt-auto pt-2 border-t border-slate-50 flex justify-between items-center">
                <span class="text-[10px] font-bold ${textClass} bg-slate-50 px-2 py-0.5 rounded truncate max-w-[100px]">${item.pencapaian}</span>
            </div>
        </div>
    </div>`;
}