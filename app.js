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
    // Timetable Selection State
    timetableSelection: {
      selectedSubjects: new Set(),
      selectedTopics: new Set(),
      subjectMemory: {}, // subjectId -> Set of topicIds
    },
  };

  let authMode = "login";

  const elements = {
    toast: document.getElementById("toast"),

    // Auth Elements
    authForm: document.getElementById("auth-form"),
    authTitle: document.getElementById("auth-title"),
    authSubtitle: document.getElementById("auth-subtitle"),
    authEmail: document.getElementById("auth-email"),
    authPassword: document.getElementById("auth-password"),
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
  /* PHASE 1 & 2: AUTHENTICATION & USER PROFILE DISPLAY       */
  /* ======================================================== */
  function setAuthMode(mode) {
    authMode = mode;
    if (mode === "login") {
      if (elements.tabLogin) elements.tabLogin.classList.add("active", "btn-primary");
      if (elements.tabLogin) elements.tabLogin.classList.remove("btn-outline");
      if (elements.tabSignup) elements.tabSignup.classList.remove("active", "btn-primary");
      if (elements.tabSignup) elements.tabSignup.classList.add("btn-outline");
      if (elements.signupFields) elements.signupFields.style.display = "none";
      if (elements.authTitle) elements.authTitle.textContent = "Welcome Back!";
      if (elements.authSubtitle) elements.authSubtitle.textContent = "Your smarter way to plan, learn and achieve.";
      if (elements.btnAuthSubmit) elements.btnAuthSubmit.textContent = "Sign In";
      if (elements.authSwitchPrompt) elements.authSwitchPrompt.textContent = "Don't have an account?";
      if (elements.authToggleModeLink) elements.authToggleModeLink.textContent = "Sign Up";
    } else {
      if (elements.tabSignup) elements.tabSignup.classList.add("active", "btn-primary");
      if (elements.tabSignup) elements.tabSignup.classList.remove("btn-outline");
      if (elements.tabLogin) elements.tabLogin.classList.remove("active", "btn-primary");
      if (elements.tabLogin) elements.tabLogin.classList.add("btn-outline");
      if (elements.signupFields) elements.signupFields.style.display = "block";
      if (elements.authTitle) elements.authTitle.textContent = "Create an Account";
      if (elements.authSubtitle) elements.authSubtitle.textContent = "Start planning your academic curriculum with AI.";
      if (elements.btnAuthSubmit) elements.btnAuthSubmit.textContent = "Create Account";
      if (elements.authSwitchPrompt) elements.authSwitchPrompt.textContent = "Already have an account?";
      if (elements.authToggleModeLink) elements.authToggleModeLink.textContent = "Sign In";
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

  // Password Visibility Toggle
  if (elements.btnTogglePassword && elements.authPassword) {
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
      const email = elements.authEmail.value.trim().toLowerCase();
      const password = elements.authPassword.value.trim();
      const firstName = elements.authFirstName ? elements.authFirstName.value.trim() : "";
      const lastName = elements.authLastName ? elements.authLastName.value.trim() : "";

      const endpoint = authMode === "signup" ? "/register" : "/login";

      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, firstName, lastName }),
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

          showToast(`Welcome back, ${displayName}!`, "success");
          showDashboard();
        } else {
          showToast(result.message || "Sign in failed", "error");
        }
      } catch (err) {
        showToast("Server connection error.", "error");
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
  /* ONE-CLICK DEMO LOGIN & SESSION MANAGEMENT                */
  /* ======================================================== */
  if (elements.btnTryDemo) {
    elements.btnTryDemo.addEventListener("click", async () => {
      const origHtml = elements.btnTryDemo.innerHTML;
      elements.btnTryDemo.disabled = true;
      elements.btnTryDemo.innerHTML = '<span class="demo-btn-icon">⏳</span> Setting Up AKTU Demo...';

      try {
        let response;
        try {
          response = await fetch(`${API_BASE_URL}/demo-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        } catch (fetchErr) {
          console.warn("POST /demo-login fetch failed, attempting GET fallback:", fetchErr);
          response = await fetch(`${API_BASE_URL}/demo-login`, { method: "GET" });
        }

        // Handle possible 405 Method Not Allowed error with automatic fallback to GET
        if (!response.ok && response.status === 405) {
          console.warn("Received 405 from POST /demo-login, falling back to GET...");
          response = await fetch(`${API_BASE_URL}/demo-login`, { method: "GET" });
        }

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

          // Show demo badges and controls
          updateUserDisplayName(state.user.displayName);
          if (elements.demoModeBadge) elements.demoModeBadge.style.display = "inline-flex";
          if (elements.demoBannerActions) elements.demoBannerActions.style.display = "inline-flex";

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

    // Repopulate select options
    filterSelect.innerHTML = "";
    sortedSemesters.forEach((sem) => {
      const opt = document.createElement("option");
      opt.value = String(sem);
      opt.textContent = `Semester ${sem}`;
      if (String(sem) === String(targetSem)) {
        opt.selected = true;
      }
      filterSelect.appendChild(opt);
    });

    // Also provide All Semesters option
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "All Semesters (Overall)";
    if (targetSem === "all") {
      allOpt.selected = true;
    }
    filterSelect.appendChild(allOpt);
  }

  function updateDashboardMetrics() {
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
      elements.metricProgressLabel.textContent = isFiltered ? `Sem ${selectedSem} Progress` : "Overall Progress";
    }

    if (elements.metricsFilterCaption) {
      elements.metricsFilterCaption.textContent = isFiltered
        ? `Showing Semester ${selectedSem} (${totalSubjects} subjects)`
        : `Showing All Semesters (${state.subjects.length} subjects)`;
    }
  }

  // Real-time semester filter change handler
  if (elements.dashboardSemesterFilter) {
    elements.dashboardSemesterFilter.addEventListener("change", (e) => {
      const val = e.target.value;
      state.selectedSemester = val;
      localStorage.setItem("cognify_selected_semester", val);
      updateDashboardMetrics();
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

    // Group subjects by semester
    const semesterGroups = {};
    state.subjects.forEach((subj) => {
      const semKey = subj.semester ? `Semester ${subj.semester}` : "Core Subjects";
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

    sortedSemKeys.forEach((semName) => {
      const groupBlock = document.createElement("div");
      groupBlock.className = "semester-group-block";

      const subjsInGroup = semesterGroups[semName];
      const semTotalTopics = subjsInGroup.reduce((acc, s) => acc + (s.topics ? s.topics.length : 0), 0);
      const semCompletedTopics = subjsInGroup.reduce((acc, s) => acc + (s.topics ? s.topics.filter((t) => t.completed).length : 0), 0);
      const semPercent = semTotalTopics > 0 ? Math.round((semCompletedTopics / semTotalTopics) * 100) : 0;

      const semHeader = document.createElement("div");
      semHeader.className = "semester-header-bar";
      semHeader.innerHTML = `
        <h3 class="semester-title">
          <span>📚</span> ${escapeHtml(semName)}
        </h3>
        <div style="display: flex; gap: 12px; align-items: center;">
          <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">${subjsInGroup.length} Subjects &bull; ${semCompletedTopics}/${semTotalTopics} Done (${semPercent}%)</span>
          <span class="semester-badge">${semName}</span>
        </div>
      `;
      groupBlock.appendChild(semHeader);

      // TRUE MASONRY GRID WITH INDEPENDENT COLUMN STACKS
      const masonryGrid = document.createElement("div");
      masonryGrid.className = "dashboard-masonry-grid";

      const columns = [];
      for (let c = 0; c < colCount; c++) {
        const colDiv = document.createElement("div");
        colDiv.className = "masonry-column";
        masonryGrid.appendChild(colDiv);
        columns.push(colDiv);
      }

      subjsInGroup.forEach((subject, subjIdx) => {
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
              const uTitle = unit.unitTitle || `Unit ${uNumber}`;
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
                      <span class="unit-number-pill">Unit ${escapeHtml(uNumber)}</span>
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
      showView("view-generate-timetable");
    });
  }

  /* ======================================================== */
  /* PHASE 3: HIERARCHICAL TOPIC SELECTOR FOR TIMETABLE       */
  /* ======================================================== */
  function updateTimetableSelectionSummary() {
    const selSubjCount = state.timetableSelection.selectedSubjects.size;
    const selTopicCount = state.timetableSelection.selectedTopics.size;

    if (elements.timetableSelectionSummary) {
      elements.timetableSelectionSummary.textContent = `${selSubjCount} subjects selected • ${selTopicCount} topics selected`;
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
      const isSubjSelected = state.timetableSelection.selectedSubjects.has(subject.id);
      const card = document.createElement("div");
      card.className = `subject-select-card ${isSubjSelected ? "active-selected" : ""}`;
      card.setAttribute("data-subj-id", subject.id);

      const totalSubjTopics = subject.topics ? subject.topics.length : 0;
      const codeBadge = subject.code ? `<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #4f46e5; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 5px;">${escapeHtml(subject.code)}</span>` : "";
      const semBadge = subject.semester ? `<span style="font-size: 11.5px; color: var(--text-muted);">Sem ${subject.semester}</span>` : "";

      // Header row
      const header = document.createElement("div");
      header.className = "subject-select-header";
      header.innerHTML = `
        <div class="subject-select-title-group">
          <input type="checkbox" class="subject-checkbox" data-subj-id="${subject.id}" ${isSubjSelected ? "checked" : ""} />
          <div>
            <div style="font-weight: 700; font-size: 15px; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
              ${codeBadge}
              <span>${escapeHtml(subject.name || subject.title)}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              ${semBadge} &bull; ${totalSubjTopics} total topics available
            </div>
          </div>
        </div>
        <div style="font-size: 13px; color: var(--text-muted); font-weight: 600;">
          <span class="subject-expand-arrow">${isSubjSelected ? "▲" : "▼"}</span>
        </div>
      `;

      // Collapsible body with units and topics
      const collapsible = document.createElement("div");
      collapsible.className = "subject-topics-collapsible";

      // Controls Bar: Select All in Subject
      const controlsBar = document.createElement("div");
      controlsBar.className = "subject-controls-bar";
      controlsBar.innerHTML = `
        <span>Choose topics for this subject:</span>
        <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 600; color: #6366f1;">
          <input type="checkbox" class="select-all-subject-topics" data-subj-id="${subject.id}" />
          <span>Select All Topics</span>
        </label>
      `;
      collapsible.appendChild(controlsBar);

      // Render Units or fallback to flat topics
      if (subject.units && subject.units.length > 0) {
        subject.units.forEach((unit, uIdx) => {
          const uNumber = unit.unitNumber || uIdx + 1;
          const uTitle = unit.unitTitle || `Unit ${uNumber}`;

          // Find topics matching this unit
          const unitTopics = (subject.topics || []).filter((t) => {
            if (t.unitNumber !== undefined) return t.unitNumber === uNumber;
            if (t.unit !== undefined) return String(t.unit).includes(String(uNumber));
            return false;
          });
          const effectiveTopics = unitTopics.length > 0 ? unitTopics : (unit.topics || []);

          const unitBlock = document.createElement("div");
          unitBlock.className = "unit-select-block";

          const unitHeader = document.createElement("div");
          unitHeader.className = "unit-select-header";
          unitHeader.innerHTML = `
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700;">
              <input type="checkbox" class="unit-select-all-checkbox" data-subj-id="${subject.id}" data-unit-num="${uNumber}" />
              <span class="unit-number-pill">Unit ${uNumber}</span>
              <span>${escapeHtml(uTitle)}</span>
            </label>
            <span style="font-size: 11.5px; color: var(--text-muted);">${effectiveTopics.length} topics</span>
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
              <label class="topic-checkbox-label">
                <input type="checkbox" class="topic-select-checkbox" data-subj-id="${subject.id}" data-unit-num="${uNumber}" data-topic-id="${t.id}" data-topic-name="${escapeHtml(t.name)}" data-subj-name="${escapeHtml(subject.name || subject.title)}" ${isTopicSelected ? "checked" : ""} />
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
        (subject.topics || []).forEach((t) => {
          const isTopicSelected = state.timetableSelection.selectedTopics.has(t.id);
          const weakBadge = t.needsFocus ? '<span style="color:#ef4444; font-size:11px; margin-left:6px;">🔴 Weak</span>' : '';
          const impBadge = t.isImportant ? '<span style="color:#f59e0b; font-size:11px; margin-left:6px;">⭐ Imp</span>' : '';

          const row = document.createElement("div");
          row.className = "topic-select-row";
          row.innerHTML = `
            <label class="topic-checkbox-label">
              <input type="checkbox" class="topic-select-checkbox" data-subj-id="${subject.id}" data-topic-id="${t.id}" data-topic-name="${escapeHtml(t.name)}" data-subj-name="${escapeHtml(subject.name || subject.title)}" ${isTopicSelected ? "checked" : ""} />
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

      // Event Listeners for Subject Checkbox
      const subjCb = header.querySelector(".subject-checkbox");
      subjCb.addEventListener("change", (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
          state.timetableSelection.selectedSubjects.add(subject.id);
          card.classList.add("active-selected");
          header.querySelector(".subject-expand-arrow").textContent = "▲";

          // Restore previously checked topics from session memory if any
          const remembered = state.timetableSelection.subjectMemory[subject.id];
          if (remembered && remembered.size > 0) {
            remembered.forEach((tId) => state.timetableSelection.selectedTopics.add(tId));
            card.querySelectorAll(".topic-select-checkbox").forEach((tCb) => {
              if (remembered.has(tCb.getAttribute("data-topic-id"))) {
                tCb.checked = true;
              }
            });
          }
        } else {
          state.timetableSelection.selectedSubjects.delete(subject.id);
          card.classList.remove("active-selected");
          header.querySelector(".subject-expand-arrow").textContent = "▼";

          // Save current topics to memory before removing from active selection
          const currentTopicIds = new Set();
          card.querySelectorAll(".topic-select-checkbox:checked").forEach((tCb) => {
            const tId = tCb.getAttribute("data-topic-id");
            currentTopicIds.add(tId);
            state.timetableSelection.selectedTopics.delete(tId);
            tCb.checked = false;
          });
          state.timetableSelection.subjectMemory[subject.id] = currentTopicIds;

          // Uncheck unit / subject master checkboxes
          const subAll = card.querySelector(".select-all-subject-topics");
          if (subAll) subAll.checked = false;
          card.querySelectorAll(".unit-select-all-checkbox").forEach((uCb) => (uCb.checked = false));
        }
        updateTimetableSelectionSummary();
      });

      // Select All in Subject shortcut (never active by default)
      const selectAllSubj = collapsible.querySelector(".select-all-subject-topics");
      if (selectAllSubj) {
        selectAllSubj.addEventListener("change", (e) => {
          const checked = e.target.checked;
          card.querySelectorAll(".topic-select-checkbox").forEach((tCb) => {
            tCb.checked = checked;
            const tId = tCb.getAttribute("data-topic-id");
            if (checked) {
              state.timetableSelection.selectedTopics.add(tId);
            } else {
              state.timetableSelection.selectedTopics.delete(tId);
            }
          });
          card.querySelectorAll(".unit-select-all-checkbox").forEach((uCb) => (uCb.checked = checked));
          updateTimetableSelectionSummary();
        });
      }

      // Unit-level checkbox toggle
      collapsible.querySelectorAll(".unit-select-all-checkbox").forEach((uCb) => {
        uCb.addEventListener("change", (e) => {
          const checked = e.target.checked;
          const uNum = uCb.getAttribute("data-unit-num");
          const parentUnit = uCb.closest(".unit-select-block");
          if (parentUnit) {
            parentUnit.querySelectorAll(".topic-select-checkbox").forEach((tCb) => {
              tCb.checked = checked;
              const tId = tCb.getAttribute("data-topic-id");
              if (checked) {
                state.timetableSelection.selectedTopics.add(tId);
              } else {
                state.timetableSelection.selectedTopics.delete(tId);
              }
            });
          }
          updateTimetableSelectionSummary();
        });
      });

      // Individual topic checkboxes
      collapsible.querySelectorAll(".topic-select-checkbox").forEach((tCb) => {
        tCb.addEventListener("change", (e) => {
          const tId = e.target.getAttribute("data-topic-id");
          if (e.target.checked) {
            state.timetableSelection.selectedTopics.add(tId);
          } else {
            state.timetableSelection.selectedTopics.delete(tId);
          }
          updateTimetableSelectionSummary();
        });
      });

      container.appendChild(card);
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

      // Build active subjects with only selected topics
      const activeSubjects = [];
      state.timetableSelection.selectedSubjects.forEach((subjId) => {
        const fullSubj = state.subjects.find((s) => s.id === subjId);
        if (!fullSubj) return;

        const chosenTopics = (fullSubj.topics || []).filter((t) => state.timetableSelection.selectedTopics.has(t.id));
        if (chosenTopics.length > 0) {
          activeSubjects.push({
            name: fullSubj.name || fullSubj.title,
            code: fullSubj.code || "",
            semester: fullSubj.semester || 3,
            topics: chosenTopics.map((t) => ({
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
          }),
        });

        const result = await response.json();
        if (result.success && result.schedule && result.schedule[0] && result.schedule[0].slots) {
          elements.timetableResultsContainer.style.display = "block";
          elements.timetableCardsWrapper.innerHTML = result.schedule[0].slots
            .map((slot) => {
              const isBreak = slot.isBreak || (slot.topic && slot.topic.toLowerCase().includes("break"));
              const borderCol = isBreak ? "#10b981" : "#6366f1";
              const icon = isBreak ? "☕" : "📖";

              return `
                <div class="card" style="padding: 16px; border-left: 4px solid ${borderCol}; margin-bottom: 10px; background: ${isBreak ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-card)'};">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="timetable-card-time" style="font-weight: 700; font-size: 14px; color: var(--text-muted);">${icon} ${escapeHtml(slot.time)}</div>
                    <span class="badge" style="background: ${isBreak ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.12)'}; color: ${borderCol}; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
                      ${escapeHtml(slot.subject)}
                    </span>
                  </div>
                  <div style="font-size: 14.5px; font-weight: 600; margin-top: 6px; color: var(--text-main);">
                    ${escapeHtml(slot.topic)}
                  </div>
                </div>
              `;
            })
            .join("");

          showToast("AI Timetable generated successfully!", "success");
          elements.timetableResultsContainer.scrollIntoView({ behavior: "smooth" });
        } else {
          showToast(result.message || "Could not generate schedule.", "error");
        }
      } catch (err) {
        showToast("Error generating timetable.", "error");
      } finally {
        if (elements.btnSubmitTimetable) {
          elements.btnSubmitTimetable.disabled = false;
          updateTimetableSelectionSummary();
        }
      }
    });
  }

  /* ======================================================== */
  /* PHASE 5: PDF UPLOAD & EXTRACTION REVIEW SCREEN           */
  /* ======================================================== */
  if (elements.pdfDropzone && elements.pdfFileInput) {
    elements.pdfDropzone.addEventListener("click", () => elements.pdfFileInput.click());
    elements.pdfFileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) handlePDFUpload(e.target.files[0]);
    });

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
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          handlePDFUpload(file);
        } else {
          showToast("Please upload a valid PDF file.", "error");
        }
      }
    });
  }

  async function handlePDFUpload(file) {
    elements.pdfPromptTitle.textContent = "⏳ Parsing & Extracting Units from PDF...";
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-syllabus-pdf`, { method: "POST", body: formData });
      const result = await response.json();

      const extractedSubjects = (result.data && result.data.subjects) || result.subjects;
      if (result.success && extractedSubjects && extractedSubjects.length > 0) {
        state.pendingExtraction = {
          subjects: extractedSubjects,
          pagesProcessed: result.pagesProcessed || 18,
          warnings: result.warnings || [],
        };

        renderExtractionReviewScreen(state.pendingExtraction);
        showView("view-extraction-review");
        showToast(`Parsed ${extractedSubjects.length} subjects! Please review before saving.`, "success");
      } else {
        showToast(result.message || "Failed to extract subjects from PDF.", "error");
      }
    } catch (err) {
      showToast("PDF parsing connection error.", "error");
    } finally {
      elements.pdfPromptTitle.textContent = "Drag & Drop Syllabus PDF Here";
      elements.pdfFileInput.value = "";
    }
  }

  function renderExtractionReviewScreen(extractionData) {
    if (!extractionData || !extractionData.subjects) return;

    const subjects = extractionData.subjects;
    let totalUnits = 0;
    let totalTopics = 0;

    subjects.forEach((s) => {
      if (s.units) totalUnits += s.units.length;
      if (s.topics) totalTopics += s.topics.length;
    });

    if (elements.reviewStatSubjects) elements.reviewStatSubjects.textContent = subjects.length;
    if (elements.reviewStatUnits) elements.reviewStatUnits.textContent = totalUnits;
    if (elements.reviewStatTopics) elements.reviewStatTopics.textContent = totalTopics;
    if (elements.reviewStatPages) elements.reviewStatPages.textContent = extractionData.pagesProcessed || 18;

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
      card.className = "review-subject-card";
      card.setAttribute("data-review-idx", sIdx);

      const semBadge = subj.semester ? `<span class="semester-badge" style="font-size: 11.5px;">Semester ${subj.semester}</span>` : "";
      const codeBadge = subj.code ? `<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #4f46e5; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">${escapeHtml(subj.code)}</span>` : "";

      let unitsMarkup = "";
      if (subj.units && subj.units.length > 0) {
        unitsMarkup = subj.units
          .map((unit, uIdx) => {
            const uNumber = unit.unitNumber || uIdx + 1;
            const uTitle = unit.unitTitle || `Unit ${uNumber}`;
            const unitTopics = unit.topics || [];

            const chips = unitTopics
              .map(
                (t, tIdx) => `
              <span class="review-chip" data-topic-chip="${sIdx}_${uIdx}_${tIdx}">
                <span>${escapeHtml(typeof t === "string" ? t : t.name)}</span>
                <button type="button" class="remove-chip-btn" data-remove-chip="${sIdx}_${uIdx}_${tIdx}" title="Remove topic">&times;</button>
              </span>
            `
              )
              .join("");

            return `
              <div class="review-unit-item">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span class="unit-number-pill">Unit ${escapeHtml(uNumber)}</span>
                  <input type="text" class="review-unit-heading-input" data-unit-heading="${sIdx}_${uIdx}" value="${escapeHtml(uTitle)}" placeholder="Unit Heading" />
                  <span style="font-size: 12px; color: var(--text-muted);">${unitTopics.length} topics</span>
                </div>
                <div class="review-topic-chips">
                  ${chips}
                </div>
              </div>
            `;
          })
          .join("");
      } else {
        const flatChips = (subj.topics || [])
          .map(
            (t, tIdx) => `
          <span class="review-chip" data-topic-chip="${sIdx}_flat_${tIdx}">
            <span>${escapeHtml(typeof t === "string" ? t : t.name)}</span>
            <button type="button" class="remove-chip-btn" data-remove-chip="${sIdx}_flat_${tIdx}" title="Remove topic">&times;</button>
          </span>
        `
          )
          .join("");
        unitsMarkup = `<div class="review-topic-chips">${flatChips}</div>`;
      }

      card.innerHTML = `
        <div class="review-card-header">
          <div style="display: flex; align-items: center; gap: 10px; flex-grow: 1;">
            ${codeBadge}
            ${semBadge}
            <input type="text" class="review-subject-input" data-subj-title-input="${sIdx}" value="${escapeHtml(subj.name || subj.title)}" placeholder="Subject Name" />
          </div>
          <button type="button" class="btn btn-outline btn-sm delete-review-subj-btn" data-remove-subj="${sIdx}" style="color: #ef4444;">✕ Remove Subject</button>
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

      card.querySelector(".delete-review-subj-btn").addEventListener("click", () => {
        card.remove();
        showToast("Subject removed from review list.", "normal");
      });

      container.appendChild(card);
    });
  }

  // Confirm and Save Reviewed Syllabus
  if (elements.btnConfirmReview) {
    elements.btnConfirmReview.addEventListener("click", async () => {
      if (!state.pendingExtraction) return;

      const reviewCards = elements.reviewSubjectsContainer.querySelectorAll(".review-subject-card");
      if (reviewCards.length === 0) {
        showToast("No subjects to confirm.", "error");
        return;
      }

      const confirmedSubjects = [];

      reviewCards.forEach((card) => {
        const sIdx = parseInt(card.getAttribute("data-review-idx"));
        const originalSubj = state.pendingExtraction.subjects[sIdx] || {};

        const titleInput = card.querySelector(`[data-subj-title-input="${sIdx}"]`);
        const finalName = titleInput ? titleInput.value.trim() : originalSubj.name || originalSubj.title;

        const finalUnits = [];
        const finalTopics = [];

        if (originalSubj.units && originalSubj.units.length > 0) {
          originalSubj.units.forEach((u, uIdx) => {
            const headingInput = card.querySelector(`[data-unit-heading="${sIdx}_${uIdx}"]`);
            const finalUnitTitle = headingInput ? headingInput.value.trim() : u.unitTitle;
            const unitNumber = u.unitNumber || uIdx + 1;

            const unitChips = card.querySelectorAll(`[data-topic-chip^="${sIdx}_${uIdx}_"]`);
            const unitTopicList = [];

            unitChips.forEach((chip) => {
              const chipText = chip.querySelector("span").textContent.trim();
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
          const flatChips = card.querySelectorAll(`[data-topic-chip^="${sIdx}_flat_"]`);
          flatChips.forEach((chip) => {
            const chipText = chip.querySelector("span").textContent.trim();
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
          (s) => (s.code && newSubj.code && s.code === newSubj.code) || s.name.toLowerCase() === newSubj.name.toLowerCase()
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
      showToast(`Saved ${confirmedSubjects.length} subjects to dashboard!`, "success");
      showDashboard();
    });
  }

  if (elements.btnDiscardReview) {
    elements.btnDiscardReview.addEventListener("click", () => {
      state.pendingExtraction = null;
      showToast("Extraction discarded.", "normal");
      showDashboard();
    });
  }

  /* MANUAL SUBJECT CREATION */
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

      const rows = elements.topicInputsContainer.querySelectorAll(".topic-input-row");
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
      showToast(`Added ${sName}!`, "success");
      showDashboard();
    });
  }

  /* DEMO DATA PREFILL FOR REGISTERED USERS */
  if (elements.btnPrefillDemo) {
    elements.btnPrefillDemo.addEventListener("click", async () => {
      const origText = elements.btnPrefillDemo.textContent;
      elements.btnPrefillDemo.disabled = true;
      elements.btnPrefillDemo.textContent = "Loading AKTU...";

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
            state.user = result.user;
          }
          state.subjects = result.subjects || [];
          state.collapsedSubjects = {};
          state.subjects.forEach((s) => {
            state.collapsedSubjects[s.id] = true;
          });
          renderDashboard();
          showToast("Loaded verified AKTU B.Tech CS/IT curriculum!", "success");
          showDashboard();
        } else {
          showToast(result.message || "Failed to load demo curriculum.", "error");
        }
      } catch (err) {
        showToast("Error loading demo data: " + err.message, "error");
      } finally {
        if (elements.btnPrefillDemo) {
          elements.btnPrefillDemo.disabled = false;
          elements.btnPrefillDemo.textContent = origText;
        }
      }
    });
  }

  // Print / Save PDF Schedule
  if (elements.btnPrintSchedule) {
    elements.btnPrintSchedule.addEventListener("click", () => {
      window.print();
    });
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