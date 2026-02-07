/**
 * ADMIN MODULE: ACHIEVEMENT
 * Menguruskan rekod pencapaian murid, guru, dan sekolah.
 */

import { AchievementService } from '../services/achievement.service.js';
import { toggleLoading } from '../core/helpers.js';

let pencapaianList = [];
let currentCardFilter = 'ALL';
let currentJawatanFilter = 'ALL';
let sortState = { column: 'created_at', direction: 'desc' };

window.populateTahunFilter = async function() {
    const select = document.getElementById('filterTahunPencapaian');
    if (!select) return;
    try {
        const years = await AchievementService.getAvailableYears();
        select.innerHTML = '<option value="ALL">SEMUA TAHUN</option>';
        years.forEach(y => select.innerHTML += `<option value="${y}">TAHUN ${y}</option>`);
        window.loadMasterPencapaian();
    } catch (e) { console.error(e); }
};

window.loadMasterPencapaian = async function() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5"><div class="spinner-border"></div></td></tr>`;
    
    const tahun = document.getElementById('filterTahunPencapaian').value;
    
    try {
        pencapaianList = await AchievementService.getAll(tahun);
        populateSekolahFilter(pencapaianList);
        window.renderPencapaianTable();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Gagal memuatkan data.</td></tr>`;
    }
};

function populateSekolahFilter(data) {
    const select = document.getElementById('filterSekolahPencapaian');
    const seen = new Set();
    // Simpan nilai lama
    const oldVal = select.value; 
    
    select.innerHTML = '<option value="ALL">SEMUA SEKOLAH</option>';
    data.forEach(i => {
        if(!seen.has(i.kod_sekolah)) {
            let label = i.kod_sekolah;
            if(window.globalDashboardData) {
                const s = window.globalDashboardData.find(x => x.kod_sekolah === i.kod_sekolah);
                if(s) label = `${s.nama_sekolah} (${i.kod_sekolah})`;
            }
            select.innerHTML += `<option value="${i.kod_sekolah}">${label}</option>`;
            seen.add(i.kod_sekolah);
        }
    });
    // Pulihkan nilai jika masih valid
    if(seen.has(oldVal)) select.value = oldVal;
}

window.renderPencapaianTable = function() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    const katFilter = document.getElementById('filterKategoriPencapaian').value;
    const sekFilter = document.getElementById('filterSekolahPencapaian').value;
    const search = document.getElementById('searchPencapaianInput').value.toUpperCase();

    let data = pencapaianList.filter(i => {
        if(sekFilter !== 'ALL' && i.kod_sekolah !== sekFilter) return false;
        if(katFilter !== 'ALL' && i.kategori !== katFilter) return false;
        if(search && !JSON.stringify(i).toUpperCase().includes(search)) return false;
        
        // Filter Card
        if(currentCardFilter === 'KEBANGSAAN' && i.peringkat !== 'KEBANGSAAN') return false;
        if(currentCardFilter === 'ANTARABANGSA' && !['ANTARABANGSA'].includes(i.peringkat) && i.jenis_rekod !== 'PENSIJILAN') return false;
        if(['GOOGLE','APPLE','MICROSOFT'].includes(currentCardFilter) && i.penyedia !== currentCardFilter) return false;
        
        // Filter Jawatan
        if(currentJawatanFilter !== 'ALL' && i.jawatan !== currentJawatanFilter) return false;

        return true;
    });

    updateStats(data);
    updateCloud(data); // Jawatan Cloud

    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">Tiada rekod.</td></tr>`;
        return;
    }

    // Sort Logic
    data.sort((a,b) => {
        let valA = a[sortState.column] || '';
        let valB = b[sortState.column] || '';
        if (sortState.direction === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    });

    tbody.innerHTML = data.map(i => {
        let namaSekolah = i.kod_sekolah;
        if(i.kod_sekolah === 'M030') namaSekolah = `<span class="text-indigo fw-bold">PPD ALOR GAJAH</span>`;
        else if(window.globalDashboardData) {
            const s = window.globalDashboardData.find(x => x.kod_sekolah === i.kod_sekolah);
            if(s) namaSekolah = s.nama_sekolah;
        }

        return `<tr>
            <td class="fw-bold small">${i.kod_sekolah}</td>
            <td class="small text-truncate" style="max-width: 200px;" title="${namaSekolah}">${namaSekolah}</td>
            <td class="text-center"><span class="badge bg-secondary">${i.kategori}</span></td>
            <td><div class="fw-bold text-dark small">${i.nama_peserta}</div>${i.jawatan ? `<small class="text-muted">${i.jawatan}</small>` : ''}</td>
            <td><div class="text-primary small fw-bold">${i.nama_pertandingan}</div></td>
            <td class="text-center fw-bold small">${i.pencapaian}</td>
            <td class="text-center"><a href="${i.pautan_bukti}" target="_blank" class="btn btn-sm btn-light border"><i class="fas fa-link"></i></a></td>
            <td class="text-center">
                <button onclick="openEditPencapaian(${i.id})" class="btn btn-sm btn-outline-warning me-1"><i class="fas fa-edit"></i></button>
                <button onclick="hapusPencapaianAdmin(${i.id})" class="btn btn-sm btn-outline-danger"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
};

function updateStats(data) {
    const ids = ['statTotalMurid', 'statTotalGuru', 'statTotalSekolah', 'statTotalPegawai', 'statTotalUnit'];
    const cats = ['MURID', 'GURU', 'SEKOLAH', 'PEGAWAI', 'PPD'];
    
    ids.forEach((id, idx) => {
        document.getElementById(id).innerText = data.filter(i => i.kategori === cats[idx]).length;
    });
    
    // KPI Cards
    document.getElementById('statKebangsaan').innerText = data.filter(i => i.peringkat === 'KEBANGSAAN').length;
    document.getElementById('statAntarabangsa').innerText = data.filter(i => i.peringkat === 'ANTARABANGSA' || i.jenis_rekod === 'PENSIJILAN').length;
}

function updateCloud(data) {
    const container = document.getElementById('jawatanCloudContainer');
    const guruData = data.filter(i => i.kategori === 'GURU' && i.jawatan);
    if(guruData.length === 0) {
        document.getElementById('jawatanCloudWrapper').classList.add('hidden');
        return;
    }
    
    document.getElementById('jawatanCloudWrapper').classList.remove('hidden');
    const counts = {};
    guruData.forEach(i => counts[i.jawatan] = (counts[i.jawatan] || 0) + 1);
    
    container.innerHTML = Object.entries(counts).map(([j, c]) => `
        <div class="cloud-tag ${currentJawatanFilter===j ? 'active' : ''}" onclick="filterByJawatan('${j}')">
            ${j} <span class="count-badge">${c}</span>
        </div>
    `).join('');
}

// --- GLOBAL EXPORTS ---
window.filterByKategori = function(k) { document.getElementById('filterKategoriPencapaian').value = k; currentJawatanFilter = 'ALL'; window.renderPencapaianTable(); };
window.filterByCard = function(c) { currentCardFilter = (currentCardFilter === c) ? 'ALL' : c; window.renderPencapaianTable(); };
window.filterByJawatan = function(j) { currentJawatanFilter = (currentJawatanFilter === j) ? 'ALL' : j; window.renderPencapaianTable(); };
window.resetPencapaianFilters = function() { 
    currentCardFilter='ALL'; currentJawatanFilter='ALL'; 
    document.getElementById('searchPencapaianInput').value = '';
    document.getElementById('filterKategoriPencapaian').value = 'ALL';
    document.getElementById('filterSekolahPencapaian').value = 'ALL';
    window.renderPencapaianTable(); 
};
window.handleSort = function(col) {
    if(sortState.column === col) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    else { sortState.column = col; sortState.direction = 'asc'; }
    window.renderPencapaianTable();
};
window.handlePencapaianSearch = function() { window.renderPencapaianTable(); };

// CRUD
window.openEditPencapaian = function(id) {
    const item = pencapaianList.find(i => i.id === id);
    if(!item) return;
    
    document.getElementById('editIdPencapaian').value = id;
    document.getElementById('editJenisRekod').value = item.jenis_rekod;
    document.getElementById('editNamaSekolah').value = item.kod_sekolah;
    document.getElementById('editInputNama').value = item.nama_peserta;
    document.getElementById('editInputProgram').value = item.nama_pertandingan;
    document.getElementById('editInputPencapaian').value = item.pencapaian;
    document.getElementById('editInputLink').value = item.pautan_bukti;
    
    const divJawatan = document.getElementById('divEditJawatan');
    if(item.kategori === 'GURU') {
        divJawatan.classList.remove('hidden');
        document.getElementById('editInputJawatan').value = item.jawatan || 'GURU AKADEMIK BIASA';
    } else {
        divJawatan.classList.add('hidden');
    }
    
    new bootstrap.Modal(document.getElementById('modalEditPencapaian')).show();
};

window.simpanEditPencapaian = async function() {
    const id = document.getElementById('editIdPencapaian').value;
    const payload = {
        nama_peserta: document.getElementById('editInputNama').value.toUpperCase(),
        nama_pertandingan: document.getElementById('editInputProgram').value.toUpperCase(),
        pencapaian: document.getElementById('editInputPencapaian').value.toUpperCase(),
        pautan_bukti: document.getElementById('editInputLink').value
    };
    
    if(!document.getElementById('divEditJawatan').classList.contains('hidden')) {
        payload.jawatan = document.getElementById('editInputJawatan').value;
    }

    toggleLoading(true);
    try {
        await AchievementService.update(id, payload);
        toggleLoading(false);
        bootstrap.Modal.getInstance(document.getElementById('modalEditPencapaian')).hide();
        Swal.fire('Berjaya', 'Data dikemaskini.', 'success').then(() => window.loadMasterPencapaian());
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal mengemaskini.', 'error');
    }
};

window.hapusPencapaianAdmin = async function(id) {
    Swal.fire({ title: 'Padam?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AchievementService.delete(id);
                toggleLoading(false);
                Swal.fire('Dipadam', '', 'success').then(() => window.loadMasterPencapaian());
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};

// PPD (M030) Functions
window.openModalPPD = function() { new bootstrap.Modal(document.getElementById('modalRekodPPD')).show(); };
window.toggleKategoriPPD = function() {
    const isUnit = document.getElementById('radUnit').checked;
    document.getElementById('lblPpdNamaPeserta').innerText = isUnit ? "NAMA UNIT / SEKTOR" : "NAMA PEGAWAI";
};
window.toggleJenisPencapaianPPD = function() {
    const isSijil = document.getElementById('radPpdPensijilan').checked;
    document.getElementById('ppdInputJenisRekod').value = isSijil ? 'PENSIJILAN' : 'PERTANDINGAN';
    document.getElementById('divPpdPenyedia').classList.toggle('hidden', !isSijil);
    document.getElementById('rowPpdPeringkat').classList.toggle('hidden', isSijil);
};
window.simpanPencapaianPPD = async function() {
    // Logic simpan sama macam public.js hantarBorangPPD, guna AchievementService.create()
    // ... Ringkas untuk jimat ruang ...
    const payload = {
        kod_sekolah: 'M030',
        kategori: document.querySelector('input[name="radKatPPD"]:checked').value,
        nama_peserta: document.getElementById('ppdInputNama').value.toUpperCase(),
        nama_pertandingan: document.getElementById('ppdInputProgram').value.toUpperCase(),
        pencapaian: document.getElementById('ppdInputPencapaian').value.toUpperCase(),
        pautan_bukti: document.getElementById('ppdInputLink').value,
        jenis_rekod: document.getElementById('ppdInputJenisRekod').value,
        tahun: parseInt(document.getElementById('ppdInputTahun').value || '2024'),
        peringkat: 'KEBANGSAAN',
        penyedia: 'LAIN-LAIN'
    };
    
    if(payload.jenis_rekod === 'PENSIJILAN') {
        payload.peringkat = 'ANTARABANGSA';
        payload.penyedia = document.getElementById('ppdInputPenyedia').value;
    } else {
        payload.peringkat = document.getElementById('ppdInputPeringkat').value;
    }

    toggleLoading(true);
    try {
        await AchievementService.create(payload);
        toggleLoading(false);
        bootstrap.Modal.getInstance(document.getElementById('modalRekodPPD')).hide();
        Swal.fire('Berjaya', 'Rekod PPD Disimpan.', 'success').then(() => window.loadMasterPencapaian());
    } catch(e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal simpan.', 'error');
    }
};