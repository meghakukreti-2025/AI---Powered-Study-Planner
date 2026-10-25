# AI Study Planner (College Mini-Project)

A clean, modern, beginner-friendly **AI Study Planner** built with a full client-server architecture:
- **Frontend**: HTML5, Vanilla CSS3, and Plain JavaScript (ES6)
- **Backend**: Python 3 & Flask REST API (`server.py`)
- **Database**: SQLite3 relational database (`study_planner.db`)

---

## 📁 File Structure

```text
ai-study-planner/
│
├── index.html         # 4-step user interface with progress stepper
├── style.css          # Design system (light/dark mode, cards, responsive layout)
├── app.js             # Client controller & asynchronous fetch() API calls
├── server.py          # Lightweight Flask REST API & SQLite database handlers
├── study_planner.db   # SQLite database file (created automatically on startup)
├── test_backend.py    # Automated test script verifying API endpoints & DB
└── README.md          # Project documentation & viva explanation guide
```

---

## 🗄️ SQLite Database Schema

The database consists of three relational tables with Foreign Keys:

### 1. `users` Table
Stores student registration credentials:
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. `subjects` Table
Stores course names linked to the registered student (`user_id` FK):
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
Stores individual study topics linked to a subject (`subject_id` FK), including the **"Needs Extra Focus"** boolean:
```sql
CREATE TABLE topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    needs_focus INTEGER NOT NULL DEFAULT 0, -- 1 = Needs Extra Focus (Weak topic), 0 = Normal
    FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
);
```
## 🔌 Flask REST API Endpoints

| Method | Endpoint | Description | Payload / Query |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Hashes password & creates new student record in SQLite | `{ "email": "...", "password": "..." }` |
| `POST` | `/login` | Verifies password hash from SQLite | `{ "email": "...", "password": "..." }` |
| `POST` | `/save-syllabus` | Saves courses & topics with `needs_focus` flag | `{ "userId": 1, "email": "...", "subjects": [...] }` |
| `GET` | `/get-syllabus` | Retrieves saved courses & topics for logged-in user | `?email=student@college.edu` |
| `GET` | `/` | Serves `index.html` frontend directly | None |

---

## 🚀 How to Run the Project

1. **Start the Flask Backend**:
   Open a terminal in the project directory and run:
   ```bash
   py server.py
   ```
   *(Or `python server.py` depending on your environment)*.

2. **Open the Application**:
   - Open your browser to: **`http://127.0.0.1:5000`**
   - Alternatively, you can double-click **`index.html`** or use **Live Server**; CORS is fully configured to allow communication between both.

3. **Run Automated Tests**:
   To test all database operations and endpoints in one command:
   ```bash
   py test_backend.py
   ```
