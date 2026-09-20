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
