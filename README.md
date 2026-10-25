# AI-Powered Study Planner

An end-to-end, full-stack **AI Study Planner** designed to streamline academic preparation by extracting syllabi from PDF documents, tracking weak and important topics, and generating optimized day-by-day study timetables using Google Gemini AI.

- **Frontend**: Responsive HTML5, Modern Vanilla CSS3 (Custom Design System with Light/Dark Mode), Vanilla JavaScript (ES6+ async/await)
- **Backend**: Python 3 with Flask REST API (`server.py`) and Flask-CORS
- **AI Engine**: Google GenAI SDK (`google-genai`) with Gemini models for PDF syllabus parsing and schedule generation
- **Database**: SQLite3 relational database (`study_planner.db`) with automatic migrations & relational integrity
- **Security**: Password hashing via `werkzeug.security` (`generate_password_hash` / `check_password_hash`)

---

## 📁 Project Structure

```text
AI---Powered-Study-Planner/
│
├── index.html         # 4-stage interactive interface (Auth, Syllabus, Planner, Timetable)
├── style.css          # Design system, themes (light/dark), card layouts, and print CSS
├── app.js             # Frontend application logic, DOM bindings, and async API calls
├── server.py          # Flask REST API, SQLite handlers, PDF parser, and Gemini AI integration
├── study_planner.db   # Local SQLite database (auto-created on first run)
├── requirements.txt   # Python dependency specifications
├── .env.example       # Template for environment variables
├── .env               # Local environment configuration (contains GEMINI_API_KEY)
├── .gitignore         # Ignores secrets, database files, and cache directories
├── test_backend.py    # Automated test suite covering auth, database, and syllabus persistence
└── README.md          # Comprehensive documentation & setup guide
```

---

## ⚙️ Quickstart & Setup Guide

### 1. Prerequisites
- Python 3.9+ installed and added to `PATH`
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Google Gemini API Key ([Get one free from Google AI Studio](https://aistudio.google.com/))

### 2. Environment Configuration
1. Clone or download the repository.
2. In the project root, create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and set your Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   FLASK_PORT=5000
   ```

### 3. Install Dependencies
Install all required Python packages using pip:
```bash
pip install -r requirements.txt
```

### 4. Run Automated Backend Tests
Verify database initialization, user registration, authentication, and syllabus persistence:
```bash
py test_backend.py
```
*(Or `python test_backend.py`)*

### 5. Start the Application Server
Run the Flask server:
```bash
py server.py
```
The server will initialize the SQLite schema and start serving on:
👉 **`http://127.0.0.1:5000`**

Open `http://127.0.0.1:5000` in your web browser.

---

## 🗄️ SQLite Database Schema & Migrations

The database (`study_planner.db`) consists of three relational tables with Foreign Keys and cascade deletions:

### 1. `users` Table
Stores student registration credentials and profile data:
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. `subjects` Table
Stores academic courses linked to each student:
```sql
CREATE TABLE subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### 3. `topics` Table
Stores individual study topics per subject, with prioritization flags:
```sql
CREATE TABLE topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    needs_focus INTEGER NOT NULL DEFAULT 0,  -- 1 = Weak topic (Needs Focus), 0 = Normal
    is_important INTEGER NOT NULL DEFAULT 0, -- 1 = Important / High-yield topic, 0 = Normal
    completed INTEGER NOT NULL DEFAULT 0,    -- 1 = Completed, 0 = Pending
    FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
);
```

*Note: `server.py` includes automatic non-destructive column migrations inside `init_db()` using `PRAGMA table_info` and `ALTER TABLE` to ensure backward compatibility with earlier database versions.*

---

## 🔌 REST API Reference

| Method | Endpoint | Description | Request Body / Parameters |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Registers a new student and securely hashes password | `{ "email": "...", "password": "...", "firstName": "...", "lastName": "..." }` |
| `POST` | `/login` | Authenticates student against hashed password in SQLite | `{ "email": "...", "password": "..." }` |
| `POST` | `/save-syllabus` | Persists subjects and unit topics with prioritization flags | `{ "userId": 1, "email": "...", "subjects": [...] }` |
| `GET` | `/get-syllabus` | Fetches saved subjects and topics for logged-in user | `?userId=1` or `?email=student@example.com` |
| `POST` | `/upload-syllabus-pdf` | Extracts clean academic subjects & units from PDF via Gemini | `multipart/form-data` with `file: <syllabus.pdf>` |
| `POST` | `/generate-schedule` | Generates AI timetable allocating 60% focus to weak topics | `{ "subjects": [...], "availableHours": 4, "startTime": "18:00", "endTime": "22:00" }` |
| `GET` | `/` | Serves the web frontend (`index.html`) | None |

---

## 💡 Key Features & Workflow

1. **User Authentication**: Secure sign-up and login with password hashing.
2. **Syllabus Ingestion**:
   - **AI PDF Parser**: Drag-and-drop university syllabus PDFs. The backend chunks pages, cleans noise (Course Outcomes, credit ratios, exam schemes), and uses Gemini AI to extract granular unit topics.
   - **Manual Course Builder**: Add custom courses and dynamically attach unit topics.
3. **Topic Prioritization**:
   - Flag topics as **"Needs Focus" (Weak)** or **"Important" (Starred)**.
   - Reorder or delete topics as needed.
4. **AI Timetable Generator**:
   - Specify daily available study hours and study time window (start & end times).
   - Gemini balances daily study blocks, weighting weak/important topics at ~60% and standard topics at ~40%.
5. **Print & PDF Export**:
   - One-click "Print / Save PDF" cleanly exports only the optimized timetable without UI navigation clutter.
6. **Theme Customization**:
   - Full dark mode and light mode toggle.

---

## 🧪 Testing

Execute the comprehensive test suite to validate all database queries and endpoints:
```bash
py test_backend.py
```
Expected output:
```text
=== AI Study Planner: Automated Backend Tests ===
[PASS] Database initialized with SQLite tables and migration support.
[PASS] User registration endpoint (/register) returned 201 Created.
[PASS] User login endpoint (/login) verified hashed password successfully.
[PASS] Syllabus persistence (/save-syllabus) saved subjects and topics.
[PASS] Syllabus retrieval (/get-syllabus) returned stored data accurately.
=== ALL 5 TESTS PASSED SUCCESSFULLY! ===
```
