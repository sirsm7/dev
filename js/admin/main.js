/**
 * ADMIN MODULE: MAIN CONTROLLER
 * Fungsi: Menguruskan logik permulaan admin, keselamatan, dan peranan (RBAC).
 * --- UPDATE V1.2 (STRICT SECURITY) ---
 * Implementation: Strict Access Control untuk UNIT PPD (Kalis Hash Bypass).
 * Migration: Migrasi dari sessionStorage ke localStorage untuk sokongan cross-tab.
 */

import { AuthService } from '../services/auth.service.js';
import { APP_CONFIG } from '../config/app.config.js';

document.addEventListener('DOMContentLoaded', () => {
    initAdminPanel();
});

/**
 * Inisialisasi Panel Admin
 */
async function initAdminPanel() {
    // UPDATE: Ambil data auth dari localStorage supaya sesi kekal apabila buka tab baharu
    const isAuth = localStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === 'true';
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);

    // 1. Semakan Keselamatan
    if (!isAuth) {
        console.warn("⛔ [AdminMain] Sesi tidak sah atau luput. Mengalihkan ke landing page...");
        window.location.replace('index.html');
        return;
    }

    // 2. Tetapan Peranan (Role Setup)
    const displayRole = document.getElementById('displayUserRole');
    
    if (userRole === 'PPD_UNIT') {
        setupUnitView(displayRole);
    } else if (userRole === 'SUPER_ADMIN') {
        setupSuperAdminView(displayRole);
    } else {
        // Default ADMIN
        setupAdminView(displayRole);
    }

    // 3. Listener Tab Global
    // Nota: Logik pertukaran tab visual dikendalikan oleh switchAdminTab di admin.html
}

/**
 * KONFIGURASI STRICT MODE: UNIT PPD
 * Mengawal akses fizikal tab dan menyekat cubaan bypass melalui URL Hash (#hash).
 */
function setupUnitView(displayRole) {
    if(displayRole) displayRole.innerHTML = "UNIT PPD VIEW";
    
    // Senarai tab yang dilarang untuk Unit PPD
    const forbiddenTabs = ['dashboard', 'analisa', 'email', 'helpdesk', 'admin-users'];
    
    // 1. Sembunyikan Navigasi (Surgical CSS Injection)
    forbiddenTabs.forEach(id => {
        const el = document.getElementById(id + '-tab');
        if(el) {
            // Kita buang terus dari aliran dokumen (Strict)
            el.classList.add('hidden');
        }
    });

    // 2. Logic Gatekeeper: Cegah pencerobohan melalui manual URL Hash
    const enforceStrictAccess = () => {
        const currentHash = window.location.hash.replace('#', '') || 'dashboard';
        
        if (forbiddenTabs.includes(currentHash)) {
            console.error(`[Security] Pencerobohan dikesan. Akses ke #${currentHash} disekat untuk peranan UNIT PPD.`);
            
            // Paksa redirect ke zon selamat (Pencapaian)
            window.location.hash = 'pencapaian';
            
            // Beri notifikasi amaran jika perlu
            Swal.fire({
                icon: 'error',
                title: 'Akses Disekat',
                text: 'Anda tidak mempunyai kebenaran untuk melihat modul ini.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    };

    // Semakan pada waktu muat halaman (Initial Load)
    enforceStrictAccess();

    // Semakan berterusan pada setiap kali URL Hash berubah
    window.addEventListener('hashchange', enforceStrictAccess);

    // 3. Muat data permitted (Achievement)
    if(window.populateTahunFilter) window.populateTahunFilter();
}

/**
 * Konfigurasi paparan untuk peranan MOD ADMIN
 */
function setupAdminView(displayRole) {
    if(displayRole) displayRole.innerHTML = "MOD ADMIN";
    // Admin biasa mempunyai akses ke semua tab kecuali kebolehan memadam user (dikawal di settings.js)
}

/**
 * Konfigurasi paparan untuk peranan SUPER ADMIN
 */
function setupSuperAdminView(displayRole) {
    if(displayRole) {
        displayRole.innerHTML = "SUPER ADMIN";
        // Visual khas: Merah & Bold untuk Kuasa Mutlak
        displayRole.classList.remove('text-brand-400');
        displayRole.classList.add('text-red-500', 'font-black'); 
    }
}