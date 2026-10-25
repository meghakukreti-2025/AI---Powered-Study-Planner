document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const API_BASE_URL = window.location.origin.includes(":5000") ? window.location.origin : "http://127.0.0.1:5000";

  const state = {
    user: { id: null, firstName: "", lastName: "", email: "", isLoggedIn: false },
    subjects: [],
    availability: { hours: 3, startTime: "18:00", endTime: "23:00" },
    collapsedSubjects: {},
  };

  let authMode = "login";

  const elements = {
    toast: document.getElementById("toast"),
    authForm: document.getElementById("auth-form"),
    authEmail: document.getElementById("auth-email"),
    authPassword: document.getElementById("auth-password"),
    authFirstName: document.getElementById("auth-first-name"),
    authLastName: document.getElementById("auth-last-name"),
    signupFields: document.getElementById("signup-fields"),
    tabLogin: document.getElementById("tab-login"),
    tabSignup: document.getElementById("tab-signup"),
    btnAuthSubmit: document.getElementById("btn-auth-submit"),
    authGuestLink: document.getElementById("auth-guest-link"),
    userDisplayName: document.getElementById("user-display-name"),

    subjectsDashboardGrid: document.getElementById("subjects-dashboard-grid"),
    btnOpenAddSubject: document.getElementById("btn-open-add-subject"),
    btnOpenTimetableGen: document.getElementById("btn-open-timetable-gen"),

    pdfDropzone: document.getElementById("pdf-dropzone"),
    pdfFileInput: document.getElementById("pdf-file-input"),
    pdfPromptTitle: document.getElementById("pdf-prompt-title"),
    addSubjectForm: document.getElementById("add-subject-form"),
    subjectNameInput: document.getElementById("subject-name"),
    topicInputsContainer: document.getElementById("topic-inputs-container"),
    btnAddTopicField: document.getElementById("btn-add-topic-field"),

    generateScheduleForm: document.getElementById("generate-schedule-form"),
    todayTopicSelector: document.getElementById("today-topic-selector"),
    dailyHoursInput: document.getElementById("daily-hours"),
    startTimeInput: document.getElementById("start-time"),
    endTimeInput: document.getElementById("end-time"),
    btnSubmitTimetable: document.getElementById("btn-submit-timetable"),
    timetableResultsContainer: document.getElementById("timetable-results-container"),
    timetableCardsWrapper: document.getElementById("timetable-cards-wrapper"),
    btnPrintSchedule: document.getElementById("btn-print-schedule"),
    btnPrefillDemo: document.getElementById("btn-prefill-demo"),
    themeToggleBtn: document.getElementById("theme-toggle"),
  };

  window.showDashboard = showDashboard;
  window.showView = showView;

  function showToast(message, type = "normal") {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
    elements.toast.classList.remove("hidden");
    setTimeout(() => elements.toast.classList.add("hidden"), 3500);
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
    return str ? String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
  }

  async function apiSaveSyllabus() {
    if (!state.user.email) return;
    try {
      await fetch(`${API_BASE_URL}/save-syllabus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: state.user.id, email: state.user.email, subjects: state.subjects }),
      });
    } catch (err) { }
  }

  /* AUTHENTICATION */
  if (elements.tabLogin && elements.tabSignup) {
    elements.tabLogin.addEventListener("click", () => {
      authMode = "login";
      elements.tabLogin.classList.add("active", "btn-primary");
      elements.tabLogin.classList.remove("btn-outline");
      elements.tabSignup.classList.remove("active", "btn-primary");
      elements.tabSignup.classList.add("btn-outline");
      if (elements.signupFields) elements.signupFields.style.display = "none";
      if (elements.btnAuthSubmit) elements.btnAuthSubmit.textContent = "Sign In & Continue";
    });

    elements.tabSignup.addEventListener("click", () => {
      authMode = "signup";
      elements.tabSignup.classList.add("active", "btn-primary");
      elements.tabSignup.classList.remove("btn-outline");
      elements.tabLogin.classList.remove("active", "btn-primary");
      elements.tabLogin.classList.add("btn-outline");
      if (elements.signupFields) elements.signupFields.style.display = "block";
      if (elements.btnAuthSubmit) elements.btnAuthSubmit.textContent = "Create Account & Continue";
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
          state.user = result.user;
          state.subjects = result.subjects || [];

          if (elements.userDisplayName) elements.userDisplayName.textContent = state.user.firstName;
          showToast(`Welcome back, ${state.user.firstName}!`, "success");
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
      state.user = { id: 999, email: "guest@college.edu", firstName: "Guest", isLoggedIn: true };
      if (elements.userDisplayName) elements.userDisplayName.textContent = "Guest";
      showDashboard();
    });
  }

  /* RENDER DASHBOARD */
  function renderDashboard() {
    const container = elements.subjectsDashboardGrid;
    if (!container) return;
    container.innerHTML = "";

    if (state.subjects.length === 0) {
      container.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 40px; column-span: all;">
          <h3>📚 No Subjects Added Yet</h3>
          <p class="text-muted">Import your college syllabus PDF or add subjects manually to get started.</p>
          <button class="btn btn-primary" onclick="showView('view-add-syllabus')">+ Add Syllabus / PDF</button>
        </div>
      `;
      return;
    }

    state.subjects.forEach((subject) => {
      const card = document.createElement("div");
      card.className = "card subject-dashboard-card";

      const totalTopics = subject.topics.length;
      const completedTopics = subject.topics.filter((t) => t.completed).length;
      const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      if (state.collapsedSubjects[subject.id] === undefined) {
        state.collapsedSubjects[subject.id] = true;
      }
      const isCollapsed = state.collapsedSubjects[subject.id];

      const topicsHtml = subject.topics
        .map(
          (t) => `
        <div class="topic-row-item">
          <label style="font-size: 13px; cursor: pointer; flex-grow: 1; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" class="topic-complete-toggle" data-subj-id="${subject.id}" data-topic-id="${t.id}" ${t.completed ? "checked" : ""} />
            <span class="topic-label-text" style="${t.completed ? "text-decoration: line-through; opacity: 0.6;" : "font-weight: 500;"}">${escapeHtml(t.name)}</span>
          </label>

          <div style="display: flex; gap: 6px; align-items: center;">
            <button type="button" class="btn-icon toggle-focus-btn ${t.needsFocus ? 'active-weak' : ''}" data-subj-id="${subject.id}" data-topic-id="${t.id}">
              🔴 Weak
            </button>
            <button type="button" class="btn-icon toggle-important-btn ${t.isImportant ? 'active-imp' : ''}" data-subj-id="${subject.id}" data-topic-id="${t.id}">
              ⭐ Imp
            </button>
          </div>
        </div>
      `
        )
        .join("");

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 17px; font-weight: 700;">${escapeHtml(subject.name)}</h3>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn btn-outline btn-sm toggle-collapse-btn" data-subj-id="${subject.id}">
              ${isCollapsed ? "▼ Show Topics" : "▲ Hide Topics"}
            </button>
            <button type="button" class="delete-subj-btn" data-subj-id="${subject.id}" style="color: #ef4444; border: none; background: transparent; cursor: pointer; font-size: 16px;">🗑️</button>
          </div>
        </div>

        <div class="progress-text" style="margin: 8px 0; font-size: 12px; font-weight: 600;">
          Course Progress: ${completedTopics} of ${totalTopics} topics (${progressPercent}%)
        </div>
        <div style="background: rgba(226, 232, 240, 0.6); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
          <div class="progress-bar-fill" style="background: #10b981; height: 100%; width: ${progressPercent}%; transition: width 0.3s ease;"></div>
        </div>

        <div class="topics-wrapper" style="display: ${isCollapsed ? "none" : "block"};">
          ${topicsHtml}
        </div>
      `;

      // Accordion Toggle
      const collapseBtn = card.querySelector(".toggle-collapse-btn");
      const topicsWrapper = card.querySelector(".topics-wrapper");
      collapseBtn.addEventListener("click", () => {
        const currentlyCollapsed = topicsWrapper.style.display === "none";
        topicsWrapper.style.display = currentlyCollapsed ? "block" : "none";
        collapseBtn.textContent = currentlyCollapsed ? "▲ Hide Topics" : "▼ Show Topics";
        state.collapsedSubjects[subject.id] = !currentlyCollapsed;
      });

      // Completion Checkbox
      card.querySelectorAll(".topic-complete-toggle").forEach((cb) => {
        cb.addEventListener("change", (e) => {
          const tId = e.target.getAttribute("data-topic-id");
          const topic = subject.topics.find((t) => t.id === tId);
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
          const topic = subject.topics.find((t) => t.id === tId);
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
          const topic = subject.topics.find((t) => t.id === tId);
          if (topic) {
            topic.isImportant = !topic.isImportant;
            renderDashboard();
            apiSaveSyllabus();
          }
        });
      });

      // Instant Deletion
      card.querySelector(".delete-subj-btn").addEventListener("click", async () => {
        state.subjects = state.subjects.filter((s) => s.id !== subject.id);
        renderDashboard();
        await apiSaveSyllabus();
        showToast(`Deleted ${subject.name}`, "normal");
      });

      container.appendChild(card);
    });
  }

  /* SYLLABUS IMPORT */
  if (elements.btnOpenAddSubject) elements.btnOpenAddSubject.addEventListener("click", () => showView("view-add-syllabus"));
  if (elements.btnOpenTimetableGen) {
    elements.btnOpenTimetableGen.addEventListener("click", () => {
      if (state.subjects.length === 0) {
        showToast("Please add at least one subject first.", "error");
        return;
      }
      renderTodayTopicSelector();
      showView("view-generate-timetable");
    });
  }

  if (elements.pdfDropzone && elements.pdfFileInput) {
    elements.pdfDropzone.addEventListener("click", () => elements.pdfFileInput.click());
    elements.pdfFileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) handlePDFUpload(e.target.files[0]);
    });
  }

  async function handlePDFUpload(file) {
    elements.pdfPromptTitle.textContent = "⏳ Parsing Syllabus PDF...";
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-syllabus-pdf`, { method: "POST", body: formData });
      const result = await response.json();

      if (result.success && result.data && result.data.subjects) {
        result.data.subjects.forEach((sub) => {
          state.subjects.push({
            id: "subj_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
            name: sub.name,
            topics: (sub.topics || []).map((t) => ({
              id: "top_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
              name: typeof t === "string" ? t : t.name,
              needsFocus: typeof t === "object" ? !!t.needsFocus : false,
              isImportant: typeof t === "object" ? !!t.isImportant : false,
              completed: false,
            })),
          });
        });

        await apiSaveSyllabus();
        showToast("Syllabus imported successfully!", "success");
        showDashboard();
      } else {
        showToast(result.message || "Failed to parse PDF.", "error");
      }
    } catch (err) {
      showToast("PDF parsing error.", "error");
    } finally {
      elements.pdfPromptTitle.textContent = "Drag & Drop Syllabus PDF Here";
      elements.pdfFileInput.value = "";
    }
  }

  /* DEMO DATA PREFILL */
  if (elements.btnPrefillDemo) {
    elements.btnPrefillDemo.addEventListener("click", async () => {
      state.user = { id: 1, email: "alex@college.edu", firstName: "Alex", isLoggedIn: true };
      state.subjects = [
        {
          id: "subj_demo_1",
          name: "Data Structures & Algorithms",
          topics: [
            { id: "d1", name: "Dynamic Programming & Memoization", needsFocus: true, isImportant: true, completed: false },
            { id: "d2", name: "Graph Traversals (BFS & DFS)", needsFocus: true, isImportant: false, completed: true },
            { id: "d3", name: "Binary Search Trees", needsFocus: false, isImportant: false, completed: false },
          ],
        },
        {
          id: "subj_demo_2",
          name: "Computer Organization & Architecture",
          topics: [
            { id: "c1", name: "Register Bus and Memory Transfer", needsFocus: false, isImportant: true, completed: false },
            { id: "c2", name: "Pipelining Concepts & Execution Stages", needsFocus: true, isImportant: true, completed: false },
          ],
        },
      ];

      if (elements.userDisplayName) elements.userDisplayName.textContent = "Alex";
      await apiSaveSyllabus();
      showToast("Loaded Demo Data!", "success");
      showDashboard();
    });
  }

  /* TODAY'S TOPIC SELECTOR & TIMETABLE */
  function renderTodayTopicSelector() {
    const container = elements.todayTopicSelector;
    if (!container) return;
    container.innerHTML = "";

    state.subjects.forEach((subject) => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "12px";

      card.innerHTML = `
        <div style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" class="subject-accordion-header">
          <label style="font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 10px;">
            <input type="checkbox" class="select-all-subject-topics" checked />
            <span>${escapeHtml(subject.name)}</span>
          </label>
        </div>
        <div class="subject-accordion-body" style="padding: 12px 16px;">
          ${subject.topics
          .map(
            (t) => `
            <label style="display: block; margin-bottom: 8px; font-size: 13px; cursor: pointer;">
              <input type="checkbox" class="today-topic-checkbox" data-topic-name="${escapeHtml(t.name)}" data-subj-name="${escapeHtml(subject.name)}" checked />
              <span style="margin-left: 6px;">${escapeHtml(t.name)}</span>
            </label>
          `
          )
          .join("")}
        </div>
      `;

      card.querySelector(".select-all-subject-topics").addEventListener("change", (e) => {
        card.querySelectorAll(".today-topic-checkbox").forEach((cb) => (cb.checked = e.target.checked));
      });

      container.appendChild(card);
    });
  }

  if (elements.generateScheduleForm) {
    elements.generateScheduleForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const checkedBoxes = elements.todayTopicSelector.querySelectorAll(".today-topic-checkbox:checked");
      if (checkedBoxes.length === 0) {
        showToast("Please select at least one topic.", "error");
        return;
      }

      const subjectMap = {};
      checkedBoxes.forEach((cb) => {
        const sName = cb.getAttribute("data-subj-name");
        const tName = cb.getAttribute("data-topic-name");
        if (!subjectMap[sName]) subjectMap[sName] = [];
        subjectMap[sName].push({ name: tName });
      });

      const activeSubjects = Object.keys(subjectMap).map((sName) => ({ name: sName, topics: subjectMap[sName] }));

      if (elements.btnSubmitTimetable) {
        elements.btnSubmitTimetable.textContent = "⏳ Generating Schedule...";
        elements.btnSubmitTimetable.disabled = true;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/generate-schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjects: activeSubjects,
            availableHours: parseFloat(elements.dailyHoursInput.value) || 3,
            startTime: elements.startTimeInput.value || "18:00",
            endTime: elements.endTimeInput.value || "23:00",
          }),
        });

        const result = await response.json();
        if (result.success && result.schedule && result.schedule[0] && result.schedule[0].slots) {
          elements.timetableResultsContainer.style.display = "block";
          elements.timetableCardsWrapper.innerHTML = result.schedule[0].slots
            .map(
              (slot) => `
            <div class="card" style="padding: 16px; border-left: 4px solid #4f46e5;">
              <div style="font-weight: 700; font-size: 15px;">⏰ ${escapeHtml(slot.time)}</div>
              <div style="color: #4f46e5; font-weight: 600; font-size: 16px; margin-top: 4px;">${escapeHtml(slot.subject)}</div>
              <div style="font-size: 14px; margin-top: 2px;">${escapeHtml(slot.topic)}</div>
            </div>
          `
            )
            .join("");
          showToast("AI Timetable generated!", "success");
          elements.timetableResultsContainer.scrollIntoView({ behavior: "smooth" });
        } else {
          showToast(result.message || "Could not generate schedule.", "error");
        }
      } catch (err) {
        showToast("Error generating timetable.", "error");
      } finally {
        if (elements.btnSubmitTimetable) {
          elements.btnSubmitTimetable.textContent = "⚡ Generate AI Timetable";
          elements.btnSubmitTimetable.disabled = false;
        }
      }
    });
  }

  // Theme Toggle
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nextTheme);
      elements.themeToggleBtn.textContent = nextTheme === "dark" ? "☀️" : "🌙";
    });
  }
});