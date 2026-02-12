/**
 * ADMIN MODULE: ACHIEVEMENT (TAILWIND EDITION)
 * Menguruskan rekod pencapaian dengan kawalan integriti data dan UI Tailwind.
 */

import { AchievementService } from '../services/achievement.service.js';
import { toggleLoading } from '../core/helpers.js';

let pencapaianList = [];
let currentPencapaianFiltered = []; 
let currentCardFilter = 'ALL';
let currentJawatanFilter = 'ALL';
let sortState = { column: 'created_at', direction: 'desc' };

// Cache untuk senarai nama program unik bagi tujuan penyeragaman
let standardizationList = []; 
let filteredStandardizationList = [];

// --- INITIALIZATION ---

window.populateTahunFilter = async function() {
    const select = document.getElementById('filterTahunPencapaian');
    if (!select) return;
    try {
        const years = await AchievementService.getAvailableYears();
        // Standardized Text
        select.innerHTML = '<option value="ALL">SEMUA TAHUN</option>';
        years.forEach(y => select.innerHTML += `<option value="${y}">TAHUN ${y}</option>`);
        window.loadMasterPencapaian();
    } catch (e) { console.error(e); }
};

window.loadMasterPencapaian = async function() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    if(!tbody) return;
    
    if (pencapaianList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 font-medium animate-pulse">Memuatkan data pencapaian...</td></tr>`;
    }
    
    const tahun = document.getElementById('filterTahunPencapaian').value;
    
    try {
        pencapaianList = await AchievementService.getAll(tahun);
        // Nota: populateSekolahFilter tidak kritikal untuk UI Tailwind, kita boleh skip atau implement nanti jika perlu
        window.renderPencapaianTable();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 font-bold">Gagal memuatkan data.</td></tr>`;
    }
};

// --- RENDERING TABLE ---

window.renderPencapaianTable = function() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    const katFilter = document.getElementById('filterKategoriPencapaian').value;
    const search = document.getElementById('searchPencapaianInput').value.toUpperCase();

    let data = pencapaianList.filter(i => {
        if(katFilter !== 'ALL' && i.kategori !== katFilter) return false;
        
        if(search) {
            let namaSekolah = (i.kod_sekolah === 'M030') ? 'PPD ALOR GAJAH' : 
                (window.globalDashboardData?.find(s => s.kod_sekolah === i.kod_sekolah)?.nama_sekolah || '');
            const searchTarget = `${i.kod_sekolah} ${namaSekolah} ${i.nama_peserta} ${i.nama_pertandingan}`.toUpperCase();
            if (!searchTarget.includes(search)) return false;
        }
        
        // Logik filter kad statistik (jika ada implementasi UI kad)
        if(currentCardFilter === 'KEBANGSAAN' && i.peringkat !== 'KEBANGSAAN') return false;
        
        return true;
    });

    updateStats(data); // Fungsi untuk update angka pada kad statistik

    data.sort((a,b) => {
        let valA = a[sortState.column] || '';
        let valB = b[sortState.column] || '';
        if (sortState.direction === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    });

    currentPencapaianFiltered = data;

    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 font-medium bg-slate-50">Tiada rekod sepadan.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(i => {
        let namaSekolah = i.kod_sekolah;
        if(i.kod_sekolah === 'M030') namaSekolah = `<span class="text-indigo-600 font-bold">PPD ALOR GAJAH</span>`;
        else if(window.globalDashboardData) {
            const s = window.globalDashboardData.find(x => x.kod_sekolah === i.kod_sekolah);
            if(s) namaSekolah = s.nama_sekolah;
        }

        // Badge Kategori (Tailwind)
        let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
        if (i.kategori === 'MURID') badgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
        else if (i.kategori === 'GURU') badgeClass = 'bg-amber-100 text-amber-700 border-amber-200';
        else if (i.kategori === 'SEKOLAH') badgeClass = 'bg-green-100 text-green-700 border-green-200';
        else if (i.kategori === 'PEGAWAI') badgeClass = 'bg-slate-800 text-white border-slate-700';
        else if (i.kategori === 'PPD') badgeClass = 'bg-indigo-100 text-indigo-700 border-indigo-200';

        let jenisLabel = i.jenis_rekod === 'PENSIJILAN' ? '<span class="text-[9px] font-bold bg-amber-50 text-amber-600 px-1 rounded border border-amber-100 mr-1">SIJIL</span>' : '';

        return `
        <tr class="hover:bg-slate-50 transition-colors group">
            <td class="px-6 py-4 border-b border-slate-100 font-mono text-xs font-bold text-slate-500 w-24">${i.kod_sekolah}</td>
            <td class="px-6 py-4 border-b border-slate-100 text-xs font-semibold text-slate-700 leading-snug w-64">
                <div class="truncate max-w-[200px]" title="${namaSekolah.replace(/<[^>]*>?/gm, '')}">${namaSekolah}</div>
            </td>
            <td class="px-6 py-4 border-b border-slate-100 text-center w-24">
                <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${i.kategori}</span>
            </td>
            <td class="px-6 py-4 border-b border-slate-100">
                <div class="font-bold text-slate-800 text-sm mb-0.5">${i.nama_peserta}</div>
                ${i.jawatan ? `<span class="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">${i.jawatan}</span>` : ''}
            </td>
            <td class="px-6 py-4 border-b border-slate-100">
                <div class="flex items-start">
                    ${jenisLabel}
                    <span class="text-xs font-semibold text-slate-600 leading-snug">${i.nama_pertandingan}</span>
                </div>
            </td>
            <td class="px-6 py-4 border-b border-slate-100 text-center font-bold text-green-600 text-xs w-32">
                ${i.pencapaian}
            </td>
            <td class="px-6 py-4 border-b border-slate-100 text-center w-32">
                <div class="flex items-center justify-center gap-2">
                    <a href="${i.pautan_bukti}" target="_blank" class="p-1.5 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition" title="Lihat Bukti"><i class="fas fa-link"></i></a>
                    <button onclick="openEditPencapaian(${i.id})" class="p-1.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition" title="Edit"><i class="fas fa-edit"></i></button>
                    <button onclick="hapusPencapaianAdmin(${i.id})" class="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition" title="Padam"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
};

function updateStats(data) {
    const setTxt = (id, count) => {
        const el = document.getElementById(id);
        if(el) el.innerText = count;
    };
    
    setTxt('statTotalMurid', data.filter(i => i.kategori === 'MURID').length);
    setTxt('statTotalGuru', data.filter(i => i.kategori === 'GURU').length);
    setTxt('statTotalSekolah', data.filter(i => i.kategori === 'SEKOLAH').length);
    setTxt('statTotalPegawai', data.filter(i => i.kategori === 'PEGAWAI').length);
    setTxt('statTotalUnit', data.filter(i => i.kategori === 'PPD').length);
}

// --- GLOBAL EXPORTS ---
window.filterByKategori = function(k) { 
    const el = document.getElementById('filterKategoriPencapaian');
    if(el) { el.value = k; window.renderPencapaianTable(); }
};

window.resetPencapaianFilters = function() { 
    document.getElementById('searchPencapaianInput').value = '';
    document.getElementById('filterKategoriPencapaian').value = 'ALL';
    window.loadMasterPencapaian();
    Swal.fire({ 
        icon: 'success', 
        title: 'Reset', 
        text: 'Paparan telah diset semula.',
        timer: 1000, 
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
};

window.handleSort = function(col) {
    if(sortState.column === col) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    else { sortState.column = col; sortState.direction = 'asc'; }
    window.renderPencapaianTable();
};

window.handlePencapaianSearch = function() { window.renderPencapaianTable(); };

// --- MODAL & CRUD LOGIC (TAILWIND MODALS) ---

window.openModalPPD = function() {
    // Anda perlu menambah modal Rekod PPD dalam admin.html jika belum ada
    // Untuk demo ini, kita anggap modal ID 'modalEditPencapaian' boleh diguna semula atau ada modal khusus
    // Gunakan classList.remove('hidden') untuk Tailwind
    Swal.fire('Info', 'Sila pastikan Modal Rekod PPD telah ditambah ke dalam admin.html', 'info');
};

// Fungsi Edit (Tailwind Modal)
window.openEditPencapaian = function(id) {
    const item = pencapaianList.find(i => i.id === id);
    if(!item) return;
    
    // Populate form fields
    document.getElementById('editIdPencapaian').value = id;
    document.getElementById('editNamaSekolah').value = item.kod_sekolah;
    document.getElementById('editInputNama').value = item.nama_peserta;
    document.getElementById('editInputProgram').value = item.nama_pertandingan;
    document.getElementById('editInputPencapaian').value = item.pencapaian;
    document.getElementById('editInputLink').value = item.pautan_bukti;
    document.getElementById('editInputTahun').value = item.tahun;
    
    // Handle Radio
    if (item.jenis_rekod === 'PENSIJILAN') {
        document.getElementById('editRadioPensijilan').checked = true;
    } else {
        document.getElementById('editRadioPertandingan').checked = true;
    }
    window.toggleEditJenis(); // Update UI

    // Handle Jawatan
    const divJawatan = document.getElementById('divEditJawatan');
    if(item.kategori === 'GURU') {
        divJawatan.classList.remove('hidden');
        document.getElementById('editInputJawatan').value = item.jawatan || 'GURU AKADEMIK BIASA';
    } else {
        divJawatan.classList.add('hidden');
    }
    
    // Handle Penyedia/Peringkat
    if (item.jenis_rekod === 'PENSIJILAN') {
        document.getElementById('editInputPenyedia').value = item.penyedia || 'LAIN-LAIN';
    } else {
        document.getElementById('editInputPeringkat').value = item.peringkat;
    }
    
    // Buka Modal (Tailwind)
    document.getElementById('modalEditPencapaian').classList.remove('hidden');
};

window.toggleEditJenis = function() {
    const jenis = document.querySelector('input[name="editRadioJenis"]:checked').value;
    
    const divPenyedia = document.getElementById('divEditPenyedia');
    const colPeringkat = document.getElementById('divEditColPeringkat');
    // Note: ID elemen label mungkin perlu disesuaikan jika admin.html diubah
    
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
    
    // Jawatan Logic
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
        // Tutup Modal
        document.getElementById('modalEditPencapaian').classList.add('hidden');
        Swal.fire({
            icon: 'success',
            title: 'Berjaya',
            text: 'Data dikemaskini.',
            timer: 1500,
            showConfirmButton: false,
            confirmButtonColor: '#22c55e'
        }).then(() => window.loadMasterPencapaian());
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
        confirmButtonColor: '#ef4444', // red-500
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal'
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AchievementService.delete(id);
                toggleLoading(false);
                Swal.fire({
                    icon: 'success',
                    title: 'Dipadam',
                    timer: 1000,
                    showConfirmButton: false
                }).then(() => window.loadMasterPencapaian());
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};

window.eksportPencapaian = function() {
    if (!currentPencapaianFiltered || currentPencapaianFiltered.length === 0) {
        Swal.fire('Tiada Data', '', 'info');
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
            index + 1, clean(i.kod_sekolah), clean(namaSekolah), clean(i.jenis_rekod), 
            clean(i.kategori), clean(i.nama_peserta), clean(i.jawatan || '-'),
            clean(i.nama_pertandingan), clean(i.peringkat || '-'), clean(i.pencapaian),
            i.tahun, clean(i.pautan_bukti)
        ];
        csvContent += row.join(",") + "\n";
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Laporan_Pencapaian_SMPID_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
};