/**
 * ADMIN MODULE: ACHIEVEMENT (FULL PRODUCTION VERSION)
 * Menguruskan rekod pencapaian, statistik, ranking sekolah, 
 * word cloud jawatan, dan logik penyeragaman data pukal.
 */

import { AchievementService } from '../services/achievement.service.js';
import { toggleLoading } from '../core/helpers.js';

// --- GLOBAL STATE ---
let pencapaianList = [];
let currentPencapaianFiltered = []; 
let currentCardFilter = 'ALL';      // Kebangsaan, Antarabangsa, Google, dll
let currentJawatanFilter = 'ALL';   // Diuruskan oleh Word Cloud
let sortState = { column: 'created_at', direction: 'desc' };

// Cache untuk senarai nama program unik bagi tujuan penyeragaman
let standardizationList = []; 
let filteredStandardizationList = [];

// --- 1. INITIALIZATION ---

/**
 * Mengisi dropdown tahun berdasarkan data unik dalam database.
 */
window.populateTahunFilter = async function() {
    const select = document.getElementById('filterTahunPencapaian');
    if (!select) return;
    try {
        const years = await AchievementService.getAvailableYears();
        // Standardized Text
        select.innerHTML = '<option value="ALL">SEMUA TAHUN</option>';
        years.forEach(y => {
            select.innerHTML += `<option value="${y}">TAHUN ${y}</option>`;
        });
        // Muat data secara automatik selepas tahun tersedia
        window.loadMasterPencapaian();
    } catch (e) { 
        console.error("[Achievement] Ralat muat tahun:", e); 
    }
};

/**
 * Mengambil data mentah dari pangkalan data.
 */
window.loadMasterPencapaian = async function() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    if(!tbody) return;
    
    // Papar placeholder loading jika senarai kosong
    if (pencapaianList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 font-medium animate-pulse">Memuatkan data pangkalan data...</td></tr>`;
    }
    
    const tahun = document.getElementById('filterTahunPencapaian').value;
    
    try {
        pencapaianList = await AchievementService.getAll(tahun);
        // Render jadual utama
        window.renderPencapaianTable();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 font-bold">Gagal memuatkan data. Sila periksa sambungan.</td></tr>`;
    }
};

// --- 2. RENDERING LOGIC ---

/**
 * Fungsi utama untuk menjana baris jadual berdasarkan filter semasa.
 */
window.renderPencapaianTable = function() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    const katFilter = document.getElementById('filterKategoriPencapaian').value;
    const search = document.getElementById('searchPencapaianInput').value.toUpperCase();

    // Proses Penapisan (Filtering)
    let data = pencapaianList.filter(i => {
        // 1. Tapis Kategori (Murid/Guru/PPD)
        if(katFilter !== 'ALL' && i.kategori !== katFilter) return false;
        
        // 2. Tapis Carian (Sekolah, Nama, Program)
        if(search) {
            let namaSekolah = (i.kod_sekolah === 'M030') ? 'PPD ALOR GAJAH' : 
                (window.globalDashboardData?.find(s => s.kod_sekolah === i.kod_sekolah)?.nama_sekolah || '');
            const searchTarget = `${i.kod_sekolah} ${namaSekolah} ${i.nama_peserta} ${i.nama_pertandingan}`.toUpperCase();
            if (!searchTarget.includes(search)) return false;
        }
        
        // 3. Tapis Jawatan (Word Cloud)
        if(currentJawatanFilter !== 'ALL' && i.jawatan !== currentJawatanFilter) return false;

        // 4. Tapis Kad Statistik (Logic dari smpid)
        if(currentCardFilter === 'KEBANGSAAN' && i.peringkat !== 'KEBANGSAAN') return false;
        if(currentCardFilter === 'ANTARABANGSA' && !['ANTARABANGSA'].includes(i.peringkat) && i.jenis_rekod !== 'PENSIJILAN') return false;
        if(['GOOGLE','APPLE','MICROSOFT'].includes(currentCardFilter) && i.penyedia !== currentCardFilter) return false;
        if(currentCardFilter === 'LAIN-LAIN' && (i.jenis_rekod !== 'PENSIJILAN' || i.penyedia !== 'LAIN-LAIN')) return false;
        
        return true;
    });

    // Kemaskini elemen visual yang bergantung kepada data tapis
    updateStatsUI(data); 
    updateWordCloudUI(data);
    renderTopContributorsUI(data);

    // Proses Susunan (Sorting)
    data.sort((a,b) => {
        let valA = a[sortState.column] || '';
        let valB = b[sortState.column] || '';
        if (sortState.direction === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    });

    currentPencapaianFiltered = data;

    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 bg-slate-50 italic">Tiada rekod sepadan ditemui.</td></tr>`;
        return;
    }

    // Penjanaan HTML baris demi baris
    tbody.innerHTML = data.map(i => {
        let namaSekolah = i.kod_sekolah;
        if(i.kod_sekolah === 'M030') namaSekolah = `<span class="text-indigo-600 font-bold">PPD ALOR GAJAH</span>`;
        else if(window.globalDashboardData) {
            const s = window.globalDashboardData.find(x => x.kod_sekolah === i.kod_sekolah);
            if(s) namaSekolah = s.nama_sekolah;
        }

        let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
        if (i.kategori === 'MURID') badgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
        else if (i.kategori === 'GURU') badgeClass = 'bg-amber-100 text-amber-700 border-amber-200';
        else if (i.kategori === 'SEKOLAH') badgeClass = 'bg-green-100 text-green-700 border-green-200';
        else if (i.kategori === 'PEGAWAI') badgeClass = 'bg-slate-800 text-white border-slate-700';
        else if (i.kategori === 'PPD') badgeClass = 'bg-indigo-100 text-indigo-700 border-indigo-200';

        const isSijil = i.jenis_rekod === 'PENSIJILAN';

        return `
        <tr class="hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0">
            <td class="px-6 py-4 font-mono text-xs font-bold text-slate-400 w-24">${i.kod_sekolah}</td>
            <td class="px-6 py-4 text-xs font-semibold text-slate-700 leading-snug w-64">
                <div class="truncate max-w-[200px]" title="${namaSekolah.replace(/<[^>]*>?/gm, '')}">${namaSekolah}</div>
            </td>
            <td class="px-6 py-4 text-center w-24">
                <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${i.kategori}</span>
            </td>
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800 text-sm mb-0.5">${i.nama_peserta}</div>
                ${i.jawatan ? `<span class="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">${i.jawatan}</span>` : ''}
            </td>
            <td class="px-6 py-4">
                <div class="flex items-start gap-1">
                    ${isSijil ? `<span class="text-[9px] font-bold bg-amber-500 text-white px-1 rounded shadow-sm">SIJIL</span>` : ''}
                    <span class="text-xs font-semibold text-slate-600 leading-snug">${i.nama_pertandingan}</span>
                </div>
                <div class="text-[10px] text-slate-400 mt-1 uppercase">${i.peringkat}</div>
            </td>
            <td class="px-6 py-4 text-center font-black text-brand-600 text-xs w-32">${i.pencapaian}</td>
            <td class="px-6 py-4 text-center w-32">
                <div class="flex items-center justify-center gap-1">
                    <a href="${i.pautan_bukti}" target="_blank" class="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition" title="Lihat Bukti"><i class="fas fa-link"></i></a>
                    <button onclick="openEditPencapaian(${i.id})" class="p-2 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition" title="Edit"><i class="fas fa-edit"></i></button>
                    <button onclick="hapusPencapaianAdmin(${i.id})" class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition" title="Padam"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
};

// --- 3. VISUAL ENHANCEMENT LOGIC ---

/**
 * Mengemaskini kaunter pada kad statistik utama.
 */
function updateStatsUI(data) {
    const setTxt = (id, count) => {
        const el = document.getElementById(id);
        if(el) el.innerText = count;
    };
    
    // Kategori
    setTxt('statTotalMurid', data.filter(i => i.kategori === 'MURID').length);
    setTxt('statTotalGuru', data.filter(i => i.kategori === 'GURU').length);
    setTxt('statTotalSekolah', data.filter(i => i.kategori === 'SEKOLAH').length);
    setTxt('statTotalPegawai', data.filter(i => i.kategori === 'PEGAWAI').length);
    setTxt('statTotalUnit', data.filter(i => i.kategori === 'PPD').length);

    // Pencapaian Utama (Logic smpid)
    const keb = document.getElementById('statKebangsaan');
    if(keb) keb.innerText = data.filter(i => i.peringkat === 'KEBANGSAAN').length;

    const ant = document.getElementById('statAntarabangsa');
    if(ant) ant.innerText = data.filter(i => i.peringkat === 'ANTARABANGSA' || i.jenis_rekod === 'PENSIJILAN').length;

    // Tech Brands
    const pensijilan = data.filter(i => i.jenis_rekod === 'PENSIJILAN');
    setTxt('statGoogle', pensijilan.filter(i => i.penyedia === 'GOOGLE').length);
    setTxt('statApple', pensijilan.filter(i => i.penyedia === 'APPLE').length);
    setTxt('statMicrosoft', pensijilan.filter(i => i.penyedia === 'MICROSOFT').length);
    setTxt('statLain', pensijilan.filter(i => i.penyedia === 'LAIN-LAIN').length);
}

/**
 * Menjana Word Cloud jawatan guru secara dinamik.
 */
function updateWordCloudUI(data) {
    const container = document.getElementById('jawatanCloudContainer');
    const wrapper = document.getElementById('jawatanCloudWrapper');
    if (!container) return;

    // Hanya ambil guru yang mempunyai jawatan
    const guruData = data.filter(i => i.kategori === 'GURU' && i.jawatan);
    
    if(guruData.length === 0) {
        if(wrapper) wrapper.classList.add('hidden');
        return;
    }
    
    if(wrapper) wrapper.classList.remove('hidden');
    const counts = {};
    let max = 0;
    
    guruData.forEach(i => {
        const j = i.jawatan.trim();
        counts[j] = (counts[j] || 0) + 1;
        if(counts[j] > max) max = counts[j];
    });
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    container.innerHTML = sorted.map(([j, c]) => {
        const isActive = currentJawatanFilter === j;
        // Penentuan saiz berdasarkan kekerapan (Tailwind style)
        let sizeClass = "text-[10px]";
        if(c > 5) sizeClass = "text-[12px] font-bold";
        if(c > 10) sizeClass = "text-[14px] font-black";

        return `
            <div onclick="filterPencapaianByJawatan('${j}')" 
                 class="inline-flex items-center px-3 py-1 rounded-full border cursor-pointer transition-all m-1 shadow-sm
                        ${isActive ? 'bg-indigo-600 text-white border-indigo-600 scale-105 shadow-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'}">
                <span class="${sizeClass}">${j}</span>
                <span class="ml-2 bg-slate-100 text-slate-500 px-1.5 rounded-full text-[9px] font-bold ${isActive ? 'bg-white/20 text-white' : ''}">${c}</span>
            </div>
        `;
    }).join('');
}

/**
 * Menjana senarai 5 sekolah penyumbang terbanyak (Ranking).
 */
function renderTopContributorsUI(data) {
    const table = document.getElementById('tableTopContributors');
    if(!table) return;

    const schoolCounts = {};
    data.forEach(i => {
        if(i.kod_sekolah !== 'M030') {
            schoolCounts[i.kod_sekolah] = (schoolCounts[i.kod_sekolah] || 0) + 1;
        }
    });
    
    const sorted = Object.entries(schoolCounts).sort(([,a], [,b]) => b - a).slice(0, 5);
    
    if(sorted.length === 0) {
        table.innerHTML = `<tr><td class="p-4 text-center text-slate-400 text-xs italic">Tiada data sekolah penyumbang.</td></tr>`;
        return;
    }
    
    table.innerHTML = sorted.map(([kod, count], idx) => {
        let nama = kod;
        if(window.globalDashboardData) {
            const s = window.globalDashboardData.find(x => x.kod_sekolah === kod);
            if(s) nama = s.nama_sekolah;
        }
        
        let rankColor = "bg-slate-100 text-slate-500";
        if(idx === 0) rankColor = "bg-amber-400 text-white shadow-sm";
        if(idx === 1) rankColor = "bg-slate-300 text-white shadow-sm";
        if(idx === 2) rankColor = "bg-orange-400 text-white shadow-sm";

        return `
        <tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer" onclick="filterBySchool('${kod}')">
            <td class="p-3 w-10">
                <div class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${rankColor}">${idx + 1}</div>
            </td>
            <td class="p-3">
                <div class="text-xs font-bold text-slate-700 truncate max-w-[150px]" title="${nama}">${nama}</div>
                <div class="text-[9px] font-mono text-slate-400">${kod}</div>
            </td>
            <td class="p-3 text-right">
                <span class="text-xs font-black text-indigo-600">${count}</span>
            </td>
        </tr>`;
    }).join('');
}

// --- 4. INTERACTION FUNCTIONS ---

window.filterByKategori = function(k) { 
    const el = document.getElementById('filterKategoriPencapaian');
    if(el) { el.value = k; currentJawatanFilter = 'ALL'; window.renderPencapaianTable(); }
};

window.filterPencapaianByJawatan = function(j) {
    currentJawatanFilter = (currentJawatanFilter === j) ? 'ALL' : j;
    const btn = document.getElementById('btnResetJawatan');
    if(btn) {
        if(currentJawatanFilter !== 'ALL') btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    }
    window.renderPencapaianTable();
};

window.filterByCard = function(c) {
    currentCardFilter = (currentCardFilter === c) ? 'ALL' : c;
    window.renderPencapaianTable();
};

window.filterBySchool = function(kod) {
    document.getElementById('searchPencapaianInput').value = kod;
    window.renderPencapaianTable();
};

window.handleSort = function(col) {
    if(sortState.column === col) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    else { sortState.column = col; sortState.direction = 'asc'; }
    window.renderPencapaianTable();
};

window.handlePencapaianSearch = function() { window.renderPencapaianTable(); };

window.resetPencapaianFilters = function() { 
    document.getElementById('searchPencapaianInput').value = '';
    document.getElementById('filterKategoriPencapaian').value = 'ALL';
    currentCardFilter = 'ALL';
    currentJawatanFilter = 'ALL';
    window.loadMasterPencapaian();
    Swal.fire({ 
        icon: 'success', 
        title: 'Reset Selesai', 
        timer: 1000, 
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
};

// --- 5. CRUD & MODAL OPERATIONS ---

window.openModalPPD = function() {
    document.getElementById('modalRekodPPD').classList.remove('hidden');
};

window.toggleKategoriPPD = function() {
    const isUnit = document.getElementById('radUnit').checked;
    const lbl = document.getElementById('lblPpdNamaPeserta');
    const inp = document.getElementById('ppdInputNama');
    if (isUnit) {
        lbl.innerText = "NAMA UNIT / SEKTOR";
        inp.placeholder = "CONTOH: SEKTOR PEMBELAJARAN";
    } else {
        lbl.innerText = "NAMA PEGAWAI";
        inp.placeholder = "TAIP NAMA PENUH...";
    }
};

window.toggleJenisPencapaianPPD = function() {
    const isPensijilan = document.getElementById('radPpdPensijilan').checked;
    document.getElementById('ppdInputJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';
    
    const divPenyedia = document.getElementById('divPpdPenyedia');
    const colPeringkat = document.getElementById('divPpdColPeringkat');
    
    if (isPensijilan) {
        divPenyedia.classList.remove('hidden');
        colPeringkat.classList.add('hidden');
    } else {
        divPenyedia.classList.add('hidden');
        colPeringkat.classList.remove('hidden');
    }
    
    const lblProg = document.getElementById('lblPpdProgram');
    const inpProg = document.getElementById('ppdInputProgram');
    const lblPenc = document.getElementById('lblPpdPencapaian');
    const inpPenc = document.getElementById('ppdInputPencapaian');
    
    if (isPensijilan) {
        lblProg.innerText = "NAMA SIJIL / PROGRAM";
        inpProg.placeholder = "CONTOH: GOOGLE CERTIFIED EDUCATOR L1";
        lblPenc.innerText = "TAHAP / SKOR / BAND";
        inpPenc.placeholder = "CONTOH: LULUS / BAND C2";
    } else {
        lblProg.innerText = "NAMA PERTANDINGAN";
        inpProg.placeholder = "CONTOH: DIGITAL COMPETENCY 2025";
        lblPenc.innerText = "PENCAPAIAN";
        inpPenc.placeholder = "CONTOH: JOHAN / EMAS";
    }
};

window.simpanPencapaianPPD = async function() {
    const radKategori = document.querySelector('input[name="radKatPPD"]:checked').value;
    const jenisRekod = document.getElementById('ppdInputJenisRekod').value;
    const nama = document.getElementById('ppdInputNama').value.trim().toUpperCase();
    
    let peringkat = 'KEBANGSAAN';
    let penyedia = 'LAIN-LAIN';
    const tahun = parseInt(document.getElementById('ppdInputTahun').value);

    if (jenisRekod === 'PENSIJILAN') {
        penyedia = document.getElementById('ppdInputPenyedia').value;
        peringkat = 'ANTARABANGSA';
    } else {
        peringkat = document.getElementById('ppdInputPeringkat').value;
    }

    const program = document.getElementById('ppdInputProgram').value.trim().toUpperCase();
    const pencapaian = document.getElementById('ppdInputPencapaian').value.trim().toUpperCase();
    const link = document.getElementById('ppdInputLink').value.trim();

    if (!nama || !program || !pencapaian || !link || !tahun) {
        Swal.fire('Tidak Lengkap', 'Sila isi semua maklumat.', 'warning');
        return;
    }

    toggleLoading(true);

    try {
        const payload = {
            kod_sekolah: 'M030',
            kategori: radKategori,
            nama_peserta: nama,
            nama_pertandingan: program,
            peringkat: peringkat,
            tahun: tahun,
            pencapaian: pencapaian,
            pautan_bukti: link,
            jenis_rekod: jenisRekod,
            penyedia: penyedia
        };

        await AchievementService.create(payload);
        
        toggleLoading(false);
        document.getElementById('modalRekodPPD').classList.add('hidden');
        document.getElementById('formPencapaianPPD').reset();
        document.getElementById('ppdInputTahun').value = '2026';
        
        Swal.fire('Berjaya', 'Rekod PPD telah disimpan.', 'success').then(() => window.loadMasterPencapaian());
    } catch(e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal menyimpan rekod.', 'error');
    }
};

window.openEditPencapaian = function(id) {
    const item = pencapaianList.find(i => i.id === id);
    if(!item) return;
    
    document.getElementById('editIdPencapaian').value = id;
    document.getElementById('editNamaSekolah').value = item.kod_sekolah;
    document.getElementById('editInputNama').value = item.nama_peserta;
    document.getElementById('editInputProgram').value = item.nama_pertandingan;
    document.getElementById('editInputPencapaian').value = item.pencapaian;
    document.getElementById('editInputLink').value = item.pautan_bukti;
    document.getElementById('editInputTahun').value = item.tahun;
    
    document.getElementById(item.jenis_rekod === 'PENSIJILAN' ? 'editRadioPensijilan' : 'editRadioPertandingan').checked = true;
    window.toggleEditJenis();

    const divJawatan = document.getElementById('divEditJawatan');
    if(item.kategori === 'GURU') {
        divJawatan.classList.remove('hidden');
        document.getElementById('editInputJawatan').value = item.jawatan || 'GURU AKADEMIK BIASA';
    } else {
        divJawatan.classList.add('hidden');
    }
    
    if (item.jenis_rekod === 'PENSIJILAN') {
        document.getElementById('editInputPenyedia').value = item.penyedia || 'LAIN-LAIN';
    } else {
        document.getElementById('editInputPeringkat').value = item.peringkat;
    }
    
    document.getElementById('modalEditPencapaian').classList.remove('hidden');
};

window.toggleEditJenis = function() {
    const jenis = document.querySelector('input[name="editRadioJenis"]:checked').value;
    const divPenyedia = document.getElementById('divEditPenyedia');
    const colPeringkat = document.getElementById('divEditColPeringkat');
    
    if (jenis === 'PENSIJILAN') {
        divPenyedia.classList.remove('hidden');
        colPeringkat.classList.add('hidden'); 
    } else {
        divPenyedia.classList.add('hidden');
        colPeringkat.classList.remove('hidden'); 
    }
};

window.simpanEditPencapaian = async function() {
    const id = document.getElementById('editIdPencapaian').value;
    const jenis = document.querySelector('input[name="editRadioJenis"]:checked').value;
    
    const payload = {
        nama_peserta: document.getElementById('editInputNama').value.toUpperCase(),
        nama_pertandingan: document.getElementById('editInputProgram').value.toUpperCase(),
        pencapaian: document.getElementById('editInputPencapaian').value.toUpperCase(),
        pautan_bukti: document.getElementById('editInputLink').value,
        tahun: parseInt(document.getElementById('editInputTahun').value),
        jenis_rekod: jenis
    };
    
    if(!document.getElementById('divEditJawatan').classList.contains('hidden')) {
        payload.jawatan = document.getElementById('editInputJawatan').value;
    }

    if (jenis === 'PENSIJILAN') {
        payload.penyedia = document.getElementById('editInputPenyedia').value;
        payload.peringkat = 'ANTARABANGSA'; 
    } else {
        payload.peringkat = document.getElementById('editInputPeringkat').value;
    }

    toggleLoading(true);
    try {
        await AchievementService.update(id, payload);
        toggleLoading(false);
        document.getElementById('modalEditPencapaian').classList.add('hidden');
        Swal.fire({ icon: 'success', title: 'Berjaya', text: 'Data dikemaskini.', timer: 1500, showConfirmButton: false }).then(() => window.loadMasterPencapaian());
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal mengemaskini.', 'error');
    }
};

window.hapusPencapaianAdmin = async function(id) {
    Swal.fire({ 
        title: 'Padam Rekod?', 
        text: "Tindakan ini tidak boleh dikembalikan.", 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#ef4444', 
        confirmButtonText: 'Ya, Padam'
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AchievementService.delete(id);
                toggleLoading(false);
                Swal.fire({ icon: 'success', title: 'Dipadam', timer: 1000, showConfirmButton: false }).then(() => window.loadMasterPencapaian());
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};

// --- 6. STANDARDIZATION LOGIC (LONG REFACTOR) ---

/**
 * Mengumpul statistik kekerapan nama program untuk dibersihkan.
 */
window.refreshStandardizeUI = function() {
    const counts = {};
    standardizationList = [];
    filteredStandardizationList = [];

    pencapaianList.forEach(item => {
        const name = item.nama_pertandingan || "TIADA NAMA";
        counts[name] = (counts[name] || 0) + 1;
    });

    Object.keys(counts).sort().forEach(name => {
        standardizationList.push({ name: name, count: counts[name] });
    });

    filteredStandardizationList = standardizationList;
    
    const searchVal = document.getElementById('standardizeSearch').value;
    if (searchVal) {
        handleStandardizeSearch(searchVal);
    } else {
        renderStandardizeTable(filteredStandardizationList);
    }
}

window.openStandardizeModal = function() {
    document.getElementById('standardizeSearch').value = '';
    window.refreshStandardizeUI();
    document.getElementById('modalStandardize').classList.remove('hidden');
};

window.renderStandardizeTable = function(list) {
    const tbody = document.getElementById('tbodyStandardize');
    if (!tbody) return;
    
    if(list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-slate-400">Tiada padanan carian.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((item, index) => {
        const safeId = index; 
        const safeName = item.name.replace(/'/g, "\\'"); 

        return `
            <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                <td class="text-center font-bold text-xs text-slate-300 p-4">${index + 1}</td>
                <td class="font-bold text-slate-800 text-xs w-1/3 p-4 leading-snug">${item.name}</td>
                <td class="text-center p-4">
                    <span class="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full text-[10px] font-black border border-indigo-100">
                        ${item.count} REKOD
                    </span>
                </td>
                <td class="p-4 w-1/3">
                    <input type="text" id="std-input-${safeId}" 
                           class="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold text-xs uppercase-input focus:border-indigo-500 outline-none bg-white" 
                           placeholder="Nama baharu..." 
                           value="${item.name.replace(/"/g, '&quot;')}"
                           oninput="this.value = this.value.toUpperCase()">
                </td>
                <td class="text-center p-4">
                    <button onclick="executeStandardization('${safeName}', 'std-input-${safeId}')" 
                            class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black shadow-sm transition transform active:scale-95">
                        <i class="fas fa-magic me-1"></i> SET
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

window.handleStandardizeSearch = function(val) {
    const term = val.toUpperCase().trim();
    if (!term) {
        filteredStandardizationList = standardizationList;
    } else {
        filteredStandardizationList = standardizationList.filter(item => item.name.toUpperCase().includes(term));
    }
    renderStandardizeTable(filteredStandardizationList);
};

window.executeStandardization = function(oldName, inputId) {
    const newName = document.getElementById(inputId).value.trim().toUpperCase();
    
    if (!newName) return Swal.fire('Ralat', 'Nama baharu kosong.', 'warning');
    if (newName === oldName) return Swal.fire('Tiada Perubahan', 'Nama sama dengan asal.', 'info');

    Swal.fire({
        title: 'Sahkan Penyeragaman?',
        html: `Menukar <b>"${oldName}"</b> kepada <br><b class="text-emerald-600">"${newName}"</b><br>untuk semua rekod berkaitan.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981', 
        confirmButtonText: 'Ya, Seragamkan!',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            toggleLoading(true);
            try {
                await AchievementService.batchUpdateProgramName(oldName, newName);
                toggleLoading(false);
                
                await Swal.fire({ title: 'Berjaya!', text: 'Data telah diseragamkan.', icon: 'success', timer: 1500, showConfirmButton: false });
                
                // Refresh data utama dan UI modal
                await window.loadMasterPencapaian(); 
                window.refreshStandardizeUI(); 
                
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal mengemaskini data.', 'error');
            }
        }
    });
};

// --- 7. EXPORT LOGIC ---

window.eksportPencapaian = function() {
    if (!currentPencapaianFiltered || currentPencapaianFiltered.length === 0) {
        Swal.fire('Tiada Data', 'Tiada rekod untuk dieksport.', 'info');
        return;
    }

    let csvContent = "BIL,KOD,NAMA SEKOLAH,JENIS REKOD,KATEGORI,PESERTA,JAWATAN,PROGRAM,PERINGKAT,PENCAPAIAN,TAHUN,PAUTAN BUKTI\n";

    currentPencapaianFiltered.forEach((i, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        
        let namaSekolah = i.kod_sekolah;
        if(i.kod_sekolah === 'M030') namaSekolah = "PPD ALOR GAJAH";
        else if(window.globalDashboardData) {
            const s = window.globalDashboardData.find(x => x.kod_sekolah === i.kod_sekolah);
            if(s) namaSekolah = s.nama_sekolah;
        }

        let row = [
            index + 1,
            clean(i.kod_sekolah),
            clean(namaSekolah),
            clean(i.jenis_rekod), 
            clean(i.kategori),
            clean(i.nama_peserta),
            clean(i.jawatan || '-'),
            clean(i.nama_pertandingan),
            clean(i.peringkat || '-'),
            clean(i.pencapaian),
            i.tahun,
            clean(i.pautan_bukti)
        ];
        csvContent += row.join(",") + "\n";
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Laporan_Pencapaian_SMPID_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
};