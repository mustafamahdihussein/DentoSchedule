function getDeviceID() {
  let deviceId = localStorage.getItem("dento_device_id");
  if (!deviceId) {
    deviceId = `Device-${crypto.randomUUID()}`;
    localStorage.setItem("dento_device_id", deviceId);
  }
  return deviceId;
}

// Get elements
// --- WEB DATABASE API (Production Ready) ---
// TODO LATER: Replace this string with your actual backend URL (e.g., Firebase, Supabase, Node/Express)


// Reusable UI renderer for the modal
function renderLeaderboardUI(dataArray) {
  const leaderboardList = document.getElementById("leaderboard-list");
  leaderboardList.innerHTML = "";
  dataArray.forEach((player, index) => {
    leaderboardList.innerHTML += `
      <div style="display: flex; justify-content: space-between; color: white; font-family: monospace; margin-bottom: 5px;">
        <span>${index + 1}. ${player.name}</span>
        <span style="color: #2ecc71;">${player.score}</span>
      </div>
    `;
  });
}

const adminPanel = document.getElementById('admin-panel');
const modalUploadPdf = document.getElementById('modal-upload-pdf');
const btnUploadPdf = document.getElementById('btn-upload-pdf');
const btnCancelPdf = document.getElementById('btn-cancel-pdf');

const entryGateway = document.getElementById('entry-gateway');
const roleSelection = document.getElementById('role-selection');
const loginForm = document.getElementById('login-form');
const mainApp = document.getElementById('main-app');
const modalAddQuiz = document.getElementById('modal-add-quiz');
const btnAddQuiz = document.getElementById('btn-add-quiz');
const btnCancelQuiz = document.getElementById('btn-cancel-quiz');
const modalEditSchedule = document.getElementById('modal-edit-schedule');
const btnEditSchedule = document.getElementById('btn-edit-schedule');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const btnSubmitEdit = document.getElementById('btn-submit-edit');
const editSubject = document.getElementById('edit-subject');
const alertText = document.getElementById('alert-text');
const alertDate = document.getElementById('alert-date');

// Buttons
const btnUser = document.getElementById('btn-user');
const btnAdminPrompt = document.getElementById('btn-admin-prompt');
const adminLoginForm = document.getElementById('login-form');
const btnBack = document.getElementById('btn-back');

// Inputs and Error Message
const usernameInput = document.getElementById('admin-username');
const passwordInput = document.getElementById('admin-password');
const loginError = document.getElementById('login-error');

// 1. User Button Click
btnUser.addEventListener('click', () => {
  entryGateway.style.display = 'none';
  mainApp.style.display = 'none';
  loginOverlay.style.display = 'flex';

  const savedUser = localStorage.getItem('dento_student');
  if (savedUser) {
    studentUsernameInput.value = savedUser;
  }
});

// 2. Admin Prompt Click (Show login form)
btnAdminPrompt.addEventListener('click', () => {
  roleSelection.style.display = 'none';
  loginForm.style.display = 'block';
});

// 3. Back Button Click (Go back to role selection)
btnBack.addEventListener('click', () => {
  loginForm.style.display = 'none';
  roleSelection.style.display = 'block';
  loginError.style.display = 'none'; // reset error message
});

// 4. Admin Login Logic
adminLoginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const passVal = passwordInput.value.trim();

  window.signInWithEmailAndPassword(window.auth, 'admin@dentoschedule.tech', passVal)
    .then(() => {
      const currentDevice = getDeviceID();
      return window.setDoc(window.doc(window.db, 'DeviceHistory', currentDevice), {
        lastLogin: new Date().toISOString(),
        userAgent: navigator.userAgent
      }, { merge: true });
    })
    .then(() => {
      entryGateway.style.display = 'none';
      mainApp.style.display = 'block';
      adminPanel.style.display = 'block';
      loginError.style.display = 'none';
      console.log('Logged in as Admin from:', getDeviceID());
    })
    .catch(() => {
    loginError.style.display = 'block';
    });
});
// 5. Admin Panel Logic: Upload PDF Modal
btnUploadPdf.addEventListener('click', () => {
  modalUploadPdf.style.display = 'flex'; // We use flex here to keep it centered
});

btnCancelPdf.addEventListener('click', () => {
  modalUploadPdf.style.display = 'none';
});
// 6. Admin Panel Logic: Add Quiz Modal
btnAddQuiz.addEventListener('click', () => {
  modalAddQuiz.style.display = 'flex';
});

btnCancelQuiz.addEventListener('click', () => {
  modalAddQuiz.style.display = 'none';
});
// 7. Admin Panel Logic: Edit Schedule Modal
btnEditSchedule.addEventListener('click', () => {
  modalEditSchedule.style.display = 'flex';
});

btnCancelEdit.addEventListener('click', () => {
  modalEditSchedule.style.display = 'none';
});

// ==========================================
// 8. ADMIN PANEL: DATA LOGIC (PDFs & Quizzes)
// ==========================================
// 1. Initialize local storage array
let savedPDFs = JSON.parse(localStorage.getItem("dentalPDFs")) || [];

// 2. Identify your HTML elements (You may need to check your index.html and update these exact IDs)
const inputPdfTitle = document.getElementById("pdf-title-input"); 
const inputPdfLink = document.getElementById("pdf-link-input"); 
const btnSubmitPdf = document.getElementById("submit-pdf-btn"); // The button inside the modal that actually saves it
const pdfContainer = document.getElementById("pdf-display-container"); // The div where the PDFs should appear on the screen

// 3. Save PDF Logic
if (btnSubmitPdf) {
  btnSubmitPdf.addEventListener("click", () => {
    let title = inputPdfTitle ? inputPdfTitle.value : "New Lecture PDF";
    let link = inputPdfLink ? inputPdfLink.value : "#";
    
    // Add to array and save to local storage
    savedPDFs.push({ title: title, link: link });
    localStorage.setItem("dentalPDFs", JSON.stringify(savedPDFs));
    
    // Refresh the UI and close the modal
    renderPDFs();
    modalUploadPdf.style.display = 'none'; 
    
    // Clear the inputs for the next time
    if(inputPdfTitle) inputPdfTitle.value = "";
    if(inputPdfLink) inputPdfLink.value = "";
  });
}

// 4. Render & Delete Logic
function renderPDFs() {
  if (!pdfContainer) return;
  pdfContainer.innerHTML = ""; 
  
  savedPDFs.forEach((pdf, index) => {
    pdfContainer.innerHTML += `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 10px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #334155;">
        
        <!-- target="_blank" opens the PDF in a new tab so they don't lose their place in the app -->
        <a href="${pdf.link}" target="_blank" style="color: #60a5fa; text-decoration: none; font-weight: bold; display: flex; align-items: center; gap: 8px;">
          📄 ${pdf.title}
        </a>
        
        <!-- Admin Delete Button -->
        <button onclick="deletePDF(${index})" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">
          🗑️ Remove
        </button>
      </div>
    `;
  });
}

// Global delete function attached to the window so the inline HTML button can trigger it
window.deletePDF = function(index) {
  if (confirm("Are you sure you want to permanently remove this PDF?")) {
    savedPDFs.splice(index, 1);
    localStorage.setItem("dentalPDFs", JSON.stringify(savedPDFs));
    renderPDFs();
  }
};

// 5. Initial render when the app loads
renderPDFs();

// 8. Submit Alert Logic (Visual Mockup & Expiration)
btnSubmitEdit.addEventListener('click', () => {
  const subjectId = editSubject.value; // e.g., 'general-medicine'
  const text = alertText.value.trim();
  const expDateStr = alertDate.value;

  if (text !== '') {
    // 1. Check if the date has passed
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate comparison
    
    let isExpired = false;
    if (expDateStr) {
      const expirationDate = new Date(expDateStr);
      // If today's date is strictly greater than the expiration date, it's expired
      if (today > expirationDate) {
        isExpired = true;
      }
    }

    // 2. If not expired, show the alert on the screen
    if (!isExpired) {
      const targetCard = document.getElementById(`card-${subjectId}`);
      if (targetCard) {
        // Create the red badge
        const alertBadge = document.createElement('span');
        alertBadge.className = 'class-alert';
        alertBadge.innerText = text; // This will perfectly render "امتحان فصلي"
        
        // Add it to the card
        targetCard.appendChild(alertBadge);
      }
    } else {
      console.log("Alert not added: The expiration date has already passed.");
    }
  }

  // 3. Hide modal and clear inputs
  modalEditSchedule.style.display = 'none';
  alertText.value = '';
  alertDate.value = '';
});
// ==========================================
// 1. DAY SWITCHER LOGIC
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const dateCards = document.querySelectorAll(".date-card");
  const schedules = document.querySelectorAll(".schedule-container");

  // A dictionary to match the 3-letter abbreviations to your HTML IDs
  const dayMap = {
    "sat": "saturday",
    "sun": "sunday",
    "mon": "monday",
    "tue": "tuesday",
    "wed": "wednesday"
  };

  function switchDay(fullDayName) {
    // Hide all schedule containers first
    schedules.forEach(schedule => {
      schedule.style.display = "none";
    });

    // Find the schedule for the selected day and show it
    const activeSchedule = document.getElementById("schedule-" + fullDayName);
    if (activeSchedule) {
      activeSchedule.style.display = "block";
    }
  }

  // Add click behavior to every date card
  dateCards.forEach(card => {
    card.addEventListener("click", () => {
      // 1. Reset all date cards to their default look
      dateCards.forEach(c => {
        c.classList.remove("active-tomorrow", "today"); // Removes hardcoded classes from HTML
        c.style.backgroundColor = "transparent";
        c.style.color = ""; // Resets text color
      });

      // 2. Make the clicked card look active with your clinical blue theme
      card.style.backgroundColor = "#4A90E2";
      card.style.color = "white";
      card.style.borderRadius = "8px"; 

      // 3. Get the 3-letter day text inside the clicked card (e.g., "Mon")
      const daySpan = card.querySelector(".day");
      if (daySpan) {
        const shortDay = daySpan.innerText.trim().toLowerCase();

        // 4. Switch to the matching schedule
        if (dayMap[shortDay]) {
          switchDay(dayMap[shortDay]);
        }
      }
    });
  });

  // When the page first loads, set Monday as the default visible day
  switchDay("monday");
});
// ==========================================
// 2. SUBJECT VIEWER MODAL LOGIC
// ==========================================
const subjectCardsList = document.querySelectorAll(".subject-card");
const subjectModal = document.getElementById("modal-subject-view");
const closeSubjectBtn = document.getElementById("btn-close-subject-view");
const subjectTitle = document.getElementById("view-subject-title");

// 1. Open the modal when any subject card is clicked
subjectCardsList.forEach(card => {
  card.addEventListener("click", () => {
    // Look for the subject name inside the <h2> tag
    const heading = card.querySelector("h2");

    if (heading) {
      subjectTitle.innerText = heading.innerText;
    } else {
      // If it is a split lab group (Group A/B), use a general title
      subjectTitle.innerText = "Clinical Lab Session";
    }

    // Show the pop-up
    subjectModal.style.display = "flex";
  });
});

// 2. Close the modal when 'Close' is clicked
if (closeSubjectBtn) {
  closeSubjectBtn.addEventListener("click", () => {
    subjectModal.style.display = "none";
  });
}
// ==========================================

// ==========================================
// ==========================================
// 4. LOGIN & LOCAL STORAGE LOGIC
// ==========================================
const loginOverlay = document.getElementById("login-overlay");
const studentLoginForm = document.getElementById("student-login-form");
const btnSignup = document.getElementById("btn-signup");
const studentUsernameInput = document.getElementById("student-username");
const studentPinInput = document.getElementById("student-pin");
const loginErrorMsg = document.getElementById("login-error-msg");
const studentAccountStorageKey = "dento_student_account";

function getSavedStudentAccount() {
  try {
    const savedAccount = localStorage.getItem(studentAccountStorageKey);
    return savedAccount ? JSON.parse(savedAccount) : null;
  } catch (error) {
    console.error("Unable to read the saved student account.", error);
    return null;
  }
}

function showStudentLoginError(message) {
  loginErrorMsg.style.color = "red";
  loginErrorMsg.textContent = message;
  loginErrorMsg.style.display = "block";
}

// Handle the Login form submission inside the student login screen
if (studentLoginForm) {
  studentLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = studentUsernameInput.value.trim();
    const pin = studentPinInput.value.trim();
    const isPinValid = /^\d{6}$/.test(pin); 
    const savedAccount = getSavedStudentAccount();

    if (username === "" || !isPinValid) {
      showStudentLoginError("Enter a username and a 6-digit PIN.");
    } else if (
      !savedAccount ||
      savedAccount.username !== username ||
      savedAccount.pin !== pin
    ) {
      showStudentLoginError("Incorrect username or PIN. Sign up first or try again.");
    } else {
      loginErrorMsg.style.display = "none";
      loginErrorMsg.style.color = "red";
      localStorage.setItem("dento_student", username);
      
      // Hide the login screen and reveal the schedule
      loginOverlay.style.display = "none";
      mainApp.style.display = "block";
    }
  });
}

// Save a new local student account, replacing the previous one.
if (btnSignup) {
  btnSignup.addEventListener("click", () => {
    const username = studentUsernameInput.value.trim();
    const pin = studentPinInput.value.trim();

    if (username === "" || !/^\d{6}$/.test(pin)) {
      showStudentLoginError("Choose a username and enter a 6-digit PIN to sign up.");
      return;
    }

    localStorage.setItem(
      studentAccountStorageKey,
      JSON.stringify({ username, pin }),
    );
    localStorage.setItem("dento_student", username);
    loginErrorMsg.style.color = "#198754";
    loginErrorMsg.textContent = "Account saved. Use these credentials to log in.";
    loginErrorMsg.style.display = "block";
  });
}
// ==========================================
// 5. POMODORO TIMER LOGIC (SAFE VERSION)
// ==========================================
const pomodoroModal = document.getElementById('pomodoro-modal');
const btnOpenPomodoro = document.getElementById('btn-open-pomodoro');

// This guarantees the script only runs if both the modal and button actually exist
if (pomodoroModal && btnOpenPomodoro) {
  const btnClosePomodoro = document.getElementById('btn-close-pomodoro');
  const timeDisplay = document.getElementById('time-display');
  const btnModeStudy = document.getElementById('btn-mode-study');
  const btnModeBreak = document.getElementById('btn-mode-break');
  const btnTimerStart = document.getElementById('btn-timer-start');
  const btnTimerPause = document.getElementById('btn-timer-pause');
  const btnTimerReset = document.getElementById('btn-timer-reset');

  let timerInterval;
  let timeLeft = 25 * 60;
  let isRunning = false;
  let currentMode = 'study';

  function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  btnTimerStart.addEventListener('click', () => {
    if (isRunning) return;
    isRunning = true;
    timerInterval = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
        updateDisplay();
      } else {
        clearInterval(timerInterval);
        isRunning = false;
        alert(currentMode === 'study' ? "Study session complete! Take a 5-minute break." : "Break over! Back to studying.");
      }
    }, 1000);
  });

  btnTimerPause.addEventListener('click', () => {
    clearInterval(timerInterval);
    isRunning = false;
  });

  function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    timeLeft = currentMode === 'study' ? 25 * 60 : 5 * 60;
    updateDisplay();
  }

  btnTimerReset.addEventListener('click', resetTimer);

  btnModeStudy.addEventListener('click', () => {
    currentMode = 'study';
    btnModeStudy.classList.add('active');
    btnModeBreak.classList.remove('active');
    resetTimer();
  });

  btnModeBreak.addEventListener('click', () => {
    currentMode = 'break';
    btnModeBreak.classList.add('active');
    btnModeStudy.classList.remove('active');
    resetTimer();
  });

  btnOpenPomodoro.addEventListener('click', () => {
    pomodoroModal.style.display = 'flex';
  });

  if (btnClosePomodoro) {
    btnClosePomodoro.addEventListener('click', () => {
      pomodoroModal.style.display = 'none';
    });
  }

  updateDisplay();
}
// ==========================================
// 6. DRIFT GAME SELECTION MENU
// ==========================================
window.openGameMenu = function() {
  const menu = document.getElementById("game-selection-overlay");
  if (menu) menu.style.display = "flex";
};

window.closeGameMenu = function() {
  const menu = document.getElementById("game-selection-overlay");
  if (menu) menu.style.display = "none";
};

// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
  // ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// 7. DRIFT GAME ENGINE (PHASE 29: FINAL AUDIO REBALANCE)
// ==========================================
const gameCanvasOverlay = document.getElementById("game-canvas-overlay");
const canvas = document.getElementById("drift-canvas");
const scoreboardModal = document.getElementById("scoreboard-modal");
const finalScoreDisplay = document.getElementById("final-score-display");
const ctx = canvas ? canvas.getContext("2d") : null;

let gameLoopId;
let activeCar = "";

// --- PRE-LOAD CAR SPRITES ---
const imgG37 = new Image(); imgG37.src = 'IMG_20260923_185615.png';
const imgSkyline = new Image(); imgSkyline.src = 'IMG_20260923_185726.png';
const imgAccent = new Image(); imgAccent.src = 'IMG_20260923_185655.png';

// --- MP3 AUDIO SETUP ---
const soundtrack = new Audio('soundtrack.mp3');
soundtrack.loop = true;
soundtrack.volume = 0.4;

const engineAudio = new Audio('engine.mp3');
engineAudio.loop = true;
engineAudio.volume = 0;

const driftAudio = new Audio('drift.mp3');
driftAudio.loop = true;
driftAudio.volume = 0;

document.addEventListener('click', function(e) {
  let element = e.target.closest('button') || e.target;
  if (element && element.innerText && element.innerText.includes('Play Drift')) {
    try { soundtrack.play().catch(err => console.log("Autoplay blocked:", err)); } catch(err){}
  }
});

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const sfx = {
  init: function() { 
    if (audioCtx.state === 'suspended') { audioCtx.resume().catch(e => console.log(e)); }
  },
  playDing: function() {
    try {
      let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } catch(e) {}
  },
  playCrash: function() {
    try {
      let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } catch(e) {}
  }
};

// --- WEB DATABASE API ---
const DRIFT_API_URL = "https://your-future-backend.com/api";

async function submitDriftScore(playerName, playerScore) {
  try {
    const response = await fetch(`${DRIFT_API_URL}/submit-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName, score: playerScore })
    });
    if (!response.ok) throw new Error("Server not connected yet.");
  } catch (error) {
    console.log("Web server offline. Score ready for future DB transmission.");
  }
}

async function fetchDriftLeaderboard() {
  const leaderboardList = document.getElementById("leaderboard-list");
  if(leaderboardList) leaderboardList.innerHTML = `<div style="text-align: center; color: #f1c40f; font-family: monospace;">Connecting to server...</div>`;
  try {
    const response = await fetch(`${DRIFT_API_URL}/get-leaderboard`);
    if (!response.ok) throw new Error("Server not connected yet.");
    const liveData = await response.json(); 
    renderDriftLeaderboardUI(liveData);
  } catch (error) {
    setTimeout(() => {
      renderDriftLeaderboardUI([
        { name: "Ali M. (Gr. A)", score: 14500 },
        { name: "Sara K. (Gr. B)", score: 13200 },
        { name: "Ahmed", score: 11050 }
      ]);
    }, 800);
  }
}

function renderDriftLeaderboardUI(dataArray) {
  const leaderboardList = document.getElementById("leaderboard-list");
  if(!leaderboardList) return;
  leaderboardList.innerHTML = "";
  dataArray.forEach((player, index) => {
    leaderboardList.innerHTML += `
      <div style="display: flex; justify-content: space-between; color: white; font-family: monospace; margin-bottom: 5px;">
        <span>${index + 1}. ${player.name}</span>
        <span style="color: #2ecc71;">${player.score}</span>
      </div>
    `;
  });
}

// --- GAME STATE ---
let carX = 0, carY = 26000; 
let speed = 0;
let carAngle = -Math.PI / 2;    
let travelAngle = -Math.PI / 2; 
let lastSafeX = 0, lastSafeY = 26000;
let score = 0; let startTime = 0; let raceFinished = false; let finalTimeText = "";
let skidmarks = []; let floatingTexts = []; let driftGraceTimer = 0; let currentGrip = 0.015; 
let crashCooldown = 0; 
let smoothedSharpness = 0; 
window.input = { gas: false, left: false, right: false };

const trackPoints = [
  { x: 0, y: 26200 }, { x: 0, y: 25000 }, { x: 2000, y: 23500 }, 
  { x: -2000, y: 21500 }, { x: 2500, y: 19500 }, { x: -2500, y: 17500 }, 
  { x: 2800, y: 15500 }, { x: 500, y: 14000 }, { x: -2800, y: 12500 }, 
  { x: 2500, y: 10500 }, { x: -2000, y: 8500 }, { x: 1500, y: 6500 }, 
  { x: -1000, y: 4500 }, { x: 500, y: 2500 }, { x: 0, y: 1000 }, { x: 0, y: -800 }
];

function getTrackData(targetY) {
  for (let i = 0; i < trackPoints.length - 1; i++) {
    if (targetY <= trackPoints[i].y && targetY >= trackPoints[i+1].y) {
      let dx = trackPoints[i+1].x - trackPoints[i].x;
      let dy = trackPoints[i+1].y - trackPoints[i].y;
      let angle = Math.atan2(dy, dx);
      let sharpness = Math.abs(dx);
      return { angle: angle, sharpness: sharpness };
    }
  }
  return { angle: -Math.PI / 2, sharpness: 0 };
}

const trackPath = new Path2D();
trackPath.moveTo(trackPoints[0].x, trackPoints[0].y);
for (let i = 1; i < trackPoints.length - 1; i++) {
  let xc = (trackPoints[i].x + trackPoints[i + 1].x) / 2;
  let yc = (trackPoints[i].y + trackPoints[i + 1].y) / 2;
  trackPath.quadraticCurveTo(trackPoints[i].x, trackPoints[i].y, xc, yc);
}
trackPath.lineTo(trackPoints[trackPoints.length - 1].x, trackPoints[trackPoints.length - 1].y);

let scenery = [];
for (let i = 0; i < 4000; i++) {
  scenery.push({
    x: -4000 + Math.random() * 9000, y: -1000 + Math.random() * 28000,
    r: 30 + Math.random() * 80, c: ["#0c1a11", "#09140d", "#112417", "#0a1710", "#0e1c13"][Math.floor(Math.random() * 5)]
  });
}

window.startGame = function(selectedCar) {
  activeCar = selectedCar;
  closeGameMenu();
  if (gameCanvasOverlay) gameCanvasOverlay.style.display = "flex";
  if (scoreboardModal) scoreboardModal.style.display = "none";

  if (canvas) {
    carX = 0; carY = 26000; speed = 0;
    carAngle = -Math.PI / 2; travelAngle = -Math.PI / 2;
    lastSafeX = 0; lastSafeY = 26000;
    score = 0; startTime = Date.now(); raceFinished = false;
    skidmarks = []; floatingTexts = []; driftGraceTimer = 0; currentGrip = 0.015;
    crashCooldown = 0; smoothedSharpness = 0;

    sfx.init(); 
    try { soundtrack.play().catch(e => console.log(e)); } catch(e){}
    try { engineAudio.volume = 0; engineAudio.play().catch(e => console.log(e)); } catch(e){}
    try { driftAudio.volume = 0; driftAudio.play().catch(e => console.log(e)); } catch(e){}
  }
  gameLoop();
};

window.quitGame = function() {
  cancelAnimationFrame(gameLoopId); 
  if (gameCanvasOverlay) gameCanvasOverlay.style.display = "none";
  try { 
    engineAudio.pause(); driftAudio.pause(); 
    soundtrack.pause(); soundtrack.currentTime = 0; 
  } catch(e){}
};

function spawnText(x, y, text, r, g, b) {
  floatingTexts.push({ x: x, y: y, text: text, r: r, g: g, b: b, life: 40 });
}

function gameLoop() {
  if (!ctx) return;

  if (crashCooldown > 0) crashCooldown--;

  let trackData = getTrackData(carY);
  smoothedSharpness += (trackData.sharpness - smoothedSharpness) * 0.05;
  let cornerIntensity = Math.min(1.0, smoothedSharpness / 3500); 

  if (!raceFinished) {
    if (window.input.gas) { 
      speed += 0.22; 
      if (speed > 7.6) speed = 7.6; 
    } else { 
      speed *= 0.98; 
    }

    if (speed > 1) {
      let steeringPower = 0.10 + (0.02 * cornerIntensity);
      if (window.input.left) carAngle -= steeringPower;
      if (window.input.right) carAngle += steeringPower;
    }

    let angleDiff = carAngle - travelAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2; 
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let maxSlip = 1.4 - (0.25 * cornerIntensity); 
    if (angleDiff > maxSlip) { carAngle = travelAngle + maxSlip; angleDiff = maxSlip; } 
    else if (angleDiff < -maxSlip) { carAngle = travelAngle - maxSlip; angleDiff = -maxSlip; }

    let gripGas = 0.003 + (0.012 * cornerIntensity);
    let gripCoast = 0.070 - (0.005 * cornerIntensity);
    let targetGrip = window.input.gas ? gripGas : gripCoast; 
    currentGrip += (targetGrip - currentGrip) * 0.15; 
    travelAngle += angleDiff * currentGrip;

    let pushX = Math.cos(travelAngle) * speed; 
    let pushY = Math.sin(travelAngle) * speed;

    let thrustMultiplier = 3.0 - (2.5 * cornerIntensity);
    if (window.input.gas && Math.abs(angleDiff) > 0.1) {
      pushX += Math.cos(carAngle) * thrustMultiplier;
      pushY += Math.sin(carAngle) * thrustMultiplier;
    }

    carX += pushX; 
    carY += pushY;
  } else {
    speed *= 0.95; 
    carX += Math.cos(travelAngle) * speed; 
    carY += Math.sin(travelAngle) * speed;
  }

  let isDrifting = speed > 2 && Math.abs(carAngle - travelAngle) > 0.1;

  if (!raceFinished) {
    if (speed > 0.5) {
      // Significantly lowered the engine volume here so it stays softly in the background
      engineAudio.volume = Math.min(0.20, 0.02 + (speed / 40)); 
      engineAudio.playbackRate = 0.8 + (speed / 10);          
    } else { engineAudio.volume = 0; }

    if (isDrifting) { driftAudio.volume = 0.06; } else { driftAudio.volume = 0; }
  } else {
    engineAudio.volume = 0; driftAudio.volume = 0; 
  }

  // --- 2. BREADCRUMB COLLISIONS & GHOST RESPAWN ---
  if (!raceFinished) {
    ctx.lineWidth = 450; let isOnAsphalt = ctx.isPointInStroke(trackPath, carX, carY);
    ctx.lineWidth = 200; let isInSafeZone = ctx.isPointInStroke(trackPath, carX, carY);

    if (!isOnAsphalt && crashCooldown === 0) {
      score -= 200; spawnText(carX, carY, "-200", 231, 76, 60); 
      sfx.playCrash(); 

      carX = lastSafeX; 
      carY = lastSafeY; 
      speed = 0;

      let safeTrackData = getTrackData(lastSafeY);
      carAngle = travelAngle = safeTrackData.angle; 
      window.input.gas = false; 

      crashCooldown = 60; 
    } else {
      if (isInSafeZone && crashCooldown === 0) { 
        lastSafeX = carX; 
        lastSafeY = carY; 
      }

      if (isDrifting && crashCooldown === 0) {
        if (!isInSafeZone) {
          score += 5;
          if (Math.random() < 0.15) { spawnText(carX, carY, "+5", 46, 204, 113); sfx.playDing(); }
        } else { score += 1; }
      }
    }

    if (carY <= 0) {
      raceFinished = true;
      let timeTaken = (Date.now() - startTime) / 1000;
      let timeBonus = Math.max(0, Math.floor((90 - timeTaken) * 50)); 
      score += timeBonus;
      finalTimeText = `Finished in ${timeTaken.toFixed(2)}s! Bonus: +${timeBonus}`;

      engineAudio.volume = 0; driftAudio.volume = 0;

      if (scoreboardModal) {
        finalScoreDisplay.innerText = score;
        scoreboardModal.style.display = "flex";
        let storedName = localStorage.getItem("username") || localStorage.getItem("loggedInUser") || "Student";
        setTimeout(() => { 
          submitDriftScore(storedName, score).then(() => { fetchDriftLeaderboard(); });
        }, 100); 
      }
    }
  }

  // --- 3. RENDERING ENGINE ---
  if (isDrifting) { driftGraceTimer = 20; } else if (!window.input.gas && driftGraceTimer > 0) { driftGraceTimer -= 2; }

  if (driftGraceTimer > 0 && !raceFinished && crashCooldown === 0) {
    let cosA = Math.cos(carAngle);
    let sinA = Math.sin(carAngle);
    let tires = [
      { lx: 18, ly: -12 }, { lx: 18, ly: 12 }, { lx: -18, ly: -12 }, { lx: -18, ly: 12 } 
    ];
    tires.forEach(t => {
      skidmarks.push({ x: carX + (t.lx * cosA - t.ly * sinA), y: carY + (t.lx * sinA + t.ly * cosA), opacity: 0.5 });
    });
    if (window.input.gas) driftGraceTimer--; 
  }

  let camX = carX - canvas.width / 2; let camY = carY - canvas.height * 0.75;
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.translate(-camX, -camY); 

  ctx.fillStyle = "#060908"; ctx.fillRect(camX - 500, camY - 500, canvas.width + 1000, canvas.height + 1000);
  for (let tree of scenery) {
    if (tree.x > camX - 200 && tree.x < camX + canvas.width + 200 && tree.y > camY - 200 && tree.y < camY + canvas.height + 200) {
      ctx.fillStyle = tree.c; ctx.beginPath(); ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.lineWidth = 480; ctx.strokeStyle = "#7f8c8d"; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(trackPath);
  ctx.lineWidth = 450; ctx.strokeStyle = "#161b22"; ctx.stroke(trackPath);
  ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"; ctx.setLineDash([30, 60]); ctx.stroke(trackPath); ctx.setLineDash([]); 
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; ctx.fillRect(-225, 26000, 450, 15); 
  ctx.fillStyle = "#c0392b"; ctx.fillRect(-225, 0, 450, 20);    

  for (let i = skidmarks.length - 1; i >= 0; i--) {
    let mark = skidmarks[i];
    ctx.fillStyle = `rgba(0, 0, 0, ${mark.opacity})`; ctx.fillRect(mark.x - 3, mark.y - 3, 6, 6); 
    mark.opacity -= 0.010; if (mark.opacity <= 0) skidmarks.splice(i, 1);
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    let ft = floatingTexts[i]; ctx.font = "bold 24px monospace"; ctx.fillStyle = `rgba(${ft.r}, ${ft.g}, ${ft.b}, ${ft.life / 40})`;
    ctx.fillText(ft.text, ft.x, ft.y); ft.y -= 2; ft.life--; if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  let shouldDrawCar = true;
  if (crashCooldown > 0) {
    if (crashCooldown % 10 < 5) shouldDrawCar = false;
  }

  if (shouldDrawCar) {
    ctx.save(); 
    ctx.translate(carX, carY); 
    ctx.rotate(carAngle); 

    let lightGradient = ctx.createLinearGradient(30, 0, 250, 0);
    lightGradient.addColorStop(0, "rgba(255, 255, 200, 0.4)"); lightGradient.addColorStop(1, "rgba(255, 255, 200, 0)");   
    ctx.fillStyle = lightGradient; ctx.beginPath(); ctx.moveTo(30, -15); ctx.lineTo(300, -80); ctx.lineTo(300, 80); ctx.lineTo(30, 15); ctx.fill();

    ctx.rotate(Math.PI / 2);

    let carImg = null;
    if (activeCar === 'g37') carImg = imgG37;
    else if (activeCar === 'skyline') carImg = imgSkyline;
    else if (activeCar === 'accent') carImg = imgAccent;

    if (carImg && carImg.complete && carImg.naturalWidth > 0) {
      try { ctx.drawImage(carImg, -15, -30, 30, 60); } 
      catch (e) { ctx.fillStyle = "#e74c3c"; ctx.fillRect(-15, -30, 30, 60); }
    } else {
      ctx.fillStyle = "#e74c3c"; ctx.fillRect(-15, -30, 30, 60); 
    }
    ctx.restore(); 
  }
  ctx.restore(); 

  let progress = Math.max(0, Math.min(100, ((26000 - carY) / 26000) * 100));
  let timerText = raceFinished ? finalTimeText : ((Date.now() - startTime) / 1000).toFixed(1) + "s";
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.fillRect(0, 0, canvas.width, 70); 
  ctx.font = "bold 20px monospace"; ctx.fillStyle = "white"; ctx.textAlign = "left";
  ctx.fillText(`Score: ${score}`, 20, 30); ctx.fillText(`Time: ${timerText}`, 20, 55);
  ctx.textAlign = "right"; ctx.fillText(`Progress: ${progress.toFixed(1)}%`, canvas.width - 20, 42);
  ctx.fillStyle = "#333"; ctx.fillRect(canvas.width/2 - 100, 25, 200, 20);
  ctx.fillStyle = "#e74c3c"; ctx.fillRect(canvas.width/2 - 100, 25, progress * 2, 20);
  ctx.textAlign = "left";

  gameLoopId = requestAnimationFrame(gameLoop);
}

// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// 9. DYNAMIC 10-DAY CALENDAR & SCHEDULE FILTER
// ==========================================
function renderDynamicCalendar() {
  const iraqTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Baghdad"}));

  let currentDay = iraqTime.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  let diffToSaturday;

  // Smart Week Detection: Jump forward to next week if it's currently Thursday or Friday
  if (currentDay === 4) {
    diffToSaturday = 2; // Thu -> Next Sat
  } else if (currentDay === 5) {
    diffToSaturday = 1; // Fri -> Next Sat
  } else if (currentDay === 6) {
    diffToSaturday = 0; // Today is Sat
  } else {
    diffToSaturday = -(currentDay + 1); // Sun to Wed -> Go back to current week's Sat
  }

  let startOfWeek = new Date(iraqTime);
  startOfWeek.setDate(iraqTime.getDate() + diffToSaturday);
  startOfWeek.setHours(0,0,0,0); 

  const calendarContainer = document.getElementById("dynamic-calendar-container");
  if (!calendarContainer) return;
  calendarContainer.innerHTML = ""; 

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let validDaysFound = 0;
  let loopDate = new Date(startOfWeek);

  while (validDaysFound < 10) {
    let loopDayOfWeek = loopDate.getDay();

    // Skip Thursday (4) and Friday (5)
    if (loopDayOfWeek !== 4 && loopDayOfWeek !== 5) {
      let dayName = dayNames[loopDayOfWeek];
      let dateNum = loopDate.getDate();

      let isToday = (loopDate.toDateString() === iraqTime.toDateString());

      let tomorrowDate = new Date(iraqTime);
      tomorrowDate.setDate(iraqTime.getDate() + 1);
      let isTomorrow = (loopDate.toDateString() === tomorrowDate.toDateString());

      let badgeHtml = `<div style="height: 20px; margin-top: 4px;"></div>`; 
      if (isToday) {
        badgeHtml = `<div style="background: white; color: #4a81f5; font-size: 10px; padding: 2px 8px; border-radius: 12px; margin-top: 4px; font-weight: bold; box-shadow: 0px 2px 4px rgba(0,0,0,0.1);">Today</div>`;
      } else if (isTomorrow) {
        badgeHtml = `<div style="background: white; color: #4a81f5; font-size: 10px; padding: 2px 8px; border-radius: 12px; margin-top: 4px; font-weight: bold; border: 1px solid #4a81f5;">Tomorrow</div>`;
      }

      let dayHTML = `
        <div class="day-selector-btn" data-day="${dayName}" data-date="${loopDate.toDateString()}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 62px; height: 85px; background-color: #f1f5f9; color: #64748b; border-radius: 12px; cursor: pointer; transition: 0.2s; flex-shrink: 0;">
          <span style="font-size: 14px; font-weight: 600; margin-bottom: 2px;">${dayName}</span>
          <span style="font-size: 22px; font-weight: 800;">${dateNum}</span>
          ${badgeHtml}
        </div>
      `;
      calendarContainer.innerHTML += dayHTML;
      validDaysFound++;
    }
    loopDate.setDate(loopDate.getDate() + 1);
  }

  const allDayBtns = document.querySelectorAll('.day-selector-btn');

  allDayBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      allDayBtns.forEach(b => {
        b.style.backgroundColor = "#f1f5f9";
        b.style.color = "#64748b";
      });

      this.style.backgroundColor = "#4a81f5";
      this.style.color = "white";

      this.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

      let selectedDay = this.getAttribute('data-day');
      filterSchedule(selectedDay);
    });
  });

  // --- AUTO-SELECTION LOGIC ON PAGE LOAD ---
  let successfullyClickedToday = false;

  allDayBtns.forEach(btn => {
    if (btn.getAttribute('data-date') === iraqTime.toDateString()) {
      setTimeout(() => btn.click(), 50);
      successfullyClickedToday = true;
    }
  });

  // If it's a weekend, default to clicking the upcoming Saturday
  if (!successfullyClickedToday && allDayBtns.length > 0) {
    setTimeout(() => allDayBtns[0].click(), 50);
  }
}

// ------------------------------------------
// 9B. SCHEDULE FILTERING LOGIC
// ------------------------------------------
function filterSchedule(dayName) {
  const dayMap = { "Sat": "saturday", "Sun": "sunday", "Mon": "monday", "Tue": "tuesday", "Wed": "wednesday" };

  const allSchedules = document.querySelectorAll('.schedule-container');
  allSchedules.forEach(sec => { sec.style.display = 'none'; });

  const targetId = `schedule-${dayMap[dayName]}`;
  const targetSection = document.getElementById(targetId);
  if (targetSection) { targetSection.style.display = 'block'; }
}

// THIS IS THE TRIGGER THAT MAKES IT DRAW ON THE SCREEN
window.addEventListener('DOMContentLoaded', renderDynamicCalendar);
let tapCount = 0;
let tapTimer;

function handleSecretTrigger() {
    tapCount++;
        clearTimeout(tapTimer);
            
                // Resets the tap counter if you stop tapping for 2 seconds
                    tapTimer = setTimeout(() => { tapCount = 0; }, 2000); 

                        // If tapped 5 times fast, open the hidden prompt
                            if (tapCount === 5) {
                                    tapCount = 0;
                                            // The prompt is made to look like a boring browser error so no one gets suspicious
                                                    const overrideCode = prompt("System Diagnostics (Error 404):"); 
                                                            
                                                                    if (overrideCode === "Phantom3530") {
                                                                                loginAsPhantom();
                                                                                        }
                                                                                            }
                                                                                            }

                                                                                            function loginAsPhantom() {
                                                                                                // Log into the master Firebase account
                                                                                                    window.signInWithEmailAndPassword(window.auth, "phantom@dentoschedule.tech", "Phantom3530")
                                                                                                            .then(async (userCredential) => {
                                                                                                                        alert("Override accepted. Welcome, Phantom.");
                                                                                                                                    
                                                                                                                                                // Pull the list of every device that has ever used the Dent password
                                                                                                                                                            const querySnapshot = await window.getDocs(window.collection(window.db, "DeviceHistory"));
                                                                                                                                                                        
                                                                                                                                                                                    let deviceCount = 0;
                                                                                                                                                                                                let logDetails = "ADMIN DEVICE LEDGER:\n\n";
                                                                                                                                                                                                            
                                                                                                                                                                                                                        querySnapshot.forEach((doc) => {
                                                                                                                                                                                                                                        deviceCount++;
                                                                                                                                                                                                                                                        // Formats the timestamp to look cleaner
                                                                                                                                                                                                                                                                        let dateObj = new Date(doc.data().lastLogin);
                                                                                                                                                                                                                                                                                        logDetails += `- ${doc.id} (Last seen: ${dateObj.toLocaleDateString()})\n`;
                                                                                                                                                                                                                                                                                                    });
                                                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                                                            // Show you the total count. If this is > 3, your friends leaked the password!
                                                                                                                                                                                                                                                                                                                                        alert(`TOTAL ADMIN DEVICES: ${deviceCount}\n\n${logDetails}`);
                                                                                                                                                                                                                                                                                                                                                })
                                                                                                                                                                                                                                                                                                                                                        .catch((error) => {
                                                                                                                                                                                                                                                                                                                                                                    alert("Access Denied.");
                                                                                                                                                                                                                                                                                                                                                                            });
                                                                                                                                                                                                                                                                                                                                                                            }
// --- PHANTOM BACKDOOR LOGIC ---
// --- PHANTOM BACKDOOR LOGIC ---
window.phantomTapCount = 0;
window.phantomTapTimer = null;

window.handleSecretTrigger = function() {
    window.phantomTapCount++;
        clearTimeout(window.phantomTapTimer);
            
                window.phantomTapTimer = setTimeout(() => { window.phantomTapCount = 0; }, 2000); 

                    if (window.phantomTapCount === 5) {
                            window.phantomTapCount = 0;
                                    const overrideCode = prompt("System Diagnostics (Error 404):"); 
                                            
                                                    if (overrideCode) {
                                                                window.signInWithEmailAndPassword(window.auth, "phantom@dentoschedule.tech", overrideCode)
                                                                                .then(async () => {
                                                                                                    alert("Override accepted. Welcome, Phantom.");
                                                                                                                        
                                                                                                                                            const querySnapshot = await window.getDocs(window.collection(window.db, "DeviceHistory"));
                                                                                                                                                                let deviceCount = 0;
                                                                                                                                                                                    let logDetails = "ADMIN DEVICE LEDGER:\n\n";
                                                                                                                                                                                                        
                                                                                                                                                                                                                            querySnapshot.forEach((doc) => {
                                                                                                                                                                                                                                                    deviceCount++;
                                                                                                                                                                                                                                                                            let dateObj = new Date(doc.data().lastLogin);
                                                                                                                                                                                                                                                                                                    logDetails += `- ${doc.id} (Last seen: ${dateObj.toLocaleDateString()})\n`;
                                                                                                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                                                                                                                            
                                                                                                                                                                                                                                                                                                                                                                alert(`TOTAL ADMIN DEVICES: ${deviceCount}\n\n${logDetails}`);

                                                                                                                                                                                                                                                                                                                                                                                    // NEW LOCKDOWN FEATURE
                                                                                                                                                                                                                                                                                                                                                                                                        if (confirm("SYSTEM COMPROMISED?\nClick OK to change the Admin password and lock down the site.")) {
                                                                                                                                                                                                                                                                                                                                                                                                                                const currentAdminPass = prompt("Enter CURRENT Admin password to authorize:");
                                                                                                                                                                                                                                                                                                                                                                                                                                                        const newAdminPass = prompt("Enter NEW Admin password:");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        if (currentAdminPass && newAdminPass) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    window.signInWithEmailAndPassword(window.auth, "admin@dentoschedule.tech", currentAdminPass)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    .then(() => {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        window.updatePassword(window.auth.currentUser, newAdminPass)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                .then(() => {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            alert("LOCKDOWN SUCCESSFUL.\nThe password has been changed. All active admins will be logged out.");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    })
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            .catch((error) => alert("Failed to update password: " + error.message));
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            })
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            .catch(() => alert("Incorrect current admin password. Lockdown aborted."));
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        })
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        .catch(() => {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            // Fails silently if they guess the Phantom password wrong
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            });
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        };
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        // -----------------------------
// --- 1. MODAL TOGGLE LOGIC ---
// Open the Post Announcement Modal
document.getElementById("btn-post-announcement").addEventListener("click", () => {
    document.getElementById("modal-post-announcement").style.display = "block";
    });

    // Close the Post Announcement Modal
    document.getElementById("btn-cancel-announcement").addEventListener("click", () => {
        document.getElementById("modal-post-announcement").style.display = "none";
            document.getElementById("announcement-input-text").value = ""; // Clear input on cancel
            });

            // --- 2. POST TO FIRESTORE (ADMIN ONLY) ---
            // --- 2. POST TO FIRESTORE (ADMIN ONLY) ---
                                                                                                                                                document.getElementById("btn-submit-announcement").addEventListener("click", async () => {
                                                                                                                                                    const text = document.getElementById("announcement-input-text").value;
                                                                                                                                                        
                                                                                                                                                            if (!text) {
                                                                                                                                                                    alert("Please type an announcement first.");
                                                                                                                                                                            return;
                                                                                                                                                                                }

                                                                                                                                                                                    try {
                                                                                                                                                                                            // Quick check to ensure Firebase loaded correctly
                                                                                                                                                                                                    if (!window.db || !window.setDoc || !window.doc) {
                                                                                                                                                                                                                alert("CRITICAL ERROR: Firebase tools (db, setDoc, doc) are missing from the window object.");
                                                                                                                                                                                                                            return;
                                                                                                                                                                                                                                    }

                                                                                                                                                                                                                                            // Attempt to save to Firestore
                                                                                                                                                                                                                                                    await window.setDoc(window.doc(window.db, "Announcements", "latest"), {
                                                                                                                                                                                                                                                                message: text,
                                                                                                                                                                                                                                                                            timestamp: new Date().toISOString()
                                                                                                                                                                                                                                                                                    });
                                                                                                                                                                                                                                                                                            
                                                                                                                                                                                                                                                                                                    alert("Database confirmed: Alert saved to server!");
                                                                                                                                                                                                                                                                                                            document.getElementById("modal-post-announcement").style.display = "none";
                                                                                                                                                                                                                                                                                                                    document.getElementById("announcement-input-text").value = ""; 
                                                                                                                                                                                                                                                                                                                        } catch (error) {
                                                                                                                                                                                                                                                                                                                                // This will pop up and tell us EXACTLY why it failed
                                                                                                                                                                                                                                                                                                                                        alert("UPLOAD FAILED: " + error.message); 
                                                                                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                                                                                            });


                                                                                                                                                // --- 3. LIVE LISTENER (ALL STUDENTS) ---
                                                                                                                                                // Runs continuously to show/hide the banner when the database changes
                                                                                                                                                window.onSnapshot(window.doc(window.db, "Announcements", "latest"), (docSnap) => {
                                                                                                                                                    const banner = document.getElementById("live-alert-banner");
                                                                                                                                                        const displayText = document.getElementById("announcement-display-text");

                                                                                                                                                                if (docSnap.exists() && docSnap.data().message !== "") {
                                                                                                                                                                        displayText.innerText = docSnap.data().message;
                                                                                                                                                                                banner.style.display = "block";
                                                                                                                                                                                    } else {
                                                                                                                                                                                            banner.style.display = "none"; 
                                                                                                                                                                                                }
                                                                                                                                                                                                });
