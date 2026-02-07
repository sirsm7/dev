import { AuthService } from '../services/auth.service.js';
import { toggleLoading, keluarSistem } from '../core/helpers.js';

window.loadAdminList = async function() {
    const wrapper = document.getElementById('adminListWrapper');
    wrapper.innerHTML = `<div class="text-center py-4"><div class="spinner-border"></div></div>`;
    
    try {
        const data = await AuthService.getAllAdmins();
        if(data.length === 0) { wrapper.innerHTML = `<div class="alert alert-warning">Tiada admin.</div>`; return; }
        
        let html = `<table class="table table-bordered bg-white small"><thead><tr><th>Emel</th><th>Peranan</th><th>Tindakan</th></tr></thead><tbody>`;
        data.forEach(user => {
            html += `<tr><td class="fw-bold">${user.email}</td><td>${user.role}</td><td class="text-center"><button onclick="padamAdmin('${user.id}')" class="btn btn-sm btn-outline-danger"><i class="fas fa-trash"></i></button></td></tr>`;
        });
        html += `</tbody></table>`;
        wrapper.innerHTML = html;
    } catch (e) { wrapper.innerHTML = 'Ralat memuatkan admin.'; }
};

window.tambahAdmin = async function() {
    const email = document.getElementById('inputNewAdminEmail').value;
    const role = document.getElementById('inputNewAdminRole').value;
    const pass = document.getElementById('inputNewAdminPass').value;
    
    if(!email || !pass) return Swal.fire('Ralat', 'Isi maklumat.', 'warning');
    
    toggleLoading(true);
    try {
        await AuthService.createAdmin(email, pass, role);
        toggleLoading(false);
        Swal.fire('Berjaya', 'Admin ditambah.', 'success').then(() => window.loadAdminList());
    } catch(e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal menambah.', 'error');
    }
};

window.padamAdmin = async function(id) {
    Swal.fire({ title: 'Padam?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AuthService.deleteUser(id);
                toggleLoading(false);
                window.loadAdminList();
            } catch (e) { toggleLoading(false); }
        }
    });
};

window.resetPasswordSekolah = async function(kod) {
    Swal.fire({ title: 'Reset Password?', text: `Reset ${kod} kepada default?`, icon: 'warning', showCancelButton: true }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AuthService.resetSchoolPassword(kod);
                toggleLoading(false);
                Swal.fire('Berjaya', `Password ${kod} telah direset.`, 'success');
            } catch (e) { toggleLoading(false); Swal.fire('Ralat', '', 'error'); }
        }
    });
};

window.ubahKataLaluanSendiri = async function() {
    // Logic sama seperti di user.js
};