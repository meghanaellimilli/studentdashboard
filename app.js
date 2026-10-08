const DATABASE_NAME = "student-portal";
const DATABASE_VERSION = 1;
const ADMIN_EMAIL = "admin@studentportal.local";
const ADMIN_PASSWORD = "Admin123!";
const SESSION_KEY = "student-portal-session";
const INTERESTS = ["Reading", "Music", "Sports", "Art", "Technology"];
const QUALIFICATIONS = ["High School", "Diploma", "Bachelor's", "Master's", "Doctorate", "Other"];
const CLASSES = Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`);

const app = document.querySelector("#app");
const headerActions = document.querySelector("#header-actions");
const toast = document.querySelector("#toast");
let database;
let toastTimer;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("users", { keyPath: "id" });
      store.createIndex("email", "email", { unique: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open the student database."));
  });
}

function databaseRequest(mode, createRequest) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("users", mode);
    let request;
    try {
      request = createRequest(transaction.objectStore("users"));
    } catch (error) {
      reject(error);
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("The database request failed."));
    transaction.onerror = () => reject(transaction.error || new Error("The database transaction failed."));
  });
}

const getAllUsers = () => databaseRequest("readonly", (store) => store.getAll());
const getUser = (id) => databaseRequest("readonly", (store) => store.get(Number(id)));
const getUserByEmail = (email) => databaseRequest("readonly", (store) => store.index("email").get(email));
const saveUser = (user) => databaseRequest("readwrite", (store) => store.put(user));
const removeUser = (id) => databaseRequest("readwrite", (store) => store.delete(Number(id)));

async function initialize() {
  database = await openDatabase();
  const users = await getAllUsers();
  if (!users.some((user) => user.role === "admin")) {
    await saveUser({
      id: 1,
      role: "admin",
      name: "Portal Administrator",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      createdAt: new Date().toISOString(),
    });
  }

  const activeUser = await getActiveUser();
  if (activeUser?.role === "admin") {
    await renderAdminDashboard();
  } else if (activeUser?.role === "student") {
    await renderStudentDashboard(activeUser);
  } else {
    localStorage.removeItem(SESSION_KEY);
    renderLogin();
  }
}

async function getActiveUser() {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  return getUser(id);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
}

function setHeader(user) {
  if (!user) {
    headerActions.innerHTML = "";
    return;
  }
  headerActions.innerHTML = `
    <span class="header-user">${escapeHtml(user.name)}</span>
    <button class="button button-secondary button-small" type="button" data-action="logout">Log out</button>
  `;
}

function renderLogin(message = "") {
  setHeader(null);
  app.innerHTML = `
    <section class="auth-layout">
      <aside class="auth-aside">
        <div>
          <p class="eyebrow">Your next chapter starts here</p>
          <h1>Make your student journey count.</h1>
          <p>Keep your learning details together and stay connected to your progress.</p>
        </div>
        <div class="aside-note">A welcoming, simple portal for students and the people who support them.</div>
      </aside>
      <section class="auth-card">
        <p class="eyebrow">Student Portal</p>
        <h2>Welcome back</h2>
        <p class="intro">Sign in with your registered email to continue.</p>
        <form id="login-form">
          <div class="form-grid">
            <div class="field field-wide">
              <label for="login-email">Email address</label>
              <input id="login-email" name="email" type="email" autocomplete="username" required>
            </div>
            <div class="field field-wide">
              <label for="login-password">Password</label>
              <input id="login-password" name="password" type="password" autocomplete="current-password" required>
            </div>
          </div>
          <p class="form-message" role="alert">${escapeHtml(message)}</p>
          <button class="button button-full" type="submit">Sign in</button>
        </form>
        <div class="form-links">
          <button class="text-link" type="button" data-action="forgot">Forgot password?</button>
          <button class="text-link" type="button" data-action="register">Create student account</button>
        </div>
        <p class="help-text">Demo administrator: ${ADMIN_EMAIL} &nbsp;·&nbsp; Password: ${ADMIN_PASSWORD}</p>
      </section>
    </section>
  `;
}

function renderOptions(options, selectedValues = []) {
  return options.map((value) =>
    `<option value="${escapeHtml(value)}" ${selectedValues.includes(value) ? "selected" : ""}>${escapeHtml(value)}</option>`,
  ).join("");
}

function renderChoiceInputs(name, options, selectedValues = [], type = "checkbox") {
  return `<div class="choice-row">${options.map((value) => `
    <label class="choice">
      <input type="${type}" name="${name}" value="${escapeHtml(value)}" ${type === "radio" && value === options[0] ? "required" : ""} ${selectedValues.includes(value) ? "checked" : ""}>
      <span>${escapeHtml(value)}</span>
    </label>
  `).join("")}</div>`;
}

function renderRegistration(message = "") {
  setHeader(null);
  app.innerHTML = `
    <section class="panel">
      <div class="page-heading">
        <div>
          <p class="eyebrow">Join the portal</p>
          <h1>Create your student account</h1>
          <p>Enter your details below. Your email will be used to sign in.</p>
        </div>
        <button class="button button-secondary" type="button" data-action="login">Back to sign in</button>
      </div>
      <form id="registration-form">
        ${renderProfileFields({}, { includePassword: true, includeName: true, includeEmail: true, requireDocument: true })}
        <p class="form-message" role="alert">${escapeHtml(message)}</p>
        <button class="button" type="submit">Create account</button>
      </form>
    </section>
  `;
}

function renderProfileFields(user, options = {}) {
  const { includeName = true, includeEmail = true, includePassword = false, requireDocument = false } = options;
  const birthDate = user.dateOfBirth || "";
  const today = new Date().toISOString().slice(0, 10);
  return `
    <div class="form-grid">
      ${includeName ? `
        <div class="field">
          <label for="profile-name">Full name</label>
          <input id="profile-name" name="name" type="text" maxlength="100" value="${escapeHtml(user.name)}" required>
        </div>
      ` : ""}
      ${includeEmail ? `
        <div class="field">
          <label for="profile-email">Email address</label>
          <input id="profile-email" name="email" type="email" maxlength="254" value="${escapeHtml(user.email)}" required>
        </div>
      ` : ""}
      ${includePassword ? `
        <div class="field">
          <label for="profile-password">Password</label>
          <input id="profile-password" name="password" type="password" minlength="8" autocomplete="new-password" required>
        </div>
      ` : ""}
      <div class="field">
        <label for="profile-dob">Date of birth</label>
        <input id="profile-dob" name="dateOfBirth" type="date" max="${today}" value="${escapeHtml(birthDate)}" required>
      </div>
      <div class="field field-wide">
        <span class="group-label">Gender</span>
        ${renderChoiceInputs("gender", ["Female", "Male", "Non-binary", "Prefer not to say"], user.gender ? [user.gender] : [], "radio")}
      </div>
      <div class="field">
        <label for="profile-qualification">Qualification</label>
        <select id="profile-qualification" name="qualification" required>
          <option value="">Select qualification</option>
          ${renderOptions(QUALIFICATIONS, user.qualification ? [user.qualification] : [])}
        </select>
      </div>
      <div class="field">
        <label for="profile-class">Class</label>
        <select id="profile-class" name="className" required>
          <option value="">Select class</option>
          ${renderOptions(CLASSES, user.className ? [user.className] : [])}
        </select>
      </div>
      <div class="field">
        <label for="profile-subject">Subject</label>
        <input id="profile-subject" name="subject" type="text" maxlength="100" value="${escapeHtml(user.subject)}" required>
      </div>
      <div class="field">
        <label for="profile-marks">Marks</label>
        <input id="profile-marks" name="marks" type="number" min="0" step="0.01" value="${escapeHtml(user.marks)}" required>
      </div>
      <div class="field field-wide">
        <span class="group-label">Interests</span>
        ${renderChoiceInputs("interests", INTERESTS, user.interests || [])}
      </div>
      <div class="field field-wide">
        <label for="aadhaar-file">${requireDocument ? "Aadhaar document (PDF)" : "Replace Aadhaar document (PDF)"}</label>
        <input id="aadhaar-file" name="aadhaarFile" type="file" accept=".pdf,application/pdf" ${requireDocument ? "required" : ""}>
        <p class="help-text">${requireDocument ? "Upload a PDF document to complete registration." : `Current document: ${escapeHtml(user.aadhaarOriginalName || "Not uploaded")}. Leave empty to keep it.`}</p>
      </div>
    </div>
  `;
}

function renderForgotPassword(message = "", isSuccess = false) {
  setHeader(null);
  app.innerHTML = `
    <section class="auth-layout">
      <aside class="auth-aside">
        <div>
          <p class="eyebrow">Account recovery</p>
          <h1>A fresh start is just a few steps away.</h1>
          <p>Choose a new password for your student portal account.</p>
        </div>
        <div class="aside-note">This local demo updates the account password in your browser. It does not send email.</div>
      </aside>
      <section class="auth-card">
        <p class="eyebrow">Password reset</p>
        <h2>Reset your password</h2>
        <p class="intro">Enter the account email and choose a new password.</p>
        <form id="reset-form">
          <div class="form-grid">
            <div class="field field-wide">
              <label for="reset-email">Email address</label>
              <input id="reset-email" name="email" type="email" autocomplete="username" required>
            </div>
            <div class="field field-wide">
              <label for="reset-password">New password</label>
              <input id="reset-password" name="password" type="password" minlength="8" autocomplete="new-password" required>
            </div>
            <div class="field field-wide">
              <label for="reset-confirm">Confirm new password</label>
              <input id="reset-confirm" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required>
            </div>
          </div>
          <p class="form-message ${isSuccess ? "success" : ""}" role="alert">${escapeHtml(message)}</p>
          <button class="button button-full" type="submit">Update password</button>
        </form>
        <div class="form-links">
          <button class="text-link" type="button" data-action="login">Back to sign in</button>
        </div>
      </section>
    </section>
  `;
}

function ageFor(dateString) {
  if (!dateString) return "";
  const birth = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : "";
}

function detailItem(label, value) {
  return `<div class="detail-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`;
}

async function renderStudentDashboard(user, successMessage = "") {
  const latestUser = await getUser(user.id);
  if (!latestUser || latestUser.role !== "student") {
    localStorage.removeItem(SESSION_KEY);
    renderLogin("Your session has ended. Please sign in again.");
    return;
  }
  setHeader(latestUser);
  app.innerHTML = `
    <section class="welcome-banner">
      <p class="eyebrow">Student dashboard</p>
      <h1>Welcome, ${escapeHtml(latestUser.name)} (User ID: #${escapeHtml(latestUser.id)})</h1>
      <p>Your learning details, all in one place.</p>
    </section>
    <section class="panel">
      <div class="section-heading">
        <h2>Your submitted details</h2>
        <button class="button" type="button" data-action="edit-profile">Edit profile</button>
      </div>
      <dl class="detail-grid">
        ${detailItem("Name", latestUser.name)}
        ${detailItem("Email", latestUser.email)}
        ${detailItem("Date of birth", latestUser.dateOfBirth)}
        ${detailItem("Age", ageFor(latestUser.dateOfBirth))}
        ${detailItem("Gender", latestUser.gender)}
        ${detailItem("Qualification", latestUser.qualification)}
        ${detailItem("Interests", (latestUser.interests || []).join(", "))}
        ${detailItem("Class", latestUser.className)}
        ${detailItem("Subject", latestUser.subject)}
        ${detailItem("Marks", latestUser.marks)}
        <div class="detail-item">
          <dt>Aadhaar document</dt>
          <dd>${latestUser.aadhaarBlob
    ? `<a href="#" data-action="open-document" data-user-id="${escapeHtml(latestUser.id)}">${escapeHtml(latestUser.aadhaarOriginalName)}</a>`
    : "Not uploaded"}</dd>
        </div>
      </dl>
      ${successMessage ? `<p class="form-message success">${escapeHtml(successMessage)}</p>` : ""}
    </section>
    <div id="modal-root"></div>
  `;
}

function studentRow(user) {
  const documentLink = user.aadhaarBlob
    ? `<a href="#" data-action="open-document" data-user-id="${escapeHtml(user.id)}">Open PDF</a>`
    : "—";
  return `
    <tr data-student-row data-name="${escapeHtml(user.name.toLowerCase())}" data-class="${escapeHtml(user.className)}" data-age="${escapeHtml(ageFor(user.dateOfBirth))}">
      <td><span class="student-name">${escapeHtml(user.name)}</span><br><span class="help-text">#${escapeHtml(user.id)}</span></td>
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.className)}</td>
      <td>${escapeHtml(ageFor(user.dateOfBirth))}</td>
      <td>${documentLink}</td>
      <td class="action-cell">
        <button class="button button-secondary button-small" type="button" data-action="admin-edit" data-user-id="${escapeHtml(user.id)}">Edit</button>
        <button class="button button-danger button-small" type="button" data-action="admin-delete" data-user-id="${escapeHtml(user.id)}">Delete</button>
      </td>
    </tr>
  `;
}

async function renderAdminDashboard() {
  const admin = await getActiveUser();
  if (!admin || admin.role !== "admin") {
    localStorage.removeItem(SESSION_KEY);
    renderLogin("Please sign in with the administrator account.");
    return;
  }
  const students = (await getAllUsers())
    .filter((user) => user.role === "student")
    .sort((first, second) => second.id - first.id);
  setHeader(admin);
  app.innerHTML = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Administration</p>
        <h1>Student directory</h1>
        <p>Review registrations, update student records, and manage uploaded documents.</p>
      </div>
      <div class="admin-summary"><span class="count-badge" id="student-count">${students.length}</span> registered students</div>
    </div>
    <section class="panel">
      <div class="filter-bar" aria-label="Filter students">
        <div class="filter-control">
          <label for="filter-name">Name</label>
          <input id="filter-name" type="search" placeholder="Search by name">
        </div>
        <div class="filter-control">
          <label for="filter-class">Class</label>
          <select id="filter-class">
            <option value="">All classes</option>
            ${renderOptions(CLASSES)}
          </select>
        </div>
        <div class="filter-control">
          <label for="filter-min-age">Minimum age</label>
          <input id="filter-min-age" type="number" min="0" max="120" placeholder="Any">
        </div>
        <div class="filter-control">
          <label for="filter-max-age">Maximum age</label>
          <input id="filter-max-age" type="number" min="0" max="120" placeholder="Any">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Student</th><th>Email</th><th>Class</th><th>Age</th><th>Aadhaar</th><th>Actions</th></tr>
          </thead>
          <tbody id="student-rows">
            ${students.length ? students.map(studentRow).join("") : `<tr><td colspan="6"><div class="empty-state"><strong>No students yet</strong>New registrations will appear here.</div></td></tr>`}
          </tbody>
        </table>
      </div>
      <p id="filter-empty" class="empty-state" hidden><strong>No matching students</strong>Try changing or clearing your filters.</p>
    </section>
    <div id="modal-root"></div>
  `;
}

function applyStudentFilters() {
  const name = document.querySelector("#filter-name").value.trim().toLowerCase();
  const className = document.querySelector("#filter-class").value;
  const minAge = document.querySelector("#filter-min-age").value;
  const maxAge = document.querySelector("#filter-max-age").value;
  const rows = [...document.querySelectorAll("[data-student-row]")];
  let visibleRows = 0;

  rows.forEach((row) => {
    const age = row.dataset.age === "" ? null : Number(row.dataset.age);
    const matches = row.dataset.name.includes(name)
      && (!className || row.dataset.class === className)
      && (minAge === "" || (age !== null && age >= Number(minAge)))
      && (maxAge === "" || (age !== null && age <= Number(maxAge)));
    row.hidden = !matches;
    if (matches) visibleRows += 1;
  });
  document.querySelector("#filter-empty").hidden = visibleRows !== 0 || rows.length === 0;
}

async function readPdf(file) {
  if (!file || !file.name) return null;
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const isPdfSignature = new TextDecoder().decode(signature) === "%PDF-";
  if (!file.name.toLowerCase().endsWith(".pdf") || !isPdfSignature) {
    throw new Error("Please upload a valid PDF file.");
  }
  return {
    blob: file.slice(0, file.size, "application/pdf"),
    originalName: file.name,
    storedName: `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}.pdf`,
  };
}

function readFormValues(form) {
  const formData = new FormData(form);
  return {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    password: String(formData.get("password") || ""),
    dateOfBirth: String(formData.get("dateOfBirth") || ""),
    gender: String(formData.get("gender") || ""),
    qualification: String(formData.get("qualification") || ""),
    interests: formData.getAll("interests").map(String),
    className: String(formData.get("className") || ""),
    subject: String(formData.get("subject") || "").trim(),
    marks: String(formData.get("marks") || ""),
    aadhaarFile: formData.get("aadhaarFile"),
  };
}

function showRegisterError(message) {
  const target = document.querySelector("#registration-form .form-message");
  if (target) target.textContent = message;
}

async function registerStudent(form) {
  const values = readFormValues(form);
  const existingUser = await getUserByEmail(values.email);
  if (existingUser) {
    showRegisterError("This email is already registered.");
    return;
  }
  if (!form.reportValidity()) return;
  const documentData = await readPdf(values.aadhaarFile);
  const users = await getAllUsers();
  const nextId = Math.max(0, ...users.map((user) => Number(user.id) || 0)) + 1;
  const user = {
    id: nextId,
    role: "student",
    name: values.name,
    email: values.email,
    password: values.password,
    dateOfBirth: values.dateOfBirth,
    gender: values.gender,
    qualification: values.qualification,
    interests: values.interests,
    className: values.className,
    subject: values.subject,
    marks: values.marks,
    aadhaarBlob: documentData.blob,
    aadhaarOriginalName: documentData.originalName,
    aadhaarStoredName: documentData.storedName,
    createdAt: new Date().toISOString(),
  };
  try {
    await saveUser(user);
  } catch (error) {
    if (error?.name === "ConstraintError") {
      showRegisterError("This email is already registered.");
      return;
    }
    throw error;
  }
  localStorage.setItem(SESSION_KEY, String(user.id));
  await renderStudentDashboard(user);
  showToast("Your student account has been created.");
}

async function login(form) {
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await getUserByEmail(email);
  if (!user || user.password !== password) {
    renderLogin("The email or password you entered is incorrect.");
    return;
  }
  localStorage.setItem(SESSION_KEY, String(user.id));
  if (user.role === "admin") await renderAdminDashboard();
  else await renderStudentDashboard(user);
}

async function resetPassword(form) {
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  if (password !== confirmPassword) {
    renderForgotPassword("The passwords do not match.");
    return;
  }
  const user = await getUserByEmail(email);
  if (!user) {
    renderForgotPassword("No account was found with that email address.");
    return;
  }
  user.password = password;
  await saveUser(user);
  renderLogin("Your password has been updated. Please sign in.");
}

function openProfileEditor(user, isAdmin = false) {
  const modalRoot = document.querySelector("#modal-root");
  if (!modalRoot) return;
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="dismiss-modal">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div class="modal-heading">
          <div>
            <p class="eyebrow">${isAdmin ? "Administrator tools" : "Your account"}</p>
            <h2 id="edit-title">${isAdmin ? "Edit student details" : "Edit your profile"}</h2>
            ${isAdmin ? `<p class="help-text">Name and email are locked for administrator edits.</p>` : ""}
          </div>
          <button class="icon-button" type="button" data-action="close-modal" aria-label="Close dialog">×</button>
        </div>
        <form id="edit-form" data-user-id="${escapeHtml(user.id)}" data-admin-edit="${isAdmin}">
          ${renderProfileFields(user, {
    includeName: !isAdmin,
    includeEmail: false,
    includePassword: false,
    requireDocument: false,
  })}
          <p class="form-message" role="alert"></p>
          <div class="modal-actions">
            <button class="button button-secondary" type="button" data-action="close-modal">Cancel</button>
            <button class="button" type="submit">Save changes</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

async function saveProfileChanges(form) {
  const user = await getUser(form.dataset.userId);
  if (!user || user.role !== "student") throw new Error("That student account could not be found.");
  const values = readFormValues(form);
  if (!form.reportValidity()) return;
  const documentData = await readPdf(values.aadhaarFile);
  if (form.dataset.adminEdit !== "true") user.name = values.name;
  user.dateOfBirth = values.dateOfBirth;
  user.gender = values.gender;
  user.qualification = values.qualification;
  user.interests = values.interests;
  user.className = values.className;
  user.subject = values.subject;
  user.marks = values.marks;
  if (documentData) {
    user.aadhaarBlob = documentData.blob;
    user.aadhaarOriginalName = documentData.originalName;
    user.aadhaarStoredName = documentData.storedName;
  }
  await saveUser(user);
  if (form.dataset.adminEdit === "true") {
    await renderAdminDashboard();
    showToast("Student details updated.");
  } else {
    await renderStudentDashboard(user, "Your profile has been updated.");
    showToast("Your profile has been updated.");
  }
}

async function openDocument(userId) {
  const user = await getUser(userId);
  if (!user?.aadhaarBlob) {
    showToast("No Aadhaar document is available.");
    return;
  }
  const url = URL.createObjectURL(user.aadhaarBlob);
  const opened = window.open(url, "_blank", "noopener");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = user.aadhaarOriginalName || user.aadhaarStoredName || "aadhaar.pdf";
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === "login-form") await login(form);
    if (form.id === "registration-form") await registerStudent(form);
    if (form.id === "reset-form") await resetPassword(form);
    if (form.id === "edit-form") await saveProfileChanges(form);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
    const target = form.querySelector(".form-message");
    if (target) target.textContent = message;
    else showToast(message);
  }
});

app.addEventListener("input", (event) => {
  if (event.target.matches("#filter-name, #filter-min-age, #filter-max-age")) applyStudentFilters();
});

app.addEventListener("change", (event) => {
  if (event.target.matches("#filter-class")) applyStudentFilters();
});

document.addEventListener("click", async (event) => {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;
  const action = actionElement.dataset.action;

  if (action === "dismiss-modal" && event.target !== actionElement) return;
  if (actionElement.tagName === "A") event.preventDefault();
  try {
    if (action === "home") {
      const user = await getActiveUser();
      if (user?.role === "admin") await renderAdminDashboard();
      else if (user?.role === "student") await renderStudentDashboard(user);
      else renderLogin();
    }
    if (action === "login") renderLogin();
    if (action === "register") renderRegistration();
    if (action === "forgot") renderForgotPassword();
    if (action === "logout") {
      localStorage.removeItem(SESSION_KEY);
      renderLogin();
    }
    if (action === "edit-profile") {
      const user = await getActiveUser();
      if (user?.role === "student") openProfileEditor(user);
    }
    if (action === "admin-edit") {
      const user = await getUser(actionElement.dataset.userId);
      if (user?.role === "student") openProfileEditor(user, true);
    }
    if (action === "admin-delete") {
      const user = await getUser(actionElement.dataset.userId);
      if (user?.role !== "student") return;
      if (window.confirm(`Delete the student account for ${user.name}? This cannot be undone.`)) {
        await removeUser(user.id);
        await renderAdminDashboard();
        showToast("Student record deleted.");
      }
    }
    if (action === "open-document") await openDocument(actionElement.dataset.userId);
    if (action === "close-modal" || action === "dismiss-modal") {
      document.querySelector("#modal-root").innerHTML = "";
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Something went wrong. Please try again.");
  }
});

initialize().catch((error) => {
  console.error("Student Portal could not start:", error);
  app.innerHTML = `
    <section class="panel empty-state">
      <strong>Student Portal could not start</strong>
      <p>${escapeHtml(error instanceof Error ? error.message : "The browser database could not be opened.")}</p>
      <p>Use a current browser with IndexedDB enabled, then reload this page.</p>
    </section>
  `;
});
