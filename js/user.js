/**
 * SMPID USER PORTAL CONTROLLER (TAILWIND EDITION)
 * Logik utama untuk papan pemuka sekolah (User Dashboard).
 */

import { toggleLoading, checkEmailDomain, autoFormatPhone, keluarSistem, formatSentenceCase } from './core/helpers.js';
import { SchoolService } from './services/school.service.js';
import { AuthService } from './services/auth.service.js';
import { DcsService } from './services/dcs.service.js';
import { SupportService } from './services/support.service.js';
import { AchievementService } from './services/achievement.service.js';
import { APP_CONFIG } from './config/app.config.js';

let analisaChart = null;
let userPencapaianList = []; 

document.addEventListener('DOMContentLoaded', () => {
    initUserPortal();
});

function initUserPortal() {
    const kod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const isAdmin = sessionStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === 'true';

    if (!kod && !isAdmin) { 
        window.location.replace('index.html'); 
        return; 
    }
    
    const displayKod = document.getElementById('displayKodSekolah');
    const btnLogout = document.getElementById('btnLogoutMenu');

    if (isAdmin) {
        displayKod.innerHTML = `<i class="fas fa-user-shield"></i> ADMIN VIEW: ${kod}`;
        displayKod.className = "inline-flex items-center gap-2 bg-indigo-600/20 border border-indigo-400 text-white text-xs font-bold px-4 py-1.5 rounded-full backdrop-blur-sm";
        
        if(btnLogout) {
            btnLogout.innerHTML = `<i class="fas fa-arrow-left"></i> Kembali ke Dashboard Admin`;
            btnLogout.setAttribute('onclick', "window.location.href='admin.html'");
            btnLogout.className = "w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm";
        }
        
        const btnReset = document.getElementById('btnResetData');
        if (btnReset) btnReset.classList.remove('hidden');

    } else {
        displayKod.innerHTML = `<i class="fas fa-school"></i> ${kod}`;
    }
    
    loadProfil(kod);
}

// --- NAVIGATION LOGIC ---
window.showSection = function(section) {
    // Sembunyikan semua seksyen
    const sections = ['menu', 'profil', 'aduan', 'analisa', 'pencapaian'];
    sections.forEach(s => {
        const el = document.getElementById(`section-${s}`);
        if(el) el.classList.add('hidden');
    });

    // Paparkan seksyen yang dipilih dengan animasi
    const targetEl = document.getElementById(`section-${section}`);
    if(targetEl) {
        targetEl.classList.remove('hidden');
        targetEl.classList.add('animate-fade-up'); // Pastikan CSS animasi wujud dalam HTML
    }

    // Logic khusus setiap seksyen
    if (section === 'aduan') window.loadTiketUser();
    if (section === 'analisa') loadAnalisaSekolah();
    if (section === 'pencapaian') window.loadPencapaianSekolah();
    
    // Scroll ke atas
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

async function loadProfil(kod) {
    try {
        const data = await SchoolService.getByCode(kod);
        document.getElementById('dispNamaSekolah').innerText = data.nama_sekolah;
        document.getElementById('dispKodDaerah').innerText = `KOD: ${data.kod_sekolah} | DAERAH: ${data.daerah || '-'}`;
        document.getElementById('hiddenKodSekolah').value = data.kod_sekolah;
        
        const fields = {
            'gpictNama': data.nama_gpict, 'gpictTel': data.no_telefon_gpict, 'gpictEmel': data.emel_delima_gpict,
            'adminNama': data.nama_admin_delima, 'adminTel': data.no_telefon_admin_delima, 'adminEmel': data.emel_delima_admin_delima
        };
        for (let id in fields) { 
            if(document.getElementById(id)) document.getElementById(id).value = fields[id] || ""; 
        }
    } catch (err) { console.error(err); }
}

window.simpanProfil = async function() {
    const kod = document.getElementById('hiddenKodSekolah').value;
    const emelG = document.getElementById('gpictEmel').value;
    const btnSubmit = document.querySelector('#dataForm button[type="submit"]');
    
    if (!checkEmailDomain(emelG)) return Swal.fire('Format Salah', 'Sila gunakan emel domain moe-dl.edu.my', 'warning');

    if(btnSubmit) { btnSubmit.disabled = true; btnSubmit.classList.add('opacity-75'); }
    toggleLoading(true);

    const payload = {
        nama_gpict: document.getElementById('gpictNama').value.toUpperCase(),
        no_telefon_gpict: document.getElementById('gpictTel').value,
        emel_delima_gpict: emelG,
        nama_admin_delima: document.getElementById('adminNama').value.toUpperCase(),
        no_telefon_admin_delima: document.getElementById('adminTel').value,
        emel_delima_admin_delima: document.getElementById('adminEmel').value
    };

    try {
        await SchoolService.updateProfile(kod, payload);
        toggleLoading(false);
        if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.classList.remove('opacity-75'); }
        Swal.fire({
            icon: 'success', 
            title: 'Disimpan', 
            text: 'Maklumat sekolah berjaya dikemaskini.',
            confirmButtonColor: '#22c55e'
        }).then(() => window.showSection('menu'));
    } catch (err) {
        toggleLoading(false); 
        if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.classList.remove('opacity-75'); }
        Swal.fire('Ralat', 'Gagal menyimpan data.', 'error');
    }
};

window.salinData = function() {
    if (document.getElementById('checkSama').checked) {
        ['Nama','Tel','Emel'].forEach(suffix => {
            document.getElementById('admin'+suffix).value = document.getElementById('gpict'+suffix).value;
        });
    }
};

// --- ANALISA LOGIC ---
async function loadAnalisaSekolah() {
    const kod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const tableBody = document.getElementById('tableAnalisaBody');

    try {
        const data = await DcsService.getBySchool(kod);

        if (!data) {
            if(tableBody) tableBody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-red-400 font-bold">Data analisa belum tersedia.</td></tr>`;
            return;
        }

        let dcsLatest = (data.dcs_2025 !== null) ? data.dcs_2025 : data.dcs_2024;
        let aktifLatest = (data.peratus_aktif_2025 !== null) ? data.peratus_aktif_2025 : data.peratus_aktif_2024;
        
        document.getElementById('valDcs').innerText = dcsLatest ? dcsLatest.toFixed(2) : "0.00";
        document.getElementById('valAktif').innerText = aktifLatest ? aktifLatest : "0";

        renderAnalisaTable(data);
        renderDcsChart(data);
    } catch (err) { console.error(err); }
}

function renderAnalisaTable(data) {
    const tableBody = document.getElementById('tableAnalisaBody');
    if(!tableBody) return;
    const years = [2023, 2024, 2025];
    let rows = '';
    years.forEach(year => {
        const dcs = data[`dcs_${year}`];
        const aktif = data[`peratus_aktif_${year}`];
        if (dcs !== null || aktif !== null) {
            rows += `
            <tr class="hover:bg-slate-50 transition">
                <td class="px-6 py-4 font-bold text-slate-500">${year}</td>
                <td class="px-6 py-4 font-bold text-blue-600">${dcs !== null ? dcs.toFixed(2) : '-'}</td>
                <td class="px-6 py-4 font-bold text-green-600">${aktif !== null ? aktif + '%' : '-'}</td>
            </tr>`;
        }
    });
    tableBody.innerHTML = rows || `<tr><td colspan="3" class="p-6 text-center text-slate-400 italic">Tiada data sejarah.</td></tr>`;
}

function renderDcsChart(data) {
    const ctx = document.getElementById('chartAnalisa');
    if (!ctx) return;
    if (analisaChart) analisaChart.destroy();
    
    const labels = ['2023', '2024', '2025'];
    const dataDcs = [data.dcs_2023, data.dcs_2024, data.dcs_2025];
    const dataAktif = [data.peratus_aktif_2023, data.peratus_aktif_2024, data.peratus_aktif_2025];

    analisaChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Skor DCS (0-5)', data: dataDcs, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', yAxisID: 'y', tension: 0.3, fill: true },
                { label: '% Aktif DELIMa', data: dataAktif, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', yAxisID: 'y1', tension: 0.3, borderDash: [5, 5] }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { min: 0, max: 5, position: 'left' }, y1: { min: 0, max: 100, position: 'right', grid: { drawOnChartArea: false } } }
        }
    });
}

// --- PENCAPAIAN LOGIC (TAILWIND UI) ---
window.setPencapaianType = function(type) {
    document.getElementById('pencapaianKategori').value = type;
    
    // Update Tab Styles
    const tabs = ['murid', 'guru', 'sekolah'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-p-${t}`);
        if(t.toUpperCase() === type) {
            btn.className = "flex-1 py-2 rounded-lg text-xs font-bold bg-teal-600 text-white shadow-sm transition";
        } else {
            btn.className = "flex-1 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition";
        }
    });

    // Toggle Input Fields
    const wrapperJenis = document.getElementById('wrapperJenisRekod');
    const divJawatan = document.getElementById('divInputJawatan');
    const inpName = document.getElementById('pInputNama');
    const lblName = document.getElementById('labelNamaPeserta');

    if (type === 'GURU') {
        wrapperJenis.classList.remove('hidden');
        divJawatan.classList.remove('hidden');
        inpName.value = "";
        inpName.readOnly = false;
        lblName.innerText = "NAMA GURU";
    } else {
        wrapperJenis.classList.add('hidden');
        divJawatan.classList.add('hidden');
        document.getElementById('radioPertandingan').checked = true;
        
        if (type === 'SEKOLAH') {
            inpName.value = document.getElementById('dispNamaSekolah').innerText;
            inpName.readOnly = true;
            lblName.innerText = "NAMA SEKOLAH";
        } else {
            inpName.value = "";
            inpName.readOnly = false;
            lblName.innerText = "NAMA MURID / KUMPULAN";
        }
    }
    window.toggleJenisPencapaian();
};

window.toggleJenisPencapaian = function() {
    const isPensijilan = document.getElementById('radioPensijilan').checked;
    document.getElementById('pInputJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';
    
    const divPenyedia = document.getElementById('divInputPenyedia');
    const colPeringkat = document.getElementById('divColPeringkat');
    
    if (isPensijilan) {
        divPenyedia.classList.remove('hidden');
        colPeringkat.classList.add('hidden');
    } else {
        divPenyedia.classList.add('hidden');
        colPeringkat.classList.remove('hidden');
    }
};

window.loadPencapaianSekolah = async function() {
    const kod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const tbody = document.getElementById('tbodyRekodPencapaian');
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-400 font-medium animate-pulse">Memuatkan...</td></tr>`;

    try {
        const data = await AchievementService.getBySchool(kod);
        userPencapaianList = data; 

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-400 italic bg-slate-50">Tiada rekod dijumpai.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(item => {
            let badgeClass = 'bg-slate-100 text-slate-600';
            if (item.kategori === 'MURID') badgeClass = 'bg-blue-100 text-blue-700';
            else if (item.kategori === 'GURU') badgeClass = 'bg-amber-100 text-amber-700';
            else if (item.kategori === 'SEKOLAH') badgeClass = 'bg-green-100 text-green-700';

            let programLabel = item.nama_pertandingan;
            if (item.jenis_rekod === 'PENSIJILAN') programLabel = `<span class="bg-amber-50 text-amber-600 text-[10px] px-1 rounded border border-amber-200 mr-1">SIJIL</span> ${item.nama_pertandingan}`;

            return `
            <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                <td class="px-6 py-4 text-center">
                    <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeClass}">${item.kategori}</span>
                    <div class="text-[10px] text-slate-400 mt-1 font-mono">${item.tahun}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="font-bold text-slate-800 text-sm leading-snug mb-1">${item.nama_peserta}</div>
                    <div class="text-xs text-teal-600 font-semibold mb-1">${programLabel}</div>
                    <div class="flex flex-wrap gap-2">
                        <span class="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded border border-slate-200">${item.peringkat}</span>
                        <span class="bg-green-50 text-green-600 text-[10px] px-2 py-0.5 rounded border border-green-100 font-bold">${item.pencapaian}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="openEditPencapaianUser('${item.id}')" class="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition"><i class="fas fa-edit"></i></button>
                        <button onclick="padamPencapaian('${item.id}')" class="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (err) { tbody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-red-500 font-bold">Ralat memuatkan data.</td></tr>`; }
};

window.simpanPencapaian = async function() {
    const kod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD); 
    const btn = document.querySelector('#formPencapaian button[type="submit"]');
    const kategori = document.getElementById('pencapaianKategori').value;
    const jenisRekod = document.getElementById('pInputJenisRekod').value;
    
    // Validasi Jawatan
    let jawatan = null;
    if (kategori === 'GURU') {
        jawatan = document.getElementById('pInputJawatan').value;
        if (!jawatan) return Swal.fire('Ralat', 'Sila pilih jawatan guru.', 'warning');
    }

    let peringkat = document.getElementById('pInputPeringkat').value;
    let penyedia = document.getElementById('pInputPenyedia').value;
    if (jenisRekod === 'PENSIJILAN') peringkat = 'ANTARABANGSA';

    if(btn) { btn.disabled = true; btn.classList.add('opacity-75'); }
    toggleLoading(true);

    try {
        const payload = {
            kod_sekolah: kod,
            kategori, 
            nama_peserta: document.getElementById('pInputNama').value.trim().toUpperCase(), 
            nama_pertandingan: document.getElementById('pInputProgram').value.trim().toUpperCase(),
            peringkat,
            tahun: parseInt(document.getElementById('pInputTahun').value),
            pencapaian: document.getElementById('pInputPencapaian').value.trim().toUpperCase(),
            pautan_bukti: document.getElementById('pInputLink').value.trim(),
            jenis_rekod: jenisRekod,
            penyedia,
            jawatan
        };

        await AchievementService.create(payload);
        toggleLoading(false);
        if(btn) { btn.disabled = false; btn.classList.remove('opacity-75'); }
        Swal.fire('Berjaya', 'Rekod disimpan.', 'success').then(() => {
            document.getElementById('formPencapaian').reset();
            document.getElementById('pInputTahun').value = '2026';
            window.loadPencapaianSekolah();
        });
    } catch (err) {
        toggleLoading(false); if(btn) { btn.disabled = false; btn.classList.remove('opacity-75'); }
        Swal.fire('Ralat', 'Gagal menyimpan rekod.', 'error');
    }
};

// --- HELPDESK & OTHER UTILS ---
window.hantarTiket = async function() {
    const kod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const peranan = document.getElementById('tiketPeranan').value;
    const tajuk = document.getElementById('tiketTajuk').value.toUpperCase();
    const mesej = document.getElementById('tiketMesej').value;

    if (!peranan) return Swal.fire('Ralat', 'Sila pilih peranan.', 'warning');

    toggleLoading(true);
    try {
        await SupportService.createTicket({ kod_sekolah: kod, peranan_pengirim: peranan, tajuk: tajuk, butiran_masalah: mesej });
        toggleLoading(false);
        Swal.fire('Berjaya', 'Tiket dihantar. Kami akan semak segera.', 'success').then(() => {
            document.getElementById('formTiket').reset();
            window.switchAduanTab('semak');
            window.loadTiketUser();
        });
    } catch (e) { toggleLoading(false); Swal.fire('Ralat', 'Gagal menghantar tiket.', 'error'); }
};

window.loadTiketUser = async function() {
    const kod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const container = document.getElementById('senaraiTiketContainer');
    try {
        const data = await SupportService.getBySchool(kod);
        container.innerHTML = "";
        if(data.length === 0) { container.innerHTML = `<div class="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">Tiada tiket aduan direkodkan.</div>`; return; }
        
        data.forEach(t => {
            const statusBadge = t.status === 'SELESAI' 
                ? `<span class="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-bold">SELESAI</span>` 
                : `<span class="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded font-bold animate-pulse">DALAM PROSES</span>`;
            
            const balasan = t.balasan_admin 
                ? `<div class="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 bg-green-50 p-2 rounded border border-green-100"><strong class="text-green-700"><i class="fas fa-check-circle mr-1"></i> Respon Admin:</strong> ${t.balasan_admin}</div>` 
                : '';
            
            container.innerHTML += `
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
                <div class="flex justify-between items-start mb-2">
                    <div class="text-[10px] text-slate-400 font-bold">${new Date(t.created_at).toLocaleDateString()}</div>
                    ${statusBadge}
                </div>
                <h4 class="font-bold text-slate-800 text-sm mb-1">${t.tajuk}</h4>
                <p class="text-xs text-slate-500 leading-relaxed">${t.butiran_masalah}</p>
                ${balasan}
            </div>`;
        });
    } catch (e) { container.innerHTML = `<div class="text-red-500 font-bold text-center py-4">Gagal memuatkan tiket.</div>`; }
};

window.ubahKataLaluan = async function() {
    const userId = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ID);
    if (!userId) return;
    const { value: formValues } = await Swal.fire({
        title: 'Tukar Kata Laluan',
        html: '<input id="swal-input1" type="password" class="swal2-input" placeholder="Kata Laluan Lama"><input id="swal-input2" type="password" class="swal2-input" placeholder="Kata Laluan Baru (Min 6)">',
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'Simpan', confirmButtonColor: '#16a34a',
        preConfirm: () => [document.getElementById('swal-input1').value, document.getElementById('swal-input2').value]
    });
    if (formValues) {
        const [oldPass, newPass] = formValues;
        if (!oldPass || !newPass || newPass.length < 6) return Swal.fire('Ralat', 'Kata laluan minimum 6 aksara.', 'warning');
        toggleLoading(true);
        try {
            await AuthService.changePassword(userId, oldPass, newPass);
            toggleLoading(false);
            Swal.fire('Berjaya', 'Kata laluan ditukar. Sila log masuk semula.', 'success').then(() => keluarSistem());
        } catch (err) { toggleLoading(false); Swal.fire('Gagal', err.message, 'error'); }
    }
};

window.resetDataSekolah = async function() {
    const kod = document.getElementById('hiddenKodSekolah').value;
    const { value: password } = await Swal.fire({
        title: 'Akses Admin Diperlukan',
        text: 'Masukkan kata laluan khas:',
        input: 'password',
        showCancelButton: true,
        confirmButtonText: 'Reset',
        confirmButtonColor: '#ef4444'
    });

    if (password === 'pkgag') { 
         Swal.fire({
            title: 'Pasti Reset Data?',
            text: "Semua data GPICT/Admin akan dipadam. Kod sekolah kekal.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Reset!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                toggleLoading(true);
                try {
                    await SchoolService.resetData(kod);
                    toggleLoading(false);
                    Swal.fire('Berjaya', 'Data sekolah telah di-reset.', 'success').then(() => loadProfil(kod));
                } catch (err) {
                    toggleLoading(false); Swal.fire('Ralat', 'Gagal reset data.', 'error');
                }
            }
        });
    } else if (password) {
        Swal.fire('Akses Ditolak', 'Kata laluan salah.', 'error');
    }
};

// --- MODAL UTILS (EDIT) ---
window.openEditPencapaianUser = function(id) {
    const item = userPencapaianList.find(i => String(i.id) === String(id));
    if (!item) return;

    document.getElementById('editUserId').value = item.id;
    if (item.jenis_rekod === 'PENSIJILAN') document.getElementById('editRadioPensijilanUser').checked = true;
    else document.getElementById('editRadioPertandinganUser').checked = true;

    document.getElementById('editUserNama').value = item.nama_peserta;
    document.getElementById('editUserProgram').value = item.nama_pertandingan;
    document.getElementById('editUserPencapaian').value = item.pencapaian;
    document.getElementById('editUserLink').value = item.pautan_bukti;
    document.getElementById('editUserTahun').value = item.tahun;

    window.toggleEditUserJenis(); // Update UI logic

    const divJawatan = document.getElementById('editUserDivJawatan');
    if (item.kategori === 'GURU') {
        divJawatan.classList.remove('hidden');
        document.getElementById('editUserJawatan').value = item.jawatan || 'GURU AKADEMIK BIASA';
    } else {
        divJawatan.classList.add('hidden');
    }

    if (item.jenis_rekod === 'PENSIJILAN') document.getElementById('editUserPenyedia').value = item.penyedia || 'LAIN-LAIN';
    else document.getElementById('editUserPeringkat').value = item.peringkat || 'KEBANGSAAN';

    document.getElementById('modalEditPencapaianUser').classList.remove('hidden');
};

window.toggleEditUserJenis = function() {
    const jenis = document.querySelector('input[name="editRadioJenisUser"]:checked').value;
    const divPenyedia = document.getElementById('editUserDivPenyedia');
    const colPeringkat = document.getElementById('editUserColPeringkat');

    if (jenis === 'PENSIJILAN') {
        divPenyedia.classList.remove('hidden');
        colPeringkat.classList.add('hidden'); 
    } else {
        divPenyedia.classList.add('hidden');
        colPeringkat.classList.remove('hidden'); 
    }
};

window.updatePencapaianUser = async function() {
    const id = document.getElementById('editUserId').value;
    const btn = document.querySelector('#formEditPencapaianUser button[type="submit"]');
    const jenis = document.querySelector('input[name="editRadioJenisUser"]:checked').value;

    if(btn) { btn.disabled = true; btn.classList.add('opacity-75'); }
    toggleLoading(true);

    try {
        const payload = {
            nama_peserta: document.getElementById('editUserNama').value.toUpperCase(),
            nama_pertandingan: document.getElementById('editUserProgram').value.toUpperCase(),
            pencapaian: document.getElementById('editUserPencapaian').value.toUpperCase(),
            pautan_bukti: document.getElementById('editUserLink').value,
            tahun: parseInt(document.getElementById('editUserTahun').value),
            jenis_rekod: jenis
        };

        if (!document.getElementById('editUserDivJawatan').classList.contains('hidden')) {
            payload.jawatan = document.getElementById('editUserJawatan').value;
        }

        if (jenis === 'PENSIJILAN') {
            payload.penyedia = document.getElementById('editUserPenyedia').value;
            payload.peringkat = 'ANTARABANGSA'; 
        } else {
            payload.peringkat = document.getElementById('editUserPeringkat').value;
        }

        await AchievementService.update(id, payload);
        toggleLoading(false);
        if(btn) { btn.disabled = false; btn.classList.remove('opacity-75'); }
        
        document.getElementById('modalEditPencapaianUser').classList.add('hidden');
        Swal.fire('Berjaya', 'Rekod dikemaskini.', 'success').then(() => window.loadPencapaianSekolah());
    } catch (e) {
        toggleLoading(false); if(btn) { btn.disabled = false; btn.classList.remove('opacity-75'); }
        Swal.fire('Ralat', 'Gagal mengemaskini.', 'error');
    }
};

window.padamPencapaian = async function(id) {
    Swal.fire({ title: 'Padam Rekod?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' }).then(async (result) => {
        if (result.isConfirmed) {
            toggleLoading(true);
            try {
                await AchievementService.delete(id);
                toggleLoading(false);
                Swal.fire('Dipadam', 'Rekod dipadam.', 'success').then(() => window.loadPencapaianSekolah());
            } catch (e) {
                toggleLoading(false); Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};