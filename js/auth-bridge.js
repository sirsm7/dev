(function () {
  function getSessionKeys() {
    const cfg =
      typeof window !== "undefined" && window.APP_CONFIG && window.APP_CONFIG.SESSION
        ? window.APP_CONFIG.SESSION
        : null;
    return {
      authFlag: (cfg && cfg.AUTH_FLAG) || "smpid_auth",
      userKod: (cfg && cfg.USER_KOD) || "smpid_user_kod",
      userRole: (cfg && cfg.USER_ROLE) || "smpid_user_role"
    };
  }

  function isValidValue(val) {
    if (!val) {
      return false;
    }
    const normalized = String(val).trim();
    return normalized !== "" && normalized !== "null" && normalized !== "undefined";
  }

  function resolveModuleLoginUrl() {
    const path = window.location.pathname || "";
    if (path.indexOf("/modules/") !== -1) {
      return "../../index.html";
    }
    return "index.html";
  }

  function verifyModuleBridgeSession() {
    const keys = getSessionKeys();

    const localKod = localStorage.getItem(keys.userKod);
    const sessionKod = sessionStorage.getItem(keys.userKod);
    const resolvedKod = isValidValue(localKod)
      ? String(localKod).trim()
      : isValidValue(sessionKod)
        ? String(sessionKod).trim()
        : "";

    const localAuth = localStorage.getItem(keys.authFlag);
    const sessionAuth = sessionStorage.getItem(keys.authFlag);
    const isAdminFlag = localAuth === "true" || sessionAuth === "true";

    const localRole = localStorage.getItem(keys.userRole);
    const sessionRole = sessionStorage.getItem(keys.userRole);
    const resolvedRole = isValidValue(localRole)
      ? String(localRole).trim()
      : isValidValue(sessionRole)
        ? String(sessionRole).trim()
        : "";

    const adminRoles = ["ADMIN", "PPD_UNIT", "SUPER_ADMIN", "JPNMEL"];
    const hasValidAdminSession = isAdminFlag && adminRoles.indexOf(resolvedRole) !== -1;

    if (!resolvedKod && !hasValidAdminSession) {
      window.alert("Sila log masuk melalui Portal NaDIM dahulu.");
      window.location.replace(resolveModuleLoginUrl());
      return false;
    }

    if (resolvedKod) {
      if (!isValidValue(localKod)) {
        localStorage.setItem(keys.userKod, resolvedKod);
      }
      if (!isValidValue(sessionKod)) {
        sessionStorage.setItem(keys.userKod, resolvedKod);
      }
    }

    return true;
  }

  verifyModuleBridgeSession();

  window.addEventListener("pageshow", function (event) {
    const navEntries =
      typeof performance !== "undefined" && typeof performance.getEntriesByType === "function"
        ? performance.getEntriesByType("navigation")
        : [];
    const isBackForward =
      navEntries.length > 0 && navEntries[0] && navEntries[0].type === "back_forward";

    if (event.persisted || isBackForward) {
      verifyModuleBridgeSession();
    }
  });

  window.verifyModuleBridgeSession = verifyModuleBridgeSession;
})();