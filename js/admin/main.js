/**
 * ADMIN MODULE: MAIN CONTROLLER
 * Fungsi: Menguruskan logik permulaan admin, keselamatan, dan peranan.
 * * UPDATE V1.1: Migrasi dari sessionStorage ke localStorage untuk sokongan cross-tab.
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

    // 3. Listener Tab Global (Jika diperlukan tambahan)
    // Nota: Sebahagian besar logik tab kini dikendalikan oleh switchAdminTab di admin.html
}

/**
 * Konfigurasi paparan untuk peranan UNIT PPD
 */
function setupUnitView(displayRole) {
    if(displayRole) displayRole.innerHTML = "UNIT PPD VIEW";
    
    // Sembunyikan Tab & Fungsi yang tidak relevan (Strict Mode)
    const tabsToHide = ['dashboard-tab', 'analisa-tab', 'email-tab', 'helpdesk-tab', 'admin-users-tab'];
    tabsToHide.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            // Sembunyikan elemen <a> itu sendiri
            el.classList.add('hidden');
        }
    });

    // Auto-Redirect ke Tab Pencapaian (Jika pengguna berada di root admin.html)
    if (window.location.hash === '' || window.location.hash === '#dashboard') {
        if (window.switchAdminTab) {
            window.switchAdminTab('pencapaian');
        }
    }

    // Muat data asas (Tahun) untuk dropdown pencapaian
    if(window.populateTahunFilter) window.populateTahunFilter();
}

/**
 * Konfigurasi paparan untuk peranan MOD ADMIN
 */
function setupAdminView(displayRole) {
    if(displayRole) displayRole.innerHTML = "MOD ADMIN";
    // Data dashboard akan dimuatkan secara automatik melalui switchAdminTab('dashboard') dalam admin.html
}

/**
 * Konfigurasi paparan untuk peranan SUPER ADMIN
 */
function setupSuperAdminView(displayRole) {
    if(displayRole) {
        displayRole.innerHTML = "SUPER ADMIN";
        // Visual khas untuk kuasa mutlak
        displayRole.classList.remove('text-brand-400');
        displayRole.classList.add('text-red-400', 'font-black'); 
    }
}