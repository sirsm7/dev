/**
 * ADMIN MAIN CONTROLLER
 * Entry point untuk panel admin.
 * Menggunakan: AuthService, APP_CONFIG
 */

import { AuthService } from '../services/auth.service.js';
import { APP_CONFIG } from '../config/app.config.js';

// Import Admin Modules (Jika kita nak refactor semua sekali gus)
// Buat masa ini, kita biarkan module lain dimuatkan secara berasingan
// TETAPI, amalan terbaik adalah main.js import semuanya.
// Untuk fasa ini, kita pastikan auth check berfungsi dahulu.

document.addEventListener('DOMContentLoaded', () => {
    initAdminPanel();
});

async function initAdminPanel() {
    const isAuth = sessionStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === 'true';
    const userRole = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);

    // 1. Security Check
    if (!isAuth) {
        window.location.replace('index.html');
        return;
    }

    // 2. Role Setup
    const displayRole = document.getElementById('displayUserRole');
    if (userRole === 'PPD_UNIT') {
        setupUnitView(displayRole);
    } else {
        setupAdminView(displayRole);
    }

    // 3. Global Listeners
    setupTabListeners();
}

function setupUnitView(displayRole) {
    if(displayRole) displayRole.innerHTML = "UNIT PPD VIEW";
    
    // Hide irrelevant tabs
    ['dashboard-tab', 'email-tab', 'admin-users-tab'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.parentElement.style.display = 'none';
    });

    // Auto switch to Achievement
    const tabPencapaian = new bootstrap.Tab(document.getElementById('pencapaian-tab'));
    tabPencapaian.show();
}

function setupAdminView(displayRole) {
    if(displayRole) displayRole.innerHTML = "MOD ADMIN";
    // Trigger dashboard load (fungsi global dari dashboard.js lama perlu diubah nanti)
    if(window.fetchDashboardData) window.fetchDashboardData();
}

function setupTabListeners() {
    // ... Logic listener tab kekal sama ...
}

// Global Logout
window.keluarSistem = function() {
    sessionStorage.clear();
    window.location.replace('index.html');
};