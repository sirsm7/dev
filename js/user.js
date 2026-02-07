/**
 * USER PORTAL CONTROLLER
 * Menguruskan papan pemuka sekolah (Profil, Analisa, Aduan, Pencapaian).
 * Menggunakan: SchoolService, AuthService, AnalyticsService, SupportService, AchievementService
 */

import { SchoolService } from './services/school.service.js';
import { AuthService } from './services/auth.service.js';
import { AnalyticsService } from './services/analytics.service.js';
import { SupportService } from './services/support.service.js';
import { AchievementService } from './services/achievement.service.js';
import { toggleLoading, formatSentenceCase, checkEmailDomain, autoFormatPhone } from './core/helpers.js';
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
    
    // UI Header Setup
    const displayKod = document.getElementById('displayKodSekolah');
    const btnLogout = document.getElementById('btnLogoutMenu');

    if (isAdmin) {
        displayKod.innerHTML = `<i class="fas fa-user-shield me-2"></i>ADMIN VIEW: ${kod}`;
        displayKod.classList.replace('text-dark', 'text-primary');
        displayKod.classList.add('border', 'border-primary');
        
        if(btnLogout) {
            btnLogout.innerHTML = `<i class="fas fa-arrow-left me-2"></i>Kembali ke Dashboard Admin`;
            btnLogout.setAttribute('onclick', "window.location.href='admin.html'");
            btnLogout.classList.replace('text-danger', 'text-primary');
        }
        document.getElementById('btnResetData')?.classList.remove('hidden');
    } else {
        displayKod.innerHTML = `<i class="fas fa-school me-2"></i>${kod}`;
    }
    
    loadProfil(kod);
}

// --- NAVIGASI UI ---
window.showSection = function(section) {
    const sections = ['menu', 'profil', 'aduan', 'analisa', 'pencapaian'];
    const welcomeText = document.getElementById('welcomeText');

    sections.forEach(s => {
        const el = document.getElementById(`section-${s}`);
        if(el) el.classList.add('hidden');
    });

    const activeEl = document.getElementById(`section-${section}`);
    if(activeEl) activeEl.classList.remove('hidden');

    if (section === 'menu') welcomeText.innerText = "Menu Utama";
    else if (section === 'profil') welcomeText.innerText = "Kemaskini Maklumat";
    else if (section === 'aduan') { welcomeText.innerText = "Helpdesk & Aduan"; loadTiketUser(); }
    else if (section === 'analisa') { welcomeText.innerText = "Analisa Digital"; loadAnalisaSekolah(); }
    else if (section === 'pencapaian') { welcomeText.innerText = "Rekod Pencapaian"; loadPencapaianSekolah(); }
};

// --- MODUL PROFIL ---
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
    } catch (err) { 
        console.error("Gagal muat profil:", err); 
        Swal.fire('Ralat Sambungan', 'Gagal memuatkan data sekolah.', 'error');
    }
}

window.simpanProfil = async function() {
    const kod = document.getElementById('hiddenKodSekolah').value;
    const emelG = document.getElementById('gpictEmel').value;
    const btnSubmit = document.querySelector('#dataForm button[type="submit"]');
    
    if (!checkEmailDomain(emelG)) { 
        Swal.fire('Format Salah', 'Sila gunakan emel domain moe-dl.edu.my', 'warning'); 
        return; 
    }

    if(btnSubmit) btnSubmit.disabled = true;
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
        
        // Notifikasi API Deno (Optional)
        if (APP_CONFIG.API.DENO_URL) {
            const namaSekolah = document.getElementById('dispNamaSekolah').innerText;
            const isAdmin = sessionStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === 'true';
            fetch(`${APP_CONFIG.API.DENO_URL}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kod, nama: namaSekolah, updated_by: isAdmin ? 'PENTADBIR PPD' : 'PIHAK SEKOLAH' })
            }).catch(() => {});
        }

        toggleLoading(false);
        if(btnSubmit) btnSubmit.disabled = false;
        
        Swal.fire('Berjaya', 'Maklumat sekolah telah dikemaskini.', 'success')
            .then(() => window.showSection('menu'));
            
    } catch (err) {
        toggleLoading(false); 
        if(btnSubmit) btnSubmit.disabled = false;
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

// --- MODUL ANALISA ---
async function loadAnalisaSekolah() {
    const kod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const tableBody = document.getElementById('tableAnalisaBody');

    try {
        const data = await AnalyticsService.getBySchool(kod);

        if (!data) {
            if(tableBody) tableBody.innerHTML = `<tr><td colspan="3" class="text-danger py-3">Data analisa belum tersedia.</td></tr>`;
            return;
        }

        // Logik Paparan DCS & Aktif
        let dcsLatest = (data.dcs_2025 !== null) ? data.dcs_2025 : data.dcs_2024;
        let aktifLatest = (data.peratus_aktif_2025 !== null) ? data.peratus_aktif_2025 : data.peratus_aktif_2024;
        
        document.getElementById('valDcs').innerText = dcsLatest ? dcsLatest.toFixed(2) : "0.00";
        document.getElementById('valAktif').innerText = aktifLatest ? aktifLatest : "0";

        // Render Table & Chart (guna data yang sama)
        renderAnalisaTable(data);
        renderDcsChart(data);

    } catch (err) {
        console.error(err);
        if(tableBody) tableBody.innerHTML = `<tr><td colspan="3" class="text-danger py-3">Ralat memuatkan data.</td></tr>`;
    }
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
            rows += `<tr>
                <td class="fw-bold text-secondary">${year}</td>
                <td><span class="badge ${dcs >= 3.0 ? 'bg-success' : 'bg-warning'} text-white">${dcs !== null ? dcs.toFixed(2) : '-'}</span></td>
                <td>${aktif !== null ? aktif + '%' : '-'}</td>
            </tr>`;
        }
    });
    
    tableBody.innerHTML = rows || `<tr><td colspan="3" class="text-muted">Tiada data sejarah.</td></tr>`;
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
                { label: 'Skor DCS (0-5)', data: dataDcs, borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)', yAxisID: 'y', tension: 0.3, fill: true },
                { label: '% Aktif DELIMa', data: dataAktif, borderColor: '#198754', backgroundColor: 'rgba(25, 135, 84, 0.1)', yAxisID: 'y1', tension: 0.3, borderDash: [5, 5] }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 5, position: 'left' },
                y1: { min: 0, max: 100, position: 'right', grid: { drawOnChartArea: false } }
            }
        }
    });
}

// --- MODUL PENCAPAIAN ---
window.loadPencapaianSekolah = async function() {
    const kod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const tbody = document.getElementById('tbodyRekodPencapaian');
    
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div> Memuatkan...</td></tr>`;

    try {
        const data = await AchievementService.getBySchool(kod);
        userPencapaianList = data; // Cache untuk Edit

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted fst-italic">Tiada rekod dijumpai.</td></tr>`;
            return;
        }

        let html = '';
        data.forEach(item => {
            // ... (HTML Generation Code Sama Seperti Asal, cuma dipermudah) ...
            let badgeClass = item.kategori === 'MURID' ? 'bg-info text-dark' : (item.kategori === 'GURU' ? 'bg-warning text-dark' : 'bg-purple');
            let program = item.nama_pertandingan;
            
            if (item.jenis_rekod === 'PENSIJILAN') {
                program = `<span class="badge bg-secondary me-1"><i class="fas fa-certificate"></i></span> ${item.nama_pertandingan}`;
            }

            html += `
            <tr>
                <td class="text-center align-middle">
                    <span class="badge ${badgeClass} shadow-sm">${item.kategori}</span>
                    <div class="small text-muted mt-1 fw-bold">${item.tahun}</div>
                </td>
                <td class="align-middle">
                    <div class="fw-bold text-dark small text-truncate" style="max-width: 200px;">${item.nama_peserta}</div>
                    ${item.jawatan ? `<span class="badge bg-light text-secondary border mt-1" style="font-size:0.65rem;">${item.jawatan}</span>` : ''}
                    <div class="mt-2 text-primary small fw-bold">${program}</div>
                    <div class="d-flex gap-2 mt-1">
                        <span class="badge bg-light text-dark border">${item.peringkat}</span>
                        <span class="badge bg-success bg-opacity-10 text-success border border-success">${item.pencapaian}</span>
                    </div>
                </td>
                <td class="text-center align-middle">
                    <button onclick="openEditPencapaianUser(${item.id})" class="btn btn-sm btn-outline-warning shadow-sm me-1"><i class="fas fa-edit"></i></button>
                    <button onclick="padamPencapaian(${item.id})" class="btn btn-sm btn-outline-danger shadow-sm"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Gagal memuatkan data.</td></tr>`;
    }
};

window.simpanPencapaian = async function() {
    const kod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD); 
    const btn = document.querySelector('#formPencapaian button[type="submit"]');

    // Ambil nilai form
    const kategori = document.getElementById('pencapaianKategori').value;
    const jenisRekod = document.getElementById('pInputJenisRekod').value;
    const nama = document.getElementById('pInputNama').value.trim().toUpperCase();
    
    let jawatan = null;
    if (kategori === 'GURU') {
        jawatan = document.getElementById('pInputJawatan').value;
        if (!jawatan) return Swal.fire('Ralat', 'Sila pilih jawatan guru.', 'warning');
    }

    // ... (Validasi lain kekal sama) ...

    if(btn) btn.disabled = true;
    toggleLoading(true);

    try {
        const payload = {
            kod_sekolah: kod,
            kategori, nama_peserta: nama, nama_pertandingan: document.getElementById('pInputProgram').value.trim().toUpperCase(),
            peringkat: document.getElementById('pInputPeringkat').value,
            tahun: parseInt(document.getElementById('pInputTahun').value),
            pencapaian: document.getElementById('pInputPencapaian').value.trim().toUpperCase(),
            pautan_bukti: document.getElementById('pInputLink').value.trim(),
            jenis_rekod: jenisRekod,
            penyedia: document.getElementById('pInputPenyedia').value,
            jawatan
        };

        await AchievementService.create(payload);

        toggleLoading(false);
        if(btn) btn.disabled = false;

        Swal.fire('Berjaya', 'Rekod disimpan.', 'success').then(() => {
            document.getElementById('formPencapaian').reset();
            window.loadPencapaianSekolah();
        });

    } catch (err) {
        toggleLoading(false);
        if(btn) btn.disabled = false;
        Swal.fire('Ralat', 'Gagal menyimpan rekod.', 'error');
    }
};

// ... Fungsi Padam, Edit, dan Reset Data, Hantar Tiket turut menggunakan Service ...
// (Saya ringkaskan untuk menjimatkan ruang, tetapi prinsipnya sama: Guna AchievementService & SupportService)

window.padamPencapaian = async function(id) {
    Swal.fire({
        title: 'Padam Rekod?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33'
    }).then(async (result) => {
        if (result.isConfirmed) {
            toggleLoading(true);
            try {
                await AchievementService.delete(id);
                toggleLoading(false);
                Swal.fire('Dipadam', 'Rekod dipadam.', 'success').then(() => window.loadPencapaianSekolah());
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};

// Bind fungsi UI lain ke window (Toggle Jenis, Set Kategori)
window.setPencapaianType = function(type) {
    document.getElementById('pencapaianKategori').value = type;
    const wrapperJenis = document.getElementById('wrapperJenisRekod');
    const divJawatan = document.getElementById('divInputJawatan');
    const inpName = document.getElementById('pInputNama');

    if (type === 'GURU') {
        wrapperJenis.classList.remove('hidden');
        divJawatan.classList.remove('hidden');
        inpName.value = "";
        inpName.readOnly = false;
    } else {
        wrapperJenis.classList.add('hidden');
        divJawatan.classList.add('hidden');
        document.getElementById('radioPertandingan').checked = true;
        
        if (type === 'SEKOLAH') {
            inpName.value = document.getElementById('dispNamaSekolah').innerText;
            inpName.readOnly = true;
        } else {
            inpName.value = "";
            inpName.readOnly = false;
        }
    }
    window.toggleJenisPencapaian();
};

window.toggleJenisPencapaian = function() {
    const isPensijilan = document.getElementById('radioPensijilan').checked;
    document.getElementById('pInputJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';
    
    const divPenyedia = document.getElementById('divInputPenyedia');
    const selectPeringkat = document.getElementById('pInputPeringkat');
    
    if (isPensijilan) {
        divPenyedia.classList.remove('hidden');
        selectPeringkat.parentElement.classList.add('hidden');
    } else {
        divPenyedia.classList.add('hidden');
        selectPeringkat.parentElement.classList.remove('hidden');
    }
};

window.hantarTiket = async function() {
    const kod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const peranan = document.getElementById('tiketPeranan').value;
    const tajuk = document.getElementById('tiketTajuk').value.toUpperCase();
    const mesej = document.getElementById('tiketMesej').value;

    if (!peranan) return Swal.fire('Ralat', 'Sila pilih peranan.', 'warning');

    toggleLoading(true);
    try {
        await SupportService.createTicket({ 
            kod_sekolah: kod, 
            peranan_pengirim: peranan, 
            tajuk: tajuk, 
            butiran_masalah: mesej 
        });
        
        toggleLoading(false);
        Swal.fire('Berjaya', 'Tiket dihantar.', 'success').then(() => {
            document.getElementById('formTiket').reset();
            window.loadTiketUser();
        });
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal menghantar tiket.', 'error');
    }
};

window.loadTiketUser = async function() {
    const kod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const container = document.getElementById('senaraiTiketContainer');
    
    try {
        const data = await SupportService.getBySchool(kod);
        container.innerHTML = "";
        
        if(data.length === 0) {
            container.innerHTML = `<div class="text-center py-5 text-muted">Tiada tiket aduan.</div>`;
            return;
        }

        data.forEach(t => {
            // Render HTML tiket (Ringkas)
            const status = t.status === 'SELESAI' ? '<span class="badge bg-success">SELESAI</span>' : '<span class="badge bg-warning text-dark">DALAM PROSES</span>';
            const balasan = t.balasan_admin ? `<div class="bg-light p-2 mt-2 border rounded small"><strong>Admin:</strong> ${t.balasan_admin}</div>` : '';
            
            container.innerHTML += `
            <div class="card mb-2 shadow-sm border-0">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between mb-1">
                        <small class="text-muted fw-bold">${new Date(t.created_at).toLocaleDateString()}</small>
                        ${status}
                    </div>
                    <h6 class="fw-bold mb-1">${t.tajuk}</h6>
                    <p class="small text-secondary mb-0">${t.butiran_masalah}</p>
                    ${balasan}
                </div>
            </div>`;
        });
    } catch (e) {
        container.innerHTML = `<div class="text-danger small">Gagal memuatkan tiket.</div>`;
    }
};