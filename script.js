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
      .then(() => {
        const currentDevice = getDeviceID();
        return window.setDoc(
          window.doc(window.db, "DeviceHistory", currentDevice),
          {
            lastLogin: new Date().toISOString(),
            userAgent: navigator.userAgent,
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
          alert("Override accepted. Welcome, Phantom.");

          const querySnapshot = await window.getDocs(
            window.collection(window.db, "DeviceHistory"),
          );
          let deviceCount = 0;
          let logDetails = "ADMIN DEVICE LEDGER:\n\n";

          querySnapshot.forEach((docSnap) => {
            deviceCount++;
            const dateObj = new Date(docSnap.data().lastLogin);
            logDetails += `- ${docSnap.id} (Last seen: ${dateObj.toLocaleDateString()})\n`;
          });

          alert(`TOTAL ADMIN DEVICES: ${deviceCount}\n\n${logDetails}`);

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
        .catch(() => {});
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
const LOFI_CHUNK_SIZE = 700000;

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
// 9. POMODORO TIMER + LO-FI LINK
// ==========================================
const pomodoroModal = document.getElementById("pomodoro-modal");
const btnOpenPomodoro = document.getElementById("btn-open-pomodoro");
const btnFocusSound = document.getElementById("btn-focus-sound");
const btnToolbarLofi = document.getElementById("btn-toolbar-lofi");

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
    sfx.playDing();
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

// ==========================================
// 11. ARCADE LEADERBOARD & DUAL-MODE 3D ENGINE
// ==========================================
let arcadePlayerName = "";

window.openGameMenu = function () {
  const playerName = prompt(
    "Enter your name for the Al-Ameen Arcade Leaderboard:",
    localStorage.getItem("dento_student") || "",
  );
  if (!playerName || !playerName.trim()) return;

  arcadePlayerName = playerName.trim().slice(0, 30);
  localStorage.setItem("dento_student", arcadePlayerName);

  const nameLabel = document.getElementById("arcade-player-name-label");
  if (nameLabel) nameLabel.textContent = arcadePlayerName;

  const menu = document.getElementById("game-selection-overlay");
  if (menu) menu.style.display = "flex";
};

window.closeGameMenu = function () {
  const menu = document.getElementById("game-selection-overlay");
  if (menu) menu.style.display = "none";
  stopArcadeAudio();
};

window.switchArcadeModeTab = function (mode) {
  const tabDrift = document.getElementById("tab-mode-drift");
  const tabDental = document.getElementById("tab-mode-dental");
  const panelDrift = document.getElementById("arcade-panel-drift");
  const panelDental = document.getElementById("arcade-panel-dental");

  if (mode === "drift") {
    if (tabDrift) tabDrift.classList.add("active");
    if (tabDental) tabDental.classList.remove("active");
    if (panelDrift) panelDrift.style.display = "block";
    if (panelDental) panelDental.style.display = "none";
  } else {
    if (tabDental) tabDental.classList.add("active");
    if (tabDrift) tabDrift.classList.remove("active");
    if (panelDental) panelDental.style.display = "block";
    if (panelDrift) panelDrift.style.display = "none";
  }
};

window.openStandaloneLeaderboard = function () {
  const scoreboardModal = document.getElementById("scoreboard-modal");
  const gameCanvasOverlay = document.getElementById("game-canvas-overlay");
  const menu = document.getElementById("game-selection-overlay");

  if (menu) menu.style.display = "none";
  if (gameCanvasOverlay) gameCanvasOverlay.style.display = "flex";

  const heading = document.getElementById("scoreboard-heading");
  const finalScoreDisp = document.getElementById("final-score-display");
  const finalSub = document.getElementById("final-run-subtitle");

  if (heading) heading.textContent = "🏆 AL-AMEEN HIGH SCORES";
  if (finalScoreDisp) finalScoreDisp.textContent = "---";
  if (finalSub) finalSub.textContent = "Global Hall of Fame (Cumulative)";

  if (scoreboardModal) scoreboardModal.style.display = "flex";
  fetchDriftLeaderboard();
};

// --- AUDIO & LAZY WEB AUDIO SYNTHESIS ---
const soundtrack = new Audio("soundtrack.mp3");
soundtrack.loop = true;
soundtrack.volume = 0.35;

const engineAudio = new Audio("engine.mp3");
engineAudio.loop = true;
engineAudio.volume = 0;

const driftAudio = new Audio("drift.mp3");
driftAudio.loop = true;
driftAudio.volume = 0;

let arcadeAudioCtx = null;
function getArcadeAudioCtx() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!arcadeAudioCtx) {
    try {
      arcadeAudioCtx = new AudioContextClass();
    } catch (e) {
      return null;
    }
  }
  if (arcadeAudioCtx.state === "suspended") {
    arcadeAudioCtx.resume().catch(() => {});
  }
  return arcadeAudioCtx;
}

const dentalArcadeSynth = {
  timer: null,
  step: 0,
  drillOsc: null,
  drillGain: null,
  notes: [
    329.63, 392.0, 493.88, 659.25, 493.88, 392.0,
    293.66, 369.99, 440.0, 587.33, 440.0, 369.99,
    261.63, 329.63, 392.0, 523.25, 392.0, 329.63,
    293.66, 369.99, 440.0, 587.33, 659.25, 587.33,
  ],
  startMusic() {
    this.stopMusic();
    const ctx = getArcadeAudioCtx();
    if (!ctx) return;

    this.step = 0;
    this.timer = setInterval(() => {
      try {
        const now = ctx.currentTime;
        const freq = this.notes[this.step % this.notes.length];
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = this.step % 4 === 0 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.035, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);

        if (this.step % 2 === 0) {
          const bass = ctx.createOscillator();
          const bg = ctx.createGain();
          bass.type = "triangle";
          bass.frequency.setValueAtTime(freq * 0.25, now);
          bg.gain.setValueAtTime(0.04, now);
          bg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          bass.connect(bg);
          bg.connect(ctx.destination);
          bass.start(now);
          bass.stop(now + 0.17);
        }
        this.step++;
      } catch (e) {}
    }, 150);

    try {
      this.drillOsc = ctx.createOscillator();
      this.drillGain = ctx.createGain();
      this.drillOsc.type = "sine";
      this.drillOsc.frequency.setValueAtTime(3100, ctx.currentTime);
      this.drillGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.drillOsc.connect(this.drillGain);
      this.drillGain.connect(ctx.destination);
      this.drillOsc.start();
    } catch (e) {}
  },
  setDrillActive(isActive) {
    const ctx = getArcadeAudioCtx();
    if (!ctx || !this.drillGain || !this.drillOsc) return;
    try {
      const now = ctx.currentTime;
      this.drillGain.gain.setTargetAtTime(isActive ? 0.038 : 0.0001, now, 0.03);
      this.drillOsc.frequency.setTargetAtTime(
        isActive ? 3500 + Math.random() * 250 : 2800,
        now,
        0.03,
      );
    } catch (e) {}
  },
  stopMusic() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.drillOsc) {
      try {
        this.drillOsc.stop();
        this.drillOsc.disconnect();
      } catch (e) {}
      this.drillOsc = null;
      this.drillGain = null;
    }
  },
};

function stopArcadeAudio() {
  try {
    engineAudio.pause();
    driftAudio.pause();
    soundtrack.pause();
    soundtrack.currentTime = 0;
  } catch (e) {}
  dentalArcadeSynth.stopMusic();
}

const sfx = {
  init() {
    getArcadeAudioCtx();
  },
  playTone(freq, endFreq, duration = 0.18, type = "sine", vol = 0.15) {
    const ctx = getArcadeAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        endFreq,
        ctx.currentTime + duration,
      );
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.01);
    } catch (e) {}
  },
  playDing(pitch = 880) {
    this.playTone(pitch, pitch * 1.45, 0.18, "sine", 0.15);
  },
  playCountdownBeep(isGo = false) {
    this.playTone(
      isGo ? 1046.5 : 523.25,
      isGo ? 1318.5 : 523.25,
      isGo ? 0.35 : 0.15,
      "triangle",
      0.18,
    );
  },
  playCrash() {
    this.playTone(150, 32, 0.32, "sawtooth", 0.26);
  },
};

// --- FIREBASE SCOREBOARD SYNC ---
async function submitDriftScore(playerName, playerScore) {
  const studentName =
    playerName?.trim() || localStorage.getItem("dento_student") || "Student";
  const currentUser = window.auth?.currentUser;
  const isAdmin = currentUser?.email === adminEmail;
  const displayName = isAdmin ? "Admin" : studentName;
  const docId = isAdmin
    ? "admin_master"
    : studentName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();

  if (!window.db || !window.doc || !window.getDoc || !window.setDoc) {
    return false;
  }

  try {
    const docRef = window.doc(window.db, "DriftScores", docId);
    const docSnap = await window.getDoc(docRef);
    const previousScore = docSnap.exists()
      ? Number(docSnap.data().score) || 0
      : 0;
    const sanitizedGain = Math.min(
      50000,
      Math.max(0, Math.round(Number(playerScore) || 0)),
    );
    const cumulativeScore = previousScore + sanitizedGain;

    await window.setDoc(docRef, {
      name: displayName,
      score: cumulativeScore,
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Firebase score error:", error);
    return false;
  }
}

async function fetchDriftLeaderboard() {
  const leaderboardList = document.getElementById("leaderboard-list");
  if (leaderboardList) {
    leaderboardList.innerHTML = `<div style="text-align: center; color: white; font-family: monospace;">Fetching Live Scores...</div>`;
  }
  try {
    const scoresQuery = window.query(
      window.collection(window.db, "DriftScores"),
      window.orderBy("score", "desc"),
      window.limit(10),
    );
    const snapshot = await window.getDocs(scoresQuery);
    const dataArray = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      dataArray.push({ id: docSnap.id, name: d.name, score: d.score });
    });
    renderDriftLeaderboardUI(dataArray);
  } catch (error) {
    if (leaderboardList) {
      leaderboardList.innerHTML = `<div style="text-align: center; color: #ef4444; font-family: monospace;">Unable to load live scores.</div>`;
    }
  }
}

function renderDriftLeaderboardUI(dataArray) {
  const leaderboardList = document.getElementById("leaderboard-list");
  if (!leaderboardList) return;
  leaderboardList.innerHTML = "";

  if (dataArray.length === 0) {
    leaderboardList.innerHTML = `<div style="text-align: center; color: #94a3b8; font-family: monospace;">No scores yet. Set the record!</div>`;
    return;
  }

  const isAdmin =
    window.auth &&
    window.auth.currentUser &&
    window.auth.currentUser.email === adminEmail;

  dataArray.forEach((player, index) => {
    const rankPrefix = index === 0 ? "👑 " : `${index + 1}. `;
    const rowDiv = document.createElement("div");
    rowDiv.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; color: white; margin-bottom: 8px; font-family: monospace; font-size: 15px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 5px;";

    const infoSpan = document.createElement("span");
    infoSpan.textContent = `${rankPrefix}${player.name}`;

    const rightBox = document.createElement("div");
    rightBox.style.cssText = "display: flex; align-items: center; gap: 10px;";

    const scoreSpan = document.createElement("span");
    scoreSpan.style.cssText = "color: #2ecc71; font-weight: bold;";
    scoreSpan.textContent = String(player.score);
    rightBox.appendChild(scoreSpan);

    if (isAdmin) {
      const delScoreBtn = document.createElement("button");
      delScoreBtn.className = "delete-resource-btn";
      delScoreBtn.textContent = "🗑️";
      delScoreBtn.title = "Delete score";
      delScoreBtn.addEventListener("click", async () => {
        if (confirm(`Delete score for ${player.name}?`)) {
          try {
            await window.deleteDoc(
              window.doc(window.db, "DriftScores", player.id),
            );
            rowDiv.remove();
          } catch (err) {
            alert("Delete failed: " + err.message);
          }
        }
      });
      rightBox.appendChild(delScoreBtn);
    }

    rowDiv.appendChild(infoSpan);
    rowDiv.appendChild(rightBox);
    leaderboardList.appendChild(rowDiv);
  });
}

// ==========================================
// 12. CACHED TEXTURES & ZERO-LAG GEOMETRY POOL
// ==========================================
window.input = { gas: false, left: false, right: false };

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") window.input.left = true;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") window.input.right = true;
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") window.input.gas = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") window.input.left = false;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") window.input.right = false;
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") window.input.gas = false;
});

function createTextBannerTexture(title, subtitle, bgHex, borderHex) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 128);

  for (let y = 0; y < 128; y += 16) {
    for (let x = 0; x < 32; x += 16) {
      ctx.fillStyle = (x + y) % 32 === 0 ? "#ffffff" : "#000000";
      ctx.fillRect(x, y, 16, 16);
      ctx.fillRect(512 - 32 + x, y, 16, 16);
    }
  }

  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 506, 122);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 36px monospace";
  ctx.textAlign = "center";
  ctx.fillText(title, 256, 56);

  ctx.fillStyle = borderHex;
  ctx.font = "700 22px monospace";
  ctx.fillText(subtitle, 256, 96);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function build3DGantryArch(title, subtitle, accentColor, borderHex) {
  const archGroup = new THREE.Group();
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.3,
  });
  const neonMat = new THREE.MeshBasicMaterial({ color: accentColor });

  [-9.5, 9.5].forEach((px) => {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.36, 6.5, 12),
      pillarMat,
    );
    pillar.position.set(px, 3.25, 0);
    archGroup.add(pillar);

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 6.0, 0.15),
      neonMat,
    );
    strip.position.set(px > 0 ? px - 0.3 : px + 0.3, 3.25, 0);
    archGroup.add(strip);
  });

  const bannerTex = createTextBannerTexture(title, subtitle, "#090d16", borderHex);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(19.6, 2.3, 0.45),
    new THREE.MeshBasicMaterial({ map: bannerTex }),
  );
  board.position.set(0, 5.6, 0);
  archGroup.add(board);

  return archGroup;
}

// ==========================================
// 13. TRUE EXTRUDED 3D CARS, CHROME HANDPIECE & SDF MOLAR
// ==========================================

// 1. REAL CAR SILHOUETTE BUILDER (Black G37x, Blue R34 Skyline, White Accent)
function build3DCarMesh(carType, isTraffic = false) {
  const carGroup = new THREE.Group();
  const bodyPivot = new THREE.Group();
  carGroup.add(bodyPivot);

  // Authentic Colors Requested by User:
  // G37x = Obsidian Black, Skyline = Bayside Blue, Accent = Pearl White
  let bodyColor = 0x111827; // Black G37x
  let emissiveTint = 0x1e293b; // Subtle slate reflection so Black G37 pops against dark road
  let rimColor = 0xe2e8f0;
  let underglowColor = 0xef4444;

  if (carType === "skyline") {
    bodyColor = 0x0284c7; // Bayside Blue GT-R R34
    emissiveTint = 0x0369a1;
    rimColor = 0xd97706; // Bronze R34 TE37 Rims
    underglowColor = 0x38bdf8;
  } else if (carType === "accent") {
    bodyColor = 0xf8fafc; // Pearl White Hyundai Accent
    emissiveTint = 0x94a3b8;
    rimColor = 0x334155; // Gunmetal Sport Rims
    underglowColor = 0xfacc15;
  } else if (isTraffic) {
    const trafficColors = [0x475569, 0x991b1b, 0x065f46, 0x3730a3, 0xd97706];
    bodyColor = trafficColors[Math.floor(Math.random() * trafficColors.length)];
    emissiveTint = 0x0f172a;
  }

  // Low metalness + High Clearcoat prevents Three.js from rendering cars pitch-black!
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    emissive: emissiveTint,
    emissiveIntensity: 0.22,
    metalness: 0.18,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.4,
  });

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    emissive: 0x64748b,
    emissiveIntensity: 0.2,
    roughness: 0.15,
    clearcoat: 1.0,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x020617,
    emissive: 0x0f172a,
    emissiveIntensity: 0.25,
    roughness: 0.08,
    clearcoat: 1.0,
  });

  // Extrude a True 2D Side-Profile Silhouette (z = -2.2 Front to z = +2.2 Rear)
  const profile = new THREE.Shape();
  if (carType === "skyline") {
    // R34 GT-R Boxy Muscular Coupe Profile
    profile.moveTo(-2.15, 0.22);
    profile.lineTo(-2.1, 0.68); // Aggressive flat front bumper
    profile.lineTo(-0.85, 0.78); // Long flat R34 hood
    profile.lineTo(-0.25, 1.24); // Steep windshield
    profile.lineTo(0.85, 1.22); // Coupe roofline
    profile.lineTo(1.45, 0.84); // Rear window slope
    profile.lineTo(2.15, 0.82); // Boxy R34 trunk deck
    profile.lineTo(2.15, 0.24); // Rear diffuser
    profile.closePath();
  } else if (carType === "accent") {
    // Hyundai Accent Compact Fastback/Hatch Sedan Profile
    profile.moveTo(-1.95, 0.22);
    profile.lineTo(-1.88, 0.62); // Nose
    profile.lineTo(-0.85, 0.76); // Short sloped hood
    profile.lineTo(-0.15, 1.26); // Swept windshield
    profile.lineTo(0.95, 1.24); // High compact roof
    profile.lineTo(1.75, 0.82); // Fastback hatch rear
    profile.lineTo(1.9, 0.25);
    profile.closePath();
  } else {
    // Infiniti G37x Sleek Sport Sedan Profile (Curved VQ Hood + Flowing Roof + High Deck)
    profile.moveTo(-2.15, 0.22);
    profile.lineTo(-2.05, 0.64); // Front fascia
    profile.lineTo(-0.8, 0.8); // Bulging G37 hood
    profile.lineTo(-0.15, 1.25); // Raked sedan windshield
    profile.lineTo(0.85, 1.23); // Arched sedan roof
    profile.lineTo(1.55, 0.85); // C-pillar slope
    profile.lineTo(2.12, 0.82); // High G37 trunk deck
    profile.lineTo(2.12, 0.24);
    profile.closePath();
  }

  const extrudeSettings = {
    depth: 1.62,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.12,
    bevelThickness: 0.12,
  };
  const bodyGeo = new THREE.ExtrudeGeometry(profile, extrudeSettings);
  // Rotate so profile runs along Z axis (front = -Z, rear = +Z) and center X
  bodyGeo.rotateY(Math.PI / 2);
  bodyGeo.translate(-0.81, 0, 0);

  const mainBody = new THREE.Mesh(bodyGeo, paintMat);
  bodyPivot.add(mainBody);

  // Flared Wheel Arches / Widebody Fenders
  const fenderRadius = carType === "skyline" ? 0.18 : 0.11;
  const fenderGeo = new THREE.BoxGeometry(1.96 + fenderRadius, 0.42, 0.95);
  [-1.32, 1.32].forEach((fz) => {
    const fender = new THREE.Mesh(fenderGeo, paintMat);
    fender.position.set(0, 0.44, fz);
    bodyPivot.add(fender);
  });

  // Dark Tinted Windshield, Rear Glass & Side Windows
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.48, 0.44, 1.85),
    glassMat,
  );
  windshield.position.set(0, 1.03, 0.35);
  bodyPivot.add(windshield);

  // G37 Silver Window Trim or Accent Black Roof Contrast
  if (carType === "g37" && !isTraffic) {
    [-0.78, 0.78].forEach((sx) => {
      const chromeStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.05, 1.75),
        chromeMat,
      );
      chromeStrip.position.set(sx, 0.84, 0.35);
      bodyPivot.add(chromeStrip);
    });
  } else if (carType === "accent" && !isTraffic) {
    const blackRoof = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.04, 1.35),
      trimMat,
    );
    blackRoof.position.set(0, 1.37, 0.38);
    bodyPivot.add(blackRoof);
  }

  // Front Grille & Headlights (at Front -Z)
  const frontZ = carType === "accent" ? -2.02 : -2.22;
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.24, 0.08),
    carType === "g37" ? chromeMat : trimMat,
  );
  grille.position.set(0, 0.48, frontZ);
  bodyPivot.add(grille);

  if (carType === "skyline" && !isTraffic) {
    // Silver Front-Mount Intercooler in lower bumper
    const intercooler = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.18, 0.08),
      chromeMat,
    );
    intercooler.position.set(0, 0.28, frontZ);
    bodyPivot.add(intercooler);
  }

  const headLightMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
  [-0.68, 0.68].forEach((hx) => {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.15, 0.1),
      headLightMat,
    );
    hl.position.set(hx, 0.58, frontZ);
    bodyPivot.add(hl);
  });

  // Signature Rear Taillights, Spoilers & Exhausts (at Rear +Z)
  const rearZ = carType === "accent" ? 1.98 : 2.22;
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1e27 });

  if (carType === "g37" && !isTraffic) {
    // G37x: Quad Red Halo Rings + Chrome Trunk Garnish + Ducktail + Dual Chrome Exhausts
    const redHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.2, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x7f1d1d }),
    );
    [-0.58, 0.58].forEach((hx) => {
      const hClone = redHousing.clone();
      hClone.position.set(hx, 0.64, rearZ);
      bodyPivot.add(hClone);
    });
    [-0.68, -0.46, 0.46, 0.68].forEach((tx, idx) => {
      const r = idx === 0 || idx === 3 ? 0.09 : 0.07;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.025, 10, 20),
        tailMat,
      );
      ring.position.set(tx, 0.64, rearZ + 0.03);
      bodyPivot.add(ring);
    });
    const chromeTrunkBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.05, 0.06),
      chromeMat,
    );
    chromeTrunkBar.position.set(0, 0.68, rearZ + 0.02);
    bodyPivot.add(chromeTrunkBar);

    [-0.56, 0.56].forEach((ex) => {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.3, 12),
        chromeMat,
      );
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(ex, 0.24, rearZ + 0.08);
      bodyPivot.add(pipe);
    });
  } else if (carType === "skyline" && !isTraffic) {
    // R34 GT-R: Iconic Dual-Size Round Taillights + Tall R34 Wing + Left Exhaust Cannon
    [-0.68, -0.44, 0.44, 0.68].forEach((tx, idx) => {
      const r = idx === 0 || idx === 3 ? 0.11 : 0.08;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.032, 10, 20),
        tailMat,
      );
      ring.position.set(tx, 0.62, rearZ + 0.03);
      bodyPivot.add(ring);
    });
    // Raised R34 Wing painted Bayside Blue with black center blade
    const wingBlade = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 0.07, 0.32),
      paintMat,
    );
    wingBlade.position.set(0, 1.16, rearZ - 0.18);
    bodyPivot.add(wingBlade);
    [-0.68, 0.68].forEach((sx) => {
      const stand = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.32, 0.24),
        paintMat,
      );
      stand.position.set(sx, 0.98, rearZ - 0.18);
      bodyPivot.add(stand);
    });
  } else {
    // Accent & Traffic: Sleek Wrap-Around Red LED Taillight Clusters
    [-0.6, 0.6].forEach((tx) => {
      const tl = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.18, 0.08),
        tailMat,
      );
      tl.position.set(tx, 0.62, rearZ + 0.02);
      bodyPivot.add(tl);
    });
  }

  // 4 Detailed Wheels + Multi-Spoke Rims
  const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.85,
  });
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.3, 10);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    roughness: 0.25,
  });

  const zWheel = carType === "accent" ? 1.22 : 1.34;
  [
    [-0.96, 0.37, -zWheel],
    [0.96, 0.37, -zWheel],
    [-0.96, 0.37, zWheel],
    [0.96, 0.37, zWheel],
  ].forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(wx, wy, wz);
    carGroup.add(w);
    const r = new THREE.Mesh(rimGeo, rimMat);
    r.position.set(wx, wy, wz);
    carGroup.add(r);
  });

  let exhaustFlames = null;
  if (!isTraffic) {
    const neonGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 4.4),
      new THREE.MeshBasicMaterial({
        color: underglowColor,
        transparent: true,
        opacity: 0.25,
      }),
    );
    neonGlow.rotation.x = -Math.PI / 2;
    neonGlow.position.y = 0.03;
    carGroup.add(neonGlow);

    exhaustFlames = new THREE.Group();
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });
    [-0.55, 0.55].forEach((fx) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.9, 10),
        flameMat,
      );
      cone.rotation.x = Math.PI / 2;
      cone.position.set(fx, 0.25, rearZ + 0.5);
      exhaustFlames.add(cone);
    });
    exhaustFlames.visible = false;
    bodyPivot.add(exhaustFlames);
  }

  carGroup.userData = { bodyPivot, exhaustFlames };
  return carGroup;
}

// 2. ONE-PIECE CONNECTED SURGICAL SILVER CONTRA-ANGLE HANDPIECE (No Floating Black Pipes!)
function build3DDentalHandpiece() {
  const rootGroup = new THREE.Group();

  // Tilted slightly so you see the connected body, contra-angle neck, chuck head & bur
  const instrumentGroup = new THREE.Group();
  instrumentGroup.position.set(0, 0.82, -0.85);
  rootGroup.add(instrumentGroup);

  // Surgical Silver-Chrome Material (Low metalness + High Clearcoat so it gleams white-silver, NEVER black!)
  const silverMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.12,
    metalness: 0.15,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  const blueRingMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.2,
    roughness: 0.2,
    clearcoat: 1.0,
  });

  // Vertical Turbine Chuck Head directly over the tooth
  const chuckHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.21, 0.58, 24),
    silverMat,
  );
  chuckHead.position.set(0, 0.25, 0);
  instrumentGroup.add(chuckHead);

  // Push-Button Cap on top of the Chuck Head
  const pushCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 20, 12),
    blueRingMat,
  );
  pushCap.scale.set(1, 0.42, 1);
  pushCap.position.set(0, 0.55, 0);
  instrumentGroup.add(pushCap);

  // Connected Elbow Sphere Joint at the back of the Chuck Head
  const elbowJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 16),
    silverMat,
  );
  elbowJoint.position.set(0, 0.28, 0.18);
  instrumentGroup.add(elbowJoint);

  // Connected Contra-Angle Neck & Handle Extending Smoothly to the Rear-Right
  const armPivot = new THREE.Group();
  armPivot.position.set(0, 0.28, 0.18);
  armPivot.rotation.y = -0.38; // Angled ergonomically to the right side of the screen
  armPivot.rotation.x = 0.22;  // Angled slightly upward toward the clinician's hand
  instrumentGroup.add(armPivot);

  // Tapered Neck (Starts at z = 0 inside the elbow joint and extends to z = 1.2)
  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.17, 1.25, 24),
    silverMat,
  );
  neckMesh.rotation.x = Math.PI / 2;
  neckMesh.position.set(0, 0, 0.62);
  armPivot.add(neckMesh);

  // Blue Anodized Collar Ring at Neck-Handle Junction (z = 1.25)
  const collarRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.255, 0.255, 0.18, 24),
    blueRingMat,
  );
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.set(0, 0, 1.25);
  armPivot.add(collarRing);

  // Main Ergonomic Grip Barrel (Connected flush at z = 1.25 extending to z = 3.4)
  const barrelMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 2.2, 24),
    silverMat,
  );
  barrelMesh.rotation.x = Math.PI / 2;
  barrelMesh.position.set(0, 0, 2.35);
  armPivot.add(barrelMesh);

  // Spinning High-Speed Diamond Bur protruding from bottom of Chuck Head
  const burPivot = new THREE.Group();
  burPivot.position.set(0, -0.04, 0);
  instrumentGroup.add(burPivot);

  const burShank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.45, 12),
    silverMat,
  );
  burShank.position.y = -0.2;
  burPivot.add(burShank);

  const diamondBurTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
  );
  diamondBurTip.position.y = -0.44;
  burPivot.add(diamondBurTip);

  // Focused Ultrasonic Water-Laser Beam (Shoots downward + forward onto the molar!)
  const laserBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.32, 8.5, 16),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
    }),
  );
  laserBeam.rotation.x = Math.PI / 2;
  laserBeam.position.set(0, -0.35, -4.2);
  instrumentGroup.add(laserBeam);

  // Target Reticle on the Molar Surface
  const aimRing = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.52, 24),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    }),
  );
  aimRing.rotation.x = -Math.PI / 2;
  aimRing.position.set(0, -0.64, 0);
  instrumentGroup.add(aimRing);

  rootGroup.userData = { burPivot, laserBeam, aimRing, instrumentGroup };
  return rootGroup;
}

// 3. REUSE THE EXACT HOME-SCREEN 3D SDF PORCELAIN MOLAR FOR THE ARCH!
let cachedHomeMolarGeo = null;
let cachedHomeMolarMat = null;

function buildHomeScreenMolarClone() {
  if (!cachedHomeMolarGeo) {
    if (typeof buildSeamlessPorcelainMolarGeometry === "function") {
      cachedHomeMolarGeo = buildSeamlessPorcelainMolarGeometry();
      const pos = cachedHomeMolarGeo.attributes.position;
      const norm = cachedHomeMolarGeo.attributes.normal;
      const colors = [];
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const ny = norm.getY(i);
        const rXZ = Math.sqrt(vx * vx + vz * vz);
        const fossaShadow =
          vy > 0.35 ? Math.exp(-rXZ * rXZ * 9.0) * 0.26 : 0.0;
        const furcationShadow =
          vy < 0.08 && vy > -0.55 ? Math.exp(-rXZ * rXZ * 11.0) * 0.3 : 0.0;
        const undercutShadow = ny < -0.15 ? Math.abs(ny) * 0.16 : 0.0;
        const shade = Math.max(
          0.52,
          1.0 - fossaShadow - furcationShadow - undercutShadow,
        );
        colors.push(shade * 0.96, shade * 0.98, Math.min(1.0, shade * 1.02));
      }
      cachedHomeMolarGeo.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3),
      );
    } else {
      cachedHomeMolarGeo = new THREE.SphereGeometry(0.8, 24, 24);
    }

    cachedHomeMolarMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      color: 0xffffff,
      roughness: 0.18,
      metalness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      reflectivity: 1.0,
    });
  }

  const molarMesh = new THREE.Mesh(cachedHomeMolarGeo, cachedHomeMolarMat);
  molarMesh.scale.set(1.65, 1.35, 1.65);
  molarMesh.position.y = -0.78;
  return molarMesh;
}

// ==========================================
// 14. SHARED ARCADE STATE & DELTA-TIME ENGINE
// ==========================================
let gameLoopId = null;
let lastFrameTimestamp = 0;
let activeGameMode = "drift";
let activeCarSelection = "g37";

let webglRenderer = null;
let webglScene = null;
let webglCamera = null;
let playerMesh = null;

let score = 0;
let comboMultiplier = 1;
let distanceTraveled = 0;
let totalRunDistance = 1600; // ~65 seconds at smooth delta-time speed
let currentStageNumber = 1;
let countdownSeconds = 3.0;
let countdownLastInt = 4;
let victorySeconds = 0;
let raceFinished = false;
let startTime = 0;
let crashShake = 0;
let bannerTimeout = null;

// Drift Mode Specific State
let playerLaneOffset = 0;
let playerSpeed = 0; // Units per second
let driftSlipAngle = 0;
let activeDriftBank = 0;
let roadSegments = [];
let trafficCars = [];
let nitroPads = [];
let smokeParticles = [];
let startGantry = null;
let finishGantry = null;

// Dental Runner Specific State
let dentalTargetLane = 0;
let dentalCurrentX = 0;
let laneSwitchLocked = false;
let molarRows = [];
let dentalTargets = [];
let shatterParticles = [];

function showHudBanner(text, color = "#facc15", duration = 1100) {
  const banner = document.getElementById("hud-floating-banner");
  if (!banner) return;
  banner.textContent = text;
  banner.style.color = color;
  banner.classList.add("show");
  if (bannerTimeout) clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => banner.classList.remove("show"), duration);
}

// Gentle, Enjoyable Sweeping Highway Curve (Never throws the player off-road)
function getTougeCurveX(worldDistance) {
  if (worldDistance < 60) return 0;
  const d = worldDistance - 60;
  const ramp = Math.min(1.0, d / 120);
  return ramp * (Math.sin(d * 0.014) * 5.5 + Math.cos(d * 0.007) * 3.5);
}

window.startGame = function (modeOrCar) {
  closeGameMenu();
  const gameCanvasOverlay = document.getElementById("game-canvas-overlay");
  const scoreboardModal = document.getElementById("scoreboard-modal");
  const actionBtn = document.getElementById("btn-game-action");
  const secLabel = document.getElementById("hud-secondary-label");

  if (gameCanvasOverlay) gameCanvasOverlay.style.display = "flex";
  if (scoreboardModal) scoreboardModal.style.display = "none";

  window.input = { gas: false, left: false, right: false };
  score = 0;
  comboMultiplier = 1;
  distanceTraveled = 0;
  currentStageNumber = 1;
  countdownSeconds = 2.8;
  countdownLastInt = 4;
  victorySeconds = 0;
  raceFinished = false;
  crashShake = 0;

  sfx.init();
  stopArcadeAudio();

  if (modeOrCar === "dental_runner") {
    activeGameMode = "dental_runner";
    totalRunDistance = 1250; // Smooth ~60s 3-Stage Clinical Shift
    if (actionBtn) actionBtn.textContent = "⚡ Hold Drill / Laser";
    if (secLabel) secLabel.textContent = "STREAK";
    initDentalRunnerScene();
    dentalArcadeSynth.startMusic();
  } else {
    activeGameMode = "drift";
    activeCarSelection = modeOrCar || "g37";
    totalRunDistance = 1850; // Smooth ~65s 3-Stage Touge Run
    if (actionBtn) actionBtn.textContent = "⏫ Drift Gas";
    if (secLabel) secLabel.textContent = "COMBO";
    initNightDriftScene();
    try {
      soundtrack.play().catch(() => {});
      engineAudio.volume = 0;
      engineAudio.play().catch(() => {});
      driftAudio.volume = 0;
      driftAudio.play().catch(() => {});
    } catch (e) {}
  }

  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  lastFrameTimestamp = performance.now();
  gameLoopId = requestAnimationFrame(masterArcadeLoop);
};

window.quitGame = function () {
  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }
  const gameCanvasOverlay = document.getElementById("game-canvas-overlay");
  if (gameCanvasOverlay) gameCanvasOverlay.style.display = "none";
  stopArcadeAudio();
};

function ensureWebGLRenderer() {
  const canvas = document.getElementById("drift-canvas");
  if (!canvas || typeof THREE === "undefined") return false;
  if (!webglRenderer) {
    webglRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    // Capped pixelRatio at 1.25 for butter-smooth 60 FPS on mobile GPUs
    webglRenderer.setSize(540, 720, false);
    webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    webglRenderer.toneMappingExposure = 1.08;
  }
  return true;
}

// ==========================================
// 15. MODE A: 3D MIDNIGHT TOUGE DRIFT (WIDE 4-LANE HIGHWAY)
// ==========================================
function initNightDriftScene() {
  if (!ensureWebGLRenderer()) return;

  webglScene = new THREE.Scene();
  webglScene.background = new THREE.Color(0x070b16);
  webglScene.fog = new THREE.FogExp2(0x070b16, 0.009);

  webglCamera = new THREE.PerspectiveCamera(58, 540 / 720, 0.1, 240);

  // Strong overhead & side studio lighting so Black G37, Blue Skyline, and White Accent pop!
  const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 1.1);
  webglScene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
  dirLight.position.set(12, 28, 16);
  webglScene.add(dirLight);

  // 32 Wide 4-Lane Highway Slices (Width = 19.6 units so drifting is wide & forgiving!)
  roadSegments = [];
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x161f30,
    roughness: 0.45,
  });
  const redCurbMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const whiteCurbMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const railMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const bldgMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x1e3a8a,
    emissiveIntensity: 0.35,
  });

  for (let i = 0; i < 32; i++) {
    const segGroup = new THREE.Group();
    segGroup.userData = { zLocal: -i * 6.5 };

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(19.6, 0.2, 6.7),
      asphaltMat,
    );
    slab.position.y = -0.1;
    segGroup.add(slab);

    const cMat = i % 2 === 0 ? redCurbMat : whiteCurbMat;
    [-9.9, 9.9].forEach((cx) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 6.6), cMat);
      curb.position.set(cx, 0.08, 0);
      segGroup.add(curb);

      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.6, 6.6),
        railMat,
      );
      rail.position.set(cx > 0 ? cx + 0.38 : cx - 0.38, 0.35, 0);
      segGroup.add(rail);
    });

    if (i % 2 === 0) {
      [-4.8, 0, 4.8].forEach((lx) => {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 3.2), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(lx, 0.02, 0);
        segGroup.add(dash);
      });
    }

    if (i % 4 === 0) {
      [-11.0, 11.0].forEach((px) => {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.14, 6.5, 8),
          poleMat,
        );
        pole.position.set(px, 3.25, 0);
        segGroup.add(pole);

        const bulb = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.16, 0.35),
          lampGlowMat,
        );
        bulb.position.set(px > 0 ? px - 0.7 : px + 0.7, 6.45, 0);
        segGroup.add(bulb);
      });

      [-22, 22].forEach((bx) => {
        const h = 16 + ((i * 7) % 22);
        const bldg = new THREE.Mesh(new THREE.BoxGeometry(7.5, h, 6.2), bldgMat);
        bldg.position.set(bx, h / 2, 0);
        segGroup.add(bldg);
      });
    }

    webglScene.add(segGroup);
    roadSegments.push(segGroup);
  }

  startGantry = build3DGantryArch(
    "BAGHDAD MIDNIGHT TOUGE",
    "STEER + HOLD DRIFT GAS TO SLIDE",
    0x38bdf8,
    "#38bdf8",
  );
  startGantry.position.set(0, 0, -14);
  webglScene.add(startGantry);

  finishGantry = build3DGantryArch(
    "🏁 FINISH LINE 🏁",
    "TOUGE STAGE COMPLETE",
    0x10b981,
    "#10b981",
  );
  finishGantry.visible = false;
  webglScene.add(finishGantry);

  playerLaneOffset = 0;
  playerSpeed = 12;
  driftSlipAngle = 0;
  activeDriftBank = 0;
  playerMesh = build3DCarMesh(activeCarSelection, false);
  webglScene.add(playerMesh);

  // Only 3 Traffic Cars spaced far apart across 4 wide lanes (Easy & fun to weave around!)
  trafficCars = [];
  const wideLanes = [-6.8, -2.3, 2.3, 6.8];
  for (let i = 0; i < 3; i++) {
    const tCar = build3DCarMesh("traffic", true);
    tCar.userData = {
      laneOffset: wideLanes[i % 4],
      zDist: -65 - i * 65,
      speed: 14 + i * 2,
      nearMissed: false,
    };
    webglScene.add(tCar);
    trafficCars.push(tCar);
  }

  // Glowing Nitro Pads
  nitroPads = [];
  const nitroMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.85,
  });
  for (let i = 0; i < 2; i++) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 5.2), nitroMat);
    pad.rotation.x = -Math.PI / 2;
    pad.userData = {
      laneOffset: wideLanes[(i + 2) % 4],
      zDist: -80 - i * 95,
    };
    webglScene.add(pad);
    nitroPads.push(pad);
  }

  // Orange/White Drift Tire Smoke Pool
  smokeParticles = [];
  const smokeGeo = new THREE.SphereGeometry(0.34, 8, 8);
  for (let i = 0; i < 22; i++) {
    const sMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0,
    });
    const puff = new THREE.Mesh(smokeGeo, sMat);
    puff.visible = false;
    puff.userData = { life: 0, vx: 0, vy: 0, vz: 0 };
    webglScene.add(puff);
    smokeParticles.push(puff);
  }

  positionWindingDriftWorld();
}

function positionWindingDriftWorld() {
  const playerCurveX = getTougeCurveX(distanceTraveled);
  const playerNextCurveX = getTougeCurveX(distanceTraveled + 6);
  const roadHeading = Math.atan2(playerNextCurveX - playerCurveX, 6);

  roadSegments.forEach((seg) => {
    const zRel = seg.userData.zLocal;
    const segWorldDist = distanceTraveled - zRel;
    const segCurveX = getTougeCurveX(segWorldDist);
    const nextCurveX = getTougeCurveX(segWorldDist + 6);
    const segAngle = Math.atan2(nextCurveX - segCurveX, 6);

    seg.position.set(segCurveX, 0, zRel);
    seg.rotation.y = -segAngle;
  });

  if (startGantry) {
    const startZ = -14 + distanceTraveled;
    startGantry.visible = startZ < 14;
    if (startGantry.visible) {
      startGantry.position.set(getTougeCurveX(14), 0, startZ);
    }
  }

  if (finishGantry) {
    const remDist = totalRunDistance - distanceTraveled;
    finishGantry.visible = remDist < 190;
    if (finishGantry.visible) {
      finishGantry.position.set(getTougeCurveX(totalRunDistance), 0, -remDist);
    }
  }

  const worldPlayerX = playerCurveX + playerLaneOffset;
  if (playerMesh) {
    playerMesh.position.set(worldPlayerX, 0, 0);
    playerMesh.rotation.y = -roadHeading + driftSlipAngle;
    if (playerMesh.userData.bodyPivot) {
      playerMesh.userData.bodyPivot.rotation.z = -driftSlipAngle * 0.25;
    }
    if (playerMesh.userData.exhaustFlames) {
      playerMesh.userData.exhaustFlames.visible =
        window.input.gas && playerSpeed > 22;
      playerMesh.userData.exhaustFlames.scale.z = 0.8 + Math.random() * 0.5;
    }
  }

  const shakeX = crashShake > 0 ? (Math.random() - 0.5) * 0.35 : 0;
  if (crashShake > 0) crashShake--;

  if (victorySeconds > 0) {
    const angle = (1.8 - victorySeconds) * 2.2;
    webglCamera.position.set(
      worldPlayerX + Math.sin(angle) * 7.2,
      3.3,
      Math.cos(angle) * 7.2,
    );
    webglCamera.lookAt(worldPlayerX, 0.8, 0);
  } else if (countdownSeconds > 0) {
    const t = countdownSeconds / 2.8;
    webglCamera.position.set(
      worldPlayerX + Math.sin(t * 1.5) * 3.0,
      2.6 + (1 - t) * 1.0,
      6.2 + t * 2.0,
    );
    webglCamera.lookAt(worldPlayerX, 0.85, -10);
  } else {
    const lookAheadCurveX = getTougeCurveX(distanceTraveled + 16);
    webglCamera.position.set(
      playerCurveX + playerLaneOffset * 0.72 + shakeX,
      3.55,
      7.2,
    );
    webglCamera.lookAt(
      lookAheadCurveX + playerLaneOffset * 0.55,
      0.85,
      -15,
    );
  }
}

function updateNightDriftLoop(dt) {
  // Controllable Real-Time Speeds (Units per second)
  const topSpeed =
    activeCarSelection === "skyline"
      ? 35
      : activeCarSelection === "g37"
        ? 33
        : 31;
  const cruiseSpeed = 16;

  if (window.input.gas) {
    playerSpeed = Math.min(topSpeed, playerSpeed + 22 * dt);
  } else {
    playerSpeed = Math.max(cruiseSpeed, playerSpeed - 14 * dt);
  }

  // Smooth, Direct Arcade Steering & Satisfying Controlled Drift Slide
  let steerInput = 0;
  if (window.input.left) steerInput = -1;
  if (window.input.right) steerInput = 1;

  const steerSpeed = activeCarSelection === "accent" ? 13.5 : 12.0;
  playerLaneOffset += steerInput * steerSpeed * dt;

  // When holding Gas + Steering, kick the tail out into a wide, easy-to-hold 35-deg drift!
  const targetSlip =
    steerInput !== 0 && window.input.gas ? -steerInput * 0.58 : 0;
  driftSlipAngle += (targetSlip - driftSlipAngle) * Math.min(1, 8.5 * dt);

  const isDrifting = Math.abs(driftSlipAngle) > 0.18 && window.input.gas;
  if (isDrifting) {
    const ptsGain = Math.ceil(280 * dt * comboMultiplier);
    activeDriftBank += ptsGain;
    score += ptsGain;

    if (Math.random() < 0.45) {
      showHudBanner(
        `🔥 DRIFT SLIDE! +${activeDriftBank} (x${comboMultiplier})`,
        "#38bdf8",
        400,
      );
    }

    const freeSmoke = smokeParticles.find((p) => p.userData.life <= 0);
    if (freeSmoke && playerMesh) {
      freeSmoke.visible = true;
      freeSmoke.position.set(
        playerMesh.position.x + (Math.random() - 0.5) * 1.5,
        0.22,
        2.1,
      );
      freeSmoke.scale.set(0.65, 0.65, 0.65);
      freeSmoke.material.opacity = 0.6;
      freeSmoke.userData = {
        life: 1.0,
        vx: (Math.random() - 0.5) * 2.5,
        vy: 1.4,
        vz: playerSpeed * 0.45,
      };
    }
  } else {
    if (activeDriftBank >= 150) {
      comboMultiplier = Math.min(10, comboMultiplier + 1);
      sfx.playDing(820 + comboMultiplier * 60);
      showHudBanner(
        `✅ DRIFT LOCKED! +${activeDriftBank} (Combo x${comboMultiplier})`,
        "#34d399",
      );
    }
    activeDriftBank = 0;
    score += Math.ceil(35 * dt);
  }

  // Forgiving Soft Guardrail Bounce at +/- 8.6 units
  if (Math.abs(playerLaneOffset) > 8.6) {
    playerLaneOffset = Math.sign(playerLaneOffset) * 8.3;
    playerSpeed *= 0.8;
    driftSlipAngle *= 0.5;
    crashShake = 8;
    sfx.playCrash();
    showHudBanner("⚠️ WALL SCRAPE!", "#fb923c");
  }

  const stepDist = playerSpeed * dt;
  distanceTraveled += stepDist;

  // Stage Announcements
  const progRatio = distanceTraveled / totalRunDistance;
  if (progRatio >= 0.33 && currentStageNumber === 1) {
    currentStageNumber = 2;
    score += 1000;
    sfx.playCountdownBeep(true);
    showHudBanner("🌆 SECTOR 2: NEON BRIDGE! +1000", "#38bdf8", 1600);
    webglScene.background.setHex(0x0b071e);
    webglScene.fog.color.setHex(0x0b071e);
  } else if (progRatio >= 0.66 && currentStageNumber === 2) {
    currentStageNumber = 3;
    score += 1500;
    sfx.playCountdownBeep(true);
    showHudBanner("🔥 FINAL SECTOR: TOUGE SPRINT! +1500", "#facc15", 1600);
    webglScene.background.setHex(0x160714);
    webglScene.fog.color.setHex(0x160714);
  }

  roadSegments.forEach((seg) => {
    seg.userData.zLocal += stepDist;
    if (seg.userData.zLocal > 13) {
      seg.userData.zLocal -= 32 * 6.5;
    }
  });

  const wideLanes = [-6.8, -2.3, 2.3, 6.8];
  nitroPads.forEach((pad) => {
    pad.userData.zDist += stepDist;
    const padWorldDist = distanceTraveled - pad.userData.zDist;
    pad.position.set(
      getTougeCurveX(padWorldDist) + pad.userData.laneOffset,
      0.04,
      pad.userData.zDist,
    );

    if (
      Math.abs(pad.userData.zDist) < 2.8 &&
      Math.abs(playerLaneOffset - pad.userData.laneOffset) < 1.85
    ) {
      playerSpeed = Math.min(topSpeed + 8, playerSpeed + 8);
      const pts = 400 * comboMultiplier;
      score += pts;
      sfx.playDing(1150);
      showHudBanner(`🚀 NITRO BOOST! +${pts}`, "#34d399");
      pad.userData.zDist = -190 - Math.random() * 40;
      pad.userData.laneOffset = wideLanes[Math.floor(Math.random() * 4)];
    } else if (pad.userData.zDist > 14) {
      pad.userData.zDist = -190 - Math.random() * 40;
      pad.userData.laneOffset = wideLanes[Math.floor(Math.random() * 4)];
    }
  });

  trafficCars.forEach((tCar) => {
    tCar.userData.zDist += (playerSpeed - tCar.userData.speed) * dt;
    const carWorldDist = distanceTraveled - tCar.userData.zDist;
    const curveX = getTougeCurveX(carWorldDist);
    const nextCurveX = getTougeCurveX(carWorldDist + 5);
    tCar.position.set(
      curveX + tCar.userData.laneOffset,
      0,
      tCar.userData.zDist,
    );
    tCar.rotation.y = -Math.atan2(nextCurveX - curveX, 5);

    const dz = Math.abs(tCar.userData.zDist);
    const dx = Math.abs(playerLaneOffset - tCar.userData.laneOffset);

    if (dz < 3.2 && dx < 1.55) {
      playerSpeed = 14;
      activeDriftBank = 0;
      comboMultiplier = 1;
      score = Math.max(0, score - 200);
      crashShake = 14;
      sfx.playCrash();
      showHudBanner("💥 BUMPED TRAFFIC! -200", "#ef4444");
      tCar.userData.zDist = -180 - Math.random() * 50;
      tCar.userData.laneOffset = wideLanes[Math.floor(Math.random() * 4)];
      tCar.userData.nearMissed = false;
    } else if (
      tCar.userData.zDist > 0.5 &&
      tCar.userData.zDist < 5.5 &&
      dx < 3.4 &&
      !tCar.userData.nearMissed
    ) {
      tCar.userData.nearMissed = true;
      comboMultiplier = Math.min(10, comboMultiplier + 1);
      const pts = 400 * comboMultiplier;
      score += pts;
      sfx.playDing(920 + comboMultiplier * 65);
      showHudBanner(`⚡ NEAR MISS! +${pts} (x${comboMultiplier})`, "#facc15");
    }

    if (tCar.userData.zDist > 15) {
      tCar.userData.zDist = -180 - Math.random() * 50;
      tCar.userData.laneOffset = wideLanes[Math.floor(Math.random() * 4)];
      tCar.userData.nearMissed = false;
    }
  });

  smokeParticles.forEach((p) => {
    if (p.userData.life > 0) {
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      p.scale.multiplyScalar(1 + 1.8 * dt);
      p.userData.life -= 2.2 * dt;
      p.material.opacity = Math.max(0, p.userData.life * 0.55);
      if (p.userData.life <= 0) p.visible = false;
    }
  });

  positionWindingDriftWorld();

  engineAudio.volume = Math.min(0.2, 0.03 + (playerSpeed / 35) * 0.14);
  engineAudio.playbackRate = 0.8 + (playerSpeed / 35) * 0.5;
  driftAudio.volume = isDrifting ? 0.09 : 0;
}

// ==========================================
// 16. MODE B: 3D DENTAL CLINIC RUSH (HOME-SCREEN 3D MOLARS!)
// ==========================================
function initDentalRunnerScene() {
  if (!ensureWebGLRenderer()) return;

  webglScene = new THREE.Scene();
  webglScene.background = new THREE.Color(0x0b132b);
  webglScene.fog = new THREE.FogExp2(0x0b132b, 0.011);

  webglCamera = new THREE.PerspectiveCamera(50, 540 / 720, 0.1, 200);

  // Exact High-Contrast Studio Lighting from Home Screen 3D Tooth!
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.38);
  hemi.position.set(0, 10, 0);
  webglScene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
  keyLight.position.set(12, 22, 14);
  webglScene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.7);
  rimLight.position.set(-12, -4, -10);
  webglScene.add(rimLight);

  // Scalloped Pink Gingiva (Gum) Ridges on Left & Right
  const gumMat = new THREE.MeshPhysicalMaterial({
    color: 0xe11d48,
    roughness: 0.35,
    clearcoat: 0.8,
  });
  [-4.6, 4.6].forEach((gx) => {
    const gum = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.6, 240, 16),
      gumMat,
    );
    gum.rotation.x = Math.PI / 2;
    gum.position.set(gx, -0.75, -100);
    webglScene.add(gum);
  });

  // 3 Lanes of Your Exact Home-Screen 3D Porcelain Molars!
  molarRows = [];
  const laneX = [-2.4, 0, 2.4];
  for (let r = 0; r < 22; r++) {
    const rowGroup = new THREE.Group();
    rowGroup.position.z = -r * 3.8;
    laneX.forEach((lx) => {
      const molar = buildHomeScreenMolarClone();
      molar.position.x = lx;
      rowGroup.add(molar);
    });
    webglScene.add(rowGroup);
    molarRows.push(rowGroup);
  }

  startGantry = build3DGantryArch(
    "🦷 AL-AMEEN CLINIC RUSH",
    "HOLD DRILL OVER BROWN CARIES",
    0x10b981,
    "#10b981",
  );
  startGantry.position.set(0, 0, -12);
  webglScene.add(startGantry);

  finishGantry = build3DGantryArch(
    "✨ CLINICAL SHIFT COMPLETE ✨",
    "FULL ARCH RESTORED",
    0xfacc15,
    "#facc15",
  );
  finishGantry.visible = false;
  webglScene.add(finishGantry);

  dentalTargetLane = 0;
  dentalCurrentX = 0;
  laneSwitchLocked = false;
  playerMesh = build3DDentalHandpiece();
  playerMesh.position.set(0, 0.55, 0);
  webglScene.add(playerMesh);

  // Pre-build Pooled Target Meshes (ZERO mid-game allocations = ZERO lag!)
  dentalTargets = [];
  const cariesMat = new THREE.MeshStandardMaterial({
    color: 0x3f1d0b,
    roughness: 0.75,
  });
  const goldCrownMat = new THREE.MeshPhysicalMaterial({
    color: 0xfacc15,
    emissive: 0xa16207,
    emissiveIntensity: 0.25,
    roughness: 0.15,
    clearcoat: 1.0,
  });
  const hazardMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
  const fluorideMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  for (let i = 0; i < 10; i++) {
    const tGroup = new THREE.Group();

    // Sub-mesh A: Caries / Cavity Cluster
    const cariesMesh = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const blob = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.4, 1),
        cariesMat,
      );
      blob.position.set(
        (k % 2 === 0 ? -1 : 1) * 0.22,
        0.15 + (k % 2) * 0.14,
        (k < 2 ? -1 : 1) * 0.2,
      );
      cariesMesh.add(blob);
    }
    tGroup.add(cariesMesh);

    // Sub-mesh B: Restored Gold Crown
    const goldCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.55, 0.48, 16),
      goldCrownMat,
    );
    goldCrown.position.y = 0.22;
    tGroup.add(goldCrown);

    // Sub-mesh C: Exposed Red Pulp Bio-Hazard Ring (Dodge!)
    const hazardMesh = new THREE.Group();
    const spike = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.58, 0),
      hazardMat,
    );
    spike.position.y = 0.55;
    hazardMesh.add(spike);
    const warnRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.08, 10, 24),
      hazardMat,
    );
    warnRing.rotation.x = Math.PI / 2;
    warnRing.position.y = 0.15;
    hazardMesh.add(warnRing);
    tGroup.add(hazardMesh);

    // Sub-mesh D: Cyan Fluoride Orb (Collect!)
    const fluorideMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.12, 12, 24),
      fluorideMat,
    );
    fluorideMesh.position.y = 0.65;
    tGroup.add(fluorideMesh);

    tGroup.userData = {
      cariesMesh,
      goldCrown,
      hazardMesh,
      fluorideMesh,
      type: "caries",
      resolved: false,
      hp: 100,
    };

    configurePooledDentalTarget(tGroup, -24 - i * 18, i);
    webglScene.add(tGroup);
    dentalTargets.push(tGroup);
  }

  shatterParticles = [];
  const pGeo = new THREE.OctahedronGeometry(0.16, 0);
  for (let i = 0; i < 24; i++) {
    const pMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const part = new THREE.Mesh(pGeo, pMat);
    part.visible = false;
    part.userData = { life: 0, vx: 0, vy: 0, vz: 0 };
    webglScene.add(part);
    shatterParticles.push(part);
  }
}

function configurePooledDentalTarget(tGroup, zPos, indexHint = 0) {
  const laneX = [-2.4, 0, 2.4];
  const laneIdx = (indexHint + Math.floor(Math.random() * 3)) % 3;
  tGroup.position.set(laneX[laneIdx], 0.05, zPos);
  tGroup.visible = true;

  const ud = tGroup.userData;
  ud.resolved = false;
  ud.hp = 100;
  ud.cariesMesh.visible = false;
  ud.cariesMesh.scale.setScalar(1);
  ud.goldCrown.visible = false;
  ud.hazardMesh.visible = false;
  ud.fluorideMesh.visible = false;

  const roll = Math.random();
  if (roll < 0.58) {
    ud.type = "caries";
    ud.cariesMesh.visible = true;
  } else if (roll < 0.82) {
    ud.type = "nerve_hazard";
    ud.hazardMesh.visible = true;
  } else {
    ud.type = "fluoride";
    ud.fluorideMesh.visible = true;
  }
}

function spawnShatterBurst(x, z, hexColor) {
  let spawned = 0;
  for (let i = 0; i < shatterParticles.length && spawned < 8; i++) {
    const p = shatterParticles[i];
    if (p.userData.life <= 0) {
      p.visible = true;
      p.material.color.setHex(hexColor);
      p.position.set(x, 0.4, z);
      p.userData = {
        life: 1.0,
        vx: (Math.random() - 0.5) * 6.5,
        vy: 3.5 + Math.random() * 3.5,
        vz: (Math.random() - 0.5) * 6.5,
      };
      spawned++;
    }
  }
}

function updateDentalRunnerLoop(dt) {
  // Smooth, Controllable Clinical Scroll Speed (Units per second)
  const forwardSpeed = 17.5 + (currentStageNumber - 1) * 2.0;
  const stepDist = forwardSpeed * dt;
  distanceTraveled += stepDist;
  score += Math.ceil(30 * dt);

  const progRatio = distanceTraveled / totalRunDistance;
  if (progRatio >= 0.33 && currentStageNumber === 1) {
    currentStageNumber = 2;
    score += 1000;
    sfx.playCountdownBeep(true);
    showHudBanner("🦷 STAGE 2: CROWN PREP! +1000", "#38bdf8", 1600);
  } else if (progRatio >= 0.66 && currentStageNumber === 2) {
    currentStageNumber = 3;
    score += 1500;
    sfx.playCountdownBeep(true);
    showHudBanner("👑 FINAL STAGE: SMILE DESIGN! +1500", "#facc15", 1600);
  }

  if (!window.input.left && !window.input.right) {
    laneSwitchLocked = false;
  } else if (!laneSwitchLocked) {
    if (window.input.left && dentalTargetLane > -1) {
      dentalTargetLane--;
      laneSwitchLocked = true;
    } else if (window.input.right && dentalTargetLane < 1) {
      dentalTargetLane++;
      laneSwitchLocked = true;
    }
  }

  const targetX = dentalTargetLane * 2.4;
  dentalCurrentX += (targetX - dentalCurrentX) * Math.min(1, 12 * dt);

  const isDrilling = Boolean(window.input.gas);
  dentalArcadeSynth.setDrillActive(isDrilling);

  if (playerMesh) {
    const targetY = isDrilling ? 0.42 : 0.62;
    playerMesh.position.x = dentalCurrentX;
    playerMesh.position.y += (targetY - playerMesh.position.y) * Math.min(1, 14 * dt);
    playerMesh.rotation.z = (dentalCurrentX - targetX) * 0.12;

    if (playerMesh.userData.burPivot) {
      playerMesh.userData.burPivot.rotation.y += (isDrilling ? 32 : 8) * dt;
    }
    if (playerMesh.userData.laserBeam) {
      playerMesh.userData.laserBeam.material.opacity = isDrilling ? 0.65 : 0.0;
    }
    if (playerMesh.userData.aimRing) {
      playerMesh.userData.aimRing.rotation.z += 3.5 * dt;
      playerMesh.userData.aimRing.scale.setScalar(isDrilling ? 1.25 : 0.95);
    }
  }

  if (startGantry) {
    startGantry.position.z = -12 + distanceTraveled;
    startGantry.visible = startGantry.position.z < 12;
  }
  if (finishGantry) {
    const remDist = totalRunDistance - distanceTraveled;
    finishGantry.visible = remDist < 160;
    if (finishGantry.visible) {
      finishGantry.position.set(0, 0, -remDist);
    }
  }

  molarRows.forEach((row) => {
    row.position.z += stepDist;
    if (row.position.z > 7.6) {
      row.position.z -= 22 * 3.8;
    }
  });

  dentalTargets.forEach((tGroup, idx) => {
    tGroup.position.z += stepDist;
    const ud = tGroup.userData;
    const inSameLane = Math.abs(dentalCurrentX - tGroup.position.x) < 1.1;

    if (ud.hazardMesh.visible) ud.hazardMesh.rotation.y += 2.5 * dt;
    if (ud.fluorideMesh.visible) ud.fluorideMesh.rotation.y += 3.0 * dt;

    // Long-Range Hydro-Laser Excavates Caries Ahead!
    if (
      !ud.resolved &&
      ud.type === "caries" &&
      isDrilling &&
      inSameLane &&
      tGroup.position.z < 0.8 &&
      tGroup.position.z > -11.5
    ) {
      ud.hp -= 260 * dt;
      ud.cariesMesh.scale.setScalar(Math.max(0.1, ud.hp / 100));
      ud.cariesMesh.rotation.y += 10 * dt;

      if (ud.hp <= 0) {
        ud.resolved = true;
        ud.cariesMesh.visible = false;
        ud.goldCrown.visible = true;

        comboMultiplier = Math.min(12, comboMultiplier + 1);
        const pts = 450 * comboMultiplier;
        score += pts;
        sfx.playDing(920 + comboMultiplier * 65);
        spawnShatterBurst(tGroup.position.x, tGroup.position.z, 0xfacc15);
        showHudBanner(
          `👑 GOLD CROWN PLACED! +${pts} (x${comboMultiplier})`,
          "#34d399",
        );
      }
    }

    // Direct Contact Check at Handpiece Head (z = -0.85)
    if (
      !ud.resolved &&
      Math.abs(tGroup.position.z - -0.85) < 1.1 &&
      inSameLane
    ) {
      if (ud.type === "nerve_hazard") {
        ud.resolved = true;
        comboMultiplier = 1;
        score = Math.max(0, score - 250);
        crashShake = 12;
        sfx.playCrash();
        spawnShatterBurst(tGroup.position.x, tGroup.position.z, 0xff1e42);
        showHudBanner("🩸 PULP HAZARD HIT! -250 (Switch Lanes!)", "#ef4444");
        ud.hazardMesh.visible = false;
      } else if (ud.type === "fluoride") {
        ud.resolved = true;
        const pts = 500 * comboMultiplier;
        score += pts;
        sfx.playDing(1300);
        spawnShatterBurst(tGroup.position.x, tGroup.position.z, 0x38bdf8);
        showHudBanner(`💎 FLUORIDE BOOST! +${pts}`, "#38bdf8");
        ud.fluorideMesh.visible = false;
      }
    }

    if (tGroup.position.z > 9) {
      configurePooledDentalTarget(tGroup, -170 - Math.random() * 15, idx);
    }
  });

  shatterParticles.forEach((p) => {
    if (p.userData.life > 0) {
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      p.userData.vy -= 12 * dt;
      p.userData.life -= 2.2 * dt;
      p.scale.setScalar(Math.max(0.01, p.userData.life));
      if (p.userData.life <= 0) p.visible = false;
    }
  });

  const shakeX = crashShake > 0 ? (Math.random() - 0.5) * 0.3 : 0;
  if (crashShake > 0) crashShake--;

  if (victorySeconds > 0) {
    const angle = (1.8 - victorySeconds) * 2.2;
    webglCamera.position.set(
      Math.sin(angle) * 6.2,
      3.4,
      Math.cos(angle) * 6.2,
    );
    webglCamera.lookAt(0, 0.3, 0);
  } else if (countdownSeconds > 0) {
    const t = countdownSeconds / 2.8;
    webglCamera.position.set(0, 3.8 + t * 1.2, 5.2 + t * 1.8);
    webglCamera.lookAt(0, 0.2, -9);
  } else {
    webglCamera.position.set(dentalCurrentX * 0.55 + shakeX, 3.7, 5.1);
    webglCamera.lookAt(dentalCurrentX * 0.75, 0.15, -9.5);
  }
}

// ==========================================
// 17. MASTER DELTA-TIME (dt) LOOP
// ==========================================
function masterArcadeLoop(now) {
  if (raceFinished) return;

  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTimestamp) / 1000));
  lastFrameTimestamp = now;

  // PHASE 1: STARTING GRID 3-2-1 COUNTDOWN
  if (countdownSeconds > 0) {
    const currentInt = Math.ceil(countdownSeconds);
    if (currentInt !== countdownLastInt) {
      countdownLastInt = currentInt;
      sfx.playCountdownBeep(false);
      if (currentInt === 3) showHudBanner("🔴 READY... 3", "#ef4444", 850);
      else if (currentInt === 2) showHudBanner("🟠 SET... 2", "#fb923c", 850);
      else if (currentInt === 1) showHudBanner("🟡 1...", "#facc15", 850);
    }

    countdownSeconds -= dt;
    if (countdownSeconds <= 0) {
      sfx.playCountdownBeep(true);
      showHudBanner(
        activeGameMode === "dental_runner"
          ? "🟢 GO! HOLD DRILL ON CARIES!"
          : "🟢 GO! STEER + HOLD DRIFT GAS!",
        "#34d399",
        1300,
      );
      startTime = Date.now();
    }

    if (activeGameMode === "dental_runner") {
      const t = Math.max(0, countdownSeconds / 2.8);
      webglCamera.position.set(0, 3.8 + t * 1.2, 5.2 + t * 1.8);
      webglCamera.lookAt(0, 0.2, -9);
    } else {
      positionWindingDriftWorld();
    }

    if (webglRenderer && webglScene && webglCamera) {
      webglRenderer.render(webglScene, webglCamera);
    }
    gameLoopId = requestAnimationFrame(masterArcadeLoop);
    return;
  }

  // PHASE 2: FINISH LINE VICTORY CAMERA ORBIT
  if (victorySeconds > 0) {
    victorySeconds -= dt;
    if (activeGameMode === "dental_runner") {
      const angle = (1.8 - victorySeconds) * 2.2;
      webglCamera.position.set(
        Math.sin(angle) * 6.2,
        3.4,
        Math.cos(angle) * 6.2,
      );
      webglCamera.lookAt(0, 0.3, 0);
    } else {
      positionWindingDriftWorld();
    }

    if (webglRenderer && webglScene && webglCamera) {
      webglRenderer.render(webglScene, webglCamera);
    }

    if (victorySeconds <= 0) {
      raceFinished = true;
      stopArcadeAudio();

      const timeTaken = (Date.now() - startTime) / 1000;
      const grade =
        score >= 22000
          ? "S+ MASTER"
          : score >= 14000
            ? "A+ SENIOR"
            : "B RESIDENT";

      const scoreboardModal = document.getElementById("scoreboard-modal");
      const finalScoreDisplay = document.getElementById("final-score-display");
      const finalSub = document.getElementById("final-run-subtitle");
      const heading = document.getElementById("scoreboard-heading");

      if (heading) {
        heading.textContent =
          activeGameMode === "dental_runner"
            ? `🦷 SHIFT COMPLETE (${grade}) 🦷`
            : `🏁 TOUGE COMPLETE (${grade}) 🏁`;
      }
      if (finalScoreDisplay) finalScoreDisplay.textContent = String(score);
      if (finalSub) {
        finalSub.textContent = `Time: ${timeTaken.toFixed(1)}s | Rank: ${grade}`;
      }

      if (scoreboardModal) scoreboardModal.style.display = "flex";
      setTimeout(async () => {
        const saved = await submitDriftScore(arcadePlayerName, score);
        if (saved) fetchDriftLeaderboard();
      }, 80);
      return;
    }

    gameLoopId = requestAnimationFrame(masterArcadeLoop);
    return;
  }

  // PHASE 3: SMOOTH DELTA-TIME GAMEPLAY
  if (activeGameMode === "dental_runner") {
    updateDentalRunnerLoop(dt);
  } else {
    updateNightDriftLoop(dt);
  }

  if (webglRenderer && webglScene && webglCamera) {
    webglRenderer.render(webglScene, webglCamera);
  }

  const progress = Math.max(
    0,
    Math.min(100, (distanceTraveled / totalRunDistance) * 100),
  );
  const elScore = document.getElementById("hud-score");
  const elCombo = document.getElementById("hud-combo");
  const elProg = document.getElementById("hud-progress");

  if (elScore) elScore.textContent = String(score);
  if (elCombo) elCombo.textContent = `x${comboMultiplier}`;
  if (elProg) elProg.textContent = `${progress.toFixed(1)}%`;

  if (distanceTraveled >= totalRunDistance && victorySeconds === 0) {
    victorySeconds = 1.8;
    const timeTaken = (Date.now() - startTime) / 1000;
    const speedBonus = Math.max(0, Math.floor((85 - timeTaken) * 50));
    score += speedBonus;
    sfx.playCountdownBeep(true);
    showHudBanner(
      `🏆 FINISH LINE! SPEED BONUS +${speedBonus}`,
      "#facc15",
      2000,
    );
  }

  gameLoopId = requestAnimationFrame(masterArcadeLoop);
}