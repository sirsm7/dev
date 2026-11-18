import { envReady } from "./config/config.js";
import { APP_CONFIG } from "./config/app.config.js";
import { initDatabaseClient } from "./core/db.js";
import { AuthService } from "./services/auth.service.js";
import { toggleLoading } from "./core/helpers.js";

let loginBusy = false;

function clearElement(el) {
  if (!el) {
    return;
  }
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function showAlert(options) {
  if (typeof window !== "undefined" && window.Swal && typeof window.Swal.fire === "function") {
    return window.Swal.fire(options);
  }
  const message =
    options && (options.text || options.title)
      ? `${options.title || ""}\n${options.text || ""}`.trim()
      : "";
  if (message) {
    window.alert(message);
  }
  return Promise.resolve({ isConfirmed: true });
}

function renderLoginHeader() {
  const params = new URLSearchParams(window.location.search);
  const kod = params.get("kod");
  const mod = params.get("mod");

  const titleEl = document.getElementById("loginTitle");
  if (!titleEl) {
    return;
  }

  if (mod === "admin") {
    clearElement(titleEl);
    const shieldIcon = document.createElement("i");
    shieldIcon.className = "fas fa-user-shield mr-2";
    titleEl.appendChild(shieldIcon);
    titleEl.appendChild(document.createTextNode("LOG MASUK PENTADBIR"));
  } else if (kod && kod.trim() !== "") {
    clearElement(titleEl);
    titleEl.appendChild(document.createTextNode("LOG MASUK "));
    const codeSpan = document.createElement("span");
    codeSpan.className = "text-brand-600";
    codeSpan.textContent = kod.trim().toUpperCase();
    titleEl.appendChild(codeSpan);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", window.location.href);
  renderLoginHeader();
});

window.togglePass = function () {
  const input = document.getElementById("inputPassword");
  const icon = document.getElementById("iconEye");

  if (!input || !icon) {
    return;
  }

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
};

window.prosesLogin = async function () {
  if (loginBusy) {
    return;
  }

  const inputEmail = document.getElementById("inputEmail");
  const inputPass = document.getElementById("inputPassword");
  const btnLogin =
    document.getElementById("btnLogin") ||
    document.querySelector('button[onclick*="prosesLogin"]');

  if (!inputEmail || !inputPass) {
    return;
  }

  const email = inputEmail.value.trim();
  const password = inputPass.value.trim();

  if (!email || !password) {
    await showAlert({
      icon: "warning",
      title: "Ralat",
      text: "Sila masukkan emel dan kata laluan."
    });
    return;
  }

  loginBusy = true;
  if (btnLogin) {
    btnLogin.disabled = true;
  }
  toggleLoading(true);

  try {
    await envReady;
    await initDatabaseClient();

    const user = await AuthService.login(email, password);

    localStorage.setItem(APP_CONFIG.SESSION.USER_KOD, user.kod_sekolah || "");
    localStorage.setItem(APP_CONFIG.SESSION.USER_ROLE, user.role || "");
    localStorage.setItem(APP_CONFIG.SESSION.USER_ID, String(user.id || ""));

    const adminRoles = ["ADMIN", "PPD_UNIT", "SUPER_ADMIN", "JPNMEL"];
    if (adminRoles.includes(user.role)) {
      localStorage.setItem(APP_CONFIG.SESSION.AUTH_FLAG, "true");

      let welcomeTitle = "Admin Disahkan";
      let welcomeMsg = "Selamat kembali, Admin PPD.";

      if (user.role === "PPD_UNIT") {
        welcomeTitle = "Akses Unit PPD";
        welcomeMsg = "Log masuk sebagai Unit PPD.";
      } else if (user.role === "SUPER_ADMIN") {
        welcomeTitle = "Akses Super Admin";
        welcomeMsg = "Log masuk dengan kuasa penuh.";
      } else if (user.role === "JPNMEL") {
        welcomeTitle = "Akses JPN Melaka";
        welcomeMsg = "Log masuk pentadbir peringkat negeri.";
      }

      await showAlert({
        icon: "success",
        title: welcomeTitle,
        text: welcomeMsg,
        timer: 800,
        showConfirmButton: false
      });
      window.location.replace("admin.html");
    } else {
      localStorage.setItem(APP_CONFIG.SESSION.AUTH_FLAG, "false");
      await showAlert({
        icon: "success",
        title: "Log Masuk Berjaya",
        text: `Kod Sekolah: ${user.kod_sekolah}`,
        timer: 800,
        showConfirmButton: false
      });
      window.location.replace("user.html");
    }
  } catch (err) {
    await showAlert({
      icon: "error",
      title: "Gagal",
      text: err && err.message ? err.message : "Ralat sistem."
    });
  } finally {
    toggleLoading(false);
    if (btnLogin) {
      btnLogin.disabled = false;
    }
    loginBusy = false;
  }
};