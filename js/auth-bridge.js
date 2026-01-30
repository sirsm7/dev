/**
 * SMPID AUTH BRIDGE
 * Fungsi: Memastikan modul dalam sub-folder hanya boleh diakses
 * jika pengguna telah log masuk melalui SMPID utama.
 */

(function() {
    // Semak kunci sesi dari sessionStorage (yang dikongsi dalam origin yang sama)
    const isAuth = sessionStorage.getItem('smpid_auth');
    const userKod = sessionStorage.getItem('smpid_user_kod');

    // Jika tiada rekod auth, tendang keluar
    if (isAuth !== 'true' || !userKod) {
        console.warn("⛔ Akses Tanpa Izin ke Modul. Mengalih ke Login...");
        
        // Peringatan mesra sebelum redirect
        alert("Sesi tamat atau tidak sah. Sila log masuk semula melalui portal utama.");
        
        // Redirect ke root (naik 2 level dari /modules/nama_modul/)
        window.location.href = '../../index.html';
    } else {
        console.log("✅ Akses Modul Dibenarkan: " + userKod);
    }
})();