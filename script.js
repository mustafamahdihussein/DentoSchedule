// ==========================================
// 1. DEVICE ID & GLOBAL STATE
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

function clearAuthSessionTimeout() {
  if (authSessionTimeout) {
    clearTimeout(authSessionTimeout);
    authSessionTimeout = null;
  }
}

function showEntryGateway() {
  clearAuthSessionTimeout();
  const adminPanel = document.getElementById("admin-panel");
  const mainApp = document.getElementById("main-app");
  const roleSelection = document.getElementById("role-selection");
  const loginForm = document.getElementById("login-form");
  const entryGateway = document.getElementById("entry-gateway");
  const loginError = document.getElementById("login-error");
  const passwordInput = document.getElementById("admin-password");

  if (adminPanel) adminPanel.style.display = "none";
  if (mainApp) mainApp.style.display = "none";
  if (roleSelection) roleSelection.style.display = "block";
  if (loginForm) loginForm.style.display = "none";
  if (entryGateway) entryGateway.style.display = "flex";
  if (loginError) loginError.style.display = "none";
  if (passwordInput) passwordInput.value = "";
}

const btnLogout = document.getElementById("btn-logout");
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

// 1. User Button Click
const btnUser = document.getElementById("btn-user");
const entryGateway = document.getElementById("entry-gateway");
const mainApp = document.getElementById("main-app");
const roleSelection = document.getElementById("role-selection");
const loginForm = document.getElementById("login-form");
const btnAdminPrompt = document.getElementById("btn-admin-prompt");
const btnBack = document.getElementById("btn-back");
const adminLoginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("admin-password");
const loginError = document.getElementById("login-error");
const adminPanel = document.getElementById("admin-panel");

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

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const passVal = passwordInput ? passwordInput.value.trim() : "";

    window.authPersistenceReady
      .then(() =>
        window.signInWithEmailAndPassword(
          window.auth,
          adminEmail,
          passVal,
        ),
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
  if (!window.auth || !window.auth.currentUser) return;

  try {
    const sessionRef = adminSessionControlRef();
    let sessionSnapshot = await window.getDoc(sessionRef);
    let sessionVersion = null;

    if (!sessionSnapshot.exists() && window.auth.currentUser.email === adminEmail) {
      await window.setDoc(sessionRef, {
        version: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      });
      sessionSnapshot = await window.getDoc(sessionRef);
    }
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
    watchAdminSession();
    refreshAllResourceBadges();
  });
}

// ==========================================
// 2. INTERACTIVE THREE.JS 3D TOOTH MASCOT
// ==========================================
function initHeader3DMascot() {
  const canvas = document.getElementById("header-3d-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(90, 90);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 4.2;

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  const pointLight = new THREE.PointLight(0x2563eb, 3, 10);
  pointLight.position.set(-3, -2, 2);
  scene.add(pointLight);

  // Stylized 3D Molar / Crown Group
  const toothGroup = new THREE.Group();
  scene.add(toothGroup);

  const crownGeo = new THREE.CylinderGeometry(0.8, 1.0, 1.1, 8);
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.1,
  });
  const crownMesh = new THREE.Mesh(crownGeo, crownMat);
  crownMesh.position.y = 0.35;
  toothGroup.add(crownMesh);

  // Roots
  const rootGeo = new THREE.ConeGeometry(0.45, 1.2, 6);
  const rootMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
  
  const root1 = new THREE.Mesh(rootGeo, rootMat);
  root1.position.set(-0.35, -0.65, 0);
  root1.rotation.z = 0.25;
  toothGroup.add(root1);

  const root2 = new THREE.Mesh(rootGeo, rootMat);
  root2.position.set(0.35, -0.65, 0);
  root2.rotation.z = -0.25;
  toothGroup.add(root2);

  toothGroup.rotation.x = 0.3;
  toothGroup.rotation.y = 0.2;

  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let autoSpinSpeed = 0.008;

  canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    toothGroup.rotation.y += deltaX * 0.012;
    toothGroup.rotation.x += deltaY * 0.012;

    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("pointerup", () => {
    isDragging = false;
  });

  function animateMascot() {
    requestAnimationFrame(animateMascot);
    if (!isDragging) {
      toothGroup.rotation.y += autoSpinSpeed;
    }
    renderer.render(scene, camera);
  }
  animateMascot();
}
window.addEventListener("DOMContentLoaded", initHeader3DMascot);

// ==========================================
// 3. ADMIN PANEL MODALS & ID/QR LINK
// ==========================================
const modalUploadPdf = document.getElementById("modal-upload-pdf");
const btnUploadPdf = document.getElementById("btn-upload-pdf");
const btnCancelPdf = document.getElementById("btn-cancel-pdf");
const modalEditIdQr = document.getElementById("modal-edit-id-qr");
const btnEditIdQr = document.getElementById("btn-edit-id-qr");
const btnSaveIdQr = document.getElementById("btn-save-id-qr");
const btnCancelIdQr = document.getElementById("btn-cancel-id-qr");
const idQrLinkInput = document.getElementById("id-qr-link");
const btnOpenIdQr = document.getElementById("btn-open-id-qr");

const modalAddQuiz = document.getElementById("modal-add-quiz");
const btnAddQuiz = document.getElementById("btn-add-quiz");
const btnCancelQuiz = document.getElementById("btn-cancel-quiz");
const modalEditSchedule = document.getElementById("modal-edit-schedule");
const btnEditSchedule = document.getElementById("btn-edit-schedule");
const btnCancelEdit = document.getElementById("btn-cancel-edit");

if (btnUploadPdf) btnUploadPdf.addEventListener("click", () => { if (modalUploadPdf) modalUploadPdf.style.display = "flex"; });
if (btnCancelPdf) btnCancelPdf.addEventListener("click", () => { if (modalUploadPdf) modalUploadPdf.style.display = "none"; });

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
      alert("The ID and QR link has not been added yet by the admin.");
    }
  });
}

if (btnEditIdQr) {
  btnEditIdQr.addEventListener("click", async () => {
    const linkSnapshot = await window.getDoc(idQrDocRef());
    if (idQrLinkInput) {
      idQrLinkInput.value = linkSnapshot.exists() ? linkSnapshot.data().url || "" : "";
    }
    if (modalEditIdQr) modalEditIdQr.style.display = "flex";
  });
}

if (btnCancelIdQr) {
  btnCancelIdQr.addEventListener("click", () => { if (modalEditIdQr) modalEditIdQr.style.display = "none"; });
}

if (btnSaveIdQr) {
  btnSaveIdQr.addEventListener("click", async () => {
    const link = idQrLinkInput ? idQrLinkInput.value.trim() : "";
    try {
      const parsedLink = new URL(link);
      if (!/^https?:$/.test(parsedLink.protocol)) throw new Error();
      await window.setDoc(idQrDocRef(), {
        url: link,
        timestamp: new Date().toISOString(),
      });
      if (btnOpenIdQr) btnOpenIdQr.href = link;
      if (modalEditIdQr) modalEditIdQr.style.display = "none";
      alert("ID and QR link saved successfully.");
    } catch (error) {
      alert("Please enter a valid HTTP/HTTPS link.");
    }
  });
}
loadIdQrLink();

if (btnAddQuiz) btnAddQuiz.addEventListener("click", () => { if (modalAddQuiz) modalAddQuiz.style.display = "flex"; });
if (btnCancelQuiz) btnCancelQuiz.addEventListener("click", () => { if (modalAddQuiz) modalAddQuiz.style.display = "none"; });
if (btnEditSchedule) btnEditSchedule.addEventListener("click", () => { if (modalEditSchedule) modalEditSchedule.style.display = "flex"; });
if (btnCancelEdit) btnCancelEdit.addEventListener("click", () => { if (modalEditSchedule) modalEditSchedule.style.display = "none"; });

// ==========================================
// 4. DYNAMIC 10-DAY CALENDAR & SCHEDULE
// ==========================================
function renderDynamicCalendar() {
  const iraqTime = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" }),
  );

  let currentDay = iraqTime.getDay();
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

  let startOfWeek = new Date(iraqTime);
  startOfWeek.setDate(iraqTime.getDate() + diffToSaturday);
  startOfWeek.setHours(0, 0, 0, 0);

  const calendarContainer = document.getElementById("dynamic-calendar-container");
  if (!calendarContainer) return;
  calendarContainer.innerHTML = "";

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let validDaysFound = 0;
  let loopDate = new Date(startOfWeek);

  while (validDaysFound < 10) {
    let loopDayOfWeek = loopDate.getDay();
    if (loopDayOfWeek !== 4 && loopDayOfWeek !== 5) {
      let dayName = dayNames[loopDayOfWeek];
      let dateNum = loopDate.getDate();
      let isToday = loopDate.toDateString() === iraqTime.toDateString();

      let tomorrowDate = new Date(iraqTime);
      tomorrowDate.setDate(iraqTime.getDate() + 1);
      let isTomorrow = loopDate.toDateString() === tomorrowDate.toDateString();

      let badgeHtml = `<div style="height: 18px; margin-top: 4px;"></div>`;
      if (isToday) {
        badgeHtml = `<div style="background: #ffffff; color: #1d4ed8; font-size: 10px; padding: 2px 7px; border-radius: 12px; margin-top: 4px; font-weight: 800; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Today</div>`;
      } else if (isTomorrow) {
        badgeHtml = `<div style="background: #ffffff; color: #1d4ed8; font-size: 10px; padding: 2px 7px; border-radius: 12px; margin-top: 4px; font-weight: 800; border: 1px solid #93c5fd;">Tomorrow</div>`;
      }

      let dayHTML = `
        <div class="day-selector-btn" data-day="${dayName}" data-date="${loopDate.toDateString()}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 64px; height: 86px; background-color: #ffffff; color: #64748b; border: 1px solid #e2e8f0; border-radius: 14px; cursor: pointer; transition: all 0.2s ease; flex-shrink: 0; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);">
          <span style="font-size: 13px; font-weight: 700; margin-bottom: 2px;">${dayName}</span>
          <span style="font-size: 22px; font-weight: 850; color: #0f172a;">${dateNum}</span>
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
        b.style.backgroundColor = "#ffffff";
        b.style.color = "#64748b";
        b.style.borderColor = "#e2e8f0";
        b.style.boxShadow = "0 2px 6px rgba(15, 23, 42, 0.03)";
        const spanNum = b.querySelector("span:nth-child(2)");
        if (spanNum) spanNum.style.color = "#0f172a";
      });

      this.style.backgroundColor = "#2563eb";
      this.style.color = "white";
      this.style.borderColor = "#1d4ed8";
      this.style.boxShadow = "0 6px 16px rgba(37, 99, 235, 0.3)";
      const spanNum = this.querySelector("span:nth-child(2)");
      if (spanNum) spanNum.style.color = "#ffffff";

      this.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

      let selectedDay = this.getAttribute("data-day");
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
  allSchedules.forEach((sec) => { sec.style.display = "none"; });

  const targetId = `schedule-${dayMap[dayName]}`;
  const targetSection = document.getElementById(targetId);
  if (targetSection) {
    targetSection.style.display = "block";
  }
}

window.addEventListener("DOMContentLoaded", renderDynamicCalendar);

// ==========================================
// 5. LIVE BAGHDAD CLOCK & LECTURE LIVE PROGRESS
// ==========================================
function updateLiveBaghdadStatus() {
  const now = new Date();
  const baghdadTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Baghdad" });
  const baghdadDate = new Date(baghdadTimeStr);

  const hours = baghdadDate.getHours();
  const minutes = baghdadDate.getMinutes();
  const dayOfWeek = baghdadDate.getDay(); // 0=Sun..6=Sat

  const timePill = document.getElementById("baghdad-live-clock");
  if (timePill) {
    const hh = hours.toString().padStart(2, "0");
    const mm = minutes.toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    timePill.innerHTML = `🕒 Baghdad Time: ${displayHour}:${mm} ${ampm}`;
  }

  // Active lecture highlighting & progress bars (Sat=6, Sun=0, Mon=1, Tue=2, Wed=3)
  const activeDayMap = { 6: "schedule-saturday", 0: "schedule-sunday", 1: "schedule-monday", 2: "schedule-tuesday", 3: "schedule-wednesday" };
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
        const startStr = block.getAttribute("data-start"); // e.g. "08:00"
        const endStr = block.getAttribute("data-end");     // e.g. "09:00"
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
            const pct = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
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

// ==========================================
// 6. 3D PERSPECTIVE TILT ON CARDS
// ==========================================
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
      card.style.setProperty("--rx", `0deg`);
      card.style.setProperty("--ry", `0deg`);
    }
  });
});

// ==========================================
// 7. SUBJECT VIEWER MODAL & FIREBASE SYNC
// ==========================================
const subjectModal = document.getElementById("modal-subject-view");
const closeSubjectBtn = document.getElementById("btn-close-subject-view");
const subjectTitle = document.getElementById("view-subject-title");

// Attach click listeners to main subject cards AND split-group columns
function setupSubjectClickTriggers() {
  const clickableItems = document.querySelectorAll(".subject-card, .group-col[data-subject]");

  clickableItems.forEach((item) => {
    if (item.classList.contains("free-slot")) return;

    item.addEventListener("click", (e) => {
      e.stopPropagation();
      let subName = "";
      let subKey = "";

      if (item.hasAttribute("data-subject")) {
        subKey = item.getAttribute("data-subject");
        subName = subKey.replace("-", " ").toUpperCase();
      } else {
        const heading = item.querySelector("h2");
        if (heading) {
          subName = heading.firstChild.textContent.trim();
          subKey = subName.toLowerCase().replace(/\s+/g, "-");
        }
      }

      if (!subName) return;
      if (subjectTitle) subjectTitle.innerText = subName;

      loadSubjectResources(subKey);
      if (subjectModal) subjectModal.style.display = "flex";
    });
  });
}

async function loadSubjectResources(subjectKey) {
  const pdfContainer = document.getElementById("list-pdfs");
  const quizContainer = document.getElementById("list-quizzes");

  if (pdfContainer) pdfContainer.innerHTML = `<div style="text-align:center; color:#64748b; font-size:13px;">Loading PDFs...</div>`;
  if (quizContainer) quizContainer.innerHTML = `<div style="text-align:center; color:#64748b; font-size:13px;">Loading Quizzes...</div>`;

  const isAdmin = window.auth && window.auth.currentUser && window.auth.currentUser.email === adminEmail;

  try {
    // 1. Load PDFs
    const pdfSnapshot = await window.getDocs(window.collection(window.db, "PDFNotes"));
    if (pdfContainer) pdfContainer.innerHTML = "";
    let pdfCount = 0;

    pdfSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.subject === subjectKey) {
        pdfCount++;
        const itemRow = document.createElement("div");
        itemRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);";

        const linkBtn = document.createElement("a");
        linkBtn.href = data.url;
        linkBtn.target = "_blank";
        linkBtn.style.cssText = "text-decoration: none; color: #1e293b; font-weight: 600; font-size: 14px; flex-grow: 1;";
        linkBtn.innerHTML = `📄 ${data.name}`;

        itemRow.appendChild(linkBtn);

        if (isAdmin) {
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-resource-btn";
          deleteBtn.innerHTML = "🗑️";
          deleteBtn.addEventListener("click", async () => {
            if (confirm(`Remove ${data.name}?`)) {
              await window.deleteDoc(window.doc(window.db, "PDFNotes", docSnap.id));
              itemRow.remove();
              refreshAllResourceBadges();
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

    // 2. Load Quizzes
    const quizSnapshot = await window.getDocs(window.collection(window.db, "QuizLinks"));
    if (quizContainer) quizContainer.innerHTML = "";
    let quizCount = 0;

    quizSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.subject === subjectKey) {
        quizCount++;
        const itemRow = document.createElement("div");
        itemRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: #fefce8; border: 1px solid #fde047; padding: 10px 14px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);";

        const linkBtn = document.createElement("a");
        linkBtn.href = data.url;
        linkBtn.target = "_blank";
        linkBtn.style.cssText = "text-decoration: none; color: #854d0e; font-weight: 600; font-size: 14px; flex-grow: 1;";
        linkBtn.innerHTML = `📝 ${data.name}`;

        itemRow.appendChild(linkBtn);

        if (isAdmin) {
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-resource-btn";
          deleteBtn.innerHTML = "🗑️";
          deleteBtn.addEventListener("click", async () => {
            if (confirm(`Remove ${data.name}?`)) {
              await window.deleteDoc(window.doc(window.db, "QuizLinks", docSnap.id));
              itemRow.remove();
              refreshAllResourceBadges();
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
// 8. LIVE RESOURCE BADGES & UPCOMING EXAMS RADAR
// ==========================================
async function refreshAllResourceBadges() {
  try {
    const pdfsSnap = await window.getDocs(window.collection(window.db, "PDFNotes"));
    const quizzesSnap = await window.getDocs(window.collection(window.db, "QuizLinks"));
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
        <span class="res-pill ${c.pdfs > 0 ? 'has-items' : ''}">📄 ${c.pdfs} PDF${c.pdfs === 1 ? '' : 's'}</span>
        <span class="res-pill quiz-pill ${c.quizzes > 0 ? 'has-items' : ''}">📝 ${c.quizzes} Quiz${c.quizzes === 1 ? '' : 's'}</span>
      `;
    });
  } catch (e) {
    console.error("Failed to refresh resource badges", e);
  }
}
window.addEventListener("DOMContentLoaded", refreshAllResourceBadges);

// Live Schedule Notes & Exams Radar
window.onSnapshot(window.collection(window.db, "ScheduleNotes"), (snapshot) => {
  const today = new Date().toISOString().split("T")[0];
  const radarContainer = document.getElementById("upcoming-exams-radar");
  if (!radarContainer) return;

  radarContainer.innerHTML = "";
  let activeAlertsCount = 0;

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const subjectKey = docSnap.id;
    const badge = document.getElementById("badge-" + subjectKey);

    if (badge) {
      if (data.expiration >= today && data.note && data.note.trim() !== "") {
        badge.innerText = data.note;
        badge.style.cssText = "display: inline-block; background-color: #e11d48; color: white; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; margin-left: 8px; letter-spacing: 0.4px; animation: pulse 1.5s infinite; vertical-align: middle;";
        
        activeAlertsCount++;
        const chip = document.createElement("div");
        chip.className = "exam-radar-chip";
        chip.innerHTML = `
          <div class="exam-radar-chip-top">
            <span class="exam-radar-subj">${subjectKey.replace("-", " ").toUpperCase()}</span>
            <span class="exam-radar-countdown">Exp: ${data.expiration}</span>
          </div>
          <div class="exam-radar-note">⚠️ ${data.note}</div>
        `;
        chip.addEventListener("click", () => {
          loadSubjectResources(subjectKey);
          if (subjectTitle) subjectTitle.innerText = subjectKey.replace("-", " ").toUpperCase();
          if (subjectModal) subjectModal.style.display = "flex";
        });
        radarContainer.appendChild(chip);
      } else {
        badge.style.display = "none";
        badge.innerText = "";
      }
    }
  });

  if (activeAlertsCount > 0) {
    radarContainer.style.display = "block";
    if (!radarContainer.querySelector(".exams-radar-title")) {
      const titleDiv = document.createElement("div");
      titleDiv.className = "exams-radar-title";
      titleDiv.innerHTML = `<span>🚨 ACTIVE EXAMS &amp; ANNOUNCEMENTS</span>`;
      radarContainer.prepend(titleDiv);
    }
  } else {
    radarContainer.style.display = "none";
  }
});

// ==========================================
// 9. POMODORO TIMER & FOCUS SOUND GENERATOR
// ==========================================
const pomodoroModal = document.getElementById("pomodoro-modal");
const btnOpenPomodoro = document.getElementById("btn-open-pomodoro");

if (pomodoroModal && btnOpenPomodoro) {
  const btnClosePomodoro = document.getElementById("btn-close-pomodoro");
  const timeDisplay = document.getElementById("time-display");
  const btnModeStudy = document.getElementById("btn-mode-study");
  const btnModeBreak = document.getElementById("btn-mode-break");
  const btnTimerStart = document.getElementById("btn-timer-start");
  const btnTimerPause = document.getElementById("btn-timer-pause");
  const btnTimerReset = document.getElementById("btn-timer-reset");
  const btnFocusSound = document.getElementById("btn-focus-sound");

  const timerStorageKey = "dento_pomodoro_timer";
  let timerInterval;
  let timeLeft = 25 * 60;
  let isRunning = false;
  let currentMode = "study";
  let endTime = null;
  let screenWakeLock = null;

  // Web Audio Brown Noise Focus Sound Generator
  let focusAudioCtx = null;
  let focusNoiseNode = null;
  let isFocusSoundOn = false;

  function toggleFocusSound() {
    if (isFocusSoundOn) {
      if (focusAudioCtx) {
        focusAudioCtx.close();
        focusAudioCtx = null;
      }
      isFocusSoundOn = false;
      if (btnFocusSound) {
        btnFocusSound.classList.remove("active");
        btnFocusSound.textContent = "🎧 Focus Brown Noise: OFF";
      }
    } else {
      try {
        focusAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const bufferSize = 2 * focusAudioCtx.sampleRate;
        const noiseBuffer = focusAudioCtx.createBuffer(1, bufferSize, focusAudioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5; // Gain boost
        }

        focusNoiseNode = focusAudioCtx.createBufferSource();
        focusNoiseNode.buffer = noiseBuffer;
        focusNoiseNode.loop = true;

        const filter = focusAudioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 320; // Soft deep brown noise

        focusNoiseNode.connect(filter);
        filter.connect(focusAudioCtx.destination);
        focusNoiseNode.start(0);

        isFocusSoundOn = true;
        if (btnFocusSound) {
          btnFocusSound.classList.add("active");
          btnFocusSound.textContent = "🎧 Focus Brown Noise: ON (Playing)";
        }
      } catch (e) {
        console.warn("Web Audio error:", e);
        alert("Unable to start focus sound.");
      }
    }
  }

  if (btnFocusSound) {
    btnFocusSound.addEventListener("click", toggleFocusSound);
  }

  async function requestScreenWakeLock() {
    if (!isRunning || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
    try {
      const wakeLock = await navigator.wakeLock.request("screen");
      if (!isRunning) {
        await wakeLock.release();
        return;
      }
      screenWakeLock = wakeLock;
      screenWakeLock.addEventListener("release", () => { screenWakeLock = null; });
    } catch (error) {
      console.warn("Screen wake lock unavailable.", error);
    }
  }

  async function releaseScreenWakeLock() {
    const wakeLock = screenWakeLock;
    screenWakeLock = null;
    if (wakeLock) {
      try { await wakeLock.release(); } catch (e) {}
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
      const savedState = JSON.parse(localStorage.getItem(timerStorageKey) || "null");
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
    alert(currentMode === "study" ? "Study session complete! Take a 5-minute break." : "Break over! Back to studying.");
  }

  function runTimer() {
    clearInterval(timerInterval);
    updateDisplay();
    if (timeLeft <= 0) {
      finishTimer();
      return;
    }
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
      releaseScreenWakeLock();
      saveTimerState();
    });
  }

  function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    endTime = null;
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

  if (btnOpenPomodoro) {
    btnOpenPomodoro.addEventListener("click", () => { pomodoroModal.style.display = "flex"; });
  }

  if (btnClosePomodoro) {
    btnClosePomodoro.addEventListener("click", () => { pomodoroModal.style.display = "none"; });
  }

  loadTimerState();
  if (btnModeStudy) btnModeStudy.classList.toggle("active", currentMode === "study");
  if (btnModeBreak) btnModeBreak.classList.toggle("active", currentMode === "break");
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
  { id: "cons_amal", title: "Conservative: Amalgam Restorations", target: 15 },
  { id: "cons_comp", title: "Conservative: Composite Restorations", target: 20 },
  { id: "surg_ext", title: "Oral Surgery: Simple Extractions", target: 12 },
  { id: "prost_cd", title: "Prosthodontics: Complete Denture Cases", target: 2 },
  { id: "prost_pd", title: "Prosthodontics: Partial Denture Cases", target: 4 },
  { id: "perio_sc", title: "Periodontics: Scaling & Root Planing", target: 10 },
  { id: "pedo_rest", title: "Pedodontics: Pediatric Restorations", target: 8 },
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
          <button class="clinic-step-btn" onclick="adjustClinicCount('${req.id}', -1)">-</button>
          <span class="clinic-req-count">${currentCount} / ${req.target}</span>
          <button class="clinic-step-btn" onclick="adjustClinicCount('${req.id}', 1)">+</button>
        </div>
      </div>
      <div class="clinic-progress-track">
        <div class="clinic-progress-fill" style="width: ${pct}%"></div>
      </div>
    `;
    clinicReqList.appendChild(itemDiv);
  });
}

window.adjustClinicCount = function (reqId, delta) {
  const savedData = getClinicLogData();
  const current = Number(savedData[reqId]) || 0;
  const next = Math.max(0, current + delta);
  savedData[reqId] = next;
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
// 11. DUAL-MODE 3D ARCADE & LEADERBOARD SYSTEM
// ==========================================
let arcadePlayerName = "";
let currentArcadeTab = "drift"; // "drift" or "dental"

window.openGameMenu = function () {
  const playerName = prompt("Enter your name for the Al-Ameen Arcade Leaderboard:", localStorage.getItem("dento_student") || "");
  if (!playerName || !playerName.trim()) return;

  arcadePlayerName = playerName.trim().slice(0, 30);
  localStorage.setItem("dento_student", arcadePlayerName);

  const nameLabel = document.getElementById("arcade-player-name-label");
  if (nameLabel) nameLabel.innerText = arcadePlayerName;

  const menu = document.getElementById("game-selection-overlay");
  if (menu) menu.style.display = "flex";
};

window.closeGameMenu = function () {
  const menu = document.getElementById("game-selection-overlay");
  if (menu) menu.style.display = "none";
  stopArcadeAudio();
};

window.switchArcadeModeTab = function (mode) {
  currentArcadeTab = mode;
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
  const actionBtn = scoreboardModal ? scoreboardModal.querySelector(".scoreboard-close") : null;

  if (heading) heading.innerText = "🏆 AL-AMEEN HIGH SCORES";
  if (finalScoreDisp) finalScoreDisp.innerText = "---";
  if (finalSub) finalSub.innerText = "Global Hall of Fame";
  if (actionBtn) actionBtn.innerText = "Back to Menu";

  if (scoreboardModal) scoreboardModal.style.display = "flex";
  fetchDriftLeaderboard();
};

// --- AUDIO & THREE.JS 3D ARCADE ENGINE ---
const soundtrack = new Audio("soundtrack.mp3");
soundtrack.loop = true;
soundtrack.volume = 0.35;

const engineAudio = new Audio("engine.mp3");
engineAudio.loop = true;
engineAudio.volume = 0;

const driftAudio = new Audio("drift.mp3");
driftAudio.loop = true;
driftAudio.volume = 0;

function stopArcadeAudio() {
  try {
    engineAudio.pause();
    driftAudio.pause();
    soundtrack.pause();
    soundtrack.currentTime = 0;
  } catch (e) {}
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const sfx = {
  init: function () {
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch((e) => {});
    }
  },
  playDing: function () {
    try {
      let osc = audioCtx.createOscillator();
      let gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  },
  playCrash: function () {
    try {
      let osc = audioCtx.createOscillator();
      let gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, audioCtx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
  },
};

// --- FIREBASE SCOREBOARD SYNC ---
async function submitDriftScore(playerName, playerScore) {
  const studentName = playerName?.trim() || localStorage.getItem("dento_student") || "Student";
  const currentUser = window.auth?.currentUser;
  const isAdmin = currentUser?.email === adminEmail;
  const displayName = isAdmin ? "Admin" : studentName;
  const docId = isAdmin ? "admin_master" : studentName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();

  if (!window.db || !window.doc || !window.getDoc || !window.setDoc) {
    console.error("Firebase services unavailable.");
    return false;
  }

  try {
    const docRef = window.doc(window.db, "DriftScores", docId);
    const docSnap = await window.getDoc(docRef);
    const previousScore = docSnap.exists() ? Number(docSnap.data().score) || 0 : 0;
    
    // Anti-cheat limit per run
    const sanitizedGain = Math.min(50000, Number(playerScore) || 0);
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
    console.error("Failed to fetch leaderboard:", error);
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

  const isAdmin = window.auth && window.auth.currentUser && window.auth.currentUser.email === adminEmail;

  dataArray.forEach((player, index) => {
    const rankPrefix = index === 0 ? "👑 " : `${index + 1}. `;
    const rowDiv = document.createElement("div");
    rowDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center; color: white; margin-bottom: 8px; font-family: monospace; font-size: 15px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 5px;";

    const infoSpan = document.createElement("span");
    infoSpan.innerHTML = `${rankPrefix}${player.name}`;

    const rightBox = document.createElement("div");
    rightBox.style.cssText = "display: flex; align-items: center; gap: 10px;";

    const scoreSpan = document.createElement("span");
    scoreSpan.style.cssText = "color: #2ecc71; font-weight: bold;";
    scoreSpan.innerText = player.score;

    rightBox.appendChild(scoreSpan);

    if (isAdmin) {
      const delScoreBtn = document.createElement("button");
      delScoreBtn.className = "delete-resource-btn";
      delScoreBtn.innerHTML = "🗑️";
      delScoreBtn.title = "Delete score";
      delScoreBtn.addEventListener("click", async () => {
        if (confirm(`Delete score for ${player.name}?`)) {
          try {
            await window.deleteDoc(window.doc(window.db, "DriftScores", player.id));
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

// --- ACTIVE GAME ENGINE LOOP (THREE.JS 3D WEBGL) ---
let gameLoopId = null;
let activeGameMode = "drift"; // "drift" or "dental_runner"
let activeCarSelection = "g37";

let webglRenderer = null;
let webglScene = null;
let webglCamera = null;
let carMeshGroup = null;

let carX = 0, carY = 26000;
let speed = 0;
let carAngle = -Math.PI / 2;
let travelAngle = -Math.PI / 2;
let lastSafeX = 0, lastSafeY = 26000;
let score = 0;
let comboMultiplier = 1;
let startTime = 0;
let raceFinished = false;
let crashCooldown = 0;
let driftGraceTimer = 0;
let currentGrip = 0.015;
let obstacles = [];
window.input = { gas: false, left: false, right: false };

const trackPoints = [
  { x: 0, y: 26200 },
  { x: 0, y: 25000 },
  { x: 2000, y: 23500 },
  { x: -2000, y: 21500 },
  { x: 2500, y: 19500 },
  { x: -2500, y: 17500 },
  { x: 2800, y: 15500 },
  { x: 500, y: 14000 },
  { x: -2800, y: 12500 },
  { x: 2500, y: 10500 },
  { x: -2000, y: 8500 },
  { x: 1500, y: 6500 },
  { x: -1000, y: 4500 },
  { x: 500, y: 2500 },
  { x: 0, y: 1000 },
  { x: 0, y: -800 },
];

function getTrackData(targetY) {
  for (let i = 0; i < trackPoints.length - 1; i++) {
    if (targetY <= trackPoints[i].y && targetY >= trackPoints[i + 1].y) {
      let dx = trackPoints[i + 1].x - trackPoints[i].x;
      let dy = trackPoints[i + 1].y - trackPoints[i].y;
      return { angle: Math.atan2(dy, dx), sharpness: Math.abs(dx) };
    }
  }
  return { angle: -Math.PI / 2, sharpness: 0 };
}

const trackPath2D = new Path2D();
trackPath2D.moveTo(trackPoints[0].x, trackPoints[0].y);
for (let i = 1; i < trackPoints.length - 1; i++) {
  let xc = (trackPoints[i].x + trackPoints[i + 1].x) / 2;
  let yc = (trackPoints[i].y + trackPoints[i + 1].y) / 2;
  trackPath2D.quadraticCurveTo(trackPoints[i].x, trackPoints[i].y, xc, yc);
}
trackPath2D.lineTo(trackPoints[trackPoints.length - 1].x, trackPoints[trackPoints.length - 1].y);

window.startGame = function (modeOrCar) {
  closeGameMenu();
  const gameCanvasOverlay = document.getElementById("game-canvas-overlay");
  const scoreboardModal = document.getElementById("scoreboard-modal");

  if (gameCanvasOverlay) gameCanvasOverlay.style.display = "flex";
  if (scoreboardModal) scoreboardModal.style.display = "none";

  if (modeOrCar === "dental_runner") {
    activeGameMode = "dental_runner";
    const secLabel = document.getElementById("hud-secondary-label");
    if (secLabel) secLabel.innerText = "ZAPS";
  } else {
    activeGameMode = "drift";
    activeCarSelection = modeOrCar;
    const secLabel = document.getElementById("hud-secondary-label");
    if (secLabel) secLabel.innerText = "COMBO";
  }

  carX = 0;
  carY = 26000;
  speed = 0;
  carAngle = -Math.PI / 2;
  travelAngle = -Math.PI / 2;
  lastSafeX = 0;
  lastSafeY = 26000;
  score = 0;
  comboMultiplier = 1;
  startTime = Date.now();
  raceFinished = false;
  crashCooldown = 0;
  driftGraceTimer = 0;
  currentGrip = 0.015;
  obstacles = [];

  // Spawn some traffic / carious lesions along the track
  for (let yPos = 24000; yPos > 2000; yPos -= 1800) {
    obstacles.push({
      x: (Math.random() - 0.5) * 260,
      y: yPos,
      type: activeGameMode === "dental_runner" ? "caries_block" : "oncoming_car",
      active: true,
    });
  }

  initThreeJSViewport();

  sfx.init();
  try { soundtrack.play().catch((e) => {}); } catch (e) {}
  try {
    engineAudio.volume = 0;
    engineAudio.play().catch((e) => {});
  } catch (e) {}
  try {
    driftAudio.volume = 0;
    driftAudio.play().catch((e) => {});
  } catch (e) {}

  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  gameLoop3D();
};

window.quitGame = function () {
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  const gameCanvasOverlay = document.getElementById("game-canvas-overlay");
  if (gameCanvasOverlay) gameCanvasOverlay.style.display = "none";
  stopArcadeAudio();
};

function initThreeJSViewport() {
  const canvas = document.getElementById("drift-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  if (!webglRenderer) {
    webglRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    webglRenderer.setSize(600, 800);
    webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  webglScene = new THREE.Scene();
  webglScene.background = new THREE.Color(0x090d16);

  webglCamera = new THREE.PerspectiveCamera(55, 600 / 800, 0.1, 1000);

  const amb = new THREE.AmbientLight(0xffffff, 1.0);
  webglScene.add(amb);

  const dir = new THREE.DirectionalLight(0x38bdf8, 1.8);
  dir.position.set(10, 20, 10);
  webglScene.add(dir);

  // Build 3D Car / Dental Turbine Model
  carMeshGroup = new THREE.Group();
  webglScene.add(carMeshGroup);

  let bodyColor = 0xe74c3c;
  if (activeCarSelection === "skyline") bodyColor = 0x38bdf8;
  if (activeCarSelection === "accent") bodyColor = 0xf59e0b;
  if (activeGameMode === "dental_runner") bodyColor = 0x10b981;

  const bodyGeo = new THREE.BoxGeometry(1.6, 0.7, 3.4);
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.2, metalness: 0.3 });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.5;
  carMeshGroup.add(bodyMesh);
}

function showHudBanner(text) {
  const banner = document.getElementById("hud-floating-banner");
  if (!banner) return;
  banner.innerText = text;
  banner.classList.add("show");
  setTimeout(() => banner.classList.remove("show"), 1200);
}

function gameLoop3D() {
  if (crashCooldown > 0) crashCooldown--;

  let trackData = getTrackData(carY);

  if (!raceFinished) {
    if (window.input.gas) {
      speed += 0.24;
      if (speed > 8.2) speed = 8.2;
    } else {
      speed *= 0.97;
    }

    if (speed > 1) {
      let steer = 0.11;
      if (window.input.left) carAngle -= steer;
      if (window.input.right) carAngle += steer;
    }

    let angleDiff = carAngle - travelAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let maxSlip = 1.35;
    if (angleDiff > maxSlip) carAngle = travelAngle + maxSlip;
    else if (angleDiff < -maxSlip) carAngle = travelAngle - maxSlip;

    currentGrip += (0.012 - currentGrip) * 0.15;
    travelAngle += angleDiff * currentGrip;

    let pushX = Math.cos(travelAngle) * speed;
    let pushY = Math.sin(travelAngle) * speed;

    carX += pushX;
    carY += pushY;
  } else {
    speed *= 0.94;
    carX += Math.cos(travelAngle) * speed;
    carY += Math.sin(travelAngle) * speed;
  }

  // Asphalt & Safezone boundary checks
  const testCanvas = document.createElement("canvas");
  testCanvas.width = 600;
  testCanvas.height = 800;
  const tCtx = testCanvas.getContext("2d");
  tCtx.lineWidth = 450;
  let isOnAsphalt = tCtx.isPointInStroke(trackPath2D, carX, carY);
  tCtx.lineWidth = 190;
  let isInSafeZone = tCtx.isPointInStroke(trackPath2D, carX, carY);

  if (!raceFinished) {
    if (!isOnAsphalt && crashCooldown === 0) {
      score = Math.max(0, score - 250);
      comboMultiplier = 1;
      showHudBanner("💥 CRASH! -250");
      sfx.playCrash();

      carX = lastSafeX;
      carY = lastSafeY;
      speed = 0;
      let safeTrack = getTrackData(lastSafeY);
      carAngle = travelAngle = safeTrack.angle;
      window.input.gas = false;
      crashCooldown = 50;
    } else {
      if (isInSafeZone && crashCooldown === 0) {
        lastSafeX = carX;
        lastSafeY = carY;
      }
      if (speed > 2) {
        score += comboMultiplier;
      }
    }

    // Obstacle collision checks
    obstacles.forEach((obs) => {
      if (obs.active && Math.hypot(carX - obs.x, carY - obs.y) < 55) {
        obs.active = false;
        if (activeGameMode === "dental_runner") {
          score += 400 * comboMultiplier;
          comboMultiplier++;
          showHudBanner("⚡ CARIES DRILLED! +400");
          sfx.playDing();
        } else {
          score += 300 * comboMultiplier;
          comboMultiplier++;
          showHudBanner("🚗 NEAR MISS! +300");
          sfx.playDing();
        }
      }
    });

    if (carY <= 0) {
      raceFinished = true;
      let timeTaken = (Date.now() - startTime) / 1000;
      let timeBonus = Math.max(0, Math.floor((90 - timeTaken) * 60));
      score += timeBonus;

      if (engineAudio) engineAudio.volume = 0;
      if (driftAudio) driftAudio.volume = 0;

      const scoreboardModal = document.getElementById("scoreboard-modal");
      const finalScoreDisplay = document.getElementById("final-score-display");
      const finalSub = document.getElementById("final-run-subtitle");
      const heading = document.getElementById("scoreboard-heading");

      if (heading) heading.innerText = "🏁 RUN COMPLETED 🏁";
      if (finalScoreDisplay) finalScoreDisplay.innerText = score;
      if (finalSub) finalSub.innerText = `Time: ${timeTaken.toFixed(2)}s | Bonus: +${timeBonus}`;

      if (scoreboardModal) scoreboardModal.style.display = "flex";
      setTimeout(async () => {
        const saved = await submitDriftScore(arcadePlayerName, score);
        if (saved) {
          fetchDriftLeaderboard();
        }
      }, 100);
    }
  }

  // Audio volume balancing
  if (!raceFinished) {
    if (speed > 0.5) {
      engineAudio.volume = Math.min(0.18, 0.02 + speed / 45);
      engineAudio.playbackRate = 0.85 + speed / 12;
    } else {
      engineAudio.volume = 0;
    }
    let isDrifting = speed > 2 && Math.abs(carAngle - travelAngle) > 0.12;
    driftAudio.volume = isDrifting ? 0.07 : 0;
  }

  // Update Three.js Camera & Car Mesh
  if (carMeshGroup && webglCamera) {
    carMeshGroup.position.set(carX * 0.02, 0, carY * -0.02);
    carMeshGroup.rotation.y = -travelAngle - Math.PI / 2;

    webglCamera.position.set(carX * 0.02, 6.5, carY * -0.02 + 8.5);
    webglCamera.lookAt(carX * 0.02, 0, carY * -0.02);
  }

  if (webglRenderer && webglScene && webglCamera) {
    webglRenderer.render(webglScene, webglCamera);
  }

  // Update HUD DOM stats
  let progress = Math.max(0, Math.min(100, ((26000 - carY) / 26000) * 100));
  const elScore = document.getElementById("hud-score");
  const elCombo = document.getElementById("hud-combo");
  const elProg = document.getElementById("hud-progress");
  if (elScore) elScore.innerText = score;
  if (elCombo) elCombo.innerText = `x${comboMultiplier}`;
  if (elProg) elProg.innerText = `${progress.toFixed(1)}%`;

  if (!raceFinished) {
    gameLoopId = requestAnimationFrame(gameLoop3D);
  }
}
