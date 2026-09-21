// Get elements
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
const btnLogin = document.getElementById('btn-login');
const btnBack = document.getElementById('btn-back');

// Inputs and Error Message
const usernameInput = document.getElementById('admin-username');
const passwordInput = document.getElementById('admin-password');
const loginError = document.getElementById('login-error');

// 1. User Button Click (Bypass login, go straight to app)
btnUser.addEventListener('click', () => {
  entryGateway.style.display = 'none';
  mainApp.style.display = 'block';
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
btnLogin.addEventListener('click', () => {
  const userVal = usernameInput.value.trim();
  const passVal = passwordInput.value.trim();

  // Check credentials
  if (userVal === 'Dent007' && passVal === 'Dent007') {
    // Success! Hide gateway and show app
    entryGateway.style.display = 'none';
    mainApp.style.display = 'block';
    adminPanel.style.display = 'block';
    // (Optional) Add a visual indicator that they are in admin mode
    console.log("Logged in as Admin. Ready to configure!");
    // Later, we will use this block to show the 'Edit', 'Upload', and 'Add Quiz' buttons.
  } else {
    // Fail
    loginError.style.display = 'block';
  }
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
