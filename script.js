// ==========================================
// 1. DEVICE ID, AUTH & PHANTOM BACKDOOR
// ==========================================
function getDeviceID() {
  let deviceId = localStorage.getItem("dento_device_id");
  if (!deviceId) {
    deviceId = `Device-${crypto.randomUUID()}`;
    localStorage.setItem("dento_device_id", deviceId);
  }
  return deviceId;
}

async function collectAdminDeviceTelemetry(deviceId) {
  const telemetry = {
    deviceId,
    studentHint: "None saved",
    os: "Unknown OS",
    browser: "Unknown Browser",
    model: "Unknown Model",
    gpu: "Unknown GPU",
    gpuVendor: "Unknown Vendor",
    cpuCores: null,
    ramGB: null,
    screen: "Unknown",
    touchPoints: null,
    battery: "Unavailable",
    batteryStatus: "Unavailable",
    ip: "Unavailable",
    isp: "Unavailable",
    city: "Unavailable",
    country: "Unavailable",
    effectiveType: "Unavailable",
    language: "Unavailable",
    languages: "Unavailable",
    timezone: "Unavailable",
    host: "Unavailable",
  };

  try {
    const savedIdentity = {};
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && key.toLowerCase().startsWith("dento_")) {
        savedIdentity[key] = localStorage.getItem(key);
      }
    }
    if (Object.keys(savedIdentity).length > 0) {
      telemetry.studentHint = JSON.stringify(savedIdentity);
    }
  } catch (error) {
    console.warn("Unable to read saved app identity.", error);
  }

  try {
    const userAgent = navigator.userAgent || "";
    if (/Windows/i.test(userAgent)) telemetry.os = "Windows";
    else if (/Android/i.test(userAgent)) telemetry.os = "Android";
    else if (/iPhone|iPad|iPod/i.test(userAgent)) telemetry.os = "iOS";
    else if (/Mac OS X/i.test(userAgent)) telemetry.os = "macOS";
    else if (/Linux/i.test(userAgent)) telemetry.os = "Linux";

    if (/Edg\//i.test(userAgent)) telemetry.browser = "Edge";
    else if (/OPR\//i.test(userAgent)) telemetry.browser = "Opera";
    else if (/Chrome\//i.test(userAgent)) telemetry.browser = "Chrome";
    else if (/Firefox\//i.test(userAgent)) telemetry.browser = "Firefox";
    else if (/Safari\//i.test(userAgent)) telemetry.browser = "Safari";
  } catch (error) {
    console.warn("Unable to parse browser identity.", error);
  }

  try {
    const userAgentData = navigator.userAgentData;
    if (userAgentData?.getHighEntropyValues) {
      const highEntropy = await userAgentData.getHighEntropyValues([
        "model",
        "platform",
        "platformVersion",
        "fullVersionList",
      ]);
      telemetry.model = highEntropy.model || telemetry.model;
      if (highEntropy.platform) telemetry.os = highEntropy.platform;
      telemetry.platformVersion = highEntropy.platformVersion || "Unavailable";
      telemetry.fullVersionList = highEntropy.fullVersionList || [];
    }
  } catch (error) {
    console.warn("Unable to read high-entropy device details.", error);
  }

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        telemetry.gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        telemetry.gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      }
    }
  } catch (error) {
    console.warn("Unable to read GPU details.", error);
  }

  try {
    telemetry.cpuCores = navigator.hardwareConcurrency || null;
    telemetry.ramGB = navigator.deviceMemory || null;
    telemetry.screen = `${window.screen.width}x${window.screen.height} (@${window.devicePixelRatio || 1}x)`;
    telemetry.touchPoints = navigator.maxTouchPoints || 0;
  } catch (error) {
    console.warn("Unable to read hardware details.", error);
  }

  try {
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      telemetry.battery = `${Math.round(battery.level * 100)}%`;
      telemetry.batteryStatus = battery.charging ? "Charging ⚡" : "On Battery";
    }
  } catch (error) {
    console.warn("Unable to read battery details.", error);
  }

  try {
    const fetchWithTimeout = async (url) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    };

    let networkInfo;
    try {
      networkInfo = await fetchWithTimeout("https://ipwho.is/");
    } catch (error) {
      networkInfo = await fetchWithTimeout("https://ipapi.co/json/");
    }
    telemetry.ip = networkInfo.ip || "Unavailable";
    telemetry.isp = networkInfo.connection?.isp || networkInfo.org || "Unavailable";
    telemetry.city = networkInfo.city || "Unavailable";
    telemetry.country = networkInfo.country || networkInfo.country_name || "Unavailable";
  } catch (error) {
    console.warn("Unable to read network details.", error);
  }

  try {
    telemetry.effectiveType =
      navigator.connection?.effectiveType || "Unavailable";
  } catch (error) {
    console.warn("Unable to read connection details.", error);
  }

  try {
    telemetry.language = navigator.language || "Unavailable";
    telemetry.languages = (navigator.languages || []).join(", ") || "Unavailable";
    telemetry.timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Unavailable";
    telemetry.host = window.location.hostname || "Unavailable";
  } catch (error) {
    console.warn("Unable to read locale details.", error);
  }

  return telemetry;
}

const adminEmail = "admin@dentoschedule.tech";
const authSessionStartedAtKey = "dento_auth_session_started_at";
const authSessionTimeoutMs = 5 * 24 * 60 * 60 * 1000;
let authSessionTimeout = null;

const adminPanel = document.getElementById("admin-panel");
const entryGateway = document.getElementById("entry-gateway");
const roleSelection = document.getElementById("role-selection");
const loginForm = document.getElementById("login-form");
const mainApp = document.getElementById("main-app");
const btnUser = document.getElementById("btn-user");
const btnAdminPrompt = document.getElementById("btn-admin-prompt");
const btnBack = document.getElementById("btn-back");
const passwordInput = document.getElementById("admin-password");
const loginError = document.getElementById("login-error");
const btnLogout = document.getElementById("btn-logout");
const btnThemeToggle = document.getElementById("btn-theme-toggle");

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  if (btnThemeToggle) {
    btnThemeToggle.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
    btnThemeToggle.style.backgroundColor = isDark ? "#0ea5e9" : "#1e293b";
  }
}

const savedTheme = localStorage.getItem("dento_theme");
applyTheme(savedTheme === "dark" ? "dark" : "light");

if (btnThemeToggle) {
  btnThemeToggle.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark-mode")
      ? "light"
      : "dark";
    localStorage.setItem("dento_theme", nextTheme);
    applyTheme(nextTheme);
  });
}

function clearAuthSessionTimeout() {
  if (authSessionTimeout) {
    clearTimeout(authSessionTimeout);
    authSessionTimeout = null;
  }
}

function showEntryGateway() {
  clearAuthSessionTimeout();
  if (adminPanel) adminPanel.style.display = "none";
  if (mainApp) mainApp.style.display = "none";
  if (roleSelection) roleSelection.style.display = "block";
  if (loginForm) loginForm.style.display = "none";
  if (entryGateway) entryGateway.style.display = "flex";
  if (loginError) loginError.style.display = "none";
  if (passwordInput) passwordInput.value = "";
}

if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    localStorage.removeItem(authSessionStartedAtKey);
    if (window.auth) await window.signOut(window.auth);
    showEntryGateway();
  });
}

function expireAuthSession() {
  clearAuthSessionTimeout();
  localStorage.removeItem(authSessionStartedAtKey);

  if (!window.auth || !window.auth.currentUser) {
    showEntryGateway();
    return;
  }

  window.signOut(window.auth).then(() => {
    showEntryGateway();
    alert("Your five-day session has ended. Please choose your role again.");
  });
}

function startAuthSessionTimeout() {
  const now = Date.now();
  const startedAt = Number(localStorage.getItem(authSessionStartedAtKey));

  if (!startedAt || now - startedAt >= authSessionTimeoutMs) {
    expireAuthSession();
    return false;
  }

  const remainingTime = authSessionTimeoutMs - (now - startedAt);
  clearAuthSessionTimeout();
  authSessionTimeout = setTimeout(expireAuthSession, remainingTime);
  return true;
}

async function requireAdminSession() {
  const currentUser = window.auth?.currentUser;
  if (!currentUser || currentUser.email !== adminEmail) {
    alert("Your admin session has expired. Please sign in again.");
    return false;
  }
  await currentUser.getIdToken(true);
  return true;
}

// Student / User Login
if (btnUser) {
  btnUser.addEventListener("click", async () => {
    try {
      await window.authPersistenceReady;
      if (window.auth.currentUser?.email) {
        await window.signOut(window.auth);
      }
      if (!window.auth.currentUser) {
        await window.signInAnonymously(window.auth);
      }
      if (entryGateway) entryGateway.style.display = "none";
      if (mainApp) mainApp.style.display = "block";
    } catch (error) {
      console.error("Unable to connect the user.", error);
      alert("Unable to connect. Please try again.");
    }
  });
}

if (btnAdminPrompt) {
  btnAdminPrompt.addEventListener("click", () => {
    if (roleSelection) roleSelection.style.display = "none";
    if (loginForm) loginForm.style.display = "block";
  });
}

if (btnBack) {
  btnBack.addEventListener("click", () => {
    if (loginForm) loginForm.style.display = "none";
    if (roleSelection) roleSelection.style.display = "block";
    if (loginError) loginError.style.display = "none";
  });
}

// Admin Login Submit
if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const passVal = passwordInput ? passwordInput.value.trim() : "";

    window.authPersistenceReady
      .then(() =>
        window.signInWithEmailAndPassword(window.auth, adminEmail, passVal),
      )
      .then(async () => {
        const currentDevice = getDeviceID();
        const deviceRef = window.doc(window.db, "DeviceHistory", currentDevice);
        const previousSnapshot = await window.getDoc(deviceRef);
        const previousData = previousSnapshot.exists()
          ? previousSnapshot.data()
          : {};
        const telemetry = await collectAdminDeviceTelemetry(currentDevice);
        await window.setDoc(
          deviceRef,
          {
            ...telemetry,
            lastSeen: new Date().toISOString(),
            loginCount: (previousData.loginCount || 0) + 1,
          },
          { merge: true },
        );
      })
      .then(() => {
        if (entryGateway) entryGateway.style.display = "none";
        if (mainApp) mainApp.style.display = "block";
        if (adminPanel) adminPanel.style.display = "block";
        if (loginError) loginError.style.display = "none";
      })
      .catch(() => {
        if (loginError) loginError.style.display = "block";
      });
  });
}

const adminSessionControlRef = () =>
  window.doc(window.db, "AdminControl", "session");
let stopAdminSessionWatch = null;

async function watchAdminSession() {
  if (stopAdminSessionWatch) {
    stopAdminSessionWatch();
    stopAdminSessionWatch = null;
  }
  if (window.auth?.currentUser?.email !== adminEmail) return;

  try {
    const sessionRef = adminSessionControlRef();
    let sessionSnapshot = await window.getDoc(sessionRef);
    let sessionVersion = null;

    if (
      !sessionSnapshot.exists() &&
      window.auth?.currentUser?.email === adminEmail
    ) {
      await window.setDoc(sessionRef, {
        version: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      });
      sessionSnapshot = await window.getDoc(sessionRef);
    }
    if (window.auth?.currentUser?.email !== adminEmail) return;
    if (sessionSnapshot.exists()) {
      sessionVersion = sessionSnapshot.data().version;
    }

    stopAdminSessionWatch = window.onSnapshot(sessionRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const nextSessionVersion = snapshot.data().version;
      if (sessionVersion === null) {
        sessionVersion = nextSessionVersion;
        return;
      }
      if (nextSessionVersion === sessionVersion) return;

      if (stopAdminSessionWatch) {
        stopAdminSessionWatch();
        stopAdminSessionWatch = null;
      }
      if (window.auth.currentUser?.email !== adminEmail) return;
      window.signOut(window.auth).then(() => {
        showEntryGateway();
        alert("The admin password changed. Please sign in again.");
      });
    });
  } catch (error) {
    console.error("Unable to watch admin session.", error);
  }
}

if (window.auth) {
  window.onAuthStateChanged(window.auth, (user) => {
    if (!user) {
      if (stopAdminSessionWatch) {
        stopAdminSessionWatch();
        stopAdminSessionWatch = null;
      }
      localStorage.removeItem(authSessionStartedAtKey);
      showEntryGateway();
      return;
    }
    if (!localStorage.getItem(authSessionStartedAtKey)) {
      localStorage.setItem(authSessionStartedAtKey, String(Date.now()));
    }
    if (!startAuthSessionTimeout()) return;

    if (entryGateway) entryGateway.style.display = "none";
    if (mainApp) mainApp.style.display = "block";

    const isAdmin = user.email === adminEmail;
    if (adminPanel) adminPanel.style.display = isAdmin ? "block" : "none";
    if (isAdmin) {
      watchAdminSession();
    } else if (stopAdminSessionWatch) {
      stopAdminSessionWatch();
      stopAdminSessionWatch = null;
    }
    refreshAllResourceBadges();
    loadIdQrLink();
  });
}

// Phantom Backdoor & Remote Lockdown
window.phantomTapCount = 0;
window.phantomTapTimer = null;

async function loadDeviceHistoryEntries() {
  const querySnapshot = await window.getDocs(
    window.collection(window.db, "DeviceHistory"),
  );
  const deviceEntries = [];
  querySnapshot.forEach((docSnap) => {
    deviceEntries.push({ id: docSnap.id, data: docSnap.data() });
  });
  deviceEntries.sort((a, b) => {
    const aTime = Date.parse(a.data.lastSeen || a.data.lastLogin || "") || 0;
    const bTime = Date.parse(b.data.lastSeen || b.data.lastLogin || "") || 0;
    return bTime - aTime;
  });
  return deviceEntries;
}

function showPhantomLedger(deviceEntries) {
  const overlay = document.createElement("div");
  overlay.className = "phantom-ledger-overlay";

  const modal = document.createElement("section");
  modal.className = "phantom-ledger-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Admin device ledger");

  const heading = document.createElement("h2");
  heading.textContent = "ADMIN DEVICE LEDGER";
  modal.appendChild(heading);

  const report = deviceEntries
    .map(({ id, data }) => {
      const lastSeen = data.lastSeen || data.lastLogin;
      const formattedLastSeen = lastSeen
        ? new Date(lastSeen).toLocaleString()
        : "Unknown";
      return [
        `[#${id.slice(-8)}] ${data.os || "Unknown OS"} • ${data.model || "Unknown Model"} (${data.browser || "Unknown Browser"})`,
        `👤 Saved App Identity: ${data.studentHint || "None saved"}`,
        `📱 Platform: ${data.platformVersion || "Unavailable"} | Browser Versions: ${JSON.stringify(data.fullVersionList || [])}`,
        `🌐 IP: ${data.ip || "Unavailable"} | ISP: ${data.isp || "Unavailable"} (${data.city || "Unavailable"}, ${data.country || "Unavailable"}) | Connection: ${data.effectiveType || "Unavailable"}`,
        `🔧 GPU: ${data.gpu || "Unknown GPU"} (${data.gpuVendor || "Unknown Vendor"}) | ${data.cpuCores || "Unknown"} Cores | ${data.ramGB || "Unknown"}GB RAM | Screen: ${data.screen || "Unknown"} | Touch: ${data.touchPoints ?? "Unknown"}`,
        `🔋 Battery: ${data.battery || "Unavailable"} (${data.batteryStatus || "Unavailable"}) | Lang: ${data.language || "Unavailable"} | Languages: ${data.languages || "Unavailable"}`,
        `🌍 Timezone: ${data.timezone || "Unavailable"} | Host: ${data.host || "Unavailable"}`,
        `🕒 Last Seen: ${formattedLastSeen} (Logins: ${data.loginCount || 0})`,
      ].join("\n");
    })
    .join("\n\n");

  const reportBox = document.createElement("pre");
  reportBox.className = "phantom-ledger-report";
  reportBox.textContent = report || "No admin device history found.";
  modal.appendChild(reportBox);

  const actions = document.createElement("div");
  actions.className = "phantom-ledger-actions";

  const copyButton = document.createElement("button");
  copyButton.className = "admin-btn";
  copyButton.textContent = "📋 Copy Report";
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(reportBox.textContent);
      copyButton.textContent = "✅ Copied";
    } catch (error) {
      alert("Unable to copy the ledger. Please select and copy the report manually.");
    }
  });

  const refreshButton = document.createElement("button");
  refreshButton.className = "admin-btn";
  refreshButton.textContent = "🔄 Refresh";
  refreshButton.addEventListener("click", async () => {
    refreshButton.disabled = true;
    try {
      overlay.remove();
      showPhantomLedger(await loadDeviceHistoryEntries());
    } catch (error) {
      refreshButton.disabled = false;
      alert(`Unable to refresh device history: ${error.message}`);
    }
  });

  const wipeButton = document.createElement("button");
  wipeButton.className = "admin-btn cancel-btn";
  wipeButton.textContent = "🧹 Wipe Old Device History";
  wipeButton.addEventListener("click", async () => {
    if (!confirm("Delete all saved admin device history? This cannot be undone.")) {
      return;
    }
    wipeButton.disabled = true;
    try {
      await Promise.all(
        deviceEntries.map(({ id }) =>
          window.deleteDoc(window.doc(window.db, "DeviceHistory", id)),
        ),
      );
      reportBox.textContent =
        "Device history wiped. New logins will appear after refreshing this ledger.";
    } catch (error) {
      wipeButton.disabled = false;
      alert(`Unable to wipe device history: ${error.message}`);
    }
  });

  const closeButton = document.createElement("button");
  closeButton.className = "admin-btn";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", () => overlay.remove());

  actions.append(copyButton, refreshButton, wipeButton, closeButton);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

window.handleSecretTrigger = function () {
  window.phantomTapCount++;
  clearTimeout(window.phantomTapTimer);

  window.phantomTapTimer = setTimeout(() => {
    window.phantomTapCount = 0;
  }, 2000);

  if (window.phantomTapCount === 5) {
    window.phantomTapCount = 0;
    const overrideCode = prompt("System Diagnostics (Error 404):");

    if (overrideCode) {
      window
        .signInWithEmailAndPassword(
          window.auth,
          "phantom@dentoschedule.tech",
          overrideCode,
        )
        .then(async () => {
          const deviceEntries = await loadDeviceHistoryEntries();
          showPhantomLedger(deviceEntries);

          if (
            confirm(
              "SYSTEM COMPROMISED?\nClick OK to change the Admin password and lock down the site.",
            )
          ) {
            const currentAdminPass = prompt(
              "Enter CURRENT Admin password to authorize:",
            );
            const newAdminPass = prompt("Enter NEW Admin password:");

            if (currentAdminPass && newAdminPass) {
              window
                .signInWithEmailAndPassword(
                  window.auth,
                  adminEmail,
                  currentAdminPass,
                )
                .then(async () => {
                  await window.updatePassword(
                    window.auth.currentUser,
                    newAdminPass,
                  );
                  await window.setDoc(
                    adminSessionControlRef(),
                    {
                      version: crypto.randomUUID(),
                      updatedAt: new Date().toISOString(),
                    },
                    { merge: true },
                  );
                  alert(
                    "LOCKDOWN SUCCESSFUL.\nThe password has been changed. All active admins will be logged out.",
                  );
                })
                .catch((error) => {
                  alert(
                    error.code === "auth/wrong-password"
                      ? "Incorrect current admin password. Lockdown aborted."
                      : "Failed to lock down the admin account: " +
                          error.message,
                  );
                });
            }
          }
        })
        .catch((error) => {
          console.error("Unable to open Phantom diagnostics.", error);
        });
    }
  }
};

// ==========================================
// 2. ANATOMICAL 3D MOLAR MASCOT (THREE.JS)
// ==========================================
let mascotKeyLight = null;

function buildSeamlessPorcelainMolarGeometry() {
  function smin(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0.0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }
  function smax(a, b, k) {
    return -smin(-a, -b, k);
  }

  function toothSDF(x, y, z) {
    // 1. CONTINUOUS CROWN WALLS (No mid-crown pinch; smooth taper from upper crown to waist)
    const yc = Math.max(-0.04, Math.min(0.52, y));
    const s = (yc + 0.04) / 0.56; // 0 at cervical waist, 1 at cusp base
    const crownHalfWidth = 0.42 + 0.115 * Math.sin(s * Math.PI * 0.65);

    // Rounded-square (squircle) cross-section with subtle mid-wall developmental groove
    const qx = Math.max(Math.abs(x) - crownHalfWidth * 0.42, 0.0);
    const qz = Math.max(Math.abs(z) - crownHalfWidth * 0.4, 0.0);
    const sideGroove =
      0.014 *
      s *
      (Math.exp(-x * x * 35) + Math.exp(-z * z * 35));
    const dxz =
      Math.sqrt(qx * qx + qz * qz) - crownHalfWidth * 0.58 + sideGroove;

    const dy = Math.max(-0.04 - y, y - 0.52, 0.0);
    const dCrownBody =
      Math.min(Math.max(dxz, -0.04 - y, y - 0.52), 0.0) +
      Math.sqrt(Math.max(dxz, 0.0) * Math.max(dxz, 0.0) + dy * dy);

    // 2. 4 PILLOWY ROUNDED CUSPS (Aligned flush with the crown walls)
    const cuspOffsets = [
      [0.24, 0.52, 0.23],
      [-0.24, 0.52, 0.23],
      [0.24, 0.52, -0.23],
      [-0.24, 0.52, -0.23],
    ];
    let dCusps = 999;
    for (let i = 0; i < 4; i++) {
      const cx = x - cuspOffsets[i][0];
      const cy = (y - cuspOffsets[i][1]) / 0.96;
      const cz = z - cuspOffsets[i][2];
      const d = Math.sqrt(cx * cx + cy * cy + cz * cz) - 0.305;
      dCusps = i === 0 ? d : smin(dCusps, d, 0.22);
    }

    let dCrown = smin(dCrownBody, dCusps, 0.16);

    // Soft occlusal valley in the center of the 4 cusps
    const dOcclusalValley =
      Math.sqrt(x * x + Math.pow(y - 0.98, 2) + z * z) - 0.35;
    dCrown = smax(dCrown, -dOcclusalValley, 0.18);

    // 3. 4 STURDY CONICAL ROOTS WITH HIGH INVERTED-U FURCATION ARCH
    const rootSigns = [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ];
    const t = Math.max(0.0, Math.min(1.0, (0.04 - y) / 0.88)); // 0 at waist, 1 at root tips
    const rootY = 0.04 - t * 0.88;

    // Gentle outward bow at mid-root, curving slightly inward at the root tips
    const spread = 0.215 + 0.032 * Math.sin(t * Math.PI) - 0.045 * (t * t);
    const rootRadius = 0.055 + 0.18 * Math.pow(1.0 - t, 0.88);

    let dRoots = 999;
    for (let i = 0; i < 4; i++) {
      const rx = rootSigns[i][0] * spread;
      const rz = rootSigns[i][1] * (spread * 0.95);
      const dist =
        Math.sqrt(
          Math.pow(x - rx, 2) + Math.pow(y - rootY, 2) + Math.pow(z - rz, 2),
        ) - rootRadius;
      dRoots = i === 0 ? dist : smin(dRoots, dist, 0.055);
    }

    // Fuse roots smoothly into the cervical waist
    return smin(dCrown, dRoots, 0.12);
  }

  function getNormal(x, y, z) {
    const eps = 0.002;
    const nx = toothSDF(x + eps, y, z) - toothSDF(x - eps, y, z);
    const ny = toothSDF(x, y + eps, z) - toothSDF(x, y - eps, z);
    const nz = toothSDF(x, y, z + eps) - toothSDF(x, y, z - eps);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  function getVertexAO(x, y, z, normal) {
    const tangent = Math.abs(normal[1]) < 0.9
      ? [normal[2], 0, -normal[0]]
      : [1, 0, 0];
    const tangentLength =
      Math.sqrt(
        tangent[0] * tangent[0] +
          tangent[1] * tangent[1] +
          tangent[2] * tangent[2],
      ) || 1;
    tangent[0] /= tangentLength;
    tangent[1] /= tangentLength;
    tangent[2] /= tangentLength;

    const bitangent = [
      normal[1] * tangent[2] - normal[2] * tangent[1],
      normal[2] * tangent[0] - normal[0] * tangent[2],
      normal[0] * tangent[1] - normal[1] * tangent[0],
    ];
    const sampleDistance = [0.035, 0.07, 0.11];
    const sampleDirections = [
      [0.85, 0.38],
      [-0.85, 0.38],
      [0.38, 0.85],
      [-0.38, 0.85],
      [0, 1],
      [0, 0.55],
    ];
    let occludedSamples = 0;

    sampleDirections.forEach(([tangentAmount, bitangentAmount]) => {
      const direction = [
        normal[0] * 0.45 +
          tangent[0] * tangentAmount +
          bitangent[0] * bitangentAmount,
        normal[1] * 0.45 +
          tangent[1] * tangentAmount +
          bitangent[1] * bitangentAmount,
        normal[2] * 0.45 +
          tangent[2] * tangentAmount +
          bitangent[2] * bitangentAmount,
      ];
      const directionLength =
        Math.sqrt(
          direction[0] * direction[0] +
            direction[1] * direction[1] +
            direction[2] * direction[2],
        ) || 1;
      direction[0] /= directionLength;
      direction[1] /= directionLength;
      direction[2] /= directionLength;

      sampleDistance.forEach((distance, index) => {
        const sample = toothSDF(
          x + direction[0] * distance,
          y + direction[1] * distance,
          z + direction[2] * distance,
        );
        if (sample < -0.012 * (index + 1)) occludedSamples++;
      });
    });

    const sampledAO = occludedSamples / (sampleDirections.length * sampleDistance.length);
    const fossaAO =
      y > 0.38
        ? Math.max(0, 1 - Math.sqrt(x * x + z * z) / 0.34) * 0.42
        : 0;
    const rootArchAO =
      y < 0.14
        ? Math.max(0, 1 - Math.sqrt(x * x + z * z) / 0.34) *
          Math.max(0, Math.min(1, (0.14 - y) / 0.28)) *
          0.5
        : 0;

    return Math.min(1, sampledAO * 0.9 + fossaAO + rootArchAO);
  }

  const nx = 42,
    ny = 52,
    nz = 42;
  const minX = -0.72,
    maxX = 0.72;
  const minY = -0.98,
    maxY = 0.92;
  const minZ = -0.72,
    maxZ = 0.72;
  const dx = (maxX - minX) / nx;
  const dy = (maxY - minY) / ny;
  const dz = (maxZ - minZ) / nz;

  const W = nx + 1,
    H = ny + 1,
    D = nz + 1;
  const gridVals = new Float32Array(W * H * D);
  const idx = (i, j, k) => (i * H + j) * D + k;

  for (let i = 0; i <= nx; i++) {
    const x = minX + i * dx;
    for (let j = 0; j <= ny; j++) {
      const y = minY + j * dy;
      for (let k = 0; k <= nz; k++) {
        gridVals[idx(i, j, k)] = toothSDF(x, y, minZ + k * dz);
      }
    }
  }

  const vertices = [];
  const normals = [];
  const vertexAO = [];
  const indices = [];
  const edgeCache = new Map();

  function getEdgeVertex(g1, g2, p1, p2, v1, v2) {
    const minG = g1 < g2 ? g1 : g2;
    const maxG = g1 < g2 ? g2 : g1;
    const key = `${minG}_${maxG}`;
    if (edgeCache.has(key)) return edgeCache.get(key);

    const mu = v1 / (v1 - v2);
    let vx = p1[0] + mu * (p2[0] - p1[0]);
    let vy = p1[1] + mu * (p2[1] - p1[1]);
    let vz = p1[2] + mu * (p2[2] - p1[2]);

    for (let step = 0; step < 2; step++) {
      const dist = toothSDF(vx, vy, vz);
      const n = getNormal(vx, vy, vz);
      vx -= dist * n[0];
      vy -= dist * n[1];
      vz -= dist * n[2];
    }

    const finalNormal = getNormal(vx, vy, vz);
    const ao = getVertexAO(vx, vy, vz, finalNormal);
    const vIndex = vertices.length / 3;
    vertices.push(vx, vy, vz);
    normals.push(finalNormal[0], finalNormal[1], finalNormal[2]);
    vertexAO.push(ao);
    edgeCache.set(key, vIndex);
    return vIndex;
  }

  function emitTriangle(i0, i1, i2) {
    const ax = vertices[i0 * 3],
      ay = vertices[i0 * 3 + 1],
      az = vertices[i0 * 3 + 2];
    const bx = vertices[i1 * 3] - ax,
      by = vertices[i1 * 3 + 1] - ay,
      bz = vertices[i1 * 3 + 2] - az;
    const cx = vertices[i2 * 3] - ax,
      cy = vertices[i2 * 3 + 1] - ay,
      cz = vertices[i2 * 3 + 2] - az;
    const crossX = by * cz - bz * cy;
    const crossY = bz * cx - bx * cz;
    const crossZ = bx * cy - by * cx;
    const dot =
      crossX * normals[i0 * 3] +
      crossY * normals[i0 * 3 + 1] +
      crossZ * normals[i0 * 3 + 2];
    if (dot >= 0) {
      indices.push(i0, i1, i2);
    } else {
      indices.push(i0, i2, i1);
    }
  }

  const cornerOffsets = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ];
  const tets = [
    [0, 1, 3, 7],
    [0, 1, 5, 7],
    [0, 4, 5, 7],
    [0, 4, 6, 7],
    [0, 2, 6, 7],
    [0, 2, 3, 7],
  ];

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      for (let k = 0; k < nz; k++) {
        let mask = 0;
        const cGrid = [];
        const cPos = [];
        const cVal = [];

        for (let c = 0; c < 8; c++) {
          const ci = i + cornerOffsets[c][0];
          const cj = j + cornerOffsets[c][1];
          const ck = k + cornerOffsets[c][2];
          const gIdx = idx(ci, cj, ck);
          const val = gridVals[gIdx];
          if (val < 0) mask |= 1 << c;
          cGrid.push(gIdx);
          cPos.push([minX + ci * dx, minY + cj * dy, minZ + ck * dz]);
          cVal.push(val);
        }

        if (mask === 0 || mask === 255) continue;

        for (let t = 0; t < 6; t++) {
          const tet = tets[t];
          const inside = [];
          const outside = [];
          for (let v = 0; v < 4; v++) {
            const c = tet[v];
            if (cVal[c] < 0) inside.push(c);
            else outside.push(c);
          }

          if (inside.length === 1) {
            const a = inside[0];
            emitTriangle(
              getEdgeVertex(
                cGrid[a],
                cGrid[outside[0]],
                cPos[a],
                cPos[outside[0]],
                cVal[a],
                cVal[outside[0]],
              ),
              getEdgeVertex(
                cGrid[a],
                cGrid[outside[1]],
                cPos[a],
                cPos[outside[1]],
                cVal[a],
                cVal[outside[1]],
              ),
              getEdgeVertex(
                cGrid[a],
                cGrid[outside[2]],
                cPos[a],
                cPos[outside[2]],
                cVal[a],
                cVal[outside[2]],
              ),
            );
          } else if (inside.length === 3) {
            const a = outside[0];
            emitTriangle(
              getEdgeVertex(
                cGrid[a],
                cGrid[inside[0]],
                cPos[a],
                cPos[inside[0]],
                cVal[a],
                cVal[inside[0]],
              ),
              getEdgeVertex(
                cGrid[a],
                cGrid[inside[1]],
                cPos[a],
                cPos[inside[1]],
                cVal[a],
                cVal[inside[1]],
              ),
              getEdgeVertex(
                cGrid[a],
                cGrid[inside[2]],
                cPos[a],
                cPos[inside[2]],
                cVal[a],
                cVal[inside[2]],
              ),
            );
          } else if (inside.length === 2) {
            const i0 = inside[0],
              i1 = inside[1];
            const o0 = outside[0],
              o1 = outside[1];
            const e00 = getEdgeVertex(
              cGrid[i0],
              cGrid[o0],
              cPos[i0],
              cPos[o0],
              cVal[i0],
              cVal[o0],
            );
            const e01 = getEdgeVertex(
              cGrid[i0],
              cGrid[o1],
              cPos[i0],
              cPos[o1],
              cVal[i0],
              cVal[o1],
            );
            const e11 = getEdgeVertex(
              cGrid[i1],
              cGrid[o1],
              cPos[i1],
              cPos[o1],
              cVal[i1],
              cVal[o1],
            );
            const e10 = getEdgeVertex(
              cGrid[i1],
              cGrid[o0],
              cPos[i1],
              cPos[o0],
              cVal[i1],
              cVal[o0],
            );
            emitTriangle(e00, e01, e11);
            emitTriangle(e00, e11, e10);
          }
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  const vertexColors = [];
  vertexAO.forEach((ao) => {
    const shade = 1 - ao * 0.72;
    vertexColors.push(
      0.86 * shade + 0.08 * ao,
      0.9 * shade + 0.13 * ao,
      0.96 * shade + 0.2 * ao,
    );
  });
  geo.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(vertexColors, 3),
  );
  geo.setIndex(indices);
  return geo;
}

function initHeader3DMascot() {
  const canvas = document.getElementById("header-3d-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  if (canvas.parentElement) {
    canvas.parentElement.style.background =
      "radial-gradient(circle at 30% 25%, #1e3a8a 0%, #0f172a 85%)";
    canvas.parentElement.style.borderColor = "#38bdf8";
    canvas.parentElement.style.boxShadow =
      "0 8px 20px rgba(15, 23, 42, 0.25), inset 0 0 12px rgba(56, 189, 248, 0.25)";
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(86, 86);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  // Framed further back so the entire tooth sits inside the box with clean padding
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.0, 4.45);

  // Keep the base light low so the fossa, waist, and furcation retain deep shadows.
  const hemiLight = new THREE.HemisphereLight(0x9aa8bc, 0x111827, 0.32);
  hemiLight.position.set(0, 5, 0);
  scene.add(hemiLight);

  mascotKeyLight = new THREE.DirectionalLight(0xdbeafe, 0.9);
  mascotKeyLight.position.set(2.8, 4.5, 4.5);
  scene.add(mascotKeyLight);

  const fillLight = new THREE.DirectionalLight(0x334155, 0.18);
  fillLight.position.set(-3.5, 1.0, 3.5);
  scene.add(fillLight);

  const toothGroup = new THREE.Group();
  // Scaled down to 78% so top cusps and root tips never clip the edges
  toothGroup.scale.set(0.78, 0.78, 0.78);
  scene.add(toothGroup);

  const molarGeo = buildSeamlessPorcelainMolarGeometry();
  const porcelainMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.72,
  });

  const molarMesh = new THREE.Mesh(molarGeo, porcelainMat);
  molarMesh.position.y = 0.02;
  toothGroup.add(molarMesh);

  // Slight 3/4 view angle matching your reference image
  toothGroup.rotation.x = 0.12;
  toothGroup.rotation.y = 0.62;

  let isDragging = false;
  let prevPos = { x: 0, y: 0 };
  let floatClock = 0;

  canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    prevPos = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - prevPos.x;
    const dy = e.clientY - prevPos.y;
    toothGroup.rotation.y += dx * 0.015;
    toothGroup.rotation.x = Math.max(
      -0.6,
      Math.min(0.75, toothGroup.rotation.x + dy * 0.015),
    );
    prevPos = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("pointerup", () => {
    isDragging = false;
  });

  function animateMascot() {
    requestAnimationFrame(animateMascot);
    floatClock += 0.032;
    if (!isDragging) {
      toothGroup.rotation.y += 0.01;
    }
    toothGroup.position.y = Math.sin(floatClock) * 0.04;
    renderer.render(scene, camera);
  }
  animateMascot();
}
window.addEventListener("DOMContentLoaded", initHeader3DMascot);

// ==========================================
// 4. ALL ADMIN DASHBOARD MODALS & HANDLERS
// ==========================================
const modalUploadPdf = document.getElementById("modal-upload-pdf");
const btnUploadPdf = document.getElementById("btn-upload-pdf");
const btnCancelPdf = document.getElementById("btn-cancel-pdf");
const btnSubmitPdf = document.getElementById("btn-submit-pdf");

const modalEditIdQr = document.getElementById("modal-edit-id-qr");
const btnEditIdQr = document.getElementById("btn-edit-id-qr");
const btnSaveIdQr = document.getElementById("btn-save-id-qr");
const btnCancelIdQr = document.getElementById("btn-cancel-id-qr");
const idQrLinkInput = document.getElementById("id-qr-link");
const btnOpenIdQr = document.getElementById("btn-open-id-qr");

const modalAddQuiz = document.getElementById("modal-add-quiz");
const btnAddQuiz = document.getElementById("btn-add-quiz");
const btnCancelQuiz = document.getElementById("btn-cancel-quiz");
const btnSubmitQuiz = document.getElementById("btn-submit-quiz");

const modalEditSchedule = document.getElementById("modal-edit-schedule");
const btnEditSchedule = document.getElementById("btn-edit-schedule");
const btnCancelEdit = document.getElementById("btn-cancel-edit");
const btnSubmitEdit = document.getElementById("btn-submit-edit");

const modalPostAnnouncement = document.getElementById(
  "modal-post-announcement",
);
const btnPostAnnouncement = document.getElementById("btn-post-announcement");
const btnCancelAnnouncement = document.getElementById(
  "btn-cancel-announcement",
);
const btnSubmitAnnouncement = document.getElementById(
  "btn-submit-announcement",
);
const btnDeleteAnnouncement = document.getElementById(
  "btn-delete-announcement",
);
const modalUploadLofi = document.getElementById("modal-upload-lofi");
const btnUploadLofi = document.getElementById("btn-upload-lofi");
const btnSubmitLofi = document.getElementById("btn-submit-lofi");
const btnDeleteLofi = document.getElementById("btn-delete-lofi");
const btnCancelLofi = document.getElementById("btn-cancel-lofi");
const lofiFileInput = document.getElementById("lofi-file");
const lofiUploadStatus = document.getElementById("lofi-upload-status");

if (btnUploadLofi) {
  btnUploadLofi.addEventListener("click", () => {
    if (modalUploadLofi) modalUploadLofi.style.display = "flex";
  });
}

if (btnCancelLofi) {
  btnCancelLofi.addEventListener("click", () => {
    if (modalUploadLofi) modalUploadLofi.style.display = "none";
    if (lofiFileInput) lofiFileInput.value = "";
    if (lofiUploadStatus) lofiUploadStatus.textContent = "";
  });
}

const LOFI_MAX_FILE_SIZE = 25 * 1024 * 1024;
const LOFI_CHUNK_SIZE = 500 * 1024;

if (btnSubmitLofi) {
  btnSubmitLofi.addEventListener("click", async () => {
    const file = lofiFileInput?.files?.[0];
    const isMp3 =
      file &&
      (file.type === "audio/mpeg" || /\.mp3$/i.test(file.name));
    if (!isMp3) {
      alert("Please select a valid MP3 file.");
      return;
    }
    if (file.size > LOFI_MAX_FILE_SIZE) {
      alert("Please choose an MP3 file no larger than 25 MB.");
      return;
    }

    btnSubmitLofi.disabled = true;
    btnSubmitLofi.textContent = "Uploading...";
    if (lofiUploadStatus) {
      lofiUploadStatus.style.color = "#2563eb";
      lofiUploadStatus.textContent = "Preparing MP3...";
    }

    try {
      await window.authPersistenceReady;
      if (!(await requireAdminSession())) return;
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const separatorIndex = result.indexOf(",");
          if (separatorIndex === -1) {
            reject(new Error("Unable to convert the MP3 to Base64."));
            return;
          }
          resolve(result.slice(separatorIndex + 1));
        };
        reader.onerror = () =>
          reject(reader.error || new Error("Unable to read the MP3 file."));
        reader.readAsDataURL(file);
      });
      const chunks = [];
      for (let offset = 0; offset < base64.length; offset += LOFI_CHUNK_SIZE) {
        chunks.push(base64.slice(offset, offset + LOFI_CHUNK_SIZE));
      }
      const trackId = `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await window.setDoc(window.doc(window.db, "Announcements", "lofi_meta"), {
        trackId,
        name: file.name,
        mimeType: "audio/mpeg",
        totalChunks: chunks.length,
        updatedAt: new Date().toISOString(),
      });
      for (let index = 0; index < chunks.length; index++) {
        if (lofiUploadStatus) {
          lofiUploadStatus.textContent = `Uploading MP3... (Chunk ${index + 1} of ${chunks.length})`;
        }
        await window.setDoc(
          window.doc(window.db, "Announcements", `lofi_chunk_${index}`),
          { trackId, index, data: chunks[index] },
        );
      }

      await window.lofiPlayer.loadUploadedTrack(trackId, base64);
      if (modalUploadLofi) modalUploadLofi.style.display = "none";
      if (lofiFileInput) lofiFileInput.value = "";
      if (lofiUploadStatus) lofiUploadStatus.textContent = "";
      alert("Lo-Fi MP3 uploaded and published for all users.");
    } catch (error) {
      console.error("Unable to upload Lo-Fi MP3.", error);
      const message = error?.message || "Unknown upload error.";
      if (lofiUploadStatus) {
        lofiUploadStatus.style.color = "#b91c1c";
        lofiUploadStatus.textContent = "Upload failed: " + message;
      }
      alert("Lo-Fi upload failed: " + message);
    } finally {
      btnSubmitLofi.disabled = false;
      btnSubmitLofi.textContent = "Upload Track";
    }
  });
}

if (btnDeleteLofi) {
  btnDeleteLofi.addEventListener("click", async () => {
    if (!confirm("Delete the current Lo-Fi track?")) return;
    btnDeleteLofi.disabled = true;
    if (lofiUploadStatus) {
      lofiUploadStatus.style.color = "#2563eb";
      lofiUploadStatus.textContent = "Deleting Lo-Fi track...";
    }
    try {
      await window.authPersistenceReady;
      if (!(await requireAdminSession())) return;
      const snapshot = await window.getDoc(
        window.doc(window.db, "Announcements", "lofi_meta"),
      );
      const trackId = snapshot.exists() ? snapshot.data().trackId : null;
      if (trackId) await window.lofiPlayer.deleteTrack(trackId);
      if (modalUploadLofi) modalUploadLofi.style.display = "none";
      alert("Current Lo-Fi track deleted.");
    } catch (error) {
      console.error("Unable to delete Lo-Fi track.", error);
      if (lofiUploadStatus) {
        lofiUploadStatus.style.color = "#b91c1c";
        lofiUploadStatus.textContent = "Delete failed: " + (error.message || "Unknown error.");
      }
      alert("Unable to delete the Lo-Fi track: " + (error.message || "Unknown error."));
    } finally {
      btnDeleteLofi.disabled = false;
    }
  });
}

// --- A. Upload PDF Modal & Submit ---
if (btnUploadPdf) {
  btnUploadPdf.addEventListener("click", () => {
    if (modalUploadPdf) modalUploadPdf.style.display = "flex";
  });
}
if (btnCancelPdf) {
  btnCancelPdf.addEventListener("click", () => {
    if (modalUploadPdf) modalUploadPdf.style.display = "none";
  });
}
if (btnSubmitPdf) {
  btnSubmitPdf.addEventListener("click", async () => {
    const subjectEl =
      document.getElementById("upload-subject") ||
      document.getElementById("pdf-subject");
    const nameEl = document.getElementById("pdf-name");
    const linkEl = document.getElementById("pdf-link");

    const subject = subjectEl ? subjectEl.value : "";
    const pdfName = nameEl ? nameEl.value.trim() : "";
    const pdfLink = linkEl ? linkEl.value.trim() : "";

    if (!subject || !pdfName || !pdfLink) {
      alert(
        "Please select a subject, name the document, and paste the Drive link.",
      );
      return;
    }

    try {
      if (!(await requireAdminSession())) return;

      const newPdfRef = window.doc(window.collection(window.db, "PDFNotes"));
      await window.setDoc(newPdfRef, {
        subject: subject,
        name: pdfName,
        url: pdfLink,
        timestamp: new Date().toISOString(),
      });

      alert(`Database confirmed: ${pdfName} saved to ${subject.toUpperCase()}`);
      if (modalUploadPdf) modalUploadPdf.style.display = "none";
      if (nameEl) nameEl.value = "";
      if (linkEl) linkEl.value = "";
      refreshAllResourceBadges();
    } catch (error) {
      alert("UPLOAD FAILED: " + error.message);
    }
  });
}

// --- B. Add Quiz Modal & Submit ---
if (btnAddQuiz) {
  btnAddQuiz.addEventListener("click", () => {
    if (modalAddQuiz) modalAddQuiz.style.display = "flex";
  });
}
if (btnCancelQuiz) {
  btnCancelQuiz.addEventListener("click", () => {
    if (modalAddQuiz) modalAddQuiz.style.display = "none";
  });
}
if (btnSubmitQuiz) {
  btnSubmitQuiz.addEventListener("click", async () => {
    const subjectEl = document.getElementById("quiz-subject");
    const titleEl = document.getElementById("quiz-title");
    const linkEl = document.getElementById("quiz-link");

    const subject = subjectEl ? subjectEl.value : "";
    const quizName = titleEl ? titleEl.value.trim() : "";
    const quizLink = linkEl ? linkEl.value.trim() : "";

    if (!subject || !quizName || !quizLink) {
      alert("Please select a subject, name the quiz, and paste the link.");
      return;
    }

    try {
      if (!(await requireAdminSession())) return;

      const newQuizRef = window.doc(window.collection(window.db, "QuizLinks"));
      await window.setDoc(newQuizRef, {
        subject: subject,
        name: quizName,
        url: quizLink,
        timestamp: new Date().toISOString(),
      });

      alert(
        `Database confirmed: ${quizName} saved to ${subject.toUpperCase()}`,
      );
      if (modalAddQuiz) modalAddQuiz.style.display = "none";
      if (titleEl) titleEl.value = "";
      if (linkEl) linkEl.value = "";
      refreshAllResourceBadges();
    } catch (error) {
      alert("UPLOAD FAILED: " + error.message);
    }
  });
}

// --- C. Edit Schedule & Alerts Modal & Submit ---
if (btnEditSchedule) {
  btnEditSchedule.addEventListener("click", () => {
    if (modalEditSchedule) modalEditSchedule.style.display = "flex";
  });
}
if (btnCancelEdit) {
  btnCancelEdit.addEventListener("click", () => {
    if (modalEditSchedule) modalEditSchedule.style.display = "none";
  });
}
if (btnSubmitEdit) {
  btnSubmitEdit.addEventListener("click", async () => {
    const subjectEl = document.getElementById("edit-subject");
    const alertTextEl = document.getElementById("alert-text");
    const expDateEl = document.getElementById("alert-date");

    const subject = subjectEl ? subjectEl.value : "";
    const alertText = alertTextEl ? alertTextEl.value.trim() : "";
    const expDate = expDateEl ? expDateEl.value : "";

    if (!subject) {
      alert("Please select a subject.");
      return;
    }

    // If text is present, require an expiration date; if blank, allow clearing the alert
    if (alertText && !expDate) {
      alert("Please select an expiration date for the alert.");
      return;
    }

    try {
      if (!(await requireAdminSession())) return;

      await window.setDoc(window.doc(window.db, "ScheduleNotes", subject), {
        note: alertText,
        expiration: expDate || "1970-01-01",
        timestamp: new Date().toISOString(),
      });

      alert(
        alertText
          ? `Database confirmed: Alert added to ${subject.toUpperCase()}!`
          : `Database confirmed: Alert cleared for ${subject.toUpperCase()}.`,
      );
      if (modalEditSchedule) modalEditSchedule.style.display = "none";
      if (alertTextEl) alertTextEl.value = "";
      if (expDateEl) expDateEl.value = "";
    } catch (error) {
      alert("UPLOAD FAILED: " + error.message);
    }
  });
}

// --- D. Post Live Announcement Modal, Submit & Live Listener ---
if (btnPostAnnouncement) {
  btnPostAnnouncement.addEventListener("click", () => {
    if (modalPostAnnouncement) modalPostAnnouncement.style.display = "flex";
  });
}
if (btnCancelAnnouncement) {
  btnCancelAnnouncement.addEventListener("click", () => {
    if (modalPostAnnouncement) modalPostAnnouncement.style.display = "none";
    const inputEl = document.getElementById("announcement-input-text");
    if (inputEl) inputEl.value = "";
  });
}
if (btnSubmitAnnouncement) {
  btnSubmitAnnouncement.addEventListener("click", async () => {
    const inputEl = document.getElementById("announcement-input-text");
    const text = inputEl ? inputEl.value.trim() : "";

    if (!text) {
      alert("Please type an announcement first.");
      return;
    }

    try {
      if (!window.db || !window.setDoc || !window.doc) {
        alert("CRITICAL ERROR: Firebase tools are missing.");
        return;
      }
      if (!(await requireAdminSession())) return;

      await window.setDoc(window.doc(window.db, "Announcements", "latest"), {
        message: text,
        timestamp: new Date().toISOString(),
      });

      alert("Database confirmed: Live announcement posted!");
      if (modalPostAnnouncement) modalPostAnnouncement.style.display = "none";
      if (inputEl) inputEl.value = "";
    } catch (error) {
      alert("UPLOAD FAILED: " + error.message);
    }
  });
}

if (btnDeleteAnnouncement) {
  btnDeleteAnnouncement.addEventListener("click", async () => {
    if (!window.db || !window.deleteDoc || !window.doc) {
      alert("CRITICAL ERROR: Firebase tools are missing.");
      return;
    }
    if (!window.confirm("Remove the currently posted announcement?")) return;

    try {
      if (!(await requireAdminSession())) return;

      await window.deleteDoc(
        window.doc(window.db, "Announcements", "latest"),
      );

      alert("Database confirmed: Live announcement removed.");
      if (modalPostAnnouncement) modalPostAnnouncement.style.display = "none";
      const inputEl = document.getElementById("announcement-input-text");
      if (inputEl) inputEl.value = "";
    } catch (error) {
      alert("REMOVE FAILED: " + error.message);
    }
  });
}

if (window.onSnapshot && window.db && window.doc) {
  window.onSnapshot(
    window.doc(window.db, "Announcements", "latest"),
    (docSnap) => {
      const banner = document.getElementById("live-alert-banner");
      const displayText = document.getElementById("live-alert-text");
      if (!banner || !displayText) return;

      if (
        docSnap.id === "lofi_meta" ||
        docSnap.id.startsWith("lofi_chunk_")
      ) {
        return;
      }
      if (docSnap.exists() && docSnap.data().message?.trim()) {
        displayText.textContent = docSnap.data().message;
        banner.style.display = "flex";
      } else {
        banner.style.display = "none";
      }
    },
  );
}

// --- E. ID & QR Link Modal & Submit ---
const idQrDocRef = () => window.doc(window.db, "IDLinks", "id-qr");

async function loadIdQrLink() {
  try {
    const linkSnapshot = await window.getDoc(idQrDocRef());
    const link = linkSnapshot.exists() ? linkSnapshot.data().url : "";
    if (link && /^https?:\/\//i.test(link)) {
      if (btnOpenIdQr) btnOpenIdQr.href = link;
    } else {
      if (btnOpenIdQr) btnOpenIdQr.href = "#";
    }
  } catch (error) {
    console.error("Unable to load ID & QR link.", error);
  }
}

if (btnOpenIdQr) {
  btnOpenIdQr.addEventListener("click", (event) => {
    if (btnOpenIdQr.getAttribute("href") === "#") {
      event.preventDefault();
      alert("The ID and QR link has not been added yet.");
    }
  });
}

if (btnEditIdQr) {
  btnEditIdQr.addEventListener("click", async () => {
    try {
      const linkSnapshot = await window.getDoc(idQrDocRef());
      if (idQrLinkInput) {
        idQrLinkInput.value = linkSnapshot.exists()
          ? linkSnapshot.data().url || ""
          : "";
      }
    } catch (e) {}
    if (modalEditIdQr) modalEditIdQr.style.display = "flex";
  });
}

if (btnCancelIdQr) {
  btnCancelIdQr.addEventListener("click", () => {
    if (modalEditIdQr) modalEditIdQr.style.display = "none";
  });
}

if (btnSaveIdQr) {
  btnSaveIdQr.addEventListener("click", async () => {
    const link = idQrLinkInput ? idQrLinkInput.value.trim() : "";
    try {
      const parsedLink = new URL(link);
      if (!/^https?:$/.test(parsedLink.protocol)) throw new Error();
      if (!(await requireAdminSession())) return;

      await window.setDoc(idQrDocRef(), {
        url: link,
        timestamp: new Date().toISOString(),
      });
      if (btnOpenIdQr) btnOpenIdQr.href = link;
      if (modalEditIdQr) modalEditIdQr.style.display = "none";
      alert("ID and QR link saved.");
    } catch (error) {
      alert("Please enter a valid Google Drive link.");
    }
  });
}

// ==========================================
// 5. DYNAMIC 10-DAY CALENDAR & SCHEDULE
// ==========================================
function renderDynamicCalendar() {
  const iraqTime = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" }),
  );

  const currentDay = iraqTime.getDay();
  let diffToSaturday;
  if (currentDay === 4) {
    diffToSaturday = 2;
  } else if (currentDay === 5) {
    diffToSaturday = 1;
  } else if (currentDay === 6) {
    diffToSaturday = 0;
  } else {
    diffToSaturday = -(currentDay + 1);
  }

  const startOfWeek = new Date(iraqTime);
  startOfWeek.setDate(iraqTime.getDate() + diffToSaturday);
  startOfWeek.setHours(0, 0, 0, 0);

  const calendarContainer = document.getElementById(
    "dynamic-calendar-container",
  );
  if (!calendarContainer) return;
  calendarContainer.innerHTML = "";

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let validDaysFound = 0;
  const loopDate = new Date(startOfWeek);

  while (validDaysFound < 10) {
    const loopDayOfWeek = loopDate.getDay();
    if (loopDayOfWeek !== 4 && loopDayOfWeek !== 5) {
      const dayName = dayNames[loopDayOfWeek];
      const dateNum = loopDate.getDate();
      const isToday = loopDate.toDateString() === iraqTime.toDateString();

      const tomorrowDate = new Date(iraqTime);
      tomorrowDate.setDate(iraqTime.getDate() + 1);
      const isTomorrow =
        loopDate.toDateString() === tomorrowDate.toDateString();

      let badgeHtml = `<div class="day-badge day-badge-placeholder"></div>`;
      if (isToday) {
        badgeHtml = `<div class="day-badge">Today</div>`;
      } else if (isTomorrow) {
        badgeHtml = `<div class="day-badge">Tomorrow</div>`;
      }

      const dayHTML = `
        <div class="day-selector-btn" data-day="${dayName}" data-date="${loopDate.toDateString()}">
          <span class="day-name">${dayName}</span>
          <span class="day-number">${dateNum}</span>
          ${badgeHtml}
        </div>
      `;
      calendarContainer.innerHTML += dayHTML;
      validDaysFound++;
    }
    loopDate.setDate(loopDate.getDate() + 1);
  }

  const allDayBtns = document.querySelectorAll(".day-selector-btn");
  allDayBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      allDayBtns.forEach((b) => {
        b.classList.remove("is-selected");
      });

      this.classList.add("is-selected");

      this.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });

      const selectedDay = this.getAttribute("data-day");
      filterSchedule(selectedDay);
    });
  });

  let successfullyClickedToday = false;
  allDayBtns.forEach((btn) => {
    if (btn.getAttribute("data-date") === iraqTime.toDateString()) {
      setTimeout(() => btn.click(), 40);
      successfullyClickedToday = true;
    }
  });
  if (!successfullyClickedToday && allDayBtns.length > 0) {
    setTimeout(() => allDayBtns[0].click(), 40);
  }
}

function filterSchedule(dayName) {
  const dayMap = {
    Sat: "saturday",
    Sun: "sunday",
    Mon: "monday",
    Tue: "tuesday",
    Wed: "wednesday",
  };
  const allSchedules = document.querySelectorAll(".schedule-container");
  allSchedules.forEach((sec) => {
    sec.style.display = "none";
  });

  const targetId = `schedule-${dayMap[dayName]}`;
  const targetSection = document.getElementById(targetId);
  if (targetSection) {
    targetSection.style.display = "block";
  }
}

window.addEventListener("DOMContentLoaded", renderDynamicCalendar);

// ==========================================
// 6. LIVE LECTURE PROGRESS
// ==========================================
function updateLiveBaghdadStatus() {
  const now = new Date();
  const baghdadTimeStr = now.toLocaleString("en-US", {
    timeZone: "Asia/Baghdad",
  });
  const baghdadDate = new Date(baghdadTimeStr);

  const hours = baghdadDate.getHours();
  const minutes = baghdadDate.getMinutes();
  const dayOfWeek = baghdadDate.getDay();

  const activeDayMap = {
    6: "schedule-saturday",
    0: "schedule-sunday",
    1: "schedule-monday",
    2: "schedule-tuesday",
    3: "schedule-wednesday",
  };
  const currentActiveContainerId = activeDayMap[dayOfWeek];

  document.querySelectorAll(".subject-card").forEach((card) => {
    card.classList.remove("is-live-now");
    const bar = card.querySelector(".live-lecture-bar");
    if (bar) bar.innerHTML = "";
  });

  if (currentActiveContainerId) {
    const container = document.getElementById(currentActiveContainerId);
    if (container && container.style.display !== "none") {
      const timeBlocks = container.querySelectorAll(".time-block");
      timeBlocks.forEach((block) => {
        const startStr = block.getAttribute("data-start");
        const endStr = block.getAttribute("data-end");
        if (!startStr || !endStr) return;

        const [startH, startM] = startStr.split(":").map(Number);
        const [endH, endM] = endStr.split(":").map(Number);

        const currentMinutes = hours * 60 + minutes;
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
          const card = block.querySelector(".subject-card");
          if (card) {
            card.classList.add("is-live-now");
            const totalDuration = endMinutes - startMinutes;
            const elapsed = currentMinutes - startMinutes;
            const pct = Math.min(
              100,
              Math.max(0, (elapsed / totalDuration) * 100),
            );
            const remaining = endMinutes - currentMinutes;

            const bar = card.querySelector(".live-lecture-bar");
            if (bar) {
              bar.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:800; color:#065f46; margin-bottom:2px;">
                  <span>🔴 LIVE NOW</span>
                  <span>${remaining} mins left</span>
                </div>
                <div class="live-lecture-fill" style="width: ${pct}%"></div>
              `;
            }
          }
        }
      });
    }
  }
}
setInterval(updateLiveBaghdadStatus, 15000);
window.addEventListener("DOMContentLoaded", updateLiveBaghdadStatus);

// 3D Tilt on Schedule Cards
document.addEventListener("pointermove", (e) => {
  const cards = document.querySelectorAll(".subject-card");
  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      const rx = -(y - rect.height / 2) / 22;
      const ry = (x - rect.width / 2) / 22;
      card.style.setProperty("--rx", `${rx}deg`);
      card.style.setProperty("--ry", `${ry}deg`);
    } else {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    }
  });
});

// ==========================================
// 7. SUBJECT VIEWER MODAL & RESOURCE SYNC
// ==========================================
const subjectModal = document.getElementById("modal-subject-view");
const closeSubjectBtn = document.getElementById("btn-close-subject-view");
const subjectTitle = document.getElementById("view-subject-title");

function setupSubjectClickTriggers() {
  const clickableItems = document.querySelectorAll(
    ".subject-card, .group-col[data-subject]",
  );

  clickableItems.forEach((item) => {
    if (item.classList.contains("free-slot")) return;

    item.addEventListener("click", (e) => {
      // Ignore if clicking directly on a split-group wrapper instead of its columns
      if (item.classList.contains("split-group")) return;
      e.stopPropagation();

      let subName = "";
      let subKey = "";

      if (item.hasAttribute("data-subject")) {
        subKey = item.getAttribute("data-subject");
        subName = subKey.replace(/-/g, " ").toUpperCase();
      } else {
        const heading = item.querySelector("h2");
        if (heading) {
          subName = heading.firstChild.textContent.trim();
          subKey = subName.toLowerCase().replace(/\s+/g, "-");
        }
      }

      if (!subName) return;
      if (subjectTitle) subjectTitle.textContent = subName;

      loadSubjectResources(subKey);
      if (subjectModal) subjectModal.style.display = "flex";
    });
  });
}

async function loadSubjectResources(subjectKey) {
  const pdfContainer = document.getElementById("list-pdfs");
  const quizContainer = document.getElementById("list-quizzes");

  if (pdfContainer) {
    pdfContainer.innerHTML = `<div style="text-align:center; color:#64748b; font-size:13px;">Loading PDFs...</div>`;
  }
  if (quizContainer) {
    quizContainer.innerHTML = `<div style="text-align:center; color:#64748b; font-size:13px;">Loading Quizzes...</div>`;
  }

  const isAdmin =
    window.auth &&
    window.auth.currentUser &&
    window.auth.currentUser.email === adminEmail;

  try {
    const pdfSnapshot = await window.getDocs(
      window.collection(window.db, "PDFNotes"),
    );
    if (pdfContainer) pdfContainer.innerHTML = "";
    let pdfCount = 0;

    pdfSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.subject === subjectKey) {
        pdfCount++;
        const itemRow = document.createElement("div");
          itemRow.className = "pdf-resource-row";

        const linkBtn = document.createElement("a");
        linkBtn.href = data.url;
        linkBtn.target = "_blank";
        linkBtn.rel = "noopener noreferrer";
        linkBtn.className = "resource-link";
        linkBtn.textContent = `📄 ${data.name}`;

        itemRow.appendChild(linkBtn);

        if (isAdmin) {
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-resource-btn";
          deleteBtn.textContent = "🗑️";
          deleteBtn.addEventListener("click", async () => {
            if (confirm(`Are you sure you want to remove ${data.name}?`)) {
              try {
                await window.deleteDoc(
                  window.doc(window.db, "PDFNotes", docSnap.id),
                );
                itemRow.remove();
                refreshAllResourceBadges();
              } catch (err) {
                alert(`Unable to remove lecture: ${err.message}`);
              }
            }
          });
          itemRow.appendChild(deleteBtn);
        }
        pdfContainer.appendChild(itemRow);
      }
    });

    if (pdfCount === 0 && pdfContainer) {
      pdfContainer.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:13px; padding:10px;">No lecture PDFs uploaded yet.</div>`;
    }

    const quizSnapshot = await window.getDocs(
      window.collection(window.db, "QuizLinks"),
    );
    if (quizContainer) quizContainer.innerHTML = "";
    let quizCount = 0;

    quizSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.subject === subjectKey) {
        quizCount++;
        const itemRow = document.createElement("div");
          itemRow.className = "quiz-resource-row";

        const linkBtn = document.createElement("a");
        linkBtn.href = data.url;
        linkBtn.target = "_blank";
        linkBtn.rel = "noopener noreferrer";
        linkBtn.className = "resource-link";
        linkBtn.textContent = `📝 ${data.name}`;

        itemRow.appendChild(linkBtn);

        if (isAdmin) {
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-resource-btn";
          deleteBtn.textContent = "🗑️";
          deleteBtn.addEventListener("click", async () => {
            if (confirm(`Are you sure you want to remove ${data.name}?`)) {
              try {
                await window.deleteDoc(
                  window.doc(window.db, "QuizLinks", docSnap.id),
                );
                itemRow.remove();
                refreshAllResourceBadges();
              } catch (err) {
                alert("Access Denied: Only the Admin can delete quizzes.");
              }
            }
          });
          itemRow.appendChild(deleteBtn);
        }
        quizContainer.appendChild(itemRow);
      }
    });

    if (quizCount === 0 && quizContainer) {
      quizContainer.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:13px; padding:10px;">No interactive quizzes added yet.</div>`;
    }
  } catch (error) {
    console.error("Error loading subject resources:", error);
  }
}

if (closeSubjectBtn) {
  closeSubjectBtn.addEventListener("click", () => {
    if (subjectModal) subjectModal.style.display = "none";
  });
}
window.addEventListener("DOMContentLoaded", setupSubjectClickTriggers);

// ==========================================
// 8. RESOURCE COUNTER PILLS & EXAMS RADAR
// ==========================================
async function refreshAllResourceBadges() {
  try {
    const pdfsSnap = await window.getDocs(
      window.collection(window.db, "PDFNotes"),
    );
    const quizzesSnap = await window.getDocs(
      window.collection(window.db, "QuizLinks"),
    );
    const counts = {};

    pdfsSnap.forEach((d) => {
      const sub = d.data().subject;
      if (!counts[sub]) counts[sub] = { pdfs: 0, quizzes: 0 };
      counts[sub].pdfs++;
    });

    quizzesSnap.forEach((d) => {
      const sub = d.data().subject;
      if (!counts[sub]) counts[sub] = { pdfs: 0, quizzes: 0 };
      counts[sub].quizzes++;
    });

    document.querySelectorAll(".resource-pills").forEach((container) => {
      const subKey = container.getAttribute("data-pills-for");
      const c = counts[subKey] || { pdfs: 0, quizzes: 0 };
      container.innerHTML = `
        <span class="res-pill ${c.pdfs > 0 ? "has-items" : ""}">📄 ${c.pdfs} PDF${c.pdfs === 1 ? "" : "s"}</span>
        <span class="res-pill quiz-pill ${c.quizzes > 0 ? "has-items" : ""}">📝 ${c.quizzes} Quiz${c.quizzes === 1 ? "" : "zes"}</span>
      `;
    });
  } catch (e) {
    console.error("Failed to refresh resource badges", e);
  }
}

if (window.onSnapshot && window.db && window.collection) {
  window.onSnapshot(
    window.collection(window.db, "ScheduleNotes"),
    (snapshot) => {
      const today = new Date().toISOString().split("T")[0];
      const radarContainer = document.getElementById("upcoming-exams-radar");
      if (!radarContainer) return;

      radarContainer.innerHTML = "";
      const titleDiv = document.createElement("div");
      titleDiv.className = "exams-radar-title";
      titleDiv.textContent = "🚨 ACTIVE EXAMS & SUBJECT ALERTS";
      radarContainer.appendChild(titleDiv);

      const listDiv = document.createElement("div");
      listDiv.className = "exams-radar-list";
      radarContainer.appendChild(listDiv);

      let activeAlertsCount = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const subjectKey = docSnap.id;
        const badge = document.getElementById("badge-" + subjectKey);

        if (badge) {
          if (
            data.expiration >= today &&
            data.note &&
            data.note.trim() !== ""
          ) {
            badge.textContent = data.note;
            badge.style.cssText =
              "display: inline-block; background-color: #0b8793; color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; margin-left: 8px; letter-spacing: 0.4px; animation: pulse 1.5s infinite; vertical-align: middle;";

            activeAlertsCount++;
            const chip = document.createElement("div");
            chip.className = "exam-radar-chip";

            const topRow = document.createElement("div");
            topRow.className = "exam-radar-chip-top";

            const subjSpan = document.createElement("span");
            subjSpan.className = "exam-radar-subj";
            subjSpan.textContent = subjectKey.replace(/-/g, " ").toUpperCase();

            const expSpan = document.createElement("span");
            expSpan.className = "exam-radar-countdown";
            expSpan.textContent = `Until ${data.expiration}`;

            topRow.appendChild(subjSpan);
            topRow.appendChild(expSpan);

            const noteDiv = document.createElement("div");
            noteDiv.className = "exam-radar-note";
            noteDiv.textContent = `⚠️ ${data.note}`;

            chip.appendChild(topRow);
            chip.appendChild(noteDiv);

            chip.addEventListener("click", () => {
              loadSubjectResources(subjectKey);
              if (subjectTitle) {
                subjectTitle.textContent = subjectKey
                  .replace(/-/g, " ")
                  .toUpperCase();
              }
              if (subjectModal) subjectModal.style.display = "flex";
            });
            listDiv.appendChild(chip);
          } else {
            badge.style.display = "none";
            badge.textContent = "";
          }
        }
      });

      radarContainer.style.display = activeAlertsCount > 0 ? "block" : "none";
    },
  );
}

// ==========================================
// 9. POMODORO TIMER + LO-FI PLAYER
// ==========================================
const pomodoroModal = document.getElementById("pomodoro-modal");
const btnOpenPomodoro = document.getElementById("btn-open-pomodoro");
const btnFocusSound = document.getElementById("btn-focus-sound");
const btnToolbarLofi = document.getElementById("btn-toolbar-lofi");

const lofiPlayer = {
  audio: new Audio(),
  trackId: null,
  loading: false,
  playing: false,
  async loadTrack() {
    const metadata = await window.getDoc(
      window.doc(window.db, "Announcements", "lofi_meta"),
    );
    if (!metadata.exists()) {
      throw new Error("No Lo-Fi track has been published yet.");
    }
    const { trackId, totalChunks, mimeType = "audio/mpeg" } = metadata.data();
    const chunks = await Promise.all(
      Array.from({ length: Number(totalChunks) }, (_, index) =>
        window.getDoc(
          window.doc(window.db, "Announcements", `lofi_chunk_${index}`),
        ),
      ),
    );
    if (chunks.some((chunk) => !chunk.exists() || chunk.data().trackId !== trackId)) {
      throw new Error("The published Lo-Fi track is incomplete.");
    }
    const base64 = chunks.map((chunk) => chunk.data().data).join("");
    this.trackId = trackId;
    this.audio.src = `data:${mimeType};base64,${base64}`;
    this.audio.load();
  },
  async toggle() {
    if (this.loading) return;
    this.loading = true;
    this.updateButtons();
    try {
      if (!this.audio.src) await this.loadTrack();
      if (this.playing) {
        this.audio.pause();
      } else {
        await this.audio.play();
      }
      this.playing = !this.playing;
    } catch (error) {
      this.playing = false;
      console.error("Unable to start Lo-Fi playback.", error);
      alert(error?.message || "Unable to start Lo-Fi playback.");
    } finally {
      this.loading = false;
      this.updateButtons();
    }
  },
  updateButtons() {
    [btnFocusSound, btnToolbarLofi].filter(Boolean).forEach((button) => {
      button.textContent = this.loading
        ? "🎧 Loading Lo-Fi..."
        : this.playing
        ? "🎧 Lo-Fi Beats: ON"
        : "🎧 Lo-Fi Beats: OFF";
      button.classList.toggle("active", this.playing);
      button.disabled = this.loading;
      button.setAttribute("aria-busy", String(this.loading));
    });
  },
  loadUploadedTrack(trackId, base64) {
    this.trackId = trackId;
    this.audio.src = `data:audio/mpeg;base64,${base64}`;
    this.audio.load();
    this.playing = false;
    this.updateButtons();
  },
  deleteTrack(trackId) {
    if (this.trackId === trackId) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.trackId = null;
      this.playing = false;
      this.updateButtons();
    }
  },
};
lofiPlayer.audio.addEventListener("ended", () => {
  lofiPlayer.playing = false;
  lofiPlayer.updateButtons();
});
window.lofiPlayer = lofiPlayer;

[btnFocusSound, btnToolbarLofi]
  .filter(Boolean)
  .forEach((button) =>
    button.addEventListener("click", () => window.lofiPlayer.toggle()),
  );

if (pomodoroModal && btnOpenPomodoro) {
  const btnClosePomodoro = document.getElementById("btn-close-pomodoro");
  const timeDisplay = document.getElementById("time-display");
  const btnModeStudy = document.getElementById("btn-mode-study");
  const btnModeBreak = document.getElementById("btn-mode-break");
  const btnTimerStart = document.getElementById("btn-timer-start");
  const btnTimerPause = document.getElementById("btn-timer-pause");
  const btnTimerReset = document.getElementById("btn-timer-reset");

  const timerStorageKey = "dento_pomodoro_timer";
  let timerInterval;
  let timeLeft = 25 * 60;
  let isRunning = false;
  let currentMode = "study";
  let endTime = null;
  let screenWakeLock = null;

  async function requestScreenWakeLock() {
    if (
      !isRunning ||
      document.visibilityState !== "visible" ||
      !("wakeLock" in navigator)
    ) {
      return;
    }
    try {
      const wakeLock = await navigator.wakeLock.request("screen");
      if (!isRunning) {
        await wakeLock.release();
        return;
      }
      screenWakeLock = wakeLock;
      screenWakeLock.addEventListener("release", () => {
        screenWakeLock = null;
      });
    } catch (error) {
      console.warn("Screen wake lock unavailable.", error);
    }
  }

  async function releaseScreenWakeLock() {
    const wakeLock = screenWakeLock;
    screenWakeLock = null;
    if (wakeLock) {
      try {
        await wakeLock.release();
      } catch (e) {}
    }
  }

  function saveTimerState() {
    localStorage.setItem(
      timerStorageKey,
      JSON.stringify({ mode: currentMode, timeLeft, endTime, isRunning }),
    );
  }

  function loadTimerState() {
    try {
      const savedState = JSON.parse(
        localStorage.getItem(timerStorageKey) || "null",
      );
      if (!savedState) return;
      currentMode = savedState.mode === "break" ? "break" : "study";
      timeLeft = Number(savedState.timeLeft) || 0;
      endTime = Number(savedState.endTime) || null;
      isRunning = Boolean(savedState.isRunning && endTime);
      if (isRunning && endTime <= Date.now()) {
        timeLeft = 0;
        endTime = null;
        isRunning = false;
      }
    } catch (e) {
      localStorage.removeItem(timerStorageKey);
    }
  }

  function updateDisplay() {
    if (isRunning && endTime) {
      timeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    }
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    if (timeDisplay) {
      timeDisplay.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
  }

  function finishTimer() {
    clearInterval(timerInterval);
    timeLeft = 0;
    endTime = null;
    isRunning = false;
    releaseScreenWakeLock();
    saveTimerState();
    updateDisplay();
    if (mascotKeyLight) mascotKeyLight.color.setHex(0x38bdf8);
    alert(
      currentMode === "study"
        ? "Study session complete! Take a 5-minute break."
        : "Break over! Back to studying.",
    );
  }

  function runTimer() {
    clearInterval(timerInterval);
    updateDisplay();
    if (timeLeft <= 0) {
      finishTimer();
      return;
    }
    if (mascotKeyLight) mascotKeyLight.color.setHex(0xef4444);
    timerInterval = setInterval(() => {
      updateDisplay();
      if (timeLeft <= 0) finishTimer();
    }, 1000);
  }

  if (btnTimerStart) {
    btnTimerStart.addEventListener("click", async () => {
      if (isRunning) return;
      isRunning = true;
      endTime = Date.now() + timeLeft * 1000;
      saveTimerState();
      await requestScreenWakeLock();
      runTimer();
    });
  }

  if (btnTimerPause) {
    btnTimerPause.addEventListener("click", () => {
      updateDisplay();
      clearInterval(timerInterval);
      isRunning = false;
      endTime = null;
      if (mascotKeyLight) mascotKeyLight.color.setHex(0x38bdf8);
      releaseScreenWakeLock();
      saveTimerState();
    });
  }

  function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    endTime = null;
    if (mascotKeyLight) mascotKeyLight.color.setHex(0x38bdf8);
    releaseScreenWakeLock();
    timeLeft = currentMode === "study" ? 25 * 60 : 5 * 60;
    saveTimerState();
    updateDisplay();
  }

  if (btnTimerReset) btnTimerReset.addEventListener("click", resetTimer);

  if (btnModeStudy) {
    btnModeStudy.addEventListener("click", () => {
      currentMode = "study";
      btnModeStudy.classList.add("active");
      if (btnModeBreak) btnModeBreak.classList.remove("active");
      resetTimer();
    });
  }

  if (btnModeBreak) {
    btnModeBreak.addEventListener("click", () => {
      currentMode = "break";
      btnModeBreak.classList.add("active");
      if (btnModeStudy) btnModeStudy.classList.remove("active");
      resetTimer();
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      requestScreenWakeLock();
    } else {
      releaseScreenWakeLock();
    }
  });

  btnOpenPomodoro.addEventListener("click", () => {
    pomodoroModal.style.display = "flex";
  });

  if (btnClosePomodoro) {
    btnClosePomodoro.addEventListener("click", () => {
      pomodoroModal.style.display = "none";
    });
  }

  loadTimerState();
  if (btnModeStudy) {
    btnModeStudy.classList.toggle("active", currentMode === "study");
  }
  if (btnModeBreak) {
    btnModeBreak.classList.toggle("active", currentMode === "break");
  }
  updateDisplay();
  if (isRunning) {
    requestScreenWakeLock();
    runTimer();
  }
}

// ==========================================
// 10. 4TH-YEAR CLINICAL REQUIREMENTS TRACKER
// ==========================================
const clinicRequirementsConfig = [
  { id: "cons_comp", title: "Conservative: Composite Restorations", target: 8 },
  { id: "surg_ext", title: "Oral Surgery: Simple Extractions", target: 8 },
  { id: "prost_pd", title: "Prosthodontics: Partial Denture Cases", target: 4 },
  { id: "perio_sc", title: "Periodontics: Scaling & Root Planing", target: 10 },
];

const modalClinicLog = document.getElementById("modal-clinic-log");
const btnOpenClinicLog = document.getElementById("btn-open-clinic-log");
const btnCloseClinicLog = document.getElementById("btn-close-clinic-log");
const btnResetClinicLog = document.getElementById("btn-reset-clinic-log");
const clinicReqList = document.getElementById("clinic-requirements-list");

function getClinicLogData() {
  try {
    return JSON.parse(localStorage.getItem("dento_clinic_log") || "{}");
  } catch (e) {
    return {};
  }
}

function saveClinicLogData(data) {
  localStorage.setItem("dento_clinic_log", JSON.stringify(data));
}

function renderClinicLogbook() {
  if (!clinicReqList) return;
  const savedData = getClinicLogData();
  clinicReqList.innerHTML = "";

  clinicRequirementsConfig.forEach((req) => {
    const currentCount = Number(savedData[req.id]) || 0;
    const pct = Math.min(100, Math.round((currentCount / req.target) * 100));

    const itemDiv = document.createElement("div");
    itemDiv.className = "clinic-req-item";
    itemDiv.innerHTML = `
      <div class="clinic-req-header">
        <span class="clinic-req-title">${req.title}</span>
        <div class="clinic-req-controls">
          <button class="clinic-step-btn" data-req-id="${req.id}" data-delta="-1">-</button>
          <span class="clinic-req-count">${currentCount} / ${req.target}</span>
          <button class="clinic-step-btn" data-req-id="${req.id}" data-delta="1">+</button>
        </div>
      </div>
      <div class="clinic-progress-track">
        <div class="clinic-progress-fill" style="width: ${pct}%"></div>
      </div>
    `;
    clinicReqList.appendChild(itemDiv);

    itemDiv.querySelectorAll(".clinic-step-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const reqId = button.getAttribute("data-req-id");
        const delta = Number(button.getAttribute("data-delta"));
        if (reqId && Number.isFinite(delta)) {
          window.adjustClinicCount(reqId, delta);
        }
      });
    });
  });
}

window.adjustClinicCount = function (reqId, delta) {
  const savedData = getClinicLogData();
  const current = Number(savedData[reqId]) || 0;
  savedData[reqId] = Math.max(0, current + delta);
  saveClinicLogData(savedData);
  renderClinicLogbook();
};

if (btnOpenClinicLog) {
  btnOpenClinicLog.addEventListener("click", () => {
    renderClinicLogbook();
    if (modalClinicLog) modalClinicLog.style.display = "flex";
  });
}

if (btnCloseClinicLog) {
  btnCloseClinicLog.addEventListener("click", () => {
    if (modalClinicLog) modalClinicLog.style.display = "none";
  });
}

if (btnResetClinicLog) {
  btnResetClinicLog.addEventListener("click", () => {
    if (confirm("Reset all logged clinical case counts to zero?")) {
      localStorage.removeItem("dento_clinic_log");
      renderClinicLogbook();
    }
  });
}
