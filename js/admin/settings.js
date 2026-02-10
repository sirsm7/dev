/**
 * ADMIN MODULE: SETTINGS (DEV)
 * Menguruskan pengguna admin dan reset password sekolah.
 * Kemaskini: Sokongan untuk SUPER ADMIN dan penapisan akses.
 */

import { AuthService } from '../services/auth.service.js';
import { toggleLoading, keluarSistem } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

// --- USER MANAGEMENT ---
window.loadAdminList = async function() {
    const wrapper = document.getElementById('adminListWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;
    
    // Dapatkan role semasa pengguna yang sedang login
    const currentUserRole = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    
    // Kemaskini Dropdown Pilihan Role untuk Tambah Admin
    updateRoleDropdown(currentUserRole);

    try {
        let data = await AuthService.getAllAdmins();
        
        // --- LOGIK PENAPISAN (FILTERING) ---
        // Jika ADMIN biasa, buang SUPER_ADMIN dari senarai paparan
        if (currentUserRole !== 'SUPER_ADMIN') {
            data = data.filter(user => user.role !== 'SUPER_ADMIN');
        }

        if(data.length === 0) { 
            wrapper.innerHTML = `<div class="alert alert-warning">Tiada data admin dijumpai.</div>`; 
            return; 
        }
        
        let html = `
        <table class="table table-hover table-bordered align-middle mb-0 bg-white">
            <thead class="bg-light">
                <tr>
                    <th class="small text-uppercase text-secondary">Emel</th>
                    <th class="small text-uppercase text-secondary">Peranan</th>
                    <th class="small text-uppercase text-secondary text-center" style="width: 150px;">Tindakan</th>
                </tr>
            </thead>
            <tbody>`;
            
        data.forEach(user => {
            let roleBadge = '';
            if (user.role === 'SUPER_ADMIN') {
                roleBadge = `<span class="badge bg-danger">SUPER ADMIN</span>`;
            } else if (user.role === 'ADMIN') {
                roleBadge = `<span class="badge bg-primary">ADMIN</span>`;
            } else {
                roleBadge = `<span class="badge bg-indigo" style="background-color: #4b0082;">UNIT PPD</span>`;
            }

            // Halang butang padam diri sendiri (optional UI enhancement)
            const currentUserId = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ID);
            let deleteBtn = `
                <button onclick="padamAdmin('${user.id}', '${user.email}', '${user.role}')" class="btn btn-sm btn-outline-danger" title="Padam Akaun">
                    <i class="fas fa-trash-alt"></i>
                </button>`;
            
            if (user.id === currentUserId) {
                deleteBtn = `<span class="badge bg-light text-muted border">ANDA</span>`;
            }

            html += `
            <tr>
                <td class="fw-bold text-dark small">${user.email}</td>
                <td class="small">${roleBadge}</td>
                <td class="text-center">
                    ${deleteBtn}
                </td>
            </tr>`;
        });
        html += `</tbody></table>`;
        wrapper.innerHTML = html;
    } catch (e) { 
        console.error(e);
        wrapper.innerHTML = `<div class="alert alert-danger">Ralat memuatkan senarai admin.</div>`; 
    }
};

// Fungsi bantuan untuk mengemaskini dropdown "Tambah Admin Baru"
function updateRoleDropdown(currentUserRole) {
    const select = document.getElementById('inputNewAdminRole');
    if (!select) return;

    // Reset pilihan
    select.innerHTML = '';

    // Pilihan Standard
    const opts = [
        { val: 'ADMIN', txt: 'ADMIN (Akses Penuh)' },
        { val: 'PPD_UNIT', txt: 'UNIT PPD (Pencapaian Sahaja)' }
    ];

    // Jika SUPER ADMIN, tambah pilihan SUPER ADMIN
    if (currentUserRole === 'SUPER_ADMIN') {
        opts.unshift({ val: 'SUPER_ADMIN', txt: 'SUPER ADMIN (Akses Mutlak)' });
    }

    opts.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.val;
        option.innerText = opt.txt;
        select.appendChild(option);
    });
}

window.tambahAdmin = async function() {
    const email = document.getElementById('inputNewAdminEmail').value.trim();
    const role = document.getElementById('inputNewAdminRole').value;
    const pass = document.getElementById('inputNewAdminPass').value.trim();
    
    if(!email || !pass) return Swal.fire('Ralat', 'Sila isi emel dan kata laluan.', 'warning');
    
    // Double check keselamatan di sisi klien (walaupun dropdown dah filter)
    const currentUserRole = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    if (role === 'SUPER_ADMIN' && currentUserRole !== 'SUPER_ADMIN') {
        return Swal.fire('Dilarang', 'Anda tidak mempunyai kuasa mencipta Super Admin.', 'error');
    }

    toggleLoading(true);
    try {
        await AuthService.createAdmin(email, pass, role);
        toggleLoading(false);
        Swal.fire('Berjaya', `Pengguna (${role}) telah ditambah.`, 'success').then(() => {
            document.getElementById('inputNewAdminEmail').value = '';
            document.getElementById('inputNewAdminPass').value = '';
            window.loadAdminList();
        });
    } catch(e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal menambah admin. Pastikan emel unik.', 'error');
    }
};

window.padamAdmin = async function(id, email, targetRole) {
    // Semakan Keselamatan Tambahan
    const currentUserRole = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    
    if (currentUserRole !== 'SUPER_ADMIN' && targetRole === 'SUPER_ADMIN') {
        return Swal.fire('Dilarang', 'Anda tidak boleh memadam Super Admin.', 'error');
    }

    Swal.fire({ 
        title: 'Padam Admin?', 
        text: `Padam akses untuk ${email}?`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33' 
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AuthService.deleteUser(id);
                toggleLoading(false);
                Swal.fire('Berjaya', 'Akaun dipadam.', 'success').then(() => window.loadAdminList());
            } catch (e) { 
                toggleLoading(false); 
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};

// --- SEKOLAH PASSWORD MANAGEMENT ---
window.resetPasswordSekolah = async function(kod) {
    Swal.fire({ 
        title: 'Reset Password?', 
        text: `Tetapkan semula kata laluan ${kod} kepada default (ppdag@12345)?`, 
        icon: 'warning', 
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Reset'
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AuthService.resetSchoolPassword(kod);
                toggleLoading(false);
                Swal.fire('Berjaya', `Kata laluan ${kod} telah di-reset.`, 'success');
            } catch (e) { 
                toggleLoading(false); 
                Swal.fire('Ralat', 'Gagal reset password.', 'error'); 
            }
        }
    });
};

// --- UNIT PPD SELF-SERVICE ---
window.ubahKataLaluanSendiri = async function() {
    const userId = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ID); 
    
    if (!userId) {
        Swal.fire('Ralat Sesi', 'Sila log keluar dan log masuk semula.', 'error');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Tukar Kata Laluan',
        html:
            '<input id="swal-pass-old" type="password" class="swal2-input" placeholder="Kata Laluan Lama">' +
            '<input id="swal-pass-new" type="password" class="swal2-input" placeholder="Kata Laluan Baru (Min 6)">',
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
            return [
                document.getElementById('swal-pass-old').value,
                document.getElementById('swal-pass-new').value
            ]
        }
    });

    if (formValues) {
        const [oldPass, newPass] = formValues;
        if (!oldPass || !newPass || newPass.length < 6) return Swal.fire('Ralat', 'Input tidak sah.', 'warning');

        toggleLoading(true);
        try {
            await AuthService.changePassword(userId, oldPass, newPass);
            toggleLoading(false);
            // Panggil keluarSistem yang diimport
            Swal.fire('Berjaya', 'Kata laluan ditukar. Sila log masuk semula.', 'success').then(() => keluarSistem());
        } catch (err) {
            toggleLoading(false);
            Swal.fire('Gagal', err.message, 'error');
        }
    }
};