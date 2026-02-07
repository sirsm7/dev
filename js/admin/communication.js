import { SupportService } from '../services/support.service.js';
import { toggleLoading } from '../core/helpers.js';

// --- EMAIL BLASTER ---
window.generateList = function() {
    const includeGpict = document.getElementById('checkGpict').checked;
    const includeAdmin = document.getElementById('checkAdmin').checked;
    const filterStatus = document.getElementById('statusFilter').value;
    const uniqueEmails = new Set();
    
    if(!window.globalDashboardData) return;

    window.globalDashboardData.forEach(row => {
        if (row.jenis === 'PPD') return;
        if (includeGpict && row.emel_delima_gpict) {
            const hasId = row.telegram_id_gpict;
            if (filterStatus === 'all' || (filterStatus === 'unregistered' && !hasId) || (filterStatus === 'registered' && hasId)) {
                uniqueEmails.add(row.emel_delima_gpict.trim());
            }
        }
        if (includeAdmin && row.emel_delima_admin_delima) {
            const hasId = row.telegram_id_admin;
            if (filterStatus === 'all' || (filterStatus === 'unregistered' && !hasId) || (filterStatus === 'registered' && hasId)) {
                uniqueEmails.add(row.emel_delima_admin_delima.trim());
            }
        }
    });

    const arr = Array.from(uniqueEmails);
    document.getElementById('countEmail').innerText = arr.length;
    document.getElementById('emailOutput').value = arr.join(', ');
    
    const subject = encodeURIComponent(document.getElementById('msgSubject').value);
    const body = encodeURIComponent(document.getElementById('msgBody').value);
    document.getElementById('mailtoLink').href = `mailto:?bcc=${arr.join(',')}&subject=${subject}&body=${body}`;
};

window.copyEmails = function() {
    const el = document.getElementById("emailOutput");
    if(el.value) {
        el.select();
        navigator.clipboard.writeText(el.value).then(() => Swal.fire('Disalin', '', 'success'));
    }
};

window.copyTemplate = function() {
    navigator.clipboard.writeText(document.getElementById("msgBody").value).then(() => Swal.fire('Disalin', '', 'success'));
};

// --- HELPDESK ---
window.loadTiketAdmin = async function() {
    const wrapper = document.getElementById('adminTiketWrapper');
    if(!wrapper) return;
    wrapper.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;
    
    const filter = document.getElementById('filterTiketAdmin').value;
    
    try {
        const data = await SupportService.getAll(filter);
        wrapper.innerHTML = "";
        
        if (data.length === 0) {
            wrapper.innerHTML = `<div class="alert alert-light text-center">Tiada tiket dalam kategori ini.</div>`;
            return;
        }

        data.forEach(t => {
            const dateStr = new Date(t.created_at).toLocaleString('ms-MY');
            let actionArea = "";

            if (t.status !== 'SELESAI') {
                actionArea = `
                <div class="mt-3 border-top pt-2 bg-light p-2 rounded">
                    <label class="small fw-bold">Balasan Admin:</label>
                    <textarea id="reply-${t.id}" class="form-control mb-2 form-control-sm" rows="2" placeholder="Tulis balasan..."></textarea>
                    <div class="d-flex justify-content-end gap-2">
                        <button onclick="padamTiket(${t.id})" class="btn btn-outline-danger btn-sm">Padam</button>
                        <button onclick="submitBalasanAdmin(${t.id})" class="btn btn-primary btn-sm">Hantar & Tutup</button>
                    </div>
                </div>`;
            } else {
                actionArea = `
                <div class="mt-2 text-success small border-top pt-2">
                    <i class="fas fa-check-circle"></i> <strong>Respon:</strong> ${t.balasan_admin} 
                    <button onclick="padamTiket(${t.id})" class="btn btn-link text-danger p-0 ms-2 text-decoration-none" title="Padam Tiket"><i class="fas fa-trash"></i></button>
                </div>`;
            }

            wrapper.innerHTML += `
            <div class="card mb-3 shadow-sm ${t.status === 'SELESAI' ? 'bg-light opacity-75' : 'border-danger'}">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="badge bg-dark me-1">${t.kod_sekolah}</span>
                            <span class="badge bg-secondary">${t.peranan_pengirim}</span>
                        </div>
                        <small class="text-muted fw-bold">${dateStr}</small>
                    </div>
                    <h6 class="fw-bold mb-1">${t.tajuk}</h6>
                    <p class="small text-secondary mb-0 bg-white p-2 rounded border">${t.butiran_masalah}</p>
                    ${actionArea}
                </div>
            </div>`;
        });
    } catch (e) { 
        console.error(e);
        wrapper.innerHTML = `<div class="text-danger text-center">Ralat memuatkan tiket.</div>`; 
    }
};

window.submitBalasanAdmin = async function(id) {
    const reply = document.getElementById(`reply-${id}`).value;
    if(!reply) return Swal.fire('Kosong', 'Sila tulis balasan.', 'warning');
    
    toggleLoading(true);
    try {
        await SupportService.update(id, { 
            status: 'SELESAI', 
            balasan_admin: reply,
            tarikh_balas: new Date().toISOString()
        });
        
        toggleLoading(false);
        Swal.fire('Selesai', 'Tiket ditutup dan notifikasi dihantar.', 'success').then(() => window.loadTiketAdmin());
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal mengemaskini tiket.', 'error');
    }
};

window.padamTiket = async function(id) {
    Swal.fire({ 
        title: 'Padam Tiket?', 
        text: "Tindakan ini tidak boleh dikembalikan.",
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal'
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await SupportService.delete(id);
                toggleLoading(false);
                Swal.fire('Dipadam', '', 'success').then(() => window.loadTiketAdmin());
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};