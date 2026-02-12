/**
 * ADMIN MODULE: SETTINGS (TAILWIND EDITION)
 * Menguruskan pengguna admin dan reset password sekolah.
 */

import { AuthService } from '../services/auth.service.js';
import { toggleLoading, keluarSistem } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

// --- USER MANAGEMENT ---
window.loadAdminList = async function() {
    const wrapper = document.getElementById('adminListWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = `<div class="text-center py-10 text-slate-400 font-medium animate-pulse">Memuatkan senarai admin...</div>`;
    
    // Dapatkan info sesi semasa
    const currentUserRole = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const currentUserId = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ID);
    
    // Kemaskini Dropdown Pilihan Role untuk Tambah Admin
    updateRoleDropdown(currentUserRole);

    try {
        let data = await AuthService.getAllAdmins();
        
        if(data.length === 0) { 
            wrapper.innerHTML = `<div class="p-4 bg-amber-50 text-amber-700 rounded-xl text-center border border-amber-100">Tiada data admin dijumpai.</div>`; 
            return; 
        }
        
        let html = `
        <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-slate-500 uppercase bg-slate-50">
                    <tr>
                        <th class="px-6 py-3 font-bold">#</th>
                        <th class="px-6 py-3 font-bold">Emel Pengguna</th>
                        <th class="px-6 py-3 font-bold text-center">Peranan</th>
                        <th class="px-6 py-3 font-bold text-center">Tindakan</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">`;
            
        data.forEach((user, index) => {
            const isSelf = (user.id === currentUserId);
            
            // 1. Badge Peranan (Tailwind)
            let roleBadge = '';
            if (user.role === 'SUPER_ADMIN') roleBadge = `<span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">SUPER ADMIN</span>`;
            else if (user.role === 'ADMIN') roleBadge = `<span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">ADMIN</span>`;
            else roleBadge = `<span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">UNIT PPD</span>`;

            // 2. Logik Butang Tindakan
            let actionButtons = '';

            // BUTANG PADAM
            if (currentUserRole === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN' && !isSelf) {
                actionButtons += `
                <button onclick="padamAdmin('${user.id}', '${user.email}')" class="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="Padam Akaun">
                    <i class="fas fa-trash-alt"></i>
                </button>`;
            } 

            // BUTANG RESET PASSWORD
            let canReset = false;
            if (user.role === 'SUPER_ADMIN') {
                if (isSelf) canReset = true;
            } else {
                if (currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'ADMIN') {
                    canReset = true;
                }
            }

            if (canReset) {
                const resetFunc = isSelf ? `ubahKataLaluanSendiri()` : `resetUserPass('${user.id}', '${user.email}', '${user.role}')`;
                const btnColor = isSelf ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50';
                const btnIcon = isSelf ? 'fa-key' : 'fa-unlock-alt';
                
                actionButtons += `
                <button onclick="${resetFunc}" class="p-2 rounded-lg transition ${btnColor}" title="Reset Password">
                    <i class="fas ${btnIcon}"></i>
                </button>`;
            }

            // Penanda 'ANDA'
            if (isSelf) {
                roleBadge += ` <span class="ml-2 text-[10px] font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded bg-slate-50">ANDA</span>`;
            }

            html += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 font-mono text-xs text-slate-400 font-bold w-12 text-center">${index + 1}</td>
                <td class="px-6 py-4 font-semibold text-slate-700">${user.email}</td>
                <td class="px-6 py-4 text-center">${roleBadge}</td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        ${actionButtons || '<span class="text-[10px] text-slate-300 italic">- Tiada Akses -</span>'}
                    </div>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
        wrapper.innerHTML = html;
    } catch (e) { 
        console.error(e);
        wrapper.innerHTML = `<div class="p-4 bg-red-50 text-red-700 rounded-xl text-center font-bold">Ralat memuatkan senarai admin.</div>`; 
    }
};

// Fungsi Reset Password Paksa (Untuk Admin reset user lain)
window.resetUserPass = async function(targetId, targetEmail, targetRole) {
    const { value: newPass } = await Swal.fire({
        title: 'Reset Kata Laluan',
        html: `Masukkan kata laluan baharu untuk<br><b>${targetEmail}</b> (${targetRole})`,
        input: 'text',
        inputPlaceholder: 'Kata laluan baru...',
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        confirmButtonColor: '#16a34a',
        cancelButtonText: 'Batal'
    });

    if (newPass) {
        if (newPass.length < 6) return Swal.fire('Ralat', 'Kata laluan terlalu pendek (Min 6).', 'warning');

        toggleLoading(true);
        try {
            await AuthService.forceResetUserPassword(targetId, newPass);
            toggleLoading(false);
            Swal.fire('Berjaya', `Kata laluan untuk ${targetEmail} telah diubah.`, 'success');
        } catch (e) {
            toggleLoading(false);
            Swal.fire('Ralat', 'Gagal menetapkan kata laluan.', 'error');
        }
    }
};

// Fungsi bantuan untuk mengemaskini dropdown "Tambah Admin Baru"
function updateRoleDropdown(currentUserRole) {
    const select = document.getElementById('inputNewAdminRole');
    if (!select) return;

    select.innerHTML = '';

    const opts = [
        { val: 'ADMIN', txt: 'ADMIN (Akses Penuh)' },
        { val: 'PPD_UNIT', txt: 'UNIT PPD (Pencapaian Sahaja)' }
    ];

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

window.padamAdmin = async function(id, email) {
    const currentUserRole = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    
    if (currentUserRole !== 'SUPER_ADMIN') {
        return Swal.fire('Dilarang', 'Hanya Super Admin boleh memadam pengguna.', 'error');
    }

    Swal.fire({ 
        title: 'Padam Pengguna?', 
        text: `Adakah anda pasti mahu memadam akses untuk ${email}?`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal'
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
        confirmButtonColor: '#f59e0b', // amber-500
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

// --- SELF-SERVICE CHANGE PASSWORD ---
window.ubahKataLaluanSendiri = async function() {
    const userId = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ID); 
    
    if (!userId) {
        Swal.fire('Ralat Sesi', 'Sila log keluar dan log masuk semula.', 'error');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Tukar Kata Laluan Anda',
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
            Swal.fire('Berjaya', 'Kata laluan ditukar. Sila log masuk semula.', 'success').then(() => keluarSistem());
        } catch (err) {
            toggleLoading(false);
            Swal.fire('Gagal', err.message, 'error');
        }
    }
};