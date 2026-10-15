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
        g.gain.setValueAtTime(0.04, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);

        if (this.step % 2 === 0) {
          const bass = ctx.createOscillator();
          const bg = ctx.createGain();
          bass.type = "sawtooth";
          bass.frequency.setValueAtTime(freq * 0.25, now);
          bg.gain.setValueAtTime(0.045, now);
          bg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          bass.connect(bg);
          bg.connect(ctx.destination);
          bass.start(now);
          bass.stop(now + 0.17);
        }
        this.step++;
      } catch (e) {}
    }, 135);

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
      this.drillGain.gain.setTargetAtTime(isActive ? 0.04 : 0.0001, now, 0.03);
      this.drillOsc.frequency.setTargetAtTime(
        isActive ? 3600 + Math.random() * 300 : 2800,
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
  playTone(freq, endFreq, duration = 0.18, type = "sine", vol = 0.16) {
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
    this.playTone(pitch, pitch * 1.45, 0.18, "sine", 0.16);
  },
  playCountdownBeep(isGo = false) {
    this.playTone(isGo ? 1046.5 : 523.25, isGo ? 1318.5 : 523.25, isGo ? 0.35 : 0.15, "triangle", 0.2);
  },
  playCrash() {
    this.playTone(150, 32, 0.35, "sawtooth", 0.3);
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
    const sanitizedGain = Math.min(50000, Math.max(0, Math.round(Number(playerScore) || 0)));
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
// 12. PROCEDURAL CANVAS TEXTURES & 3D SPRITES
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

function createTextBannerTexture(title, subtitle, bgHex = "#0f172a", borderHex = "#38bdf8", textHex = "#ffffff") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 128);

  // Checkered racing strips on left/right edges
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

  ctx.fillStyle = textHex;
  ctx.font = "900 38px monospace";
  ctx.textAlign = "center";
  ctx.fillText(title, 256, 58);

  ctx.fillStyle = borderHex;
  ctx.font = "700 24px monospace";
  ctx.fillText(subtitle, 256, 98);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function createBadgeSprite(labelText, bgColor = "#1e293b", borderColor = "#38bdf8", textColor = "#ffffff") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 80;
  const ctx = c.getContext("2d");

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 64, 18);
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = "900 28px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(labelText, 128, 41);

  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.2, 0.7, 1);
  return sprite;
}

function build3DGantryArch(title, subtitle, accentColor = 0x38bdf8, borderHex = "#38bdf8") {
  const archGroup = new THREE.Group();
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.75,
    roughness: 0.25,
  });
  const neonMat = new THREE.MeshBasicMaterial({ color: accentColor });

  [-7.2, 7.2].forEach((px) => {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 6.2, 12),
      pillarMat,
    );
    pillar.position.set(px, 3.1, 0);
    archGroup.add(pillar);

    const neonStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 5.8, 0.12),
      neonMat,
    );
    neonStrip.position.set(px > 0 ? px - 0.28 : px + 0.28, 3.1, 0);
    archGroup.add(neonStrip);
  });

  const bannerTex = createTextBannerTexture(title, subtitle, "#090d16", borderHex, "#ffffff");
  const bannerBoard = new THREE.Mesh(
    new THREE.BoxGeometry(14.8, 2.2, 0.45),
    new THREE.MeshBasicMaterial({ map: bannerTex }),
  );
  bannerBoard.position.set(0, 5.4, 0);
  archGroup.add(bannerBoard);

  return archGroup;
}

// ==========================================
// 13. DETAILED 3D MODELS (CARS, HANDPIECE, TEETH)
// ==========================================
function build3DCarMesh(carType, isTraffic = false) {
  const carGroup = new THREE.Group();
  const bodyPivot = new THREE.Group();
  carGroup.add(bodyPivot);

  let primaryColor = 0xdc2626; // G37x Sport Crimson
  let neonColor = 0xef4444;
  if (carType === "skyline") {
    primaryColor = 0x0284c7; // Bayside Blue GT-R
    neonColor = 0x38bdf8;
  } else if (carType === "accent") {
    primaryColor = 0xf59e0b; // Cyber Gold Tuner
    neonColor = 0xfacc15;
  } else if (isTraffic) {
    const palette = [0x475569, 0x334155, 0x1e293b, 0x64748b, 0x312e81, 0x7f1d1d];
    primaryColor = palette[Math.floor(Math.random() * palette.length)];
  }

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    metalness: 0.6,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });
  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.4,
    metalness: 0.5,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x020617,
    metalness: 0.25,
    roughness: 0.08,
    clearcoat: 1.0,
  });

  const chassisLength = carType === "accent" ? 3.85 : 4.35;

  // Lower Body + Sculpted Hood & Fenders
  const lowerBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.94, 0.52, chassisLength),
    paintMat,
  );
  lowerBody.position.y = 0.48;
  bodyPivot.add(lowerBody);

  // Aero Splitter & Rear Diffuser
  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(2.04, 0.12, chassisLength + 0.18),
    darkTrimMat,
  );
  splitter.position.y = 0.24;
  bodyPivot.add(splitter);

  // Sleek Fastback Cabin
  const cabinGeo = new THREE.CylinderGeometry(1.0, 1.34, 0.52, 4);
  cabinGeo.rotateY(Math.PI / 4);
  cabinGeo.scale(1.0, 1.0, carType === "accent" ? 1.48 : 1.58);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 0.96, carType === "accent" ? 0.12 : -0.08);
  bodyPivot.add(cabin);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.34, 0.06, carType === "accent" ? 1.7 : 1.65),
    paintMat,
  );
  roof.position.set(0, 1.22, carType === "accent" ? 0.12 : -0.08);
  bodyPivot.add(roof);

  // 4 Wheels + Chrome Rims + Brake Calipers
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
  const rimGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.3, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.9,
    roughness: 0.15,
  });

  const zWheel = chassisLength * 0.32;
  [
    [-0.96, 0.36, -zWheel],
    [0.96, 0.36, -zWheel],
    [-0.96, 0.36, zWheel],
    [0.96, 0.36, zWheel],
  ].forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(wx, wy, wz);
    carGroup.add(w);
    const r = new THREE.Mesh(rimGeo, rimMat);
    r.position.set(wx, wy, wz);
    carGroup.add(r);
  });

  // Front Headlights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
  [-0.66, 0.66].forEach((hx) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.08), headMat);
    hl.position.set(hx, 0.54, -chassisLength / 2 - 0.02);
    bodyPivot.add(hl);
  });

  // Rear Taillights, Exhausts & Nitro Flames
  const tailGlowMat = new THREE.MeshBasicMaterial({ color: 0xff1e27 });
  const rearZ = chassisLength / 2 + 0.02;

  if (carType === "g37" && !isTraffic) {
    [-0.68, -0.44, 0.44, 0.68].forEach((tx, idx) => {
      const radius = idx === 0 || idx === 3 ? 0.115 : 0.088;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.03, 10, 24),
        tailGlowMat,
      );
      ring.position.set(tx, 0.56, rearZ);
      bodyPivot.add(ring);
    });
    const ducktail = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 0.11, 0.24),
      paintMat,
    );
    ducktail.position.set(0, 0.78, rearZ - 0.12);
    ducktail.rotation.x = 0.26;
    bodyPivot.add(ducktail);
  } else if (carType === "skyline" && !isTraffic) {
    [-0.68, -0.42, 0.42, 0.68].forEach((tx, idx) => {
      const radius = idx === 0 || idx === 3 ? 0.12 : 0.092;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.034, 10, 24),
        tailGlowMat,
      );
      ring.position.set(tx, 0.56, rearZ);
      bodyPivot.add(ring);
    });
    const wingBlade = new THREE.Mesh(
      new THREE.BoxGeometry(1.94, 0.07, 0.34),
      darkTrimMat,
    );
    wingBlade.position.set(0, 1.04, rearZ - 0.18);
    bodyPivot.add(wingBlade);
    [-0.58, 0.58].forEach((sx) => {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.3, 0.18),
        darkTrimMat,
      );
      strut.position.set(sx, 0.88, rearZ - 0.18);
      bodyPivot.add(strut);
    });
  } else {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.66, 0.15, 0.06),
      tailGlowMat,
    );
    bar.position.set(0, 0.56, rearZ);
    bodyPivot.add(bar);
  }

  let exhaustFlames = null;
  if (!isTraffic) {
    const neonPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.35, chassisLength + 0.45),
      new THREE.MeshBasicMaterial({
        color: neonColor,
        transparent: true,
        opacity: 0.3,
      }),
    );
    neonPlane.rotation.x = -Math.PI / 2;
    neonPlane.position.y = 0.03;
    carGroup.add(neonPlane);

    // Twin Nitro Afterburner Cones on the Exhaust Pipes
    exhaustFlames = new THREE.Group();
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });
    [-0.52, 0.52].forEach((fx) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.95, 12),
        flameMat,
      );
      cone.rotation.x = Math.PI / 2;
      cone.position.set(fx, 0.28, rearZ + 0.45);
      exhaustFlames.add(cone);
    });
    exhaustFlames.visible = false;
    bodyPivot.add(exhaustFlames);
  }

  carGroup.userData = { bodyPivot, exhaustFlames };
  return carGroup;
}

// ERGONOMIC SIDE-ANGLED 3D PRO HANDPIECE + LASER RETICLE (Never blocks the screen!)
function build3DDentalHandpiece() {
  const rootGroup = new THREE.Group();

  // We angle the handpiece in from the bottom-right like a real clinician's hand
  const handpieceRig = new THREE.Group();
  handpieceRig.position.set(1.25, 0.85, 0.45);
  handpieceRig.rotation.set(0.22, 0.48, -0.42);
  rootGroup.add(handpieceRig);

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    metalness: 0.88,
    roughness: 0.14,
    clearcoat: 1.0,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    metalness: 0.65,
    roughness: 0.25,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.85,
    roughness: 0.2,
  });

  // Sleek Tapered Turbine Body (Viewed from a 3/4 diagonal angle)
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.21, 3.0, 24),
    chromeMat,
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(0, 0, 1.3);
  handpieceRig.add(shaft);

  // Tactile Blue & Gold Anodized Rings
  [0.5, 0.9, 1.8].forEach((zPos, i) => {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.195, 0.195, 0.14, 24),
      i === 1 ? goldMat : gripMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0, zPos);
    handpieceRig.add(ring);
  });

  // Contra-Angle Neck & Miniature Turbine Head reaching to the center lane
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.16, 1.35, 20),
    chromeMat,
  );
  neck.rotation.z = Math.PI / 3.4;
  neck.rotation.x = Math.PI / 2.3;
  neck.position.set(-0.55, -0.18, -0.35);
  handpieceRig.add(neck);

  // Chuck Head centered over the active tooth lane
  const chuckHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.58, 24),
    chromeMat,
  );
  chuckHead.position.set(0, 1.05, -0.85);
  rootGroup.add(chuckHead);

  const headCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 18, 12),
    gripMat,
  );
  headCap.scale.set(1, 0.45, 1);
  headCap.position.set(0, 1.35, -0.85);
  rootGroup.add(headCap);

  // Spinning Diamond Bur Tip
  const burPivot = new THREE.Group();
  burPivot.position.set(0, 0.75, -0.85);
  const burShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.52, 12),
    chromeMat,
  );
  burShaft.position.y = -0.2;
  burPivot.add(burShaft);

  const diamondTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.35, 14),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
  );
  diamondTip.rotation.x = Math.PI;
  diamondTip.position.y = -0.45;
  burPivot.add(diamondTip);
  rootGroup.add(burPivot);

  // Long-Range Ultrasonic Hydro-Laser Beam (Fires forward when holding Drill!)
  const laserBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.28, 15.0, 16),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
    }),
  );
  laserBeam.rotation.x = Math.PI / 2;
  laserBeam.position.set(0, 0.45, -8.35);
  rootGroup.add(laserBeam);

  // Glowing Aiming Reticle Ring on the Tooth Surface Ahead
  const aimRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.62, 24),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    }),
  );
  aimRing.rotation.x = -Math.PI / 2;
  aimRing.position.set(0, 0.14, -2.5);
  rootGroup.add(aimRing);

  rootGroup.userData = { burPivot, laserBeam, aimRing, handpieceRig };
  return rootGroup;
}

// SCULPTED 4-CUSP PORCELAIN MOLAR CROWN FOR THE DENTAL ARCH
let cachedArchMolarGeo = null;
function getArchMolarGeometry() {
  if (cachedArchMolarGeo) return cachedArchMolarGeo;
  const geo = new THREE.BoxGeometry(1.95, 0.95, 1.95, 12, 8, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Round the corners into a natural molar squircle and narrow the cervical base
    const rXZ = Math.sqrt(x * x + z * z);
    const neckTaper = y < 0 ? 1.0 + y * 0.28 : 1.0 - y * 0.06;
    x *= neckTaper;
    z *= neckTaper;

    if (y > 0.1) {
      // Carve 4 distinct anatomical cusps and a central occlusal pit
      const cuspBump =
        Math.cos(x * 2.4) * Math.cos(z * 2.4) * -0.18 +
        (Math.abs(x) * Math.abs(z)) * 0.26;
      const centralPit = Math.exp(-rXZ * rXZ * 2.8) * 0.28;
      y += cuspBump - centralPit;
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  cachedArchMolarGeo = geo;
  return geo;
}

function build3DCrownPlatformMesh() {
  const molarMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.22,
    metalness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const mesh = new THREE.Mesh(getArchMolarGeometry(), molarMat);
  mesh.position.y = -0.42;
  return mesh;
}

// ==========================================
// 14. SHARED ARCADE STATE, COUNTDOWN & STAGES
// ==========================================
let gameLoopId = null;
let activeGameMode = "drift";
let activeCarSelection = "g37";

let webglRenderer = null;
let webglScene = null;
let webglCamera = null;
let playerMesh = null;

let score = 0;
let comboMultiplier = 1;
let distanceTraveled = 0;
let totalRunDistance = 4200; // Proper ~75-second full 3-stage arcade run
let currentStageNumber = 1;
let countdownTimer = 180; // 3 seconds @ 60fps ("3... 2... 1... GO!")
let victoryFreezeTimer = 0;
let raceFinished = false;
let startTime = 0;
let crashShake = 0;
let bannerTimeout = null;

// Drift Mode Specific State
let playerLaneOffset = 0; // Offset from the curving road center
let playerSpeed = 0;
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

function showHudBanner(text, color = "#facc15", duration = 1200) {
  const banner = document.getElementById("hud-floating-banner");
  if (!banner) return;
  banner.textContent = text;
  banner.style.color = color;
  banner.classList.add("show");
  if (bannerTimeout) clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => banner.classList.remove("show"), duration);
}

// Mathematical S-Curve Function for the Winding 3D Touge Highway
function getTougeCurveX(worldDistance) {
  if (worldDistance < 80) return 0; // Keep starting grid straight
  const d = worldDistance - 80;
  const ramp = Math.min(1.0, d / 150);
  return (
    ramp *
    (Math.sin(d * 0.011) * 7.5 +
      Math.sin(d * 0.023) * 4.2 +
      Math.cos(d * 0.005) * 5.0)
  );
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
  countdownTimer = 180; // 3-2-1 countdown
  victoryFreezeTimer = 0;
  raceFinished = false;
  crashShake = 0;

  sfx.init();
  stopArcadeAudio();

  if (modeOrCar === "dental_runner") {
    activeGameMode = "dental_runner";
    totalRunDistance = 3200; // ~70s 3-Stage Clinical Rush
    if (actionBtn) actionBtn.textContent = "⚡ Hold Drill / Laser";
    if (secLabel) secLabel.textContent = "STREAK";
    initDentalRunnerScene();
    dentalArcadeSynth.startMusic();
  } else {
    activeGameMode = "drift";
    activeCarSelection = modeOrCar || "g37";
    totalRunDistance = 4200; // ~75s 3-Sector Touge Run
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
    webglRenderer.setSize(600, 800);
    webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
  return true;
}

// ==========================================
// 15. MODE A: 3D MIDNIGHT TOUGE DRIFT (WINDING ROAD)
// ==========================================
function initNightDriftScene() {
  if (!ensureWebGLRenderer()) return;

  webglScene = new THREE.Scene();
  webglScene.background = new THREE.Color(0x050811);
  webglScene.fog = new THREE.FogExp2(0x050811, 0.01);

  webglCamera = new THREE.PerspectiveCamera(60, 600 / 800, 0.1, 240);

  const hemi = new THREE.HemisphereLight(0xbae6fd, 0x0f172a, 0.9);
  webglScene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
  dirLight.position.set(15, 30, 18);
  webglScene.add(dirLight);

  // Build 36 Segmented Winding HighwaySlices (Curves smoothly in real-time!)
  roadSegments = [];
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.4,
    metalness: 0.25,
  });
  const redCurbMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const whiteCurbMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const railMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const bldgMat = new THREE.MeshStandardMaterial({
    color: 0x0b1120,
    emissive: 0x1e293b,
    emissiveIntensity: 0.45,
  });

  for (let i = 0; i < 36; i++) {
    const segGroup = new THREE.Group();
    const zOffset = -i * 6;
    segGroup.userData = { baseIndex: i, zLocal: zOffset };

    // Road Slab
    const slab = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.2, 6.2), asphaltMat);
    slab.position.y = -0.1;
    segGroup.add(slab);

    // Racing Curbs & Neon Guardrails
    const cMat = i % 2 === 0 ? redCurbMat : whiteCurbMat;
    [-7.4, 7.4].forEach((cx) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 6.1), cMat);
      curb.position.set(cx, 0.08, 0);
      segGroup.add(curb);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 6.1), railMat);
      rail.position.set(cx > 0 ? cx + 0.35 : cx - 0.35, 0.35, 0);
      segGroup.add(rail);
    });

    // Lane Divider Dashes
    if (i % 2 === 0) {
      [-2.4, 2.4].forEach((lx) => {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 3.0), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(lx, 0.02, 0);
        segGroup.add(dash);
      });
    }

    // Streetlamps & City Buildings every 4th slice
    if (i % 4 === 0) {
      [-8.4, 8.4].forEach((px) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6.2, 8), poleMat);
        pole.position.set(px, 3.1, 0);
        segGroup.add(pole);

        const bulb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.3), lampGlowMat);
        bulb.position.set(px > 0 ? px - 0.55 : px + 0.55, 6.15, 0);
        segGroup.add(bulb);
      });

      [-19, 19].forEach((bx) => {
        const h = 14 + ((i * 7) % 24);
        const bldg = new THREE.Mesh(new THREE.BoxGeometry(6.5, h, 5.8), bldgMat);
        bldg.position.set(bx, h / 2, 0);
        segGroup.add(bldg);
      });
    }

    webglScene.add(segGroup);
    roadSegments.push(segGroup);
  }

  // 3D Starting Grid Gantry & Finish Line Gantry
  startGantry = build3DGantryArch("STAGE 1: BAGHDAD TOUGE", "HOLD DRIFT GAS TO LAUNCH", 0x38bdf8, "#38bdf8");
  startGantry.position.set(0, 0, -14);
  webglScene.add(startGantry);

  finishGantry = build3DGantryArch("🏁 FINISH LINE 🏁", "AL-AMEEN CHAMPIONSHIP", 0x10b981, "#10b981");
  finishGantry.visible = false;
  webglScene.add(finishGantry);

  // Player Car
  playerLaneOffset = 0;
  playerSpeed = 0;
  driftSlipAngle = 0;
  activeDriftBank = 0;
  playerMesh = build3DCarMesh(activeCarSelection, false);
  webglScene.add(playerMesh);

  // 3D Traffic Cars
  trafficCars = [];
  const lanes = [-4.5, 0, 4.5];
  for (let i = 0; i < 6; i++) {
    const tCar = build3DCarMesh("traffic", true);
    tCar.userData = {
      laneOffset: lanes[i % 3],
      zDist: -50 - i * 38,
      speed: 0.42 + (i % 3) * 0.08,
      nearMissed: false,
    };
    webglScene.add(tCar);
    trafficCars.push(tCar);
  }

  // Nitro Boost Pads
  nitroPads = [];
  const nitroMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.85,
  });
  for (let i = 0; i < 3; i++) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4.8), nitroMat);
    pad.rotation.x = -Math.PI / 2;
    pad.userData = {
      laneOffset: lanes[(i + 1) % 3],
      zDist: -70 - i * 75,
    };
    webglScene.add(pad);
    nitroPads.push(pad);
  }

  // 3D Tire Smoke Particles
  smokeParticles = [];
  const smokeGeo = new THREE.SphereGeometry(0.32, 8, 8);
  for (let i = 0; i < 28; i++) {
    const sMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
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

  // Position winding road slices ahead of player
  roadSegments.forEach((seg) => {
    const zRel = seg.userData.zLocal; // 0 down to -216
    const segWorldDist = distanceTraveled - zRel;
    const segCurveX = getTougeCurveX(segWorldDist);
    const nextCurveX = getTougeCurveX(segWorldDist + 6);
    const segAngle = Math.atan2(nextCurveX - segCurveX, 6);

    seg.position.set(segCurveX, 0, zRel);
    seg.rotation.y = -segAngle;
  });

  // Position Start & Finish Gantries
  if (startGantry) {
    const startZ = -14 + distanceTraveled;
    startGantry.visible = startZ < 15;
    if (startGantry.visible) {
      startGantry.position.set(getTougeCurveX(14), 0, startZ);
    }
  }

  if (finishGantry) {
    const remDist = totalRunDistance - distanceTraveled;
    finishGantry.visible = remDist < 210;
    if (finishGantry.visible) {
      const finZ = -remDist;
      finishGantry.position.set(getTougeCurveX(totalRunDistance), 0, finZ);
    }
  }

  // Position Player Car on the Curving Highway
  const worldPlayerX = playerCurveX + playerLaneOffset;
  if (playerMesh) {
    playerMesh.position.set(worldPlayerX, 0, 0);
    playerMesh.rotation.y = -roadHeading + driftSlipAngle;
    if (playerMesh.userData.bodyPivot) {
      playerMesh.userData.bodyPivot.rotation.z = -driftSlipAngle * 0.32;
    }
    if (playerMesh.userData.exhaustFlames) {
      playerMesh.userData.exhaustFlames.visible =
        window.input.gas && playerSpeed > 0.85;
      playerMesh.userData.exhaustFlames.scale.z = 0.8 + Math.random() * 0.6;
    }
  }

  // Position Camera Following the Winding Road
  const shakeX = crashShake > 0 ? (Math.random() - 0.5) * 0.45 : 0;
  const shakeY = crashShake > 0 ? (Math.random() - 0.5) * 0.35 : 0;
  if (crashShake > 0) crashShake--;

  if (victoryFreezeTimer > 0) {
    // Cinematic slow-mo orbit at Finish Line!
    const angle = (120 - victoryFreezeTimer) * 0.045;
    webglCamera.position.set(
      worldPlayerX + Math.sin(angle) * 7.5,
      3.4,
      Math.cos(angle) * 7.5,
    );
    webglCamera.lookAt(worldPlayerX, 0.8, 0);
  } else if (countdownTimer > 0) {
    // Starting Grid Dramatic Camera Swoop
    const t = countdownTimer / 180;
    webglCamera.position.set(
      worldPlayerX + Math.sin(t * 1.8) * 3.5,
      2.6 + (1 - t) * 1.2,
      6.2 + t * 2.5,
    );
    webglCamera.lookAt(worldPlayerX, 0.9, -10);
  } else {
    webglCamera.fov = 58 + playerSpeed * 11;
    webglCamera.updateProjectionMatrix();
    const lookAheadCurveX = getTougeCurveX(distanceTraveled + 18);
    webglCamera.position.set(
      playerCurveX + playerLaneOffset * 0.68 + shakeX,
      3.65 + shakeY,
      7.4,
    );
    webglCamera.lookAt(
      lookAheadCurveX + playerLaneOffset * 0.45,
      0.85,
      -16,
    );
  }
}

function updateNightDriftLoop() {
  const topSpeed =
    activeCarSelection === "skyline"
      ? 1.55
      : activeCarSelection === "g37"
        ? 1.48
        : 1.42;

  const accel = window.input.gas ? 0.024 : -0.015;
  playerSpeed = Math.max(0.32, Math.min(topSpeed, playerSpeed + accel));

  // Road Curvature Centrifugal Push + Player Counter-Steer
  const c0 = getTougeCurveX(distanceTraveled);
  const c1 = getTougeCurveX(distanceTraveled + 5);
  const c2 = getTougeCurveX(distanceTraveled + 10);
  const roadCurvature = (c2 - 2 * c1 + c0) * 1.85;

  let steerInput = 0;
  if (window.input.left) steerInput = -1;
  if (window.input.right) steerInput = 1;

  const steerRate = activeCarSelection === "accent" ? 0.21 : 0.185;
  playerLaneOffset +=
    steerInput * steerRate * (0.55 + playerSpeed * 0.45) -
    roadCurvature * playerSpeed * 0.35;

  // Drift Slip Angle & Active Drift Score Bank
  const targetSlip =
    steerInput !== 0 && window.input.gas && playerSpeed > 0.65
      ? -steerInput * 0.46 - roadCurvature * 0.5
      : -roadCurvature * 0.35;
  driftSlipAngle += (targetSlip - driftSlipAngle) * 0.15;

  const isDrifting = Math.abs(driftSlipAngle) > 0.17 && playerSpeed > 0.72;
  if (isDrifting) {
    const gain = Math.ceil(6 * comboMultiplier);
    activeDriftBank += gain;
    score += gain;

    if (activeDriftBank % 240 < 20) {
      showHudBanner(
        `🔥 DRIFTING! +${activeDriftBank} (x${comboMultiplier})`,
        "#38bdf8",
        500,
      );
    }

    // Spawn Twin Tire Smoke Clouds
    const freeSmoke = smokeParticles.find((p) => p.userData.life <= 0);
    if (freeSmoke && playerMesh) {
      freeSmoke.visible = true;
      freeSmoke.position.set(
        playerMesh.position.x + (Math.random() - 0.5) * 1.5,
        0.24,
        1.9,
      );
      freeSmoke.scale.set(0.65, 0.65, 0.65);
      freeSmoke.material.opacity = 0.6;
      freeSmoke.userData = {
        life: 1.0,
        vx: (Math.random() - 0.5) * 0.09,
        vy: 0.03 + Math.random() * 0.02,
        vz: playerSpeed * 0.55,
      };
    }
  } else {
    if (activeDriftBank >= 300) {
      comboMultiplier = Math.min(10, comboMultiplier + 1);
      sfx.playDing(780 + comboMultiplier * 60);
      showHudBanner(
        `✅ DRIFT BANKED! +${activeDriftBank} (Combo x${comboMultiplier})`,
        "#34d399",
      );
    }
    activeDriftBank = 0;
    if (playerSpeed > 0.5) score += 2;
  }

  // Guardrail Collision Check
  if (Math.abs(playerLaneOffset) > 6.3) {
    playerLaneOffset = Math.sign(playerLaneOffset) * 6.0;
    playerSpeed *= 0.55;
    driftSlipAngle = 0;
    activeDriftBank = 0;
    comboMultiplier = 1;
    score = Math.max(0, score - 200);
    crashShake = 14;
    sfx.playCrash();
    showHudBanner("💥 GUARDRAIL SLAM! -200", "#ef4444");
  }

  distanceTraveled += playerSpeed;

  // Stage Progression Announcements (3 Distinct Sectors)
  const progRatio = distanceTraveled / totalRunDistance;
  if (progRatio >= 0.33 && currentStageNumber === 1) {
    currentStageNumber = 2;
    score += 1000;
    sfx.playCountdownBeep(true);
    showHudBanner("🌆 SECTOR 2: NEON CYBER TUNNEL! +1000", "#38bdf8", 1800);
    webglScene.background.setHex(0x090618);
    webglScene.fog.color.setHex(0x090618);
  } else if (progRatio >= 0.66 && currentStageNumber === 2) {
    currentStageNumber = 3;
    score += 1500;
    sfx.playCountdownBeep(true);
    showHudBanner("🔥 FINAL SECTOR: TOUGE HAIRPINS! +1500", "#facc15", 1800);
    webglScene.background.setHex(0x140714);
    webglScene.fog.color.setHex(0x140714);
  }

  // Scroll Road Slices
  roadSegments.forEach((seg) => {
    seg.userData.zLocal += playerSpeed;
    if (seg.userData.zLocal > 12) {
      seg.userData.zLocal -= 36 * 6;
    }
  });

  // Update Nitro Pads along the Winding Road
  const lanes = [-4.5, 0, 4.5];
  nitroPads.forEach((pad) => {
    pad.userData.zDist += playerSpeed;
    const padWorldDist = distanceTraveled - pad.userData.zDist;
    const padX = getTougeCurveX(padWorldDist) + pad.userData.laneOffset;
    pad.position.set(padX, 0.04, pad.userData.zDist);

    if (
      Math.abs(pad.userData.zDist) < 2.5 &&
      Math.abs(playerLaneOffset - pad.userData.laneOffset) < 1.55
    ) {
      playerSpeed = Math.min(topSpeed + 0.4, playerSpeed + 0.4);
      const pts = 350 * comboMultiplier;
      score += pts;
      sfx.playDing(1150);
      showHudBanner(`🚀 NITRO OVERDRIVE! +${pts}`, "#34d399");
      pad.userData.zDist = -200 - Math.random() * 40;
      pad.userData.laneOffset = lanes[Math.floor(Math.random() * 3)];
    } else if (pad.userData.zDist > 14) {
      pad.userData.zDist = -200 - Math.random() * 40;
      pad.userData.laneOffset = lanes[Math.floor(Math.random() * 3)];
    }
  });

  // Update 3D Traffic Cars along the Winding Road
  trafficCars.forEach((tCar) => {
    tCar.userData.zDist += playerSpeed - tCar.userData.speed;
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

    if (dz < 3.4 && dx < 1.65) {
      playerSpeed = 0.35;
      activeDriftBank = 0;
      comboMultiplier = 1;
      score = Math.max(0, score - 250);
      crashShake = 18;
      sfx.playCrash();
      showHudBanner("💥 TRAFFIC COLLISION! -250", "#ef4444");
      tCar.userData.zDist = -185 - Math.random() * 55;
      tCar.userData.laneOffset = lanes[Math.floor(Math.random() * 3)];
      tCar.userData.nearMissed = false;
    } else if (
      tCar.userData.zDist > 0.5 &&
      tCar.userData.zDist < 5.2 &&
      dx < 3.0 &&
      !tCar.userData.nearMissed
    ) {
      tCar.userData.nearMissed = true;
      comboMultiplier = Math.min(10, comboMultiplier + 1);
      const pts = 350 * comboMultiplier;
      score += pts;
      sfx.playDing(900 + comboMultiplier * 70);
      showHudBanner(`⚡ NEAR MISS! +${pts} (x${comboMultiplier})`, "#facc15");
    }

    if (tCar.userData.zDist > 16) {
      tCar.userData.zDist = -185 - Math.random() * 55;
      tCar.userData.laneOffset = lanes[Math.floor(Math.random() * 3)];
      tCar.userData.nearMissed = false;
    }
  });

  // Update Smoke Particles
  smokeParticles.forEach((p) => {
    if (p.userData.life > 0) {
      p.position.x += p.userData.vx;
      p.position.y += p.userData.vy;
      p.position.z += p.userData.vz;
      p.scale.multiplyScalar(1.06);
      p.userData.life -= 0.055;
      p.material.opacity = Math.max(0, p.userData.life * 0.55);
      if (p.userData.life <= 0) p.visible = false;
    }
  });

  positionWindingDriftWorld();

  // Engine & Tire Screech Audio
  engineAudio.volume = Math.min(0.2, 0.03 + playerSpeed * 0.11);
  engineAudio.playbackRate = 0.8 + playerSpeed * 0.45;
  driftAudio.volume = isDrifting ? 0.09 : 0;
}

// ==========================================
// 16. MODE B: 3D DENTAL CLINIC RUSH (PRO HANDPIECE & LASER)
// ==========================================
function initDentalRunnerScene() {
  if (!ensureWebGLRenderer()) return;

  webglScene = new THREE.Scene();
  webglScene.background = new THREE.Color(0x0d1326);
  webglScene.fog = new THREE.FogExp2(0x0d1326, 0.011);

  webglCamera = new THREE.PerspectiveCamera(54, 600 / 800, 0.1, 200);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xf43f5e, 0.9);
  webglScene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(10, 24, 14);
  webglScene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
  rimLight.position.set(-10, 8, -10);
  webglScene.add(rimLight);

  // Scalloped Pink Gingiva (Gum) Walls on Left & Right
  const gumMat = new THREE.MeshPhysicalMaterial({
    color: 0xe11d48,
    roughness: 0.32,
    clearcoat: 0.85,
  });
  [-4.6, 4.6].forEach((gx) => {
    const gum = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.6, 260, 16),
      gumMat,
    );
    gum.rotation.x = Math.PI / 2;
    gum.position.set(gx, -0.55, -110);
    webglScene.add(gum);
  });

  // 3 Lanes of Sculpted 4-Cusp Porcelain Molars
  molarRows = [];
  const laneX = [-2.4, 0, 2.4];
  for (let r = 0; r < 26; r++) {
    const rowGroup = new THREE.Group();
    rowGroup.position.z = -r * 3.8;
    laneX.forEach((lx) => {
      const molar = build3DCrownPlatformMesh();
      molar.position.x = lx;
      rowGroup.add(molar);
    });
    webglScene.add(rowGroup);
    molarRows.push(rowGroup);
  }

  // Start & Finish Clinical Archways
  startGantry = build3DGantryArch("🦷 STAGE 1: PROPHYLAXIS", "HOLD DRILL TO BLAST DECAY", 0x10b981, "#10b981");
  startGantry.position.set(0, 0, -12);
  webglScene.add(startGantry);

  finishGantry = build3DGantryArch("✨ FULL ARCH RESTORED ✨", "GOLDEN SMILE FINALE", 0xfacc15, "#facc15");
  finishGantry.visible = false;
  webglScene.add(finishGantry);

  // Side-Angled Pro Dental Handpiece + Laser Aiming Reticle
  dentalTargetLane = 0;
  dentalCurrentX = 0;
  laneSwitchLocked = false;
  playerMesh = build3DDentalHandpiece();
  playerMesh.position.set(0, 0.42, 0);
  webglScene.add(playerMesh);

  // Spawn Clear, Labeled 3D Clinical Targets
  dentalTargets = [];
  for (let i = 0; i < 15; i++) {
    const tGroup = new THREE.Group();
    webglScene.add(tGroup);
    respawnDentalTarget(tGroup, -24 - i * 11.5);
    dentalTargets.push(tGroup);
  }

  // 3D Shatter Debris Particle Pool
  shatterParticles = [];
  const pGeo = new THREE.OctahedronGeometry(0.18, 0);
  for (let i = 0; i < 28; i++) {
    const pMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
    const part = new THREE.Mesh(pGeo, pMat);
    part.visible = false;
    part.userData = { life: 0, vx: 0, vy: 0, vz: 0 };
    webglScene.add(part);
    shatterParticles.push(part);
  }
}

function respawnDentalTarget(targetGroup, zPos) {
  while (targetGroup.children.length > 0) {
    targetGroup.remove(targetGroup.children[0]);
  }

  const laneX = [-2.4, 0, 2.4];
  const laneIdx = Math.floor(Math.random() * 3);
  targetGroup.position.set(laneX[laneIdx], 0.15, zPos);
  targetGroup.userData.resolved = false;
  targetGroup.userData.hp = 100;

  const roll = Math.random();
  if (roll < 0.56) {
    // 1. CARIES / TARTAR MONSTER CLUSTER (Hold Drill/Laser to Excavate & Crown!)
    const isCalculus = Math.random() < 0.45;
    targetGroup.userData.type = isCalculus ? "calculus" : "caries";

    const clusterGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: isCalculus ? 0xeab308 : 0x451a03,
      roughness: 0.45,
      metalness: isCalculus ? 0.4 : 0.1,
    });

    for (let k = 0; k < 5; k++) {
      const blob = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.42, 1),
        mat,
      );
      blob.position.set(
        (Math.random() - 0.5) * 0.55,
        0.22 + (k % 2) * 0.18,
        (Math.random() - 0.5) * 0.45,
      );
      clusterGroup.add(blob);
    }
    targetGroup.add(clusterGroup);
    targetGroup.userData.clusterGroup = clusterGroup;

    // Gleaming Gold/Porcelain Crown (Hidden until player drills the decay away!)
    const restoredCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.58, 0.55, 16),
      new THREE.MeshPhysicalMaterial({
        color: isCalculus ? 0xffffff : 0xfacc15,
        metalness: isCalculus ? 0.1 : 0.85,
        roughness: 0.12,
        clearcoat: 1.0,
      }),
    );
    restoredCrown.position.y = 0.28;
    restoredCrown.visible = false;
    targetGroup.add(restoredCrown);
    targetGroup.userData.restoredCrown = restoredCrown;

    // Floating 3D Instruction Badge
    const badge = createBadgeSprite(
      isCalculus ? "⚡ SCALE TARTAR" : "⚡ DRILL CARIES",
      "#064e3b",
      "#34d399",
      "#a7f3d0",
    );
    badge.position.set(0, 1.35, 0);
    targetGroup.add(badge);
    targetGroup.userData.badge = badge;
  } else if (roll < 0.82) {
    // 2. EXPOSED NERVE / PULP BIO-HAZARD GATE (Steer Left/Right to Dodge!)
    targetGroup.userData.type = "nerve_hazard";

    const pillarMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
    [-0.75, 0.75].forEach((px) => {
      const p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 1.6, 12),
        pillarMat,
      );
      p.position.set(px, 0.8, 0);
      targetGroup.add(p);
    });

    const laserBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.9, 0.15),
      new THREE.MeshBasicMaterial({
        color: 0xff1e42,
        transparent: true,
        opacity: 0.65,
      }),
    );
    laserBar.position.set(0, 0.75, 0);
    targetGroup.add(laserBar);

    const warnBadge = createBadgeSprite(
      "⚠️ NERVE: DODGE!",
      "#7f1d1d",
      "#f87171",
      "#fecaca",
    );
    warnBadge.position.set(0, 1.75, 0);
    targetGroup.add(warnBadge);
  } else {
    // 3. FLUORIDE HYPER-RING (Fly through for +500 Boost!)
    targetGroup.userData.type = "fluoride";
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.12, 12, 28),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    );
    ring.position.y = 0.75;
    targetGroup.add(ring);

    const boostBadge = createBadgeSprite(
      "💎 +500 BOOST",
      "#0c4a6e",
      "#38bdf8",
      "#e0f2fe",
    );
    boostBadge.position.set(0, 1.75, 0);
    targetGroup.add(boostBadge);
  }
}

function spawnShatterBurst(x, z, hexColor) {
  let spawned = 0;
  for (let i = 0; i < shatterParticles.length && spawned < 9; i++) {
    const p = shatterParticles[i];
    if (p.userData.life <= 0) {
      p.visible = true;
      p.material.color.setHex(hexColor);
      p.position.set(x, 0.45, z);
      p.userData = {
        life: 1.0,
        vx: (Math.random() - 0.5) * 0.28,
        vy: 0.14 + Math.random() * 0.18,
        vz: (Math.random() - 0.5) * 0.28,
      };
      spawned++;
    }
  }
}

function updateDentalRunnerLoop() {
  const stageSpeedBoost = (currentStageNumber - 1) * 0.1;
  const forwardSpeed = 0.72 + stageSpeedBoost;
  distanceTraveled += forwardSpeed;
  score += 2;

  // Stage Progression Announcements
  const progRatio = distanceTraveled / totalRunDistance;
  if (progRatio >= 0.33 && currentStageNumber === 1) {
    currentStageNumber = 2;
    score += 1000;
    sfx.playCountdownBeep(true);
    showHudBanner("🦷 STAGE 2: ENDODONTIC & CROWN PREP! +1000", "#38bdf8", 1800);
    webglScene.background.setHex(0x130924);
    webglScene.fog.color.setHex(0x130924);
  } else if (progRatio >= 0.66 && currentStageNumber === 2) {
    currentStageNumber = 3;
    score += 1500;
    sfx.playCountdownBeep(true);
    showHudBanner("👑 FINAL STAGE: FULL ARCH REHAB! +1500", "#facc15", 1800);
    webglScene.background.setHex(0x062026);
    webglScene.fog.color.setHex(0x062026);
  }

  // Smooth 3-Lane Switching
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
  dentalCurrentX += (targetX - dentalCurrentX) * 0.22;

  const isDrilling = Boolean(window.input.gas);
  dentalArcadeSynth.setDrillActive(isDrilling);

  // Animate Ergonomic Side-Angled Handpiece & Long-Range Hydro-Laser
  if (playerMesh) {
    const targetY = isDrilling ? 0.32 : 0.52;
    playerMesh.position.x = dentalCurrentX;
    playerMesh.position.y += (targetY - playerMesh.position.y) * 0.25;
    playerMesh.rotation.z = (dentalCurrentX - targetX) * 0.14;

    if (playerMesh.userData.burPivot) {
      playerMesh.userData.burPivot.rotation.y += isDrilling ? 0.95 : 0.25;
    }
    if (playerMesh.userData.laserBeam) {
      playerMesh.userData.laserBeam.material.opacity = isDrilling
        ? 0.55 + Math.random() * 0.25
        : 0.0;
    }
    if (playerMesh.userData.aimRing) {
      playerMesh.userData.aimRing.rotation.z += 0.08;
      playerMesh.userData.aimRing.scale.setScalar(isDrilling ? 1.25 : 0.9);
    }
  }

  // Scroll Start & Finish Gantries
  if (startGantry) {
    startGantry.position.z = -12 + distanceTraveled;
    startGantry.visible = startGantry.position.z < 12;
  }
  if (finishGantry) {
    const remDist = totalRunDistance - distanceTraveled;
    finishGantry.visible = remDist < 190;
    if (finishGantry.visible) {
      finishGantry.position.set(0, 0, -remDist);
    }
  }

  // Scroll 3D Molar Arch Rows
  molarRows.forEach((row) => {
    row.position.z += forwardSpeed;
    if (row.position.z > 7.6) {
      row.position.z -= 26 * 3.8;
    }
  });

  // Update Targets: Long-Range Laser Drilling & Obstacle Dodging
  dentalTargets.forEach((tGroup) => {
    tGroup.position.z += forwardSpeed;
    const type = tGroup.userData.type;
    const inSameLane = Math.abs(dentalCurrentX - tGroup.position.x) < 1.1;

    // 1. Long-Range Hydro-Laser Excavates Caries/Calculus up to 14 units ahead!
    if (
      !tGroup.userData.resolved &&
      (type === "caries" || type === "calculus") &&
      isDrilling &&
      inSameLane &&
      tGroup.position.z < 0.5 &&
      tGroup.position.z > -15.5
    ) {
      tGroup.userData.hp -= 26;
      if (tGroup.userData.clusterGroup) {
        tGroup.userData.clusterGroup.scale.setScalar(
          Math.max(0.1, tGroup.userData.hp / 100),
        );
        tGroup.userData.clusterGroup.rotation.y += 0.35;
      }

      if (tGroup.userData.hp <= 0) {
        tGroup.userData.resolved = true;
        if (tGroup.userData.clusterGroup) {
          tGroup.userData.clusterGroup.visible = false;
        }
        if (tGroup.userData.restoredCrown) {
          tGroup.userData.restoredCrown.visible = true;
        }
        if (tGroup.userData.badge) {
          tGroup.userData.badge.visible = false;
        }

        comboMultiplier = Math.min(12, comboMultiplier + 1);
        const pts = (type === "caries" ? 400 : 450) * comboMultiplier;
        score += pts;
        sfx.playDing(920 + comboMultiplier * 70);
        spawnShatterBurst(
          tGroup.position.x,
          tGroup.position.z,
          type === "caries" ? 0xfacc15 : 0xffffff,
        );
        showHudBanner(
          type === "caries"
            ? `👑 CROWN PLACED! +${pts} (x${comboMultiplier})`
            : `✨ TARTAR SCALED! +${pts} (x${comboMultiplier})`,
          "#34d399",
        );
      }
    }

    // 2. Direct Contact Checks near z = -0.85
    if (
      !tGroup.userData.resolved &&
      Math.abs(tGroup.position.z - -0.85) < 1.0 &&
      inSameLane
    ) {
      if (type === "nerve_hazard") {
        tGroup.userData.resolved = true;
        comboMultiplier = 1;
        score = Math.max(0, score - 300);
        crashShake = 16;
        sfx.playCrash();
        spawnShatterBurst(tGroup.position.x, tGroup.position.z, 0xff1e42);
        showHudBanner("🩸 NERVE HIT! -300 (Dodge Red Gates!)", "#ef4444");
      } else if (type === "fluoride") {
        tGroup.userData.resolved = true;
        const pts = 500 * comboMultiplier;
        score += pts;
        sfx.playDing(1300);
        spawnShatterBurst(tGroup.position.x, tGroup.position.z, 0x38bdf8);
        showHudBanner(`💎 FLUORIDE SHIELD! +${pts}`, "#38bdf8");
        tGroup.visible = false;
      }
    }

    if (tGroup.position.z > 9) {
      tGroup.visible = true;
      respawnDentalTarget(tGroup, -165 - Math.random() * 20);
    }
  });

  // Animate Debris Particles
  shatterParticles.forEach((p) => {
    if (p.userData.life > 0) {
      p.position.x += p.userData.vx;
      p.position.y += p.userData.vy;
      p.position.z += p.userData.vz;
      p.userData.vy -= 0.012;
      p.rotation.x += 0.16;
      p.userData.life -= 0.05;
      p.scale.setScalar(Math.max(0.01, p.userData.life));
      if (p.userData.life <= 0) p.visible = false;
    }
  });

  const shakeX = crashShake > 0 ? (Math.random() - 0.5) * 0.35 : 0;
  if (crashShake > 0) crashShake--;

  if (victoryFreezeTimer > 0) {
    const angle = (120 - victoryFreezeTimer) * 0.045;
    webglCamera.position.set(
      Math.sin(angle) * 6.5,
      3.5,
      Math.cos(angle) * 6.5,
    );
    webglCamera.lookAt(0, 0.4, 0);
  } else if (countdownTimer > 0) {
    const t = countdownTimer / 180;
    webglCamera.position.set(
      dentalCurrentX * 0.5,
      3.9 + t * 1.5,
      5.2 + t * 2.5,
    );
    webglCamera.lookAt(0, 0.3, -10);
  } else {
    webglCamera.position.set(dentalCurrentX * 0.52 + shakeX, 3.85, 5.2);
    webglCamera.lookAt(dentalCurrentX * 0.72, 0.25, -10);
  }
}

// ==========================================
// 17. MASTER 60FPS LOOP (COUNTDOWN, GAMEPLAY & VICTORY)
// ==========================================
function masterArcadeLoop() {
  if (raceFinished) return;

  // PHASE 1: 3-2-1-GO STARTING GRID COUNTDOWN
  if (countdownTimer > 0) {
    if (countdownTimer === 175) {
      sfx.playCountdownBeep(false);
      showHudBanner("🔴 3...", "#ef4444", 900);
    } else if (countdownTimer === 115) {
      sfx.playCountdownBeep(false);
      showHudBanner("🟠 2...", "#fb923c", 900);
    } else if (countdownTimer === 55) {
      sfx.playCountdownBeep(false);
      showHudBanner("🟡 1...", "#facc15", 900);
    } else if (countdownTimer === 1) {
      sfx.playCountdownBeep(true);
      showHudBanner(
        activeGameMode === "dental_runner"
          ? "🟢 CLINIC OPEN! HOLD DRILL!"
          : "🟢 GO!! DRIFT THE CORNERS!",
        "#34d399",
        1300,
      );
      startTime = Date.now();
    }
    countdownTimer--;

    if (activeGameMode === "dental_runner") {
      if (webglCamera) {
        const t = countdownTimer / 180;
        webglCamera.position.set(0, 3.8 + t * 1.4, 5.2 + t * 2.2);
        webglCamera.lookAt(0, 0.3, -10);
      }
    } else {
      positionWindingDriftWorld();
    }

    if (webglRenderer && webglScene && webglCamera) {
      webglRenderer.render(webglScene, webglCamera);
    }
    gameLoopId = requestAnimationFrame(masterArcadeLoop);
    return;
  }

  // PHASE 2: FINISH LINE SLOW-MOTION VICTORY CAMERA ORBIT
  if (victoryFreezeTimer > 0) {
    victoryFreezeTimer--;
    if (activeGameMode === "dental_runner") {
      const angle = (110 - victoryFreezeTimer) * 0.045;
      webglCamera.position.set(
        Math.sin(angle) * 6.5,
        3.4,
        Math.cos(angle) * 6.5,
      );
      webglCamera.lookAt(0, 0.4, 0);
    } else {
      positionWindingDriftWorld();
    }

    if (webglRenderer && webglScene && webglCamera) {
      webglRenderer.render(webglScene, webglCamera);
    }

    if (victoryFreezeTimer === 0) {
      raceFinished = true;
      stopArcadeAudio();

      const timeTaken = (Date.now() - startTime) / 1000;
      const grade =
        score >= 25000
          ? "S+ MASTER"
          : score >= 15000
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

  // PHASE 3: ACTIVE 60FPS GAMEPLAY
  if (activeGameMode === "dental_runner") {
    updateDentalRunnerLoop();
  } else {
    updateNightDriftLoop();
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

  // Trigger Finish Line Celebration at 100%
  if (distanceTraveled >= totalRunDistance && victoryFreezeTimer === 0) {
    victoryFreezeTimer = 110; // ~1.8s slow-mo victory camera orbit
    const timeTaken = (Date.now() - startTime) / 1000;
    const speedBonus = Math.max(0, Math.floor((95 - timeTaken) * 50));
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
