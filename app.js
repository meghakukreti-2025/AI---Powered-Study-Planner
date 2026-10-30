document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const API_BASE_URL = window.location.origin.includes(":5000") ? window.location.origin : "http://127.0.0.1:5000";

  const savedUserJson = localStorage.getItem("cognify_user");
  let initialUser = { id: null, firstName: "Student", lastName: "", email: "", displayName: "Student", isLoggedIn: false };
  if (savedUserJson) {
    try {
      const parsed = JSON.parse(savedUserJson);
      if (parsed && typeof parsed === "object") {
        initialUser = { ...initialUser, ...parsed };
      }
    } catch (_) {}
  }

  const state = {
    user: initialUser,
    subjects: [],
    availability: { hours: 3.5, startTime: "18:00", endTime: "22:30" },
    collapsedSubjects: {},
    collapsedUnits: {},
    pendingExtraction: null,
    selectedSemester: null,
    searchQuery: "",
    collapsedSemesters: {},
    currentSchedule: null,
    savedSchedule: null,
    isEditingTimetable: false,
    activeTimetableDay: 0,
    // Timetable Selection State
    timetableSelection: {
      selectedSubjects: new Set(),
      selectedTopics: new Set(),
      subjectMemory: {}, // subjectId -> Set of topicIds
    },
  };

  // Restore saved timetable from localStorage if available
  try {
    const savedTimetableJson = localStorage.getItem("cognify_saved_timetable");
    if (savedTimetableJson) {
      const parsed = JSON.parse(savedTimetableJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.currentSchedule = parsed;
        state.savedSchedule = JSON.parse(JSON.stringify(parsed));
      }
    }
  } catch (_) {}

  let authMode = "login";

  const elements = {
    toast: document.getElementById("toast"),

    // Auth Elements
    authForm: document.getElementById("auth-form"),
    authTitle: document.getElementById("auth-title"),
    authSubtitle: document.getElementById("auth-subtitle"),
    authEmail: document.getElementById("auth-email"),
    authPassword: document.getElementById("auth-password"),
    authPasswordHint: document.getElementById("auth-password-hint"),
    btnTogglePassword: document.getElementById("btn-toggle-password"),
    authRememberMe: document.getElementById("auth-remember-me"),
    authFirstName: document.getElementById("auth-first-name"),
    authLastName: document.getElementById("auth-last-name"),
    signupFields: document.getElementById("signup-fields"),
    tabLogin: document.getElementById("tab-login"),
    tabSignup: document.getElementById("tab-signup"),
    btnAuthSubmit: document.getElementById("btn-auth-submit"),
    btnTryDemo: document.getElementById("btn-try-demo"),
    authGuestLink: document.getElementById("auth-guest-link"),
    authSwitchPrompt: document.getElementById("auth-switch-prompt"),
    authToggleModeLink: document.getElementById("auth-toggle-mode-link"),
    userDisplayName: document.getElementById("user-display-name"),
    btnEditDisplayName: document.getElementById("btn-edit-display-name"),
    demoModeBadge: document.getElementById("demo-mode-badge"),
    demoBannerActions: document.getElementById("demo-banner-actions"),
    btnResetDemo: document.getElementById("btn-reset-demo"),
    btnExitDemo: document.getElementById("btn-exit-demo"),
    btnLogout: document.getElementById("btn-logout"),

    // Institution & Auth Elements
    authInstitutionType: document.getElementById("auth-institution-type"),
    authAcademicLevel: document.getElementById("auth-academic-level"),
    labelAcademicLevel: document.getElementById("label-academic-level"),
    authConfirmPassword: document.getElementById("auth-confirm-password"),
    btnToggleConfirmPassword: document.getElementById("btn-toggle-confirm-password"),
    groupConfirmPassword: document.getElementById("group-confirm-password"),
    authForgotPasswordLink: document.getElementById("auth-forgot-password-link"),
    modalForgotPassword: document.getElementById("modal-forgot-password"),
    btnCloseForgotModal: document.getElementById("btn-close-forgot-modal"),
    forgotPasswordForm: document.getElementById("forgot-password-form"),
    forgotEmail: document.getElementById("forgot-email"),
    btnRequestReset: document.getElementById("btn-request-reset"),
    resetPasswordForm: document.getElementById("reset-password-form"),
    resetToken: document.getElementById("reset-token"),
    resetNewPassword: document.getElementById("reset-new-password"),
    resetConfirmPassword: document.getElementById("reset-confirm-password"),
    btnToggleResetPassword: document.getElementById("btn-toggle-reset-password"),
    btnToggleResetConfirm: document.getElementById("btn-toggle-reset-confirm"),
    btnSubmitReset: document.getElementById("btn-submit-reset"),

    // Multi-PDF Upload Elements
    btnSelectPdfTrigger: document.getElementById("btn-select-pdf-trigger"),
    pdfSelectedFilesList: document.getElementById("pdf-selected-files-list"),
    btnStartMultiUpload: document.getElementById("btn-start-multi-upload"),

    // Metric Elements & Semester Filter
    dashboardSemesterFilter: document.getElementById("dashboard-semester-filter"),
    metricsFilterCaption: document.getElementById("metrics-filter-caption"),
    metricTotalSubjects: document.getElementById("metric-total-subjects"),
    metricTotalUnits: document.getElementById("metric-total-units"),
    metricTotalTopics: document.getElementById("metric-total-topics"),
    metricCompletedTopics: document.getElementById("metric-completed-topics"),
    metricProgressPercent: document.getElementById("metric-progress-percent"),
    metricProgressLabel: document.getElementById("metric-progress-label"),
    metricProgressFill: document.getElementById("metric-progress-fill"),

    // Dashboard Elements
    subjectsDashboardGrid: document.getElementById("subjects-dashboard-grid"),
    btnOpenAddSubject: document.getElementById("btn-open-add-subject"),
    btnOpenTimetableGen: document.getElementById("btn-open-timetable-gen"),

    // Syllabus Import Elements
    pdfDropzone: document.getElementById("pdf-dropzone"),
    pdfFileInput: document.getElementById("pdf-file-input"),
    pdfPromptTitle: document.getElementById("pdf-prompt-title"),
    addSubjectForm: document.getElementById("add-subject-form"),
    subjectNameInput: document.getElementById("subject-name"),
    subjectCodeInput: document.getElementById("subject-code"),
    subjectSemesterInput: document.getElementById("subject-semester"),
    topicInputsContainer: document.getElementById("topic-inputs-container"),
    btnAddTopicField: document.getElementById("btn-add-topic-field"),

    // Extraction Review Elements
    viewExtractionReview: document.getElementById("view-extraction-review"),
    reviewStatSubjects: document.getElementById("review-stat-subjects"),
    reviewStatUnits: document.getElementById("review-stat-units"),
    reviewStatTopics: document.getElementById("review-stat-topics"),
    reviewStatPages: document.getElementById("review-stat-pages"),
    reviewWarningsBox: document.getElementById("review-warnings-box"),
    reviewSubjectsContainer: document.getElementById("review-subjects-container"),
    btnConfirmReview: document.getElementById("btn-confirm-review"),
    btnDiscardReview: document.getElementById("btn-discard-review"),

    // Timetable Generation Elements
    generateScheduleForm: document.getElementById("generate-schedule-form"),
    timetableSelectionSummary: document.getElementById("timetable-selection-summary"),
    todayTopicSelector: document.getElementById("today-topic-selector"),
    dailyHoursInput: document.getElementById("daily-hours"),
    startTimeInput: document.getElementById("start-time"),
    endTimeInput: document.getElementById("end-time"),
    timetableValidationMsg: document.getElementById("timetable-validation-msg"),
    btnSubmitTimetable: document.getElementById("btn-submit-timetable"),
    timetableResultsContainer: document.getElementById("timetable-results-container"),
    timetableCardsWrapper: document.getElementById("timetable-cards-wrapper"),
    btnPrintSchedule: document.getElementById("btn-print-schedule"),
    btnPrefillDemo: document.getElementById("btn-prefill-demo"),
    themeToggleBtn: document.getElementById("theme-toggle"),

    // Subject Search Elements
    subjectSearchInput: document.getElementById("subject-search-input"),
    subjectSearchClear: document.getElementById("subject-search-clear"),

    // Advanced Timetable Result Elements
    btnSaveTimetable: document.getElementById("btn-save-timetable"),
    btnEditTimetable: document.getElementById("btn-edit-timetable"),
    editTimetableBtnText: document.getElementById("edit-timetable-btn-text"),
    btnResetTimetable: document.getElementById("btn-reset-timetable"),
    timetableDayTabs: document.getElementById("timetable-day-tabs"),
    timetableDayMetrics: document.getElementById("timetable-day-metrics"),
    timetableUnscheduledBox: document.getElementById("timetable-unscheduled-box"),
    breakPreferenceInput: document.getElementById("break-preference"),
    focusPreferenceInput: document.getElementById("focus-preference"),

    // Duplicate Merge Elements
    btnOpenMergeModal: document.getElementById("btn-open-merge-modal"),
    modalMergeDuplicates: document.getElementById("modal-merge-duplicates"),
    btnCloseMergeModal: document.getElementById("btn-close-merge-modal"),
    btnCancelMerge: document.getElementById("btn-cancel-merge"),
    btnConfirmMerge: document.getElementById("btn-confirm-merge"),
    mergeDuplicatesList: document.getElementById("merge-duplicates-list"),

    // Review & Draft Elements
    btnSaveDraft: document.getElementById("btn-save-draft"),
    draftResumeBanner: document.getElementById("draft-resume-banner"),
    reviewPdfPanel: document.getElementById("panel-review-pdf"),
    reviewSyllabusPanel: document.getElementById("panel-review-syllabus"),
    reviewPdfIframe: document.getElementById("review-pdf-iframe"),
    reviewPdfFilename: document.getElementById("review-pdf-filename"),
    tabReviewSyllabus: document.getElementById("tab-review-syllabus"),
    tabReviewPdf: document.getElementById("tab-review-pdf"),
    btnAddReviewSubject: document.getElementById("btn-add-review-subject"),

    // Edit Subject Modal Elements
    modalEditSubject: document.getElementById("modal-edit-subject"),
    formEditSubject: document.getElementById("edit-subject-form"),
    editSubjectId: document.getElementById("edit-subject-id"),
    editSubjectName: document.getElementById("edit-subject-name"),
    editSubjectCode: document.getElementById("edit-subject-code"),
    editSubjectSemester: document.getElementById("edit-subject-semester"),
    editUnitsContainer: document.getElementById("edit-units-container"),
    btnAddEditUnit: document.getElementById("btn-add-edit-unit"),
    btnCloseEditModal: document.getElementById("btn-close-edit-modal"),
    btnCancelEditSubject: document.getElementById("btn-cancel-edit-subject"),
    btnSaveSubjectEdit: document.getElementById("btn-save-subject-edit"),
  };

  window.showDashboard = showDashboard;
  window.showView = showView;

  function showToast(message, type = "normal") {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
    elements.toast.classList.remove("hidden");
    setTimeout(() => {
      if (elements.toast) elements.toast.classList.add("hidden");
    }, 3800);
  }

  function showView(viewId) {
    document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.remove("active"));
    const activeView = document.getElementById(viewId);
    if (activeView) activeView.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showDashboard() {
    if (elements.btnLogout && state.user && state.user.isLoggedIn) {
      elements.btnLogout.style.display = "inline-flex";
    }
    renderDashboard();
    showView("view-dashboard");
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function apiSaveSyllabus() {
    if (!state.user.email) return;
    try {
      await fetch(`${API_BASE_URL}/save-syllabus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: state.user.id, email: state.user.email, subjects: state.subjects }),
      });
    } catch (err) {
      console.warn("Could not sync syllabus to server:", err);
    }
  }

  /* ======================================================== */
  function getAcademicTerms() {
    const inst = (state.user && state.user.institutionType) || "university";
    if (inst === "school") {
      return { termName: "Class", termPlural: "Classes", unitName: "Chapter", unitPlural: "Chapters", topicName: "Topic" };
    } else if (inst === "course") {
      return { termName: "Module", termPlural: "Modules", unitName: "Lesson", unitPlural: "Lessons", topicName: "Topic" };
    }
    return { termName: "Semester", termPlural: "Semesters", unitName: "Unit", unitPlural: "Units", topicName: "Topic" };
  }

  function updateAcademicLevelOptions() {
    if (!elements.authInstitutionType || !elements.authAcademicLevel) return;
    const inst = elements.authInstitutionType.value;
    elements.authAcademicLevel.innerHTML = "";
    if (inst === "school") {
      if (elements.labelAcademicLevel) elements.labelAcademicLevel.textContent = "Class / Grade";
      for (let i = 1; i <= 12; i++) {
        const opt = document.createElement("option");
        opt.value = `Class ${i}`;
        opt.textContent = `Class ${i}`;
        if (i === 10) opt.selected = true;
        elements.authAcademicLevel.appendChild(opt);
      }
    } else if (inst === "course") {
      if (elements.labelAcademicLevel) elements.labelAcademicLevel.textContent = "Course Level / Module";
      const courseLevels = ["Course 1 (Foundations)", "Course 2 (Intermediate)", "Course 3 (Advanced)", "Module 1", "Module 2", "Module 3", "Module 4"];
      courseLevels.forEach((lvl, idx) => {
        const opt = document.createElement("option");
        opt.value = lvl;
        opt.textContent = lvl;
        if (idx === 0) opt.selected = true;
        elements.authAcademicLevel.appendChild(opt);
      });
    } else {
      if (elements.labelAcademicLevel) elements.labelAcademicLevel.textContent = "Semester";
      for (let i = 1; i <= 8; i++) {
        const opt = document.createElement("option");
        opt.value = `Semester ${i}`;
        opt.textContent = `Semester ${i}`;
        if (i === 3) opt.selected = true;
        elements.authAcademicLevel.appendChild(opt);
      }
    }
  }

  if (elements.authInstitutionType) {
    elements.authInstitutionType.addEventListener("change", updateAcademicLevelOptions);
    updateAcademicLevelOptions();
  }

  /* PHASE 1 & 2: AUTHENTICATION & USER PROFILE DISPLAY       */
  /* ======================================================== */
  function setAuthMode(mode) {
    authMode = mode;
    if (mode === "login") {
      if (elements.groupConfirmPassword) elements.groupConfirmPassword.style.display = "none";
      if (elements.tabLogin) {
        elements.tabLogin.classList.add("active", "btn-primary");
        elements.tabLogin.classList.remove("btn-outline");
      }
      if (elements.tabSignup) {
        elements.tabSignup.classList.remove("active", "btn-primary");
        elements.tabSignup.classList.add("btn-outline");
      }
      if (elements.signupFields) elements.signupFields.style.display = "none";
      if (elements.authTitle) elements.authTitle.textContent = "Welcome Back!";
      if (elements.authSubtitle) elements.authSubtitle.textContent = "Your smarter way to plan, learn and achieve.";
      if (elements.btnAuthSubmit) elements.btnAuthSubmit.textContent = "Sign In";
      if (elements.authSwitchPrompt) elements.authSwitchPrompt.textContent = "Don't have an account?";
      if (elements.authToggleModeLink) elements.authToggleModeLink.textContent = "Sign Up";

      // Allow any password length for login (do not block existing accounts)
      if (elements.authPasswordHint) elements.authPasswordHint.style.display = "none";
      if (elements.authPassword) {
        elements.authPassword.removeAttribute("minlength");
        elements.authPassword.placeholder = "Enter your password";
      }
      if (elements.authConfirmPassword) {
        elements.authConfirmPassword.removeAttribute("required");
        elements.authConfirmPassword.removeAttribute("minlength");
      }
      if (elements.authFirstName) {
        elements.authFirstName.removeAttribute("required");
      }
    } else {
      if (elements.tabSignup) {
        elements.tabSignup.classList.add("active", "btn-primary");
        elements.tabSignup.classList.remove("btn-outline");
      }
      if (elements.tabLogin) {
        elements.tabLogin.classList.remove("active", "btn-primary");
        elements.tabLogin.classList.add("btn-outline");
      }
      if (elements.signupFields) elements.signupFields.style.display = "block";
      if (elements.groupConfirmPassword) elements.groupConfirmPassword.style.display = "block";
      if (elements.authTitle) elements.authTitle.textContent = "Create an Account";
      if (elements.authSubtitle) elements.authSubtitle.textContent = "Start planning your academic curriculum with AI.";
      if (elements.btnAuthSubmit) elements.btnAuthSubmit.textContent = "Create Account";
      if (elements.authSwitchPrompt) elements.authSwitchPrompt.textContent = "Already have an account?";
      if (elements.authToggleModeLink) elements.authToggleModeLink.textContent = "Sign In";

      // Require min 12 characters for registration & confirm password
      if (elements.authPasswordHint) elements.authPasswordHint.style.display = "inline";
      if (elements.authPassword) {
        elements.authPassword.setAttribute("minlength", "12");
        elements.authPassword.placeholder = "Create password (min 12 characters)";
      }
      if (elements.authConfirmPassword) {
        elements.authConfirmPassword.setAttribute("required", "required");
        elements.authConfirmPassword.setAttribute("minlength", "12");
      }
      if (elements.authFirstName) {
        elements.authFirstName.setAttribute("required", "required");
      }
    }
  }

  if (elements.tabLogin) elements.tabLogin.addEventListener("click", () => setAuthMode("login"));
  if (elements.tabSignup) elements.tabSignup.addEventListener("click", () => setAuthMode("signup"));
  if (elements.authToggleModeLink) {
    elements.authToggleModeLink.addEventListener("click", (e) => {
      e.preventDefault();
      setAuthMode(authMode === "login" ? "signup" : "login");
    });
  }

  // Password Visibility Toggles
  function setupPasswordToggle(btn, input) {
    if (btn && input) {
      btn.addEventListener("click", () => {
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        btn.textContent = isPassword ? "🙈" : "👁️";
      });
    }
  }

  setupPasswordToggle(elements.btnTogglePassword, elements.authPassword);
  setupPasswordToggle(elements.btnToggleConfirmPassword, elements.authConfirmPassword);
  setupPasswordToggle(elements.btnToggleResetPassword, elements.resetNewPassword);
  setupPasswordToggle(elements.btnToggleResetConfirm, elements.resetConfirmPassword);

  // Forgot & Reset Password Modal Logic
  if (elements.authForgotPasswordLink && elements.modalForgotPassword) {
    elements.authForgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      elements.modalForgotPassword.style.display = "flex";
      if (elements.forgotEmail && elements.authEmail) {
        elements.forgotEmail.value = elements.authEmail.value;
      }
    });
  }

  if (elements.btnCloseForgotModal && elements.modalForgotPassword) {
    elements.btnCloseForgotModal.addEventListener("click", () => {
      elements.modalForgotPassword.style.display = "none";
    });
  }

  if (elements.forgotPasswordForm) {
    elements.forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = elements.forgotEmail ? elements.forgotEmail.value.trim().toLowerCase() : "";
      if (!email) return;

      if (elements.btnRequestReset) {
        elements.btnRequestReset.disabled = true;
        elements.btnRequestReset.textContent = "Generating Token...";
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const result = await resp.json();
        if (result.success) {
          showToast(result.message || "Reset token generated! Enter your new password below.", "success");
          if (elements.resetPasswordForm) elements.resetPasswordForm.style.display = "block";
          if (elements.resetToken && result.resetToken) {
            elements.resetToken.value = result.resetToken;
          }
        } else {
          showToast(result.message || "Could not generate reset token.", "error");
        }
      } catch (err) {
        showToast("Error requesting password reset.", "error");
      } finally {
        if (elements.btnRequestReset) {
          elements.btnRequestReset.disabled = false;
          elements.btnRequestReset.textContent = "Generate Reset Token";
        }
      }
    });
  }

  if (elements.resetPasswordForm) {
    elements.resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const token = elements.resetToken ? elements.resetToken.value.trim() : "";
      const newPassword = elements.resetNewPassword ? elements.resetNewPassword.value.trim() : "";
      const confirmPassword = elements.resetConfirmPassword ? elements.resetConfirmPassword.value.trim() : "";

      if (!token) {
        showToast("Please enter the reset token.", "error");
        return;
      }
      if (newPassword.length < 12) {
        showToast("Password must be at least 12 characters.", "error");
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast("Passwords do not match.", "error");
        return;
      }

      if (elements.btnSubmitReset) {
        elements.btnSubmitReset.disabled = true;
        elements.btnSubmitReset.textContent = "Updating...";
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, newPassword, confirmPassword }),
        });
        const result = await resp.json();
        if (result.success) {
          showToast("Password updated successfully! Please sign in with your new password.", "success");
          if (elements.modalForgotPassword) elements.modalForgotPassword.style.display = "none";
          setAuthMode("login");
          if (elements.authPassword) elements.authPassword.value = "";
        } else {
          showToast(result.message || "Failed to reset password.", "error");
        }
      } catch (err) {
        showToast("Error resetting password.", "error");
      } finally {
        if (elements.btnSubmitReset) {
          elements.btnSubmitReset.disabled = false;
          elements.btnSubmitReset.textContent = "Update Password";
        }
      }
    });
  }
  if (false) { // legacy toggle
    elements.btnTogglePassword.addEventListener("click", () => {
      const isPassword = elements.authPassword.type === "password";
      elements.authPassword.type = isPassword ? "text" : "password";
      elements.btnTogglePassword.textContent = isPassword ? "🙈" : "👁️";
    });
  }

  // Update Display Name Handler
  function updateUserDisplayName(name) {
    const finalName = name || (state.user && (state.user.displayName || state.user.firstName)) || "Student";
    state.user.firstName = finalName;
    state.user.displayName = finalName;
    if (elements.userDisplayName) {
      elements.userDisplayName.textContent = finalName;
    }
    if (state.user.isLoggedIn) {
      try {
        localStorage.setItem("cognify_user", JSON.stringify(state.user));
      } catch (_) {}
    }
  }

  // Initialize user display name from session/state
  if (state.user && (state.user.displayName || state.user.firstName)) {
    updateUserDisplayName(state.user.displayName || state.user.firstName);
  }

  if (elements.btnEditDisplayName) {
    elements.btnEditDisplayName.addEventListener("click", async () => {
      const current = state.user.displayName || state.user.firstName || "Student";
      const newName = prompt("Enter your preferred display name:", current);
      if (newName && newName.trim() && newName.trim() !== current) {
        const trimmed = newName.trim();
        updateUserDisplayName(trimmed);
        showToast(`Display name updated to ${trimmed}!`, "success");

        if (state.user.id || state.user.email) {
          try {
            await fetch(`${API_BASE_URL}/update-profile`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: state.user.id,
                email: state.user.email,
                firstName: trimmed,
                displayName: trimmed,
              }),
            });
          } catch (e) {
            console.warn("Could not persist display name:", e);
          }
        }
      }
    });
  }

  if (elements.authForm) {
    elements.authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = elements.authEmail ? elements.authEmail.value.trim().toLowerCase() : "";
      const password = elements.authPassword ? elements.authPassword.value.trim() : "";
      const firstName = elements.authFirstName ? elements.authFirstName.value.trim() : "";
      const lastName = elements.authLastName ? elements.authLastName.value.trim() : "";
      const institutionType = elements.authInstitutionType ? elements.authInstitutionType.value : "university";
      const academicLevel = elements.authAcademicLevel ? elements.authAcademicLevel.value : "Semester 3";
      const confirmPassword = elements.authConfirmPassword ? elements.authConfirmPassword.value.trim() : "";

      if (!email) {
        showToast("Please enter your email address.", "error");
        if (elements.authEmail) elements.authEmail.focus();
        return;
      }
      if (!password) {
        showToast("Please enter your password.", "error");
        if (elements.authPassword) elements.authPassword.focus();
        return;
      }

      if (authMode === "signup") {
        if (!firstName) {
          showToast("Please enter your first name.", "error");
          if (elements.authFirstName) elements.authFirstName.focus();
          return;
        }
        if (password.length < 12) {
          showToast("Password must be at least 12 characters long for new registrations.", "error");
          if (elements.authPassword) elements.authPassword.focus();
          return;
        }
        if (password !== confirmPassword) {
          showToast("Passwords do not match. Please verify your confirm password.", "error");
          if (elements.authConfirmPassword) elements.authConfirmPassword.focus();
          return;
        }
      }

      const endpoint = authMode === "signup" ? "/register" : "/login";

      if (elements.btnAuthSubmit) {
        elements.btnAuthSubmit.disabled = true;
        elements.btnAuthSubmit.textContent = authMode === "signup" ? "Creating Account..." : "Signing In...";
      }

      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(authMode === "signup" ? { email, password, confirmPassword, firstName, lastName, institutionType, academicLevel } : { email, password }),
        });
        const result = await response.json();

        if (result.success && result.user) {
          state.user = { ...result.user, isLoggedIn: true };
          state.subjects = result.subjects || [];

          // Format clean first name
          const displayName = result.user.displayName || result.user.firstName || "Student";
          updateUserDisplayName(displayName);
          try {
            localStorage.setItem("cognify_user", JSON.stringify(state.user));
          } catch (_) {}

          if (elements.demoModeBadge) elements.demoModeBadge.style.display = result.user.isDemo ? "inline-flex" : "none";
          if (elements.demoBannerActions) elements.demoBannerActions.style.display = result.user.isDemo ? "flex" : "none";
          if (elements.btnLogout) elements.btnLogout.style.display = "inline-flex";

          showToast(`Welcome ${authMode === "signup" ? "" : "back, "}${displayName}!`, "success");
          showDashboard();
        } else {
          showToast(result.message || (authMode === "signup" ? "Registration failed." : "Invalid email or password."), "error");
        }
      } catch (err) {
        showToast("Server connection error.", "error");
      } finally {
        if (elements.btnAuthSubmit) {
          elements.btnAuthSubmit.disabled = false;
          elements.btnAuthSubmit.textContent = authMode === "signup" ? "Create Account" : "Sign In";
        }
      }
    });
  }

  if (elements.authGuestLink) {
    elements.authGuestLink.addEventListener("click", (e) => {
      e.preventDefault();
      state.user = { id: 999, email: "guest@college.edu", firstName: "Guest", displayName: "Guest", isLoggedIn: true };
      updateUserDisplayName("Guest");
      try {
        localStorage.setItem("cognify_user", JSON.stringify(state.user));
      } catch (_) {}
      if (elements.demoModeBadge) elements.demoModeBadge.style.display = "none";
      if (elements.demoBannerActions) elements.demoBannerActions.style.display = "none";
      showToast("Signed in as Guest Explorer", "normal");
      showDashboard();
    });
  }

  /* ======================================================== */
  // Logout Handler
  if (elements.btnLogout) {
    elements.btnLogout.addEventListener("click", async () => {
      try {
        await fetch(`${API_BASE_URL}/logout`, { method: "POST" });
      } catch (_) {}
      state.user = { isLoggedIn: false };
      state.subjects = [];
      try {
        localStorage.removeItem("cognify_user");
      } catch (_) {}
      if (elements.btnLogout) elements.btnLogout.style.display = "none";
      if (elements.demoModeBadge) elements.demoModeBadge.style.display = "none";
      if (elements.demoBannerActions) elements.demoBannerActions.style.display = "none";
      showToast("Logged out successfully.", "normal");
      showView("view-auth");
    });
  }

  /* ONE-CLICK DEMO LOGIN & SESSION MANAGEMENT                */
  /* ======================================================== */
  if (elements.btnTryDemo) {
    elements.btnTryDemo.addEventListener("click", async () => {
      const origHtml = elements.btnTryDemo.innerHTML;
      elements.btnTryDemo.disabled = true;
      elements.btnTryDemo.innerHTML = '<span class="demo-btn-icon">⏳</span> Setting Up AKTU Demo...';

      try {
        const response = await fetch(`${API_BASE_URL}/demo-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Server returned ${response.status}: ${errText}`);
        }

        const result = await response.json();

        if (result.success && result.user) {
          state.user = {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.firstName || "Demo Student",
            lastName: result.user.lastName || "Visitor",
            displayName: result.user.displayName || "Demo Student",
            isDemo: true,
            isLoggedIn: true,
            demoToken: result.user.demoToken || "",
          };
          state.subjects = result.subjects || [];

          // Collapse all subjects by default for clear high-level view
          state.collapsedSubjects = {};
          state.subjects.forEach((s) => {
            state.collapsedSubjects[s.id] = true;
          });

          // Store demo session in localStorage
          try {
            localStorage.setItem("cognify_user", JSON.stringify(state.user));
          } catch (_) {}

          // Show demo badges, logout button, and controls
          updateUserDisplayName(state.user.displayName);
          if (elements.demoModeBadge) elements.demoModeBadge.style.display = "inline-flex";
          if (elements.demoBannerActions) elements.demoBannerActions.style.display = "inline-flex";
          if (elements.btnLogout) elements.btnLogout.style.display = "inline-flex";

          renderDashboard();
          showDashboard();
          showToast(`⚡ Demo Mode Active! Loaded ${state.subjects.length} AKTU Semester 3 & 4 subjects.`, "success");
        } else {
          showToast(result.message || "Failed to initialize demo session.", "error");
        }
      } catch (err) {
        console.error("Demo login error:", err);
        showToast("Could not connect to demo server: " + err.message, "error");
      } finally {
        if (elements.btnTryDemo) {
          elements.btnTryDemo.disabled = false;
          elements.btnTryDemo.innerHTML = origHtml;
        }
      }
    });
  }

  // Demo Reset Handler
  if (elements.btnResetDemo) {
    elements.btnResetDemo.addEventListener("click", async () => {
      if (!state.user || !state.user.isDemo) {
        showToast("Reset is only available for demo sessions.", "error");
        return;
      }

      if (!confirm("Reset demo curriculum to default AKTU state? Any progress edits will be reset to initial sample values.")) {
        return;
      }

      const origText = elements.btnResetDemo.textContent;
      elements.btnResetDemo.disabled = true;
      elements.btnResetDemo.textContent = "Resetting...";

      try {
        const resp = await fetch(`${API_BASE_URL}/reset-demo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: state.user.id,
            email: state.user.email,
          }),
        });
        const result = await resp.json();
        if (result.success) {
          state.subjects = result.subjects || [];
          state.collapsedSubjects = {};
          state.subjects.forEach((s) => {
            state.collapsedSubjects[s.id] = true;
          });
          renderDashboard();
          showToast("Demo curriculum reset to default AKTU syllabus!", "success");
        } else {
          showToast(result.message || "Reset failed.", "error");
        }
      } catch (err) {
        showToast("Failed to reset demo: " + err.message, "error");
      } finally {
        if (elements.btnResetDemo) {
          elements.btnResetDemo.disabled = false;
          elements.btnResetDemo.textContent = origText;
        }
      }
    });
  }

  // Demo Exit Handler
  if (elements.btnExitDemo) {
    elements.btnExitDemo.addEventListener("click", async () => {
      if (confirm("Exit Demo Mode? Your temporary demo session will be closed.")) {
        try {
          if (state.user && state.user.isDemo) {
            await fetch(`${API_BASE_URL}/exit-demo`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: state.user.id,
                email: state.user.email,
              }),
            });
          }
        } catch (e) {
          console.warn("Exit demo error:", e);
        }

        // Clear demo state and restore defaults
        state.user = { id: null, firstName: "Student", lastName: "", email: "", displayName: "Student", isLoggedIn: false };
        state.subjects = [];
        state.collapsedSubjects = {};
        try {
          localStorage.removeItem("cognify_user");
        } catch (_) {}
        updateUserDisplayName("Student");

        if (elements.demoModeBadge) elements.demoModeBadge.style.display = "none";
        if (elements.demoBannerActions) elements.demoBannerActions.style.display = "none";

        showToast("Exited Demo Mode.", "normal");
        showView("view-auth");
      }
    });
  }

  /* ======================================================== */
  /* DASHBOARD METRICS CALCULATION & SEMESTER FILTER          */
  /* ======================================================== */
  function updateSemesterFilterDropdown() {
    const filterSelect = elements.dashboardSemesterFilter;
    if (!filterSelect) return;

    // Collect all distinct semesters present in current user's subjects
    const semestersSet = new Set();
    state.subjects.forEach((subj) => {
      if (subj.semester !== undefined && subj.semester !== null && String(subj.semester).trim() !== "") {
        const parsed = parseInt(subj.semester);
        if (!isNaN(parsed)) {
          semestersSet.add(parsed);
        } else {
          semestersSet.add(String(subj.semester));
        }
      }
    });

    const sortedSemesters = Array.from(semestersSet).sort((a, b) => {
      const numA = parseInt(a) || 999;
      const numB = parseInt(b) || 999;
      return numA - numB;
    });

    const savedPreference = localStorage.getItem("cognify_selected_semester");

    // Default to the current academic semester if that preference is saved; otherwise use lowest available semester number
    let targetSem = state.selectedSemester;
    if (!targetSem || (!sortedSemesters.map(String).includes(String(targetSem)) && targetSem !== "all")) {
      if (savedPreference && (savedPreference === "all" || sortedSemesters.map(String).includes(String(savedPreference)))) {
        targetSem = savedPreference;
      } else if (sortedSemesters.length > 0) {
        targetSem = String(sortedSemesters[0]); // lowest available semester number
      } else {
        targetSem = "all";
      }
    }

    state.selectedSemester = targetSem;

    const terms = getAcademicTerms();
    // Repopulate select options
    filterSelect.innerHTML = "";
    sortedSemesters.forEach((sem) => {
      const opt = document.createElement("option");
      opt.value = String(sem);
      opt.textContent = `${terms.termName} ${sem}`;
      if (String(sem) === String(targetSem)) {
        opt.selected = true;
      }
      filterSelect.appendChild(opt);
    });

    // Also provide All Semesters option
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = `All ${terms.termPlural} (Overall)`;
    if (targetSem === "all") {
      allOpt.selected = true;
    }
    filterSelect.appendChild(allOpt);
  }

  function updateDashboardMetrics() {
    const terms = getAcademicTerms();
    const selectedSem = state.selectedSemester;
    const isFiltered = selectedSem && selectedSem !== "all";

    // Filter subjects by selected semester if chosen; otherwise use all
    const filteredSubjects = isFiltered
      ? state.subjects.filter((s) => String(s.semester) === String(selectedSem))
      : state.subjects;

    const totalSubjects = filteredSubjects.length;
    let totalUnits = 0;
    let totalTopics = 0;
    let completedTopics = 0;

    filteredSubjects.forEach((subj) => {
      if (subj.units && subj.units.length > 0) {
        totalUnits += subj.units.length;
      } else if (subj.topics && subj.topics.length > 0) {
        totalUnits += 1;
      }

      if (subj.topics && subj.topics.length > 0) {
        totalTopics += subj.topics.length;
        completedTopics += subj.topics.filter((t) => t.completed).length;
      }
    });

    // Safe dynamic progress percentage without division by zero
    const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    if (elements.metricTotalSubjects) elements.metricTotalSubjects.textContent = totalSubjects;
    if (elements.metricTotalUnits) elements.metricTotalUnits.textContent = totalUnits;
    if (elements.metricTotalTopics) elements.metricTotalTopics.textContent = totalTopics;
    if (elements.metricCompletedTopics) elements.metricCompletedTopics.textContent = completedTopics;
    if (elements.metricProgressPercent) elements.metricProgressPercent.textContent = `${progressPercent}%`;
    if (elements.metricProgressFill) elements.metricProgressFill.style.width = `${progressPercent}%`;

    if (elements.metricProgressLabel) {
      elements.metricProgressLabel.textContent = isFiltered ? `${terms.termName} ${selectedSem} Progress` : "Overall Progress";
    }

    if (elements.metricsFilterCaption) {
      elements.metricsFilterCaption.textContent = isFiltered
        ? `Showing ${terms.termName} ${selectedSem} (${totalSubjects} subjects)`
        : `Showing All ${terms.termPlural} (${state.subjects.length} subjects)`;
    }
  }

  // Real-time semester filter change handler
  if (elements.dashboardSemesterFilter) {
    elements.dashboardSemesterFilter.addEventListener("change", (e) => {
      const val = e.target.value;
      state.selectedSemester = val;
      localStorage.setItem("cognify_selected_semester", val);
      updateDashboardMetrics();
      renderDashboard();
    });
  }

  // Subject Search Bar Real-Time Listeners
  if (elements.subjectSearchInput) {
    elements.subjectSearchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      if (elements.subjectSearchClear) {
        elements.subjectSearchClear.style.display = state.searchQuery ? "block" : "none";
      }
      renderDashboard();
    });
  }

  if (elements.subjectSearchClear) {
    elements.subjectSearchClear.addEventListener("click", () => {
      if (elements.subjectSearchInput) elements.subjectSearchInput.value = "";
      state.searchQuery = "";
      elements.subjectSearchClear.style.display = "none";
      renderDashboard();
    });
  }

  /* ======================================================== */
  /* RENDER DASHBOARD (SEMESTER -> SUBJECT -> UNIT -> TOPIC)  */
  /* ======================================================== */
  function renderDashboard() {
    updateSemesterFilterDropdown();
    updateDashboardMetrics();

    const container = elements.subjectsDashboardGrid;
    if (!container) return;
    container.innerHTML = "";

    if (state.subjects.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px 24px; max-width: 650px; margin: 30px auto;">
          <div style="font-size: 42px; margin-bottom: 12px;">📚</div>
          <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">No Subjects Added Yet</h3>
          <p class="text-muted" style="margin-bottom: 24px; font-size: 14px;">
            Import your university syllabus PDF (e.g. AKTU, VTU) or add subjects manually to start tracking your curriculum.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="showView('view-add-syllabus')">📄 Import Syllabus PDF</button>
            <button class="btn btn-outline" id="btn-empty-demo">⚡ Load Demo Syllabus</button>
          </div>
        </div>
      `;

      const emptyDemoBtn = container.querySelector("#btn-empty-demo");
      if (emptyDemoBtn && elements.btnPrefillDemo) {
        emptyDemoBtn.addEventListener("click", () => elements.btnPrefillDemo.click());
      }
      return;
    }

    const terms = getAcademicTerms();
    // Group subjects by academic term
    const semesterGroups = {};
    state.subjects.forEach((subj) => {
      const semKey = subj.semester ? `${terms.termName} ${subj.semester}` : "Core Subjects";
      if (!semesterGroups[semKey]) semesterGroups[semKey] = [];
      semesterGroups[semKey].push(subj);
    });

    const sortedSemKeys = Object.keys(semesterGroups).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "")) || 999;
      const numB = parseInt(b.replace(/\D/g, "")) || 999;
      return numA - numB;
    });

    // Responsive Column Count (Desktop: 3, Tablet: 2, Mobile: 1)
    const colCount = window.innerWidth <= 640 ? 1 : (window.innerWidth <= 1024 ? 2 : 3);

    const q = (state.searchQuery || "").trim().toLowerCase();
    const hasSearch = q.length > 0;
    let totalMatchingSubjects = 0;

    sortedSemKeys.forEach((semName) => {
      const subjsInGroup = semesterGroups[semName];
      const semNumber = semName.replace(/\D/g, "");
      const matchesDropdown = !state.selectedSemester || state.selectedSemester === "all" || String(state.selectedSemester) === String(semNumber) || state.selectedSemester === semName;

      // Filter subjects in this semester that match search query
      const matchingSubjsInGroup = subjsInGroup.filter((s) => {
        const sName = (s.name || s.title || "").toLowerCase();
        const sCode = (s.code || "").toLowerCase();
        return !hasSearch || sName.includes(q) || sCode.includes(q);
      });

      // Matching subjects remain visible even if they belong to a collapsed or filtered semester
      const shouldShowSemester = hasSearch ? (matchingSubjsInGroup.length > 0) : matchesDropdown;
      if (!shouldShowSemester) return;

      totalMatchingSubjects += matchingSubjsInGroup.length;

      const groupBlock = document.createElement("div");
      groupBlock.className = "semester-group-block";

      const semTotalTopics = subjsInGroup.reduce((acc, s) => acc + (s.topics ? s.topics.length : 0), 0);
      const semCompletedTopics = subjsInGroup.reduce((acc, s) => acc + (s.topics ? s.topics.filter((t) => t.completed).length : 0), 0);
      const semPercent = semTotalTopics > 0 ? Math.round((semCompletedTopics / semTotalTopics) * 100) : 0;

      // Semester collapse tracking
      if (state.collapsedSemesters[semName] === undefined) {
        state.collapsedSemesters[semName] = false;
      }
      // If user is searching and matches exist in this semester, ensure it remains expanded
      const isSemCollapsed = hasSearch ? false : state.collapsedSemesters[semName];

      const semHeader = document.createElement("div");
      semHeader.className = "semester-header-bar";
      semHeader.style.cursor = "pointer";
      semHeader.title = "Click to expand/collapse this semester";
      semHeader.innerHTML = `
        <h3 class="semester-title">
          <span>📚</span> ${escapeHtml(semName)}
          <span style="font-size: 12px; color: var(--text-muted); margin-left: 6px;">${isSemCollapsed ? "▼" : "▲"}</span>
        </h3>
        <div style="display: flex; gap: 12px; align-items: center;">
          <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">${hasSearch ? `${matchingSubjsInGroup.length}/${subjsInGroup.length} Matches` : `${subjsInGroup.length} Subjects`} &bull; ${semCompletedTopics}/${semTotalTopics} Done (${semPercent}%)</span>
          <span class="semester-badge">${semName}</span>
        </div>
      `;

      semHeader.addEventListener("click", () => {
        state.collapsedSemesters[semName] = !state.collapsedSemesters[semName];
        renderDashboard();
      });

      groupBlock.appendChild(semHeader);

      // TRUE MASONRY GRID WITH INDEPENDENT COLUMN STACKS
      const masonryGrid = document.createElement("div");
      masonryGrid.className = "dashboard-masonry-grid";
      masonryGrid.style.display = isSemCollapsed ? "none" : "flex";

      const columns = [];
      for (let c = 0; c < colCount; c++) {
        const colDiv = document.createElement("div");
        colDiv.className = "masonry-column";
        masonryGrid.appendChild(colDiv);
        columns.push(colDiv);
      }

      const displayedSubjs = hasSearch ? matchingSubjsInGroup : subjsInGroup;
      displayedSubjs.forEach((subject, subjIdx) => {
        const card = document.createElement("div");
        card.className = "card subject-dashboard-card";

        const totalTopics = subject.topics ? subject.topics.length : 0;
        const completedTopics = subject.topics ? subject.topics.filter((t) => t.completed).length : 0;
        const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

        // ALL SUBJECTS ARE COLLAPSED BY DEFAULT (true)
        if (state.collapsedSubjects[subject.id] === undefined) {
          state.collapsedSubjects[subject.id] = true;
        }
        const isCollapsed = state.collapsedSubjects[subject.id];

        let unitsHtml = "";
        if (subject.units && subject.units.length > 0) {
          unitsHtml = subject.units
            .map((unit, uIdx) => {
              const uNumber = unit.unitNumber || uIdx + 1;
              const uTitle = unit.unitTitle || `${terms.unitName} ${uNumber}`;
              const unitKey = `${subject.id}_u_${uNumber}`;
              if (state.collapsedUnits[unitKey] === undefined) {
                state.collapsedUnits[unitKey] = false;
              }
              const isUnitCollapsed = state.collapsedUnits[unitKey];

              const unitTopics = (subject.topics || []).filter((t) => {
                if (t.unitNumber !== undefined) return t.unitNumber === uNumber;
                if (t.unit !== undefined) return String(t.unit).includes(String(uNumber));
                return false;
              });

              const effectiveTopics = unitTopics.length > 0 ? unitTopics : (unit.topics || []);
              const uDone = effectiveTopics.filter((t) => t.completed).length;

              const topicRows = effectiveTopics
                .map((t) => renderTopicRow(subject, t))
                .join("");

              return `
                <div class="unit-block" data-unit-key="${unitKey}">
                  <div class="unit-header-bar" data-unit-toggle="${unitKey}">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span class="unit-number-pill">${terms.unitName} ${escapeHtml(uNumber)}</span>
                      <span class="unit-title-text">${escapeHtml(uTitle)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="unit-topic-count">${uDone}/${effectiveTopics.length} done</span>
                      <span style="font-size: 11px; color: var(--text-muted);">${isUnitCollapsed ? "▼" : "▲"}</span>
                    </div>
                  </div>
                  <div class="unit-topics-container" style="display: ${isUnitCollapsed ? "none" : "block"};">
                    ${topicRows || '<p class="text-muted" style="font-size: 12px; margin: 6px 0;">No topics in this unit.</p>'}
                  </div>
                </div>
              `;
            })
            .join("");
        } else {
          unitsHtml = (subject.topics || []).map((t) => renderTopicRow(subject, t)).join("");
        }

        const codeBadge = subject.code ? `<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #4f46e5; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">${escapeHtml(subject.code)}</span>` : "";

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 8px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                ${codeBadge}
                <h3 style="margin: 0; font-size: 17px; font-weight: 700;">${escapeHtml(subject.name || subject.title)}</h3>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
              <button type="button" class="btn btn-outline btn-sm toggle-collapse-btn" data-subj-id="${subject.id}" style="padding: 4px 10px; font-size: 12px;">
                ${isCollapsed ? "▼ Show" : "▲ Hide"}
              </button>
              <button type="button" class="btn-icon edit-subj-btn" data-subj-id="${subject.id}" title="Edit Subject &amp; Syllabus" style="border: none; background: transparent; cursor: pointer; font-size: 15px; padding: 4px;">✏️</button>
              <button type="button" class="delete-subj-btn" data-subj-id="${subject.id}" title="Delete Subject" style="color: #ef4444; border: none; background: transparent; cursor: pointer; font-size: 16px; padding: 4px;">🗑️</button>
            </div>
          </div>

          <div class="progress-text" style="margin: 8px 0 4px 0; font-size: 12px; font-weight: 600; display: flex; justify-content: space-between;">
            <span>Progress: ${completedTopics} of ${totalTopics} topics</span>
            <span style="color: #10b981;">${progressPercent}%</span>
          </div>
          <div style="background: rgba(226, 232, 240, 0.6); height: 7px; border-radius: 4px; overflow: hidden; margin-bottom: 14px;">
            <div class="progress-bar-fill" style="background: #10b981; height: 100%; width: ${progressPercent}%; transition: width 0.3s ease;"></div>
          </div>

          <div class="topics-wrapper" style="display: ${isCollapsed ? "none" : "block"};">
            ${unitsHtml}
          </div>
        `;

        // Accordion Toggle for Subject - Only this card grows, independent heights!
        const collapseBtn = card.querySelector(".toggle-collapse-btn");
        const topicsWrapper = card.querySelector(".topics-wrapper");
        collapseBtn.addEventListener("click", () => {
          const currentlyCollapsed = topicsWrapper.style.display === "none";
          topicsWrapper.style.display = currentlyCollapsed ? "block" : "none";
          collapseBtn.textContent = currentlyCollapsed ? "▲ Hide" : "▼ Show";
          state.collapsedSubjects[subject.id] = !currentlyCollapsed;
        });

        // Accordion Toggle for Units
        card.querySelectorAll("[data-unit-toggle]").forEach((uHeader) => {
          uHeader.addEventListener("click", () => {
            const unitKey = uHeader.getAttribute("data-unit-toggle");
            const unitBlock = card.querySelector(`[data-unit-key="${unitKey}"]`);
            if (unitBlock) {
              const uContainer = unitBlock.querySelector(".unit-topics-container");
              const isHidden = uContainer.style.display === "none";
              uContainer.style.display = isHidden ? "block" : "none";
              const arrow = uHeader.querySelector("span:last-child");
              if (arrow) arrow.textContent = isHidden ? "▲" : "▼";
              state.collapsedUnits[unitKey] = !isHidden;
            }
          });
        });

        // Completion Checkbox
        card.querySelectorAll(".topic-complete-toggle").forEach((cb) => {
          cb.addEventListener("change", (e) => {
            const tId = e.target.getAttribute("data-topic-id");
            const topic = findTopicById(subject, tId);
            if (topic) {
              topic.completed = e.target.checked;
              renderDashboard();
              apiSaveSyllabus();
            }
          });
        });

        // Weak Toggle
        card.querySelectorAll(".toggle-focus-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const tId = btn.getAttribute("data-topic-id");
            const topic = findTopicById(subject, tId);
            if (topic) {
              topic.needsFocus = !topic.needsFocus;
              renderDashboard();
              apiSaveSyllabus();
            }
          });
        });

        // Important Toggle
        card.querySelectorAll(".toggle-important-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const tId = btn.getAttribute("data-topic-id");
            const topic = findTopicById(subject, tId);
            if (topic) {
              topic.isImportant = !topic.isImportant;
              renderDashboard();
              apiSaveSyllabus();
            }
          });
        });

        // Subject Edit
        const editSubjBtn = card.querySelector(".edit-subj-btn");
        if (editSubjBtn) {
          editSubjBtn.addEventListener("click", () => {
            openEditSubjectModal(subject);
          });
        }

        // Subject Deletion
        card.querySelector(".delete-subj-btn").addEventListener("click", async () => {
          if (confirm(`Remove "${subject.name || subject.title}" from your syllabus?`)) {
            state.subjects = state.subjects.filter((s) => s.id !== subject.id);
            renderDashboard();
            await apiSaveSyllabus();
            showToast(`Removed ${subject.name || subject.title}`, "normal");
          }
        });

        // Distribute to the appropriate column
        columns[subjIdx % colCount].appendChild(card);
      });

      groupBlock.appendChild(masonryGrid);
      container.appendChild(groupBlock);
    });

    if (hasSearch && totalMatchingSubjects === 0) {
      container.innerHTML = `
        <div class="search-no-results">
          <p style="font-size: 32px; margin: 0 0 8px 0;">🔍</p>
          <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 700;">No subjects found matching "${escapeHtml(state.searchQuery)}"</h3>
          <p style="margin: 0; font-size: 14px; color: var(--text-muted);">Try a different keyword or clear your search to view all subjects.</p>
        </div>
      `;
    }
  }

  function renderTopicRow(subject, t) {
    return `
      <div class="topic-row-item">
        <div class="topic-row-main">
          <label class="topic-checkbox-label">
            <input type="checkbox" class="topic-complete-toggle" data-subj-id="${subject.id}" data-topic-id="${t.id}" ${t.completed ? "checked" : ""} />
            <span class="topic-label-text ${t.completed ? "completed-text" : ""}">
              ${escapeHtml(t.name)}
            </span>
          </label>
        </div>

        <div class="topic-actions-row">
          <button type="button" class="btn-icon toggle-focus-btn ${t.needsFocus ? "active-weak" : ""}" data-subj-id="${subject.id}" data-topic-id="${t.id}" title="Flag as Weak Topic">
            🔴 Weak
          </button>
          <button type="button" class="btn-icon toggle-important-btn ${t.isImportant ? "active-imp" : ""}" data-subj-id="${subject.id}" data-topic-id="${t.id}" title="Flag as Exam Important">
            ⭐ Imp
          </button>
        </div>
      </div>
    `;
  }

  /* ======================================================== */
  /* DUPLICATE SUBJECT DETECTION & MERGE MODAL LOGIC          */
  /* ======================================================== */
  function normalizeSubjectName(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/&/g, "and").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function isLabSubject(str) {
    return /\b(lab|laboratory|workshop|practical)\b/i.test(str || "");
  }

  function normalizeTopicName(str) {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/^(unit\s+[ivx\d]+[:\-.]?\s*|module\s+[\d]+[:\-.]?\s*|topic\s+[\d]+[:\-.]?\s*)/i, "")
      .replace(/&/g, "and")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function detectDuplicatesLocal(subjects) {
    const list = subjects || state.subjects;
    const candidates = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const s1 = list[i];
        const s2 = list[j];

        // 1. Same semester
        const sem1 = s1.semester || 3;
        const sem2 = s2.semester || 3;
        if (sem1 !== sem2) continue;

        // 2. Both lab or both theory
        const n1 = s1.name || s1.title || "";
        const n2 = s2.name || s2.title || "";
        if (isLabSubject(n1) !== isLabSubject(n2)) continue;

        // 3. Code conflict check
        const c1 = (s1.code || "").trim().toUpperCase();
        const c2 = (s2.code || "").trim().toUpperCase();
        if (c1 && c2 && c1 !== c2) continue;

        const norm1 = normalizeSubjectName(n1);
        const norm2 = normalizeSubjectName(n2);

        let isMatch = false;
        let reason = "";

        if (norm1 === norm2) {
          isMatch = true;
          reason = "Exact subject name match";
        } else if (c1 && c2 && c1 === c2) {
          isMatch = true;
          reason = `Matching course code (${c1})`;
        } else {
          const stops = new Set(["and", "the", "of", "in", "&"]);
          const w1 = new Set(norm1.split(" ").filter((w) => !stops.has(w) && w.length > 0));
          const w2 = new Set(norm2.split(" ").filter((w) => !stops.has(w) && w.length > 0));
          const intersection = new Set([...w1].filter((x) => w2.has(x)));
          const union = new Set([...w1, ...w2]);
          const jaccard = union.size > 0 ? intersection.size / union.size : 0;
          const isSubset = [...w1].every((x) => w2.has(x)) || [...w2].every((x) => w1.has(x));

          if (jaccard >= 0.65 || isSubset) {
            isMatch = true;
            reason = `High keyword overlap (${Math.round(jaccard * 100)}%)`;
          }
        }

        if (isMatch) {
          const t1Len = (s1.topics || []).length;
          const t2Len = (s2.topics || []).length;
          const keep = t1Len >= t2Len ? s1 : s2;
          const merge = t1Len >= t2Len ? s2 : s1;

          candidates.push({
            keepSubject: keep,
            mergeSubject: merge,
            reason: reason,
          });
        }
      }
    }
    return candidates;
  }

  function showMergeDuplicatesModal() {
    const duplicates = detectDuplicatesLocal(state.subjects);
    if (!duplicates || duplicates.length === 0) {
      showToast("No duplicate subjects detected in your syllabus!", "normal");
      return;
    }

    if (!elements.mergeDuplicatesList) return;
    elements.mergeDuplicatesList.innerHTML = "";

    duplicates.forEach((pair, idx) => {
      const keep = pair.keepSubject;
      const merge = pair.mergeSubject;

      const keepTopics = keep.topics || [];
      const mergeTopics = merge.topics || [];
      const keepNorms = new Set(keepTopics.map((t) => normalizeTopicName(t.name)));
      let overlapCount = 0;
      let uniqueMergeCount = 0;

      mergeTopics.forEach((t) => {
        if (keepNorms.has(normalizeTopicName(t.name))) {
          overlapCount++;
        } else {
          uniqueMergeCount++;
        }
      });

      const totalUnique = keepTopics.length + uniqueMergeCount;

      const card = document.createElement("div");
      card.className = "merge-pair-card";
      card.innerHTML = `
        <div class="merge-pair-header">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; margin: 0;">
            <input type="checkbox" class="merge-pair-checkbox" data-pair-idx="${idx}" checked style="width: 17px; height: 17px; cursor: pointer; accent-color: #6366f1;" />
            <span class="merge-pair-title">Merge Group #${idx + 1}: ${escapeHtml(keep.name || keep.title)}</span>
          </label>
          <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #4f46e5; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px;">
            ${escapeHtml(pair.reason)}
          </span>
        </div>

        <div class="merge-pair-body">
          <div class="merge-subject-box">
            <div style="font-weight: 700; color: #10b981; margin-bottom: 4px;">Primary (Keep)</div>
            <div style="font-weight: 600; font-size: 14px;">${escapeHtml(keep.name || keep.title)}</div>
            <div class="text-muted" style="margin-top: 4px;">
              Semester ${escapeHtml(keep.semester || 3)} &bull; ${keepTopics.length} Topics
              ${keep.code ? ` &bull; Code: ${escapeHtml(keep.code)}` : ""}
            </div>
          </div>

          <div class="merge-subject-box">
            <div style="font-weight: 700; color: #ef4444; margin-bottom: 4px;">Secondary (Merge Into Primary)</div>
            <div style="font-weight: 600; font-size: 14px;">${escapeHtml(merge.name || merge.title)}</div>
            <div class="text-muted" style="margin-top: 4px;">
              Semester ${escapeHtml(merge.semester || 3)} &bull; ${mergeTopics.length} Topics
              ${merge.code ? ` &bull; Code: ${escapeHtml(merge.code)}` : ""}
            </div>
          </div>
        </div>

        <div class="merge-preview-summary">
          <span><strong>Combined Result:</strong> ${totalUnique} unique topics (${overlapCount} duplicate topics consolidated, ${uniqueMergeCount} unique topics added)</span>
          <span style="color: #10b981; font-weight: 600;">✓ Progress preserved</span>
        </div>
      `;
      elements.mergeDuplicatesList.appendChild(card);
    });

    if (elements.modalMergeDuplicates) {
      elements.modalMergeDuplicates.style.display = "flex";
    }
  }

  async function executeMergeDuplicates() {
    if (!elements.btnConfirmMerge) return;
    elements.btnConfirmMerge.disabled = true;
    elements.btnConfirmMerge.textContent = "Merging...";

    try {
      const response = await fetch(`${API_BASE_URL}/merge-duplicates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: state.user.id,
          email: state.user.email,
        }),
      });
      const result = await response.json();

      if (result.success && result.subjects) {
        state.subjects = result.subjects;
        renderDashboard();
        showToast(result.message || "Duplicate subjects merged successfully!", "success");
        if (elements.modalMergeDuplicates) elements.modalMergeDuplicates.style.display = "none";
      } else {
        showToast(result.message || "Failed to merge duplicates.", "error");
      }
    } catch (err) {
      // Local fallback merge
      const duplicates = detectDuplicatesLocal(state.subjects);
      if (duplicates && duplicates.length > 0) {
        duplicates.forEach((pair) => {
          const keep = pair.keepSubject;
          const merge = pair.mergeSubject;

          const keepTopics = keep.topics || [];
          const mergeTopics = merge.topics || [];
          const keepNormMap = new Map();
          keepTopics.forEach((t) => keepNormMap.set(normalizeTopicName(t.name), t));

          mergeTopics.forEach((mt) => {
            const norm = normalizeTopicName(mt.name);
            if (keepNormMap.has(norm)) {
              const kt = keepNormMap.get(norm);
              kt.completed = kt.completed || mt.completed;
              kt.isImportant = kt.isImportant || mt.isImportant;
              kt.needsFocus = kt.needsFocus || mt.needsFocus;
            } else {
              keepTopics.push({ ...mt, id: `top_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` });
            }
          });

          keep.topics = keepTopics;
          state.subjects = state.subjects.filter((s) => s.id !== merge.id);
        });

        renderDashboard();
        await apiSaveSyllabus();
        showToast("Duplicate subjects merged successfully!", "success");
        if (elements.modalMergeDuplicates) elements.modalMergeDuplicates.style.display = "none";
      }
    } finally {
      if (elements.btnConfirmMerge) {
        elements.btnConfirmMerge.disabled = false;
        elements.btnConfirmMerge.textContent = "Confirm & Merge Duplicates";
      }
    }
  }

  // Duplicate Merge Listeners
  if (elements.btnOpenMergeModal) {
    elements.btnOpenMergeModal.addEventListener("click", showMergeDuplicatesModal);
  }
  if (elements.btnCloseMergeModal) {
    elements.btnCloseMergeModal.addEventListener("click", () => {
      if (elements.modalMergeDuplicates) elements.modalMergeDuplicates.style.display = "none";
    });
  }
  if (elements.btnCancelMerge) {
    elements.btnCancelMerge.addEventListener("click", () => {
      if (elements.modalMergeDuplicates) elements.modalMergeDuplicates.style.display = "none";
    });
  }
  if (elements.btnConfirmMerge) {
    elements.btnConfirmMerge.addEventListener("click", executeMergeDuplicates);
  }
  if (elements.modalMergeDuplicates) {
    elements.modalMergeDuplicates.addEventListener("click", (e) => {
      if (e.target === elements.modalMergeDuplicates) {
        elements.modalMergeDuplicates.style.display = "none";
      }
    });
  }

  // Responsive Masonry Resize Listener
  let resizeTimer = null;
  let lastColCount = window.innerWidth <= 640 ? 1 : (window.innerWidth <= 1024 ? 2 : 3);
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const currentCols = window.innerWidth <= 640 ? 1 : (window.innerWidth <= 1024 ? 2 : 3);
      if (currentCols !== lastColCount) {
        lastColCount = currentCols;
        renderDashboard();
      }
    }, 150);
  });

  function findTopicById(subject, topicId) {
    if (subject.topics) {
      const found = subject.topics.find((t) => String(t.id) === String(topicId));
      if (found) return found;
    }
    if (subject.units) {
      for (const u of subject.units) {
        if (u.topics) {
          const found = u.topics.find((t) => String(t.id) === String(topicId));
          if (found) return found;
        }
      }
    }
    return null;
  }

  /* NAVIGATION HOOKS */
  if (elements.btnOpenAddSubject) elements.btnOpenAddSubject.addEventListener("click", () => showView("view-add-syllabus"));
  if (elements.btnOpenTimetableGen) {
    elements.btnOpenTimetableGen.addEventListener("click", () => {
      if (state.subjects.length === 0) {
        showToast("Please add or import at least one subject first.", "error");
        return;
      }
      renderTodayTopicSelector();
      if (state.currentSchedule && state.currentSchedule.length > 0) {
        renderTimetable();
      }
      showView("view-generate-timetable");
    });
  }


  /* ======================================================== */
  /* DEMO DATA PREFILL FOR DASHBOARD                          */
  /* ======================================================== */
  if (elements.btnPrefillDemo) {
    elements.btnPrefillDemo.addEventListener("click", async () => {
      if (elements.btnPrefillDemo.disabled) return;
      const origText = elements.btnPrefillDemo.innerHTML;
      elements.btnPrefillDemo.disabled = true;
      elements.btnPrefillDemo.innerHTML = "<span>⏳</span> Loading AKTU...";

      try {
        const resp = await fetch(`${API_BASE_URL}/load-demo-curriculum`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: state.user ? state.user.id : null,
            email: state.user ? state.user.email : null,
          }),
        });
        const result = await resp.json();
        if (result.success) {
          if (result.user && (!state.user || !state.user.id)) {
            state.user = { ...state.user, ...result.user };
            try {
              localStorage.setItem("cognify_user", JSON.stringify(state.user));
            } catch (_) {}
          }
          state.subjects = result.subjects || [];
          if (!state.collapsedSubjects) state.collapsedSubjects = {};
          state.subjects.forEach((s) => {
            if (state.collapsedSubjects[s.id] === undefined) {
              state.collapsedSubjects[s.id] = true;
            }
          });
          renderDashboard();
          renderTodayTopicSelector();
          showDashboard();
          showToast("Loaded verified AKTU B.Tech CS/IT curriculum!", "success");
        } else {
          showToast(result.message || "Failed to load demo curriculum.", "error");
        }
      } catch (err) {
        showToast("Error loading demo data: " + err.message, "error");
      } finally {
        if (elements.btnPrefillDemo) {
          elements.btnPrefillDemo.disabled = false;
          elements.btnPrefillDemo.innerHTML = origText;
        }
      }
    });
  }

  /* ======================================================== */
  /* MULTI-PDF UPLOAD & FILE PICKER                           */
  /* ======================================================== */
  let selectedPdfFiles = [];

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function renderSelectedPDFList() {
    if (!elements.pdfSelectedFilesList) return;
    elements.pdfSelectedFilesList.innerHTML = "";

    if (selectedPdfFiles.length === 0) {
      if (elements.btnStartMultiUpload) elements.btnStartMultiUpload.style.display = "none";
      if (elements.pdfPromptTitle) elements.pdfPromptTitle.textContent = "Drag & Drop Syllabus PDF(s) Here";
      return;
    }

    if (elements.pdfPromptTitle) {
      elements.pdfPromptTitle.textContent = `${selectedPdfFiles.length} File${selectedPdfFiles.length > 1 ? "s" : ""} Selected`;
    }

    selectedPdfFiles.forEach((file, idx) => {
      const row = document.createElement("div");
      row.className = "selected-pdf-item";
      row.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; font-size: 13px;";
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span>📄</span>
          <strong style="color: var(--text-main);">${escapeHtml(file.name)}</strong>
          <span style="color: var(--text-muted); font-size: 11.5px;">(${formatFileSize(file.size)})</span>
        </div>
        <button type="button" class="btn btn-text btn-sm remove-pdf-btn" data-file-idx="${idx}" style="color: #ef4444; font-size: 16px; line-height: 1; padding: 2px 6px;" title="Remove this file">&times;</button>
      `;
      row.querySelector(".remove-pdf-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        selectedPdfFiles.splice(idx, 1);
        renderSelectedPDFList();
      });
      elements.pdfSelectedFilesList.appendChild(row);
    });

    if (elements.btnStartMultiUpload) {
      elements.btnStartMultiUpload.style.display = "inline-flex";
      elements.btnStartMultiUpload.innerHTML = `⚡ Extract from ${selectedPdfFiles.length} Selected File${selectedPdfFiles.length > 1 ? "s" : ""}`;
    }
  }

  function addFilesToSelection(files) {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        showToast(`Skipped "${file.name}": Only PDF files are supported.`, "error");
        continue;
      }
      if (selectedPdfFiles.length >= 3) {
        showToast("Maximum 3 PDF files can be uploaded simultaneously.", "error");
        break;
      }
      const isDuplicate = selectedPdfFiles.some((f) => f.name === file.name && f.size === file.size);
      if (!isDuplicate) {
        selectedPdfFiles.push(file);
      }
    }
    renderSelectedPDFList();
  }

  if (elements.btnSelectPdfTrigger && elements.pdfFileInput) {
    elements.btnSelectPdfTrigger.addEventListener("click", () => {
      elements.pdfFileInput.click();
    });
  }

  if (elements.pdfFileInput) {
    elements.pdfFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        addFilesToSelection(e.target.files);
      }
      elements.pdfFileInput.value = "";
    });
  }

  if (elements.pdfDropzone) {
    elements.pdfDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      elements.pdfDropzone.style.borderColor = "#6366f1";
      elements.pdfDropzone.style.background = "rgba(99, 102, 241, 0.08)";
    });

    elements.pdfDropzone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      elements.pdfDropzone.style.borderColor = "";
      elements.pdfDropzone.style.background = "";
    });

    elements.pdfDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      elements.pdfDropzone.style.borderColor = "";
      elements.pdfDropzone.style.background = "";
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFilesToSelection(e.dataTransfer.files);
      }
    });
  }

  if (elements.btnStartMultiUpload) {
    elements.btnStartMultiUpload.addEventListener("click", async () => {
      if (selectedPdfFiles.length === 0) {
        showToast("Please select at least one syllabus PDF file.", "error");
        return;
      }

      elements.btnStartMultiUpload.disabled = true;
      const origHtml = elements.btnStartMultiUpload.innerHTML;
      elements.btnStartMultiUpload.innerHTML = '<span>⏳</span> Parsing & Extracting Syllabus...';
      if (elements.pdfPromptTitle) elements.pdfPromptTitle.textContent = "⏳ Parsing & Extracting Units from PDF(s)...";

      const formData = new FormData();
      selectedPdfFiles.forEach((file) => {
        formData.append("files", file);
      });

      try {
        const response = await fetch(`${API_BASE_URL}/upload-syllabus-pdf`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();
        const extractedSubjects = result.subjects || (result.data && result.data.subjects);

        if (result.success && extractedSubjects && extractedSubjects.length > 0) {
          state.pendingExtraction = {
            subjects: extractedSubjects,
            pagesProcessed: result.pagesProcessed || 0,
            warnings: result.warnings || [],
            filename: result.filename || selectedPdfFiles.map((f) => f.name).join(", "),
            pdfUrl: result.pdfUrl || "",
            diagnostics: result.diagnostics || {},
          };

          renderExtractionReviewScreen(state.pendingExtraction);
          showView("view-extraction-review");
          showToast(`Parsed ${extractedSubjects.length} subjects! Please review before saving.`, "success");

          selectedPdfFiles = [];
          renderSelectedPDFList();
        } else {
          showToast(result.error || result.message || "No subjects could be extracted from the uploaded PDF(s).", "error");
        }
      } catch (err) {
        console.error("PDF upload error:", err);
        showToast("PDF parsing connection error: " + err.message, "error");
      } finally {
        if (elements.btnStartMultiUpload) {
          elements.btnStartMultiUpload.disabled = false;
          elements.btnStartMultiUpload.innerHTML = origHtml;
        }
        if (elements.pdfPromptTitle) {
          elements.pdfPromptTitle.textContent = selectedPdfFiles.length > 0
            ? `${selectedPdfFiles.length} File${selectedPdfFiles.length > 1 ? "s" : ""} Selected`
            : "Drag & Drop Syllabus PDF(s) Here";
        }
      }
    });
  }

  /* ======================================================== */
  /* EXTRACTION REVIEW SCREEN                                 */
  /* ======================================================== */
  function renderExtractionReviewScreen(extractionData) {
    if (!extractionData || !extractionData.subjects) return;

    const subjects = extractionData.subjects;
    let totalUnits = 0;
    let totalTopics = 0;

    subjects.forEach((s) => {
      if (s.units && Array.isArray(s.units)) totalUnits += s.units.length;
      if (s.topics && Array.isArray(s.topics)) totalTopics += s.topics.length;
    });

    if (elements.reviewStatSubjects) elements.reviewStatSubjects.textContent = subjects.length;
    if (elements.reviewStatUnits) elements.reviewStatUnits.textContent = totalUnits;
    if (elements.reviewStatTopics) elements.reviewStatTopics.textContent = totalTopics;
    if (elements.reviewStatPages) elements.reviewStatPages.textContent = extractionData.pagesProcessed || totalUnits * 2 || 1;

    const pdfFilenameEl = document.getElementById("review-pdf-filename");
    if (pdfFilenameEl) {
      pdfFilenameEl.textContent = extractionData.filename || "syllabus.pdf";
    }
    const pdfIframe = document.getElementById("review-pdf-iframe");
    if (pdfIframe) {
      pdfIframe.src = extractionData.pdfUrl || "about:blank";
    }

    if (elements.reviewWarningsBox) {
      if (extractionData.warnings && extractionData.warnings.length > 0) {
        elements.reviewWarningsBox.style.display = "block";
        elements.reviewWarningsBox.innerHTML = `<strong>⚠️ Extraction Notes:</strong> ${extractionData.warnings.map(escapeHtml).join("; ")}`;
      } else {
        elements.reviewWarningsBox.style.display = "none";
      }
    }

    const container = elements.reviewSubjectsContainer;
    if (!container) return;
    container.innerHTML = "";

    subjects.forEach((subj, sIdx) => {
      const card = document.createElement("div");
      card.className = "review-subject-card card";
      card.setAttribute("data-review-idx", sIdx);
      card.style.cssText = "padding: 16px; margin-bottom: 14px; border: 1px solid var(--border-color); border-radius: 10px;";

      const semBadge = subj.semester ? `<span class="semester-badge" style="font-size: 11.5px;">Semester ${subj.semester}</span>` : "";
      const codeBadge = subj.code ? `<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #4f46e5; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">${escapeHtml(subj.code)}</span>` : "";
      const dupBadge = subj.hasDuplicateIn ? `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; font-size: 11.5px; padding: 2px 6px; border-radius: 4px;">⚠️ Duplicate in ${escapeHtml(subj.hasDuplicateIn)}</span>` : "";

      let unitsMarkup = "";
      if (subj.units && subj.units.length > 0) {
        unitsMarkup = subj.units
          .map((unit, uIdx) => {
            const uNumber = unit.unitNumber || uIdx + 1;
            const uTitle = unit.unitTitle || `Unit ${uNumber}`;
            const unitTopics = unit.topics || [];

            const chips = unitTopics
              .map((t, tIdx) => {
                const tName = typeof t === "string" ? t : (t.name || "");
                return `
                  <span class="review-chip" data-topic-chip="${sIdx}_${uIdx}_${tIdx}" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 20px; font-size: 12px; margin: 3px;">
                    <span>${escapeHtml(tName)}</span>
                    <button type="button" class="remove-chip-btn" data-remove-chip="${sIdx}_${uIdx}_${tIdx}" title="Remove topic" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 14px; padding: 0; line-height: 1;">&times;</button>
                  </span>
                `;
              })
              .join("");

            return `
              <div class="review-unit-item" style="margin-top: 10px; padding: 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 8px; flex-wrap: wrap;">
                  <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                    <span class="unit-number-pill" style="font-size: 11.5px; font-weight: 700; padding: 2px 8px; background: rgba(99, 102, 241, 0.12); color: #4f46e5; border-radius: 4px;">Unit ${escapeHtml(uNumber)}</span>
                    <input type="text" class="review-unit-heading-input form-control form-control-sm" data-unit-heading="${sIdx}_${uIdx}" value="${escapeHtml(uTitle)}" placeholder="Unit Heading" style="max-width: 320px;" />
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" class="btn btn-text btn-sm add-unit-topic-btn" data-add-topic="${sIdx}_${uIdx}" style="font-size: 12px; color: #6366f1;">+ Add Topic</button>
                    <button type="button" class="btn btn-text btn-sm remove-unit-btn" data-remove-unit="${sIdx}_${uIdx}" style="font-size: 12px; color: #ef4444;">Remove Unit</button>
                  </div>
                </div>
                <div class="review-topic-chips" style="display: flex; flex-wrap: wrap; gap: 4px;">
                  ${chips}
                </div>
              </div>
            `;
          })
          .join("");
      } else {
        const flatChips = (subj.topics || [])
          .map((t, tIdx) => {
            const tName = typeof t === "string" ? t : (t.name || "");
            return `
              <span class="review-chip" data-topic-chip="${sIdx}_flat_${tIdx}" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 20px; font-size: 12px; margin: 3px;">
                <span>${escapeHtml(tName)}</span>
                <button type="button" class="remove-chip-btn" data-remove-chip="${sIdx}_flat_${tIdx}" title="Remove topic" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 14px; padding: 0; line-height: 1;">&times;</button>
              </span>
            `;
          })
          .join("");
        unitsMarkup = `<div class="review-topic-chips" style="display: flex; flex-wrap: wrap; gap: 4px;">${flatChips}</div>`;
      }

      card.innerHTML = `
        <div class="review-card-header" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; flex-wrap: wrap;">
            ${codeBadge}
            ${semBadge}
            ${dupBadge}
            <input type="text" class="review-subject-input form-control" data-subj-title-input="${sIdx}" value="${escapeHtml(subj.name || subj.title)}" placeholder="Subject Name" style="font-weight: 700; flex: 1; min-width: 200px;" />
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn btn-outline btn-sm add-subj-unit-btn" data-add-unit="${sIdx}">+ Add Unit</button>
            <button type="button" class="btn btn-outline btn-sm delete-review-subj-btn" data-remove-subj="${sIdx}" style="color: #ef4444;">Remove Subject</button>
          </div>
        </div>
        <div class="review-units-list">
          ${unitsMarkup}
        </div>
      `;

      card.querySelectorAll(".remove-chip-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const chipKey = btn.getAttribute("data-remove-chip");
          const chipEl = card.querySelector(`[data-topic-chip="${chipKey}"]`);
          if (chipEl) chipEl.remove();
        });
      });

      card.querySelectorAll(".remove-unit-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const uItem = btn.closest(".review-unit-item");
          if (uItem) uItem.remove();
        });
      });

      card.querySelectorAll(".add-unit-topic-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const title = prompt("Enter topic title:");
          if (title && title.trim()) {
            const uItem = btn.closest(".review-unit-item");
            const chipsCont = uItem?.querySelector(".review-topic-chips");
            if (chipsCont) {
              const chip = document.createElement("span");
              chip.className = "review-chip";
              chip.style.cssText = "display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 20px; font-size: 12px; margin: 3px;";
              chip.innerHTML = `
                <span>${escapeHtml(title.trim())}</span>
                <button type="button" class="remove-chip-btn" title="Remove topic" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 14px; padding: 0; line-height: 1;">&times;</button>
              `;
              chip.querySelector(".remove-chip-btn").addEventListener("click", () => chip.remove());
              chipsCont.appendChild(chip);
            }
          }
        });
      });

      const addUnitBtn = card.querySelector(".add-subj-unit-btn");
      if (addUnitBtn) {
        addUnitBtn.addEventListener("click", () => {
          const uList = card.querySelector(".review-units-list");
          if (uList) {
            const newUIdx = uList.querySelectorAll(".review-unit-item").length + 1;
            const newUItem = document.createElement("div");
            newUItem.className = "review-unit-item";
            newUItem.style.cssText = "margin-top: 10px; padding: 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px;";
            newUItem.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 8px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                  <span class="unit-number-pill" style="font-size: 11.5px; font-weight: 700; padding: 2px 8px; background: rgba(99, 102, 241, 0.12); color: #4f46e5; border-radius: 4px;">Unit ${newUIdx}</span>
                  <input type="text" class="review-unit-heading-input form-control form-control-sm" value="Unit ${newUIdx}" placeholder="Unit Heading" style="max-width: 320px;" />
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button type="button" class="btn btn-text btn-sm add-unit-topic-btn" style="font-size: 12px; color: #6366f1;">+ Add Topic</button>
                  <button type="button" class="btn btn-text btn-sm remove-unit-btn" style="font-size: 12px; color: #ef4444;">Remove Unit</button>
                </div>
              </div>
              <div class="review-topic-chips" style="display: flex; flex-wrap: wrap; gap: 4px;"></div>
            `;
            newUItem.querySelector(".remove-unit-btn").addEventListener("click", () => newUItem.remove());
            newUItem.querySelector(".add-unit-topic-btn").addEventListener("click", () => {
              const title = prompt("Enter topic title:");
              if (title && title.trim()) {
                const chipsCont = newUItem.querySelector(".review-topic-chips");
                const chip = document.createElement("span");
                chip.className = "review-chip";
                chip.style.cssText = "display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 20px; font-size: 12px; margin: 3px;";
                chip.innerHTML = `
                  <span>${escapeHtml(title.trim())}</span>
                  <button type="button" class="remove-chip-btn" title="Remove topic" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 14px; padding: 0; line-height: 1;">&times;</button>
                `;
                chip.querySelector(".remove-chip-btn").addEventListener("click", () => chip.remove());
                chipsCont.appendChild(chip);
              }
            });
            uList.appendChild(newUItem);
          }
        });
      }

      card.querySelector(".delete-review-subj-btn").addEventListener("click", () => {
        card.remove();
        showToast("Subject removed from review list.", "normal");
      });

      container.appendChild(card);
    });
  }

  // Add Subject button in Review Screen
  const btnAddReviewSubject = document.getElementById("btn-add-review-subject");
  if (btnAddReviewSubject && elements.reviewSubjectsContainer) {
    btnAddReviewSubject.addEventListener("click", () => {
      const sName = prompt("Enter new subject name:", "New Subject");
      if (sName && sName.trim()) {
        const dummySubj = {
          name: sName.trim(),
          title: sName.trim(),
          code: "",
          semester: 3,
          units: [{ unitNumber: 1, unitTitle: "Unit 1", topics: ["Introduction"] }],
          topics: [{ name: "Introduction", needsFocus: false, isImportant: false, completed: false }]
        };
        if (!state.pendingExtraction) state.pendingExtraction = { subjects: [] };
        if (!state.pendingExtraction.subjects) state.pendingExtraction.subjects = [];
        state.pendingExtraction.subjects.push(dummySubj);
        renderExtractionReviewScreen(state.pendingExtraction);
        showToast(`Added ${sName.trim()} to review list!`, "success");
      }
    });
  }

  // Save Draft button in Review Screen
  const btnSaveDraft = document.getElementById("btn-save-draft");
  if (btnSaveDraft) {
    btnSaveDraft.addEventListener("click", async () => {
      if (!state.pendingExtraction) {
        showToast("No active extraction review to save.", "error");
        return;
      }
      try {
        localStorage.setItem("cognify_review_draft", JSON.stringify(state.pendingExtraction));
        showToast("Review draft saved! You can resume it anytime.", "success");
      } catch (err) {
        showToast("Failed to save review draft: " + err.message, "error");
      }
    });
  }

  // Confirm and Save Reviewed Syllabus to Dashboard
  if (elements.btnConfirmReview) {
    elements.btnConfirmReview.addEventListener("click", async () => {
      if (!state.pendingExtraction) return;

      const reviewCards = elements.reviewSubjectsContainer ? elements.reviewSubjectsContainer.querySelectorAll(".review-subject-card") : [];
      if (reviewCards.length === 0) {
        showToast("No subjects to confirm.", "error");
        return;
      }

      elements.btnConfirmReview.disabled = true;
      elements.btnConfirmReview.textContent = "Saving to Hub...";

      try {
        const confirmedSubjects = [];

        reviewCards.forEach((card, cIdx) => {
          const sIdx = parseInt(card.getAttribute("data-review-idx"));
          const originalSubj = (state.pendingExtraction && state.pendingExtraction.subjects && state.pendingExtraction.subjects[sIdx]) || {};

          const titleInput = card.querySelector(`[data-subj-title-input="${sIdx}"]`) || card.querySelector(".review-subject-input");
          const finalName = titleInput ? titleInput.value.trim() : originalSubj.name || originalSubj.title || `Subject ${cIdx + 1}`;

          const finalUnits = [];
          const finalTopics = [];

          const unitItems = card.querySelectorAll(".review-unit-item");
          if (unitItems.length > 0) {
            unitItems.forEach((uItem, uIdx) => {
              const headingInput = uItem.querySelector(".review-unit-heading-input");
              const finalUnitTitle = headingInput ? headingInput.value.trim() : `Unit ${uIdx + 1}`;
              const unitNumber = uIdx + 1;

              const chips = uItem.querySelectorAll(".review-chip");
              const unitTopicList = [];

              chips.forEach((chip) => {
                const chipSpan = chip.querySelector("span");
                const chipText = chipSpan ? chipSpan.textContent.trim() : "";
                if (chipText) {
                  const topicObj = {
                    id: "top_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
                    name: chipText,
                    unitNumber: unitNumber,
                    unitTitle: finalUnitTitle,
                    needsFocus: false,
                    isImportant: false,
                    completed: false,
                  };
                  unitTopicList.push(topicObj);
                  finalTopics.push(topicObj);
                }
              });

              finalUnits.push({
                unitNumber: unitNumber,
                unitTitle: finalUnitTitle,
                topics: unitTopicList,
              });
            });
          } else {
            const chips = card.querySelectorAll(".review-chip");
            chips.forEach((chip) => {
              const chipSpan = chip.querySelector("span");
              const chipText = chipSpan ? chipSpan.textContent.trim() : "";
              if (chipText) {
                finalTopics.push({
                  id: "top_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
                  name: chipText,
                  needsFocus: false,
                  isImportant: false,
                  completed: false,
                });
              }
            });
          }

          confirmedSubjects.push({
            id: "subj_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
            name: finalName,
            title: finalName,
            code: originalSubj.code || "",
            semester: originalSubj.semester || 3,
            units: finalUnits,
            topics: finalTopics,
          });
        });

        confirmedSubjects.forEach((newSubj) => {
          const existingIdx = state.subjects.findIndex(
            (s) => (s.code && newSubj.code && s.code.toUpperCase() === newSubj.code.toUpperCase()) || s.name.toLowerCase() === newSubj.name.toLowerCase()
          );
          if (existingIdx >= 0) {
            const oldSubj = state.subjects[existingIdx];
            newSubj.topics.forEach((nt) => {
              const matchOld = oldSubj.topics.find((ot) => ot.name.toLowerCase() === nt.name.toLowerCase());
              if (matchOld) {
                nt.completed = matchOld.completed;
                nt.needsFocus = matchOld.needsFocus;
                nt.isImportant = matchOld.isImportant;
              }
            });
            state.subjects[existingIdx] = newSubj;
          } else {
            state.subjects.push(newSubj);
          }
        });

        state.pendingExtraction = null;
        await apiSaveSyllabus();
        renderDashboard();
        renderTodayTopicSelector();
        showToast(`Saved ${confirmedSubjects.length} subjects to dashboard!`, "success");
        showDashboard();
      } catch (err) {
        showToast("Error saving reviewed syllabus: " + err.message, "error");
      } finally {
        if (elements.btnConfirmReview) {
          elements.btnConfirmReview.disabled = false;
          elements.btnConfirmReview.textContent = "Confirm & Save to Dashboard";
        }
      }
    });
  }

  if (elements.btnDiscardReview) {
    elements.btnDiscardReview.addEventListener("click", () => {
      state.pendingExtraction = null;
      showToast("Extraction discarded.", "normal");
      showDashboard();
    });
  }

  // Mobile Review Tab Toggling
  const tabReviewSyllabus = document.getElementById("tab-review-syllabus");
  const tabReviewPdf = document.getElementById("tab-review-pdf");
  const panelReviewSyllabus = document.getElementById("panel-review-syllabus");
  const panelReviewPdf = document.getElementById("panel-review-pdf");

  if (tabReviewSyllabus && tabReviewPdf && panelReviewSyllabus && panelReviewPdf) {
    tabReviewSyllabus.addEventListener("click", () => {
      tabReviewSyllabus.classList.add("btn-primary");
      tabReviewSyllabus.classList.remove("btn-outline");
      tabReviewPdf.classList.add("btn-outline");
      tabReviewPdf.classList.remove("btn-primary");
      panelReviewSyllabus.style.display = "block";
      panelReviewPdf.style.display = "none";
    });

    tabReviewPdf.addEventListener("click", () => {
      tabReviewPdf.classList.add("btn-primary");
      tabReviewPdf.classList.remove("btn-outline");
      tabReviewSyllabus.classList.add("btn-outline");
      tabReviewSyllabus.classList.remove("btn-primary");
      panelReviewPdf.style.display = "block";
      panelReviewSyllabus.style.display = "none";
    });
  }

  /* ======================================================== */
  /* MANUAL SUBJECT CREATION                                   */
  /* ======================================================== */
  if (elements.btnAddTopicField && elements.topicInputsContainer) {
    elements.btnAddTopicField.addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "topic-input-row";
      row.innerHTML = `
        <input type="text" class="topic-name-input form-control" placeholder="Topic title" required />
        <label class="badge-label"><input type="checkbox" class="topic-focus-checkbox" /> 🔴 Weak</label>
        <label class="badge-label"><input type="checkbox" class="topic-important-checkbox" /> ⭐ Imp</label>
        <button type="button" class="btn btn-text btn-sm remove-topic-btn" style="color: #ef4444; margin-left: 4px;">✕</button>
      `;
      row.querySelector(".remove-topic-btn").addEventListener("click", () => row.remove());
      elements.topicInputsContainer.appendChild(row);
    });
  }

  if (elements.addSubjectForm) {
    elements.addSubjectForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const sName = elements.subjectNameInput ? elements.subjectNameInput.value.trim() : "";
      const sCode = elements.subjectCodeInput ? elements.subjectCodeInput.value.trim().toUpperCase() : "";
      const sSem = elements.subjectSemesterInput ? parseInt(elements.subjectSemesterInput.value) || 3 : 3;

      if (!sName) {
        showToast("Please enter a subject title.", "error");
        return;
      }

      const rows = elements.topicInputsContainer ? elements.topicInputsContainer.querySelectorAll(".topic-input-row") : [];
      const topics = [];
      rows.forEach((row) => {
        const nameInput = row.querySelector(".topic-name-input");
        const focusCb = row.querySelector(".topic-focus-checkbox");
        const impCb = row.querySelector(".topic-important-checkbox");
        const tName = nameInput ? nameInput.value.trim() : "";
        if (tName) {
          topics.push({
            id: "top_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
            name: tName,
            needsFocus: focusCb ? focusCb.checked : false,
            isImportant: impCb ? impCb.checked : false,
            completed: false,
          });
        }
      });

      if (topics.length === 0) {
        showToast("Please add at least one topic.", "error");
        return;
      }

      state.subjects.push({
        id: "subj_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
        name: sName,
        title: sName,
        code: sCode,
        semester: sSem,
        units: [{ unitNumber: 1, unitTitle: "Core Topics", topics: topics }],
        topics: topics,
      });

      if (elements.subjectNameInput) elements.subjectNameInput.value = "";
      if (elements.subjectCodeInput) elements.subjectCodeInput.value = "";
      if (elements.topicInputsContainer) {
        elements.topicInputsContainer.innerHTML = `
          <div class="topic-input-row">
            <input type="text" class="topic-name-input form-control" placeholder="Topic title" required />
            <label class="badge-label"><input type="checkbox" class="topic-focus-checkbox" /> 🔴 Weak</label>
            <label class="badge-label"><input type="checkbox" class="topic-important-checkbox" /> ⭐ Imp</label>
          </div>
        `;
      }

      await apiSaveSyllabus();
      renderDashboard();
      renderTodayTopicSelector();
      showToast(`Added ${sName}!`, "success");
      showDashboard();
    });
  }

  /* ======================================================== */
  /* PHASE 3: HIERARCHICAL TOPIC SELECTOR FOR TIMETABLE       */
  /* ======================================================== */
  function updateTimetableSelectionSummary() {
    const selTopicCount = state.timetableSelection.selectedTopics.size;
    let activeSubjCount = 0;
    (state.subjects || []).forEach((s) => {
      const hasChosen = (s.topics || []).some((t) => state.timetableSelection.selectedTopics.has(t.id));
      if (hasChosen) activeSubjCount++;
    });

    if (elements.timetableSelectionSummary) {
      elements.timetableSelectionSummary.textContent = `${activeSubjCount} subjects selected • ${selTopicCount} topics selected`;
    }

    if (elements.btnSubmitTimetable) {
      if (selTopicCount === 0) {
        elements.btnSubmitTimetable.disabled = true;
        elements.btnSubmitTimetable.textContent = "⚡ Select Topics Above to Generate Timetable";
      } else {
        elements.btnSubmitTimetable.disabled = false;
        elements.btnSubmitTimetable.textContent = `⚡ Generate AI Timetable (${selTopicCount} Topics Selected)`;
      }
    }
  }

  function renderTodayTopicSelector() {
    const container = elements.todayTopicSelector;
    if (!container) return;
    container.innerHTML = "";

    if (state.subjects.length === 0) {
      container.innerHTML = `<p class="text-muted" style="padding: 16px; text-align: center;">No subjects in syllabus. Please add subjects first.</p>`;
      updateTimetableSelectionSummary();
      return;
    }

    state.subjects.forEach((subject) => {
      const card = document.createElement("div");
      // Initial view: Show only subject cards, collapsed by default
      card.className = "subject-select-card";
      card.setAttribute("data-subj-id", subject.id);

      const totalSubjTopics = subject.topics ? subject.topics.length : 0;
      const codeBadge = subject.code ? `<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #4f46e5; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 5px;">${escapeHtml(subject.code)}</span>` : "";
      const semBadge = subject.semester ? `<span style="font-size: 11.5px; color: var(--text-muted);">Sem ${subject.semester}</span>` : "";

      // Header row: Subject Checkbox, title, and Topics button with right-side up arrow
      const header = document.createElement("div");
      header.className = "subject-select-header";
      header.innerHTML = `
        <div class="subject-select-title-group" style="display: flex; align-items: center; gap: 12px; flex: 1;">
          <input type="checkbox" class="subject-checkbox" data-subj-id="${subject.id}" style="width: 18px; height: 18px; cursor: pointer; accent-color: #6366f1;" />
          <div style="cursor: pointer;" class="subject-title-clickable">
            <div style="font-weight: 700; font-size: 15px; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
              ${codeBadge}
              <span>${escapeHtml(subject.name || subject.title)}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              ${semBadge} &bull; ${totalSubjTopics} total topics available
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button type="button" class="subject-expand-btn" aria-label="Expand or collapse subject units" style="background: rgba(99, 102, 241, 0.08); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; padding: 6px 12px; font-size: 13px; font-weight: 600; color: #4f46e5; display: flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
            <span>Topics</span>
            <span class="subject-expand-arrow">▼</span>
          </button>
        </div>
      `;

      // Collapsible body containing unit blocks
      const collapsible = document.createElement("div");
      collapsible.className = "subject-topics-collapsible";

      // Controls Bar: Select All in Subject
      const controlsBar = document.createElement("div");
      controlsBar.className = "subject-controls-bar";
      controlsBar.innerHTML = `
        <span>Select individual topics or select all:</span>
        <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 600; color: #6366f1;">
          <input type="checkbox" class="select-all-subject-topics" data-subj-id="${subject.id}" style="accent-color: #6366f1;" />
          <span>Select All (${totalSubjTopics})</span>
        </label>
      `;
      collapsible.appendChild(controlsBar);

      // Render Units (collapsed by default: show units but keep topics hidden)
      if (subject.units && subject.units.length > 0) {
        subject.units.forEach((unit, uIdx) => {
          const uNumber = unit.unitNumber || uIdx + 1;
          const uTitle = unit.unitTitle || `Unit ${uNumber}`;

          const unitTopics = (subject.topics || []).filter((t) => {
            if (t.unitNumber !== undefined) return t.unitNumber === uNumber;
            if (t.unit !== undefined) return String(t.unit).includes(String(uNumber));
            return false;
          });
          const effectiveTopics = unitTopics.length > 0 ? unitTopics : (unit.topics || []);

          // Notice: NOT tt-unit-expanded initially! Topics remain hidden when subject expands.
          const unitBlock = document.createElement("div");
          unitBlock.className = "unit-select-block";

          const unitHeader = document.createElement("div");
          unitHeader.className = "unit-select-header";
          unitHeader.innerHTML = `
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; flex: 1;">
              <input type="checkbox" class="unit-select-all-checkbox" data-subj-id="${subject.id}" data-unit-num="${uNumber}" style="width: 16px; height: 16px; accent-color: #6366f1;" />
              <span class="unit-number-pill" style="background: rgba(99, 102, 241, 0.12); color: #4f46e5; font-size: 11px; padding: 2px 7px; border-radius: 4px;">Unit ${uNumber}</span>
              <span>${escapeHtml(uTitle)}</span>
            </label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 11.5px; color: var(--text-muted);">${effectiveTopics.length} topics</span>
              <button type="button" class="unit-expand-btn" aria-label="Toggle unit topics" style="background: none; border: none; cursor: pointer; font-size: 11px; color: var(--text-muted); padding: 4px; display: inline-flex; align-items: center;">
                <span class="unit-expand-arrow">▼</span>
              </button>
            </div>
          `;
          unitBlock.appendChild(unitHeader);

          const topicsList = document.createElement("div");
          topicsList.className = "unit-select-topics-list";

          effectiveTopics.forEach((t) => {
            const isTopicSelected = state.timetableSelection.selectedTopics.has(t.id);
            const weakBadge = t.needsFocus ? '<span style="color:#ef4444; font-size:11px; margin-left:6px; font-weight:600;">🔴 Weak</span>' : '';
            const impBadge = t.isImportant ? '<span style="color:#f59e0b; font-size:11px; margin-left:6px; font-weight:600;">⭐ Imp</span>' : '';
            const completedNote = t.completed ? '<span style="color:var(--text-muted); font-size:11px; margin-left:6px;">(Completed)</span>' : '';

            const row = document.createElement("div");
            row.className = "topic-select-row";
            row.innerHTML = `
              <label class="topic-checkbox-label" style="display: flex; align-items: center; gap: 8px; padding: 6px 4px; cursor: pointer;">
                <input type="checkbox" class="topic-select-checkbox" data-subj-id="${subject.id}" data-unit-num="${uNumber}" data-topic-id="${t.id}" data-completed="${t.completed ? 'true' : 'false'}" data-topic-name="${escapeHtml(t.name)}" data-subj-name="${escapeHtml(subject.name || subject.title)}" ${isTopicSelected ? "checked" : ""} style="width: 15px; height: 15px; accent-color: #6366f1;" />
                <span style="${t.completed ? 'text-decoration: line-through; opacity: 0.6;' : 'font-weight: 500;'}">${escapeHtml(t.name)}</span>
                ${weakBadge}
                ${impBadge}
                ${completedNote}
              </label>
            `;
            topicsList.appendChild(row);
          });

          unitBlock.appendChild(topicsList);
          collapsible.appendChild(unitBlock);
        });
      } else {
        // Flat topics list
        const topicsList = document.createElement("div");
        topicsList.className = "unit-select-topics-list";
        topicsList.style.maxHeight = "none";
        (subject.topics || []).forEach((t) => {
          const isTopicSelected = state.timetableSelection.selectedTopics.has(t.id);
          const weakBadge = t.needsFocus ? '<span style="color:#ef4444; font-size:11px; margin-left:6px;">🔴 Weak</span>' : '';
          const impBadge = t.isImportant ? '<span style="color:#f59e0b; font-size:11px; margin-left:6px;">⭐ Imp</span>' : '';

          const row = document.createElement("div");
          row.className = "topic-select-row";
          row.innerHTML = `
            <label class="topic-checkbox-label" style="display: flex; align-items: center; gap: 8px; padding: 6px 4px; cursor: pointer;">
              <input type="checkbox" class="topic-select-checkbox" data-subj-id="${subject.id}" data-topic-id="${t.id}" data-completed="${t.completed ? 'true' : 'false'}" data-topic-name="${escapeHtml(t.name)}" data-subj-name="${escapeHtml(subject.name || subject.title)}" ${isTopicSelected ? "checked" : ""} style="width: 15px; height: 15px; accent-color: #6366f1;" />
              <span style="${t.completed ? 'text-decoration: line-through; opacity: 0.6;' : 'font-weight: 500;'}">${escapeHtml(t.name)}</span>
              ${weakBadge}
              ${impBadge}
            </label>
          `;
          topicsList.appendChild(row);
        });
        collapsible.appendChild(topicsList);
      }

      card.appendChild(header);
      card.appendChild(collapsible);

      // Re-sync all checkboxes (Subject, Units, Select All) based on eligible (incomplete) topics
      function syncCardCheckboxStates() {
        const allTopicCbs = Array.from(card.querySelectorAll(".topic-select-checkbox"));
        const eligibleTopicCbs = allTopicCbs.filter((cb) => cb.getAttribute("data-completed") !== "true");
        const checkedEligibleCbs = eligibleTopicCbs.filter((cb) => cb.checked);
        const subjCb = header.querySelector(".subject-checkbox");
        const selectAllSubj = collapsible.querySelector(".select-all-subject-topics");

        // Sync Unit checkboxes
        card.querySelectorAll(".unit-select-block").forEach((uBlock) => {
          const uMasterCb = uBlock.querySelector(".unit-select-all-checkbox");
          if (!uMasterCb) return;
          const uTopics = Array.from(uBlock.querySelectorAll(".topic-select-checkbox"));
          const uEligible = uTopics.filter((cb) => cb.getAttribute("data-completed") !== "true");
          const uChecked = uEligible.filter((cb) => cb.checked);
          if (uEligible.length > 0 && uChecked.length === uEligible.length) {
            uMasterCb.checked = true;
            uMasterCb.indeterminate = false;
          } else if (uChecked.length > 0) {
            uMasterCb.checked = false;
            uMasterCb.indeterminate = true;
          } else {
            uMasterCb.checked = false;
            uMasterCb.indeterminate = false;
          }
        });

        // Sync Subject Master Checkbox
        if (eligibleTopicCbs.length > 0 && checkedEligibleCbs.length === eligibleTopicCbs.length) {
          subjCb.checked = true;
          subjCb.indeterminate = false;
          if (selectAllSubj) {
            selectAllSubj.checked = true;
            selectAllSubj.indeterminate = false;
          }
          state.timetableSelection.selectedSubjects.add(subject.id);
          card.classList.add("active-selected");
        } else if (checkedEligibleCbs.length > 0) {
          subjCb.checked = false;
          subjCb.indeterminate = true;
          if (selectAllSubj) {
            selectAllSubj.checked = false;
            selectAllSubj.indeterminate = true;
          }
          state.timetableSelection.selectedSubjects.add(subject.id);
          card.classList.add("active-selected");
        } else {
          subjCb.checked = false;
          subjCb.indeterminate = false;
          if (selectAllSubj) {
            selectAllSubj.checked = false;
            selectAllSubj.indeterminate = false;
          }
          state.timetableSelection.selectedSubjects.delete(subject.id);
          card.classList.remove("active-selected");
        }

        updateTimetableSelectionSummary();
      }

      // 1. Subject Expand/Collapse Toggle Handler
      const expandBtn = header.querySelector(".subject-expand-btn");
      const titleClickable = header.querySelector(".subject-title-clickable");

      const toggleExpandCard = (e) => {
        if (e) {
          e.stopPropagation();
          e.preventDefault();
        }
        const isNowExpanded = card.classList.toggle("tt-expanded");
        card.classList.toggle("expanded", isNowExpanded);
        // On collapsing a subject: Hide its units and topics without losing selections
        if (!isNowExpanded) {
          card.querySelectorAll(".unit-select-block.tt-unit-expanded").forEach((ub) => {
            ub.classList.remove("tt-unit-expanded");
          });
        }
      };

      if (expandBtn) expandBtn.addEventListener("click", toggleExpandCard);
      if (titleClickable) titleClickable.addEventListener("click", toggleExpandCard);

      // 2. Unit Expand/Collapse Toggle Handler
      card.querySelectorAll(".unit-expand-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const uBlock = btn.closest(".unit-select-block");
          if (uBlock) {
            uBlock.classList.toggle("tt-unit-expanded");
          }
        });
      });

      card.querySelectorAll(".unit-select-header").forEach((uHeader) => {
        uHeader.addEventListener("click", (e) => {
          if (e.target.closest(".unit-select-all-checkbox") || e.target.closest(".unit-expand-btn")) return;
          e.stopPropagation();
          e.preventDefault();
          const uBlock = uHeader.closest(".unit-select-block");
          if (uBlock) {
            uBlock.classList.toggle("tt-unit-expanded");
          }
        });
      });

      // 3. Subject Checkbox Selection Handler (Select All incomplete topics in Subject)
      const subjCb = header.querySelector(".subject-checkbox");
      subjCb.addEventListener("change", (e) => {
        e.stopPropagation();
        const isChecked = e.target.checked;
        subjCb.indeterminate = false;

        card.querySelectorAll(".topic-select-checkbox").forEach((tCb) => {
          const isCompleted = tCb.getAttribute("data-completed") === "true";
          const tId = tCb.getAttribute("data-topic-id");
          if (isChecked) {
            // Select All must select only eligible, incomplete topics
            if (!isCompleted) {
              tCb.checked = true;
              state.timetableSelection.selectedTopics.add(tId);
            }
          } else {
            tCb.checked = false;
            state.timetableSelection.selectedTopics.delete(tId);
          }
        });

        syncCardCheckboxStates();
      });

      // 4. Select All in Subject shortcut checkbox
      const selectAllSubj = collapsible.querySelector(".select-all-subject-topics");
      if (selectAllSubj) {
        selectAllSubj.addEventListener("change", (e) => {
          e.stopPropagation();
          const isChecked = e.target.checked;
          selectAllSubj.indeterminate = false;

          card.querySelectorAll(".topic-select-checkbox").forEach((tCb) => {
            const isCompleted = tCb.getAttribute("data-completed") === "true";
            const tId = tCb.getAttribute("data-topic-id");
            if (isChecked) {
              if (!isCompleted) {
                tCb.checked = true;
                state.timetableSelection.selectedTopics.add(tId);
              }
            } else {
              tCb.checked = false;
              state.timetableSelection.selectedTopics.delete(tId);
            }
          });

          syncCardCheckboxStates();
        });
      }

      // 5. Unit-level Checkbox Toggle (Select All in Unit)
      collapsible.querySelectorAll(".unit-select-all-checkbox").forEach((uCb) => {
        uCb.addEventListener("change", (e) => {
          e.stopPropagation();
          const isChecked = e.target.checked;
          uCb.indeterminate = false;

          const parentUnit = uCb.closest(".unit-select-block");
          if (parentUnit) {
            parentUnit.querySelectorAll(".topic-select-checkbox").forEach((tCb) => {
              const isCompleted = tCb.getAttribute("data-completed") === "true";
              const tId = tCb.getAttribute("data-topic-id");
              if (isChecked) {
                if (!isCompleted) {
                  tCb.checked = true;
                  state.timetableSelection.selectedTopics.add(tId);
                }
              } else {
                tCb.checked = false;
                state.timetableSelection.selectedTopics.delete(tId);
              }
            });
          }

          syncCardCheckboxStates();
        });
      });

      // 6. Individual Topic Checkboxes
      collapsible.querySelectorAll(".topic-select-checkbox").forEach((tCb) => {
        tCb.addEventListener("change", (e) => {
          e.stopPropagation();
          const tId = e.target.getAttribute("data-topic-id");
          if (e.target.checked) {
            state.timetableSelection.selectedTopics.add(tId);
          } else {
            state.timetableSelection.selectedTopics.delete(tId);
          }
          syncCardCheckboxStates();
        });
      });

      container.appendChild(card);
      syncCardCheckboxStates();
    });

    updateTimetableSelectionSummary();
  }

  // Generate Timetable Form Submission
  if (elements.generateScheduleForm) {
    elements.generateScheduleForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (state.timetableSelection.selectedTopics.size === 0) {
        showToast("Please select at least one topic to schedule.", "error");
        return;
      }

      const activeSubjects = [];
      (state.subjects || []).forEach((fullSubj) => {
        const chosenTopics = (fullSubj.topics || []).filter((t) => state.timetableSelection.selectedTopics.has(t.id));
        if (chosenTopics.length > 0) {
          activeSubjects.push({
            id: fullSubj.id,
            name: fullSubj.name || fullSubj.title,
            code: fullSubj.code || "",
            semester: fullSubj.semester || 3,
            topics: chosenTopics.map((t) => ({
              id: t.id,
              name: t.name,
              needsFocus: t.needsFocus,
              isImportant: t.isImportant,
            })),
          });
        }
      });

      if (activeSubjects.length === 0) {
        showToast("No active topics selected in checked subjects.", "error");
        return;
      }

      const availableHours = parseFloat(elements.dailyHoursInput.value) || 3.5;
      const startTime = elements.startTimeInput.value || "18:00";
      const endTime = elements.endTimeInput.value || "22:30";
      const selectedModeInput = document.querySelector('input[name="planning-mode"]:checked');
      const planningMode = selectedModeInput ? selectedModeInput.value : "1";
      const breakPref = elements.breakPreferenceInput ? elements.breakPreferenceInput.value : "medium";
      const focusPref = elements.focusPreferenceInput ? elements.focusPreferenceInput.value : "balanced";

      if (elements.btnSubmitTimetable) {
        elements.btnSubmitTimetable.textContent = "⏳ Generating AI Study Plan...";
        elements.btnSubmitTimetable.disabled = true;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/generate-schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjects: activeSubjects,
            availableHours: availableHours,
            startTime: startTime,
            endTime: endTime,
            planningMode: planningMode,
            breakPreference: breakPref,
            focusPreference: focusPref,
          }),
        });

        const result = await response.json();
        if (result.success && result.schedule && result.schedule.length > 0) {
          state.currentSchedule = result.schedule;
          state.savedSchedule = JSON.parse(JSON.stringify(result.schedule));
          state.activeTimetableDay = 0;
          state.isEditingTimetable = false;
          renderTimetable();
          showToast(`Generated AI Study Schedule (${planningMode === "1" ? "Today" : `${planningMode} Days`})!`, "success");
          elements.timetableResultsContainer.scrollIntoView({ behavior: "smooth" });
        } else {
          showToast(result.message || "Could not generate schedule.", "error");
        }
      } catch (err) {
        showToast("Error generating timetable: " + err.message, "error");
      } finally {
        if (elements.btnSubmitTimetable) {
          elements.btnSubmitTimetable.disabled = false;
          updateTimetableSelectionSummary();
        }
      }
    });
  }

  // Sync planning horizon radio chips
  document.querySelectorAll(".planning-mode-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".planning-mode-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const radio = chip.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Time calculation helpers for non-overlapping contiguous sessions
  function parseTimeToMinutes(str, defaultMins = 1080) {
    if (!str || typeof str !== "string") return defaultMins;
    const parts = str.split(":");
    if (parts.length < 2) return defaultMins;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return defaultMins;
    return h * 60 + m;
  }

  function formatMinutesToTime(totalMins) {
    const m = ((totalMins % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  function recalculateScheduleTimings(schedule, baseStartTimeStr = "18:00") {
    if (!Array.isArray(schedule)) return;
    schedule.forEach((dayObj) => {
      let startMins = parseTimeToMinutes(baseStartTimeStr, 18 * 60);
      if (dayObj.slots && dayObj.slots.length > 0 && dayObj.slots[0].startTime) {
        startMins = parseTimeToMinutes(dayObj.slots[0].startTime, startMins);
      }
      let curr = startMins;
      let totalStudy = 0;
      let totalBreak = 0;

      (dayObj.slots || []).forEach((slot) => {
        const dur = Math.max(5, parseInt(slot.durationMins) || (slot.type === "break" ? 10 : 45));
        slot.durationMins = dur;
        const sStr = formatMinutesToTime(curr);
        curr += dur;
        const eStr = formatMinutesToTime(curr);
        slot.startTime = sStr;
        slot.endTime = eStr;
        slot.time = `${sStr} - ${eStr}`;

        if (slot.type === "break") {
          totalBreak += dur;
        } else {
          totalStudy += dur;
        }
      });

      dayObj.totalStudyMins = totalStudy;
      dayObj.totalBreakMins = totalBreak;
      dayObj.topicCount = (dayObj.slots || []).filter((s) => s.type !== "break").length;
    });
  }

  function renderTimetable() {
    if (!state.currentSchedule || state.currentSchedule.length === 0) {
      if (elements.timetableResultsContainer) elements.timetableResultsContainer.style.display = "none";
      return;
    }

    if (elements.timetableResultsContainer) elements.timetableResultsContainer.style.display = "block";

    // Update Edit Timetable button state & styling
    if (elements.editTimetableBtnText) {
      elements.editTimetableBtnText.textContent = state.isEditingTimetable ? "Done Editing" : "Edit Timetable";
    }
    if (elements.btnEditTimetable) {
      elements.btnEditTimetable.classList.toggle("btn-primary", state.isEditingTimetable);
      elements.btnEditTimetable.classList.toggle("btn-accent", !state.isEditingTimetable);
    }

    const days = state.currentSchedule;
    if (state.activeTimetableDay >= days.length) {
      state.activeTimetableDay = 0;
    }
    const activeDay = days[state.activeTimetableDay] || days[0];

    // 1. Render Multi-Day Navigation Tabs
    if (elements.timetableDayTabs) {
      if (days.length > 1) {
        elements.timetableDayTabs.style.display = "flex";
        elements.timetableDayTabs.innerHTML = days
          .map((dayObj, idx) => {
            const studySlotsCount = (dayObj.slots || []).filter((s) => s.type !== "break").length;
            const allDone = studySlotsCount > 0 && (dayObj.slots || []).filter((s) => s.type !== "break").every((s) => s.completed);
            return `
              <button type="button" class="timetable-day-tab ${idx === state.activeTimetableDay ? 'active' : ''}" data-day-index="${idx}">
                <span>📅 ${escapeHtml(dayObj.day || `Day ${idx + 1}`)}</span>
                <span class="tab-badge">${studySlotsCount} topics${allDone ? ' ✓' : ''}</span>
              </button>
            `;
          })
          .join("");

        elements.timetableDayTabs.querySelectorAll(".timetable-day-tab").forEach((btn) => {
          btn.addEventListener("click", () => {
            const idx = parseInt(btn.getAttribute("data-day-index")) || 0;
            state.activeTimetableDay = idx;
            renderTimetable();
          });
        });
      } else {
        elements.timetableDayTabs.style.display = "none";
      }
    }

    // 2. Render Day Metrics Summary Banner
    if (elements.timetableDayMetrics) {
      const studySlots = (activeDay.slots || []).filter((s) => s.type !== "break");
      const completedCount = studySlots.filter((s) => s.completed).length;
      const totalStudyMins = activeDay.totalStudyMins || studySlots.reduce((acc, s) => acc + (s.durationMins || 45), 0);
      const studyHrs = (totalStudyMins / 60).toFixed(1);

      elements.timetableDayMetrics.innerHTML = `
        <div>
          <strong style="color: var(--text-main); font-size: 15px;">${escapeHtml(activeDay.day || "Today")} Schedule</strong>
          <span style="font-size: 13px; color: var(--text-muted); margin-left: 8px;">(${studySlots.length} study sessions • ${studyHrs} hrs total study)</span>
          ${state.isEditingTimetable ? '<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #4f46e5; margin-left: 8px; font-weight: 700;">✏️ Edit Mode Active</span>' : ''}
        </div>
        <div style="font-size: 13.5px; font-weight: 600; color: ${completedCount === studySlots.length && studySlots.length > 0 ? '#10b981' : '#6366f1'};">
          ${completedCount}/${studySlots.length} Sessions Completed
        </div>
      `;
    }

    // 3. Render Study & Break Cards for Active Day
    if (elements.timetableCardsWrapper) {
      if (!activeDay.slots || activeDay.slots.length === 0) {
        elements.timetableCardsWrapper.innerHTML = `
          <div class="card" style="padding: 24px; text-align: center; color: var(--text-muted);">
            No sessions scheduled for this day.
            ${state.isEditingTimetable ? `
              <div style="margin-top: 12px;">
                <button type="button" id="btn-add-study-session" class="btn btn-primary btn-sm">+ Add Study Session</button>
                <button type="button" id="btn-add-break-session" class="btn btn-outline btn-sm" style="margin-left: 8px;">+ Add Break</button>
              </div>
            ` : ''}
          </div>
        `;
      } else {
        const slotsHtml = activeDay.slots
          .map((slot, sIdx) => {
            const isBreak = slot.type === "break" || slot.isBreak || (slot.topic && slot.topic.toLowerCase().includes("break"));
            const isCompleted = Boolean(slot.completed);
            const borderCol = isBreak ? "#10b981" : (isCompleted ? "#10b981" : "#6366f1");
            const icon = isBreak ? "☕" : (isCompleted ? "✅" : "📖");

            let priorityBadge = "";
            if (!isBreak) {
              if (slot.needsFocus && slot.isImportant) {
                priorityBadge = '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">🔴 Weak &bull; ⭐ Imp</span>';
              } else if (slot.needsFocus) {
                priorityBadge = '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">🔴 Weak</span>';
              } else if (slot.isImportant) {
                priorityBadge = '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">⭐ Imp</span>';
              }
            }

            // Controls when editing is active
            let editControlsHtml = "";
            if (state.isEditingTimetable) {
              const moveDayOptions = days.length > 1
                ? days.map((d, dIdx) => dIdx !== state.activeTimetableDay ? `<option value="${dIdx}">${escapeHtml(d.day || `Day ${dIdx + 1}`)}</option>` : '').join('')
                : "";

              editControlsHtml = `
                <div class="slot-controls-bar">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 12px; font-weight: 600; color: var(--text-muted);">Duration:</span>
                    <button type="button" class="slot-ctrl-btn btn-dur-minus" data-slot-idx="${sIdx}" title="Decrease 5 mins">-5m</button>
                    <input type="number" class="slot-ctrl-btn slot-dur-input" data-slot-idx="${sIdx}" min="5" max="240" step="5" value="${slot.durationMins || (isBreak ? 10 : 45)}" style="width: 58px; text-align: center;" />
                    <button type="button" class="slot-ctrl-btn btn-dur-plus" data-slot-idx="${sIdx}" title="Increase 5 mins">+5m</button>
                  </div>
                  <div class="slot-action-btn-group">
                    <button type="button" class="slot-ctrl-btn btn-slot-up" data-slot-idx="${sIdx}" ${sIdx === 0 ? "disabled style='opacity:0.35; cursor:default;'" : ""} title="Move Up">↑</button>
                    <button type="button" class="slot-ctrl-btn btn-slot-down" data-slot-idx="${sIdx}" ${sIdx === activeDay.slots.length - 1 ? "disabled style='opacity:0.35; cursor:default;'" : ""} title="Move Down">↓</button>
                    ${days.length > 1 ? `
                      <select class="slot-ctrl-btn slot-move-day-select" data-slot-idx="${sIdx}" title="Move to another day">
                        <option value="" disabled selected>Move to Day ▾</option>
                        ${moveDayOptions}
                      </select>
                    ` : ''}
                    <button type="button" class="slot-ctrl-btn btn-slot-delete" data-slot-idx="${sIdx}" title="Remove session" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">🗑️ Remove</button>
                  </div>
                </div>
              `;
            }

            return `
              <div class="card timetable-slot-card" data-slot-id="${slot.id || `slot_${sIdx}`}" style="padding: 16px; border-left: 4px solid ${borderCol}; margin-bottom: 10px; background: ${isBreak ? 'rgba(16, 185, 129, 0.05)' : (isCompleted ? 'rgba(16, 185, 129, 0.04)' : 'var(--bg-card)')};">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <div class="timetable-card-time" style="font-weight: 700; font-size: 14px; color: var(--text-muted);">
                    ${icon} ${escapeHtml(slot.time || `${slot.startTime} - ${slot.endTime}`)}
                    <span style="font-size: 12px; font-weight: normal; margin-left: 6px;">(${slot.durationMins || (isBreak ? 10 : 45)} mins)</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="badge" style="background: ${isBreak ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.12)'}; color: ${borderCol}; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
                      ${escapeHtml(slot.subject)}
                    </span>
                    ${priorityBadge}
                  </div>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px; gap: 12px;">
                  <div style="font-size: 14.5px; font-weight: 600; color: var(--text-main); ${isCompleted ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                    ${escapeHtml(slot.topic)}
                  </div>
                  ${!isBreak ? `
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer; color: ${isCompleted ? '#10b981' : 'var(--text-muted)'}; white-space: nowrap;">
                      <input type="checkbox" class="slot-complete-checkbox" data-slot-id="${slot.id || `slot_${sIdx}`}" ${isCompleted ? 'checked' : ''} style="accent-color: #10b981; width: 16px; height: 16px;" />
                      <span>${isCompleted ? 'Completed' : 'Mark Done'}</span>
                    </label>
                  ` : ''}
                </div>
                ${editControlsHtml}
              </div>
            `;
          })
          .join("");

        // Add Toolbar at the bottom of the active day in Edit Mode
        const addToolbarHtml = state.isEditingTimetable ? `
          <div class="card" style="padding: 12px 18px; margin-top: 10px; display: flex; gap: 10px; align-items: center; justify-content: flex-end; background: rgba(99, 102, 241, 0.04); border: 1.5px dashed var(--border-color); border-radius: 10px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-right: auto;">Add to ${escapeHtml(activeDay.day || "Today")}:</span>
            <button type="button" id="btn-add-study-session" class="btn btn-outline btn-sm" style="font-size: 12.5px;">+ Add Study Session</button>
            <button type="button" id="btn-add-break-session" class="btn btn-outline btn-sm" style="font-size: 12.5px;">+ Add Break</button>
          </div>
        ` : "";

        elements.timetableCardsWrapper.innerHTML = slotsHtml + addToolbarHtml;

        // Completion checkbox listeners
        elements.timetableCardsWrapper.querySelectorAll(".slot-complete-checkbox").forEach((cb) => {
          cb.addEventListener("change", (e) => {
            const slotId = e.target.getAttribute("data-slot-id");
            const slot = (activeDay.slots || []).find((s, idx) => (s.id || `slot_${idx}`) === slotId);
            if (slot) {
              slot.completed = e.target.checked;
              (state.subjects || []).forEach((subj) => {
                if ((subj.name || "").toLowerCase() === (slot.subject || "").toLowerCase()) {
                  (subj.topics || []).forEach((top) => {
                    if ((top.name || "").toLowerCase() === (slot.topic || "").toLowerCase()) {
                      top.completed = e.target.checked;
                    }
                  });
                }
              });
              renderTimetable();
            }
          });
        });

        // Edit Mode event listeners
        if (state.isEditingTimetable) {
          // Duration Minus
          elements.timetableCardsWrapper.querySelectorAll(".btn-dur-minus").forEach((btn) => {
            btn.addEventListener("click", () => {
              const idx = parseInt(btn.getAttribute("data-slot-idx"), 10);
              const slot = activeDay.slots[idx];
              if (slot) {
                slot.durationMins = Math.max(5, (parseInt(slot.durationMins) || 45) - 5);
                recalculateScheduleTimings(state.currentSchedule, elements.startTimeInput?.value);
                renderTimetable();
              }
            });
          });

          // Duration Plus
          elements.timetableCardsWrapper.querySelectorAll(".btn-dur-plus").forEach((btn) => {
            btn.addEventListener("click", () => {
              const idx = parseInt(btn.getAttribute("data-slot-idx"), 10);
              const slot = activeDay.slots[idx];
              if (slot) {
                slot.durationMins = Math.min(240, (parseInt(slot.durationMins) || 45) + 5);
                recalculateScheduleTimings(state.currentSchedule, elements.startTimeInput?.value);
                renderTimetable();
              }
            });
          });

          // Duration Input Change
          elements.timetableCardsWrapper.querySelectorAll(".slot-dur-input").forEach((inp) => {
            inp.addEventListener("change", (e) => {
              const idx = parseInt(inp.getAttribute("data-slot-idx"), 10);
              const slot = activeDay.slots[idx];
              if (slot) {
                const val = parseInt(e.target.value, 10);
                slot.durationMins = Math.max(5, Math.min(240, isNaN(val) ? 45 : val));
                recalculateScheduleTimings(state.currentSchedule, elements.startTimeInput?.value);
                renderTimetable();
              }
            });
          });

          // Move Up
          elements.timetableCardsWrapper.querySelectorAll(".btn-slot-up").forEach((btn) => {
            btn.addEventListener("click", () => {
              const idx = parseInt(btn.getAttribute("data-slot-idx"), 10);
              if (idx > 0 && idx < activeDay.slots.length) {
                const temp = activeDay.slots[idx];
                activeDay.slots[idx] = activeDay.slots[idx - 1];
                activeDay.slots[idx - 1] = temp;
                recalculateScheduleTimings(state.currentSchedule, elements.startTimeInput?.value);
                renderTimetable();
              }
            });
          });

          // Move Down
          elements.timetableCardsWrapper.querySelectorAll(".btn-slot-down").forEach((btn) => {
            btn.addEventListener("click", () => {
              const idx = parseInt(btn.getAttribute("data-slot-idx"), 10);
              if (idx >= 0 && idx < activeDay.slots.length - 1) {
                const temp = activeDay.slots[idx];
                activeDay.slots[idx] = activeDay.slots[idx + 1];
                activeDay.slots[idx + 1] = temp;
                recalculateScheduleTimings(state.currentSchedule, elements.startTimeInput?.value);
                renderTimetable();
              }
            });
          });

          // Move to another Day
          elements.timetableCardsWrapper.querySelectorAll(".slot-move-day-select").forEach((sel) => {
            sel.addEventListener("change", (e) => {
              const sIdx = parseInt(sel.getAttribute("data-slot-idx"), 10);
              const targetDayIdx = parseInt(e.target.value, 10);
              if (!isNaN(targetDayIdx) && days[targetDayIdx]) {
                const [movedSlot] = activeDay.slots.splice(sIdx, 1);
                movedSlot.dayIndex = targetDayIdx;
                days[targetDayIdx].slots.push(movedSlot);
                recalculateScheduleTimings(state.currentSchedule, elements.startTimeInput?.value);
                renderTimetable();
                showToast(`Moved to ${days[targetDayIdx].day || `Day ${targetDayIdx + 1}`}!`, "success");
              }
            });
          });

          // Delete session
          elements.timetableCardsWrapper.querySelectorAll(".btn-slot-delete").forEach((btn) => {
            btn.addEventListener("click", () => {
              const idx = parseInt(btn.getAttribute("data-slot-idx"), 10);
              const removed = activeDay.slots.splice(idx, 1)[0];
              recalculateScheduleTimings(state.currentSchedule, elements.startTimeInput?.value);
              renderTimetable();
              showToast(`Removed "${removed?.topic || removed?.subject}".`, "normal");
            });
          });

          // Add Study Session
          const btnAddStudy = elements.timetableCardsWrapper.querySelector("#btn-add-study-session");
          if (btnAddStudy) {
            btnAddStudy.addEventListener("click", () => {
              const title = prompt("Enter study topic name:", "Additional Practice & Review");
              if (title && title.trim()) {
                activeDay.slots.push({
                  id: "slot_custom_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
                  subject: "Study Session",
                  topic: title.trim(),
                  durationMins: 45,
                  type: "study",
                  needsFocus: false,
                  isImportant: false,
                  completed: false,
                  dayIndex: state.activeTimetableDay,
                });
                recalculateScheduleTimings(state.currentSchedule, elements.startTimeInput?.value);
                renderTimetable();
                showToast(`Added session "${title.trim()}"!`, "success");
              }
            });
          }

          // Add Break
          const btnAddBreak = elements.timetableCardsWrapper.querySelector("#btn-add-break-session");
          if (btnAddBreak) {
            btnAddBreak.addEventListener("click", () => {
              activeDay.slots.push({
                id: "break_custom_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
                subject: "Refresh Break",
                topic: "Hydrate, stretch, or rest your eyes",
                durationMins: 10,
                type: "break",
                needsFocus: false,
                isImportant: false,
                completed: false,
                dayIndex: state.activeTimetableDay,
              });
              recalculateScheduleTimings(state.currentSchedule, elements.startTimeInput?.value);
              renderTimetable();
              showToast("Added 10-minute refresh break!", "success");
            });
          }
        }
      }
    }
  }

  // Edit Timetable Button Handler (Toggles Edit Mode)
  if (elements.btnEditTimetable) {
    elements.btnEditTimetable.addEventListener("click", () => {
      if (!state.currentSchedule || state.currentSchedule.length === 0) {
        showToast("No active timetable to edit. Please generate one first.", "error");
        return;
      }
      state.isEditingTimetable = !state.isEditingTimetable;
      renderTimetable();
      showToast(state.isEditingTimetable ? "Edit mode enabled. Adjust durations, reorder, or add sessions." : "Exited edit mode.", "normal");
    });
  }

  // Save Changes Button Handler (Persists edits to localStorage and SQLite)
  if (elements.btnSaveTimetable) {
    elements.btnSaveTimetable.addEventListener("click", async () => {
      if (!state.currentSchedule || state.currentSchedule.length === 0) {
        showToast("No study schedule to save.", "error");
        return;
      }

      elements.btnSaveTimetable.disabled = true;
      elements.btnSaveTimetable.innerHTML = "<span>⏳</span> <span>Saving...</span>";

      try {
        localStorage.setItem("cognify_saved_timetable", JSON.stringify(state.currentSchedule));
        state.savedSchedule = JSON.parse(JSON.stringify(state.currentSchedule));

        try {
          await fetch(`${API_BASE_URL}/save-timetable`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: state.user?.id || 999,
              schedule: state.currentSchedule,
            }),
          });
        } catch (_) {}

        await apiSaveSyllabus();
        showToast("Timetable saved successfully!", "success");
      } catch (err) {
        showToast("Failed to save timetable changes: " + err.message, "error");
      } finally {
        elements.btnSaveTimetable.disabled = false;
        elements.btnSaveTimetable.innerHTML = "<span>💾</span> <span>Save Changes</span>";
      }
    });
  }

  // Reset Edits Button Handler (Reverts to last saved schedule)
  if (elements.btnResetTimetable) {
    elements.btnResetTimetable.addEventListener("click", () => {
      let source = state.savedSchedule;
      if (!source || !Array.isArray(source) || source.length === 0) {
        try {
          const fromStorage = localStorage.getItem("cognify_saved_timetable");
          if (fromStorage) source = JSON.parse(fromStorage);
        } catch (_) {}
      }

      if (source && Array.isArray(source) && source.length > 0) {
        state.currentSchedule = JSON.parse(JSON.stringify(source));
        recalculateScheduleTimings(state.currentSchedule, elements.startTimeInput?.value);
        renderTimetable();
        showToast("Reverted edits to last saved timetable.", "normal");
        return;
      }
      showToast("No saved timetable to revert to.", "normal");
    });
  }

  // Print / Save PDF Schedule
  if (elements.btnPrintSchedule) {
    elements.btnPrintSchedule.addEventListener("click", () => {
      window.print();
    });
  }

  // Initial session check
  if (state.user && state.user.isLoggedIn) {
    if (elements.btnLogout) elements.btnLogout.style.display = "inline-flex";
    if (elements.demoModeBadge) elements.demoModeBadge.style.display = state.user.isDemo ? "inline-flex" : "none";
    if (elements.demoBannerActions) elements.demoBannerActions.style.display = state.user.isDemo ? "flex" : "none";
    updateUserDisplayName(state.user.displayName || state.user.firstName);
    showDashboard();
  }

  // Theme Toggle
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nextTheme);
      elements.themeToggleBtn.textContent = nextTheme === "dark" ? "☀️" : "🌙";
    });
  }
});