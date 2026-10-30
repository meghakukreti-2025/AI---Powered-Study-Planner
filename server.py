import os
import json
import re
import uuid
import sqlite3
import datetime
import secrets
from datetime import timedelta
# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify
from flask_cors import CORS
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
# pyrefly: ignore[missing-import]
from werkzeug.security import generate_password_hash, check_password_hash
from aktu_demo_dataset import get_aktu_demo_dataset

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

load_dotenv()

app = Flask(__name__, static_folder=".", static_url_path="")
app.secret_key = os.getenv("SECRET_KEY", "cognify-study-planner-secret-key-default")
CORS(app, resources={r"/*": {"origins": "*"}})

if not os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") == "your_gemini_api_key_here":
    app.logger.info("Notice: GEMINI_API_KEY not configured. AI features will gracefully fall back to local deterministic algorithms.")

DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'study_planner.db')


def get_db_connection():
    """
    Creates and returns a connection to the SQLite database.
    Sets row_factory to sqlite3.Row for dict-like column access and enables foreign keys.
    """
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """
    Initializes the SQLite database tables:
    1. users: user credentials and profile
    2. subjects: academic courses linked to a user
    3. topics: unit topics linked to a subject (with needs_focus flag)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT DEFAULT '',
        last_name TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        needs_focus INTEGER NOT NULL DEFAULT 0,
        is_important INTEGER NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subjects_merge_backup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 0,
        merged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        primary_id INTEGER NOT NULL DEFAULT 0,
        secondary_id INTEGER NOT NULL DEFAULT 0,
        snapshot_json TEXT NOT NULL DEFAULT ''
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS syllabus_drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        filename TEXT DEFAULT '',
        draft_json TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_timetables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        schedule_json TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Non-destructive migrations for subjects and topics
    cursor.execute("PRAGMA table_info(subjects)")
    subj_cols = [row["name"] for row in cursor.fetchall()]
    if "code" not in subj_cols:
        cursor.execute("ALTER TABLE subjects ADD COLUMN code TEXT DEFAULT ''")
    if "semester" not in subj_cols:
        cursor.execute("ALTER TABLE subjects ADD COLUMN semester INTEGER DEFAULT 3")
    if "units_json" not in subj_cols:
        cursor.execute("ALTER TABLE subjects ADD COLUMN units_json TEXT DEFAULT ''")
    if "institution_type" not in subj_cols:
        cursor.execute("ALTER TABLE subjects ADD COLUMN institution_type TEXT DEFAULT 'university'")
    if "term_label" not in subj_cols:
        cursor.execute("ALTER TABLE subjects ADD COLUMN term_label TEXT DEFAULT 'Semester 3'")
    if "is_demo" not in subj_cols:
        cursor.execute("ALTER TABLE subjects ADD COLUMN is_demo INTEGER DEFAULT 0")

    cursor.execute("PRAGMA table_info(topics)")
    top_cols = [row["name"] for row in cursor.fetchall()]
    if "unit" not in top_cols:
        cursor.execute("ALTER TABLE topics ADD COLUMN unit INTEGER DEFAULT 1")

    cursor.execute("PRAGMA table_info(users)")
    user_cols = [row["name"] for row in cursor.fetchall()]
    if "display_name" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT ''")
    if "is_demo" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN is_demo INTEGER DEFAULT 0")
    if "institution_type" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN institution_type TEXT DEFAULT 'university'")
    if "academic_level" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN academic_level TEXT DEFAULT 'Semester 3'")
    if "created_at" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

    # Ensure demo guest user exists for seamless guest testing
    cursor.execute("SELECT id FROM users WHERE email = 'guest@college.edu'")
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users (id, email, password_hash, first_name, last_name, display_name) VALUES (999, 'guest@college.edu', ?, 'Guest', 'Student', 'Guest')",
            (generate_password_hash("guestPass123"),)
        )

    # Periodic safe cleanup: Remove expired temporary demo sessions older than 2 days
    try:
        cursor.execute("SELECT id FROM users WHERE is_demo = 1 AND created_at < datetime('now', '-2 days')")
        old_demo_ids = [r["id"] for r in cursor.fetchall()]
        if old_demo_ids:
            placeholders = ",".join("?" for _ in old_demo_ids)
            cursor.execute(f"DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE user_id IN ({placeholders}))", old_demo_ids)
            cursor.execute(f"DELETE FROM subjects WHERE user_id IN ({placeholders})", old_demo_ids)
            cursor.execute(f"DELETE FROM syllabus_drafts WHERE user_id IN ({placeholders})", old_demo_ids)
            cursor.execute(f"DELETE FROM user_timetables WHERE user_id IN ({placeholders})", old_demo_ids)
            cursor.execute(f"DELETE FROM password_resets WHERE user_id IN ({placeholders})", old_demo_ids)
            cursor.execute(f"DELETE FROM users WHERE id IN ({placeholders})", old_demo_ids)
    except Exception:
        pass

    conn.commit()
    conn.close()


# Auto-initialize database schema on startup
init_db()


def seed_aktu_demo_for_user(user_id, conn):
    """
    Populates the verified AKTU B.Tech CS/IT 2nd Year dataset for user_id.
    Ensures safe transactions and preloaded realistic study progress.
    """
    cursor = conn.cursor()
    dataset = get_aktu_demo_dataset()

    for s in dataset:
        cursor.execute(
            "INSERT INTO subjects (user_id, name, code, semester, units_json, is_demo) VALUES (?, ?, ?, ?, ?, 1)",
            (user_id, s["name"], s.get("code", ""), s.get("semester", 3), json.dumps(s.get("units", [])))
        )
        subject_id = cursor.lastrowid
        for t in s.get("topics", []):
            cursor.execute(
                "INSERT INTO topics (subject_id, name, unit, needs_focus, is_important, completed) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    subject_id,
                    t["name"],
                    t.get("unitNumber", 1),
                    1 if t.get("needsFocus") else 0,
                    1 if t.get("isImportant") else 0,
                    1 if t.get("completed") else 0
                )
            )


def get_user_syllabus(user_id, conn=None):
    """
    Fetches all subjects and their nested topics for a given user from SQLite.
    Supports backward-compatible topics array and hierarchical units.
    """
    close_conn = False
    if conn is None:
        conn = get_db_connection()
        close_conn = True

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM subjects WHERE user_id = ? ORDER BY id ASC", (user_id,))
    subj_rows = cursor.fetchall()
    subjects = []

    for s in subj_rows:
        cursor.execute(
            "SELECT id, name, needs_focus, is_important, completed, unit FROM topics WHERE subject_id = ? ORDER BY id ASC",
            (s["id"],)
        )
        top_rows = cursor.fetchall()
        topics = [
            {
                "id": f"top_{t['id']}",
                "name": t["name"],
                "unit": t["unit"] if "unit" in t.keys() else 1,
                "needsFocus": bool(t["needs_focus"]),
                "isImportant": bool(t["is_important"]),
                "completed": bool(t["completed"])
            }
            for t in top_rows
        ]

        units = []
        if "units_json" in s.keys() and s["units_json"]:
            try:
                units = json.loads(s["units_json"])
            except Exception:
                units = []

        subjects.append({
            "id": f"subj_{s['id']}",
            "name": s["name"],
            "title": s["name"],
            "code": s["code"] if "code" in s.keys() else "",
            "semester": s["semester"] if "semester" in s.keys() else 3,
            "institutionType": s["institution_type"] if "institution_type" in s.keys() and s["institution_type"] else "university",
            "termLabel": s["term_label"] if "term_label" in s.keys() and s["term_label"] else f"Semester {s['semester'] if 'semester' in s.keys() else 3}",
            "units": units,
            "topics": topics,
            "isDemo": bool(s["is_demo"]) if "is_demo" in s.keys() else False
        })

    if close_conn:
        conn.close()
    return subjects


try:
    # pyrefly: ignore [missing-import]
    from google import genai
    # pyrefly: ignore [missing-import]
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


@app.route("/")
def index():
    return app.send_static_file("index.html")


def clean_first_name(email, provided_name=""):
    """
    Derives clean first name without concatenating usernames or hardcoding for all users.
    """
    if provided_name and provided_name.strip():
        name = provided_name.strip()
        parts = name.split()
        return parts[0].capitalize() if parts else name.capitalize()

    prefix = email.split("@")[0].strip().lower() if email else ""
    # Split by standard delimiters like dots, dashes, underscores
    tokens = re.split(r'[._-]+', prefix) if prefix else []
    first_token = re.sub(r'\d+', '', tokens[0]).strip() if tokens else ""
    if first_token:
        return first_token.capitalize()
    return "Student"


# --- USER AUTHENTICATION & PROFILE ENDPOINTS ---
def serialize_user(user_row):
    """Safely serializes a user row into a client-facing JSON object without leaking password hash."""
    if not user_row:
        return None
    keys = user_row.keys() if hasattr(user_row, "keys") else []
    first_name = user_row["first_name"] if "first_name" in keys and user_row["first_name"] else clean_first_name(user_row["email"])
    display_name = user_row["display_name"] if "display_name" in keys and user_row["display_name"] else first_name
    institution_type = user_row["institution_type"] if "institution_type" in keys and user_row["institution_type"] else "university"
    academic_level = user_row["academic_level"] if "academic_level" in keys and user_row["academic_level"] else "Semester 3"
    is_demo = bool(user_row["is_demo"]) if "is_demo" in keys else False
    return {
        "id": user_row["id"],
        "email": user_row["email"],
        "firstName": first_name,
        "lastName": user_row["last_name"] if "last_name" in keys and user_row["last_name"] else "",
        "displayName": display_name,
        "institutionType": institution_type,
        "academicLevel": academic_level,
        "isDemo": is_demo
    }

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    confirm_password = data.get("confirmPassword", "").strip()
    first_name = clean_first_name(email, data.get("firstName", ""))
    last_name = data.get("lastName", "").strip()
    institution_type = data.get("institutionType", "university").strip().lower()
    if institution_type not in ["university", "school", "course"]:
        institution_type = "university"
    academic_level = data.get("academicLevel", "").strip()
    if not academic_level:
        academic_level = "Semester 1" if institution_type == "university" else ("Class 10" if institution_type == "school" else "Course 1")

    if not email:
        return jsonify({"success": False, "message": "Email is required."}), 400
    if not password:
        return jsonify({"success": False, "message": "Password is required."}), 400
    if len(password) < 12:
        return jsonify({"success": False, "message": "Password must be at least 12 characters long."}), 400
    if confirm_password and password != confirm_password:
        return jsonify({"success": False, "message": "Passwords do not match."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "message": "Email already registered. Please sign in."}), 400

    pwd_hash = generate_password_hash(password)
    cursor.execute(
        "INSERT INTO users (email, password_hash, first_name, last_name, display_name, institution_type, academic_level) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (email, pwd_hash, first_name, last_name, first_name, institution_type, academic_level)
    )
    user_id = cursor.lastrowid
    conn.commit()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user_row = cursor.fetchone()
    user_obj = serialize_user(user_row)
    conn.close()
    return jsonify({"success": True, "user": user_obj, "subjects": []}), 201

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    
    if not email:
        return jsonify({"success": False, "message": "Email is required."}), 400
    if not password:
        return jsonify({"success": False, "message": "Password is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user_row = cursor.fetchone()

    # Generic error message to prevent user enumeration; strictly do not auto-create on failed login
    if not user_row or not user_row["password_hash"]:
        conn.close()
        return jsonify({"success": False, "message": "Invalid email or password."}), 401

    if not check_password_hash(user_row["password_hash"], password):
        conn.close()
        return jsonify({"success": False, "message": "Invalid email or password."}), 401

    user_obj = serialize_user(user_row)
    subjects = get_user_syllabus(user_row["id"], conn)
    conn.close()
    return jsonify({"success": True, "user": user_obj, "subjects": subjects}), 200


@app.route("/logout", methods=["POST"])
def logout():
    return jsonify({"success": True, "message": "Logged out successfully."}), 200


@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    if not email:
        return jsonify({"success": False, "message": "Email is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    user_row = cursor.fetchone()
    if not user_row:
        conn.close()
        return jsonify({
            "success": True,
            "message": "If an account exists with this email, password reset instructions have been generated."
        }), 200

    user_id = user_row["id"]
    token = secrets.token_urlsafe(32)
    expires_at = datetime.datetime.utcnow() + timedelta(hours=1)
    cursor.execute(
        "INSERT INTO password_resets (user_id, token, expires_at, used) VALUES (?, ?, ?, 0)",
        (user_id, token, expires_at)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Password reset token generated. In a production environment, this link would be emailed.",
        "resetToken": token
    }), 200


@app.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    token = data.get("token", "").strip()
    new_password = data.get("newPassword", "").strip()
    confirm_password = data.get("confirmPassword", "").strip()

    if not token:
        return jsonify({"success": False, "message": "Reset token is required."}), 400
    if not new_password:
        return jsonify({"success": False, "message": "New password is required."}), 400
    if len(new_password) < 12:
        return jsonify({"success": False, "message": "Password must be at least 12 characters long."}), 400
    if confirm_password and new_password != confirm_password:
        return jsonify({"success": False, "message": "Passwords do not match."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM password_resets WHERE token = ? AND used = 0", (token,))
    reset_row = cursor.fetchone()
    if not reset_row:
        conn.close()
        return jsonify({"success": False, "message": "Invalid or expired reset token."}), 400

    expires_at_str = reset_row["expires_at"]
    try:
        if isinstance(expires_at_str, str):
            expires_at = datetime.datetime.fromisoformat(expires_at_str.replace(" ", "T"))
        else:
            expires_at = expires_at_str
        if datetime.datetime.utcnow() > expires_at:
            conn.close()
            return jsonify({"success": False, "message": "Reset token has expired. Please request a new one."}), 400
    except Exception:
        pass

    user_id = reset_row["user_id"]
    pwd_hash = generate_password_hash(new_password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pwd_hash, user_id))
    cursor.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (reset_row["id"],))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Password has been reset successfully. You can now log in."}), 200


@app.route("/update-academic-profile", methods=["POST"])
def update_academic_profile():
    data = request.get_json() or {}
    user_id = data.get("userId")
    institution_type = data.get("institutionType", "university").strip().lower()
    academic_level = data.get("academicLevel", "").strip()

    if not user_id:
        return jsonify({"success": False, "message": "User ID is required."}), 400
    if institution_type not in ["university", "school", "course"]:
        institution_type = "university"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET institution_type = ?, academic_level = ? WHERE id = ?",
        (institution_type, academic_level, user_id)
    )
    conn.commit()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user_row = cursor.fetchone()
    conn.close()

    if not user_row:
        return jsonify({"success": False, "message": "User not found."}), 404

    return jsonify({"success": True, "user": serialize_user(user_row)}), 200

"""
DEPRECATED DUPLICATE REGISTRATION AND LOGIN (SUPERSEDED ABOVE)
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    first_name = clean_first_name(email, data.get("firstName", ""))
    last_name = data.get("lastName", "").strip()

    if not email:
        return jsonify({"success": False, "message": "Email is required."}), 400
    if not password:
        return jsonify({"success": False, "message": "Password is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "message": "Email already registered. Please sign in."}), 400

    pwd_hash = generate_password_hash(password)
    cursor.execute(
        "INSERT INTO users (email, password_hash, first_name, last_name, display_name) VALUES (?, ?, ?, ?, ?)",
        (email, pwd_hash, first_name, last_name, first_name)
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    user_obj = {
        "id": user_id,
        "email": email,
        "firstName": first_name,
        "lastName": last_name,
        "displayName": first_name
    }
    return jsonify({"success": True, "user": user_obj, "subjects": []}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    
    if not email:
        return jsonify({"success": False, "message": "Email is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user_row = cursor.fetchone()

    if not user_row:
        # If user does not exist yet and password provided, automatically create account
        first_name = clean_first_name(email, data.get("firstName", ""))
        last_name = data.get("lastName", "").strip()
        pwd_hash = generate_password_hash(password) if password else ""
        cursor.execute(
            "INSERT INTO users (email, password_hash, first_name, last_name, display_name) VALUES (?, ?, ?, ?, ?)",
            (email, pwd_hash, first_name, last_name, first_name)
        )
        user_id = cursor.lastrowid
        conn.commit()
        user_obj = {
            "id": user_id,
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
            "displayName": first_name
        }
        conn.close()
        return jsonify({"success": True, "user": user_obj, "subjects": []}), 200

    # Verify password if user has hash and password was submitted
    if password and user_row["password_hash"]:
        if not check_password_hash(user_row["password_hash"], password):
            conn.close()
            return jsonify({"success": False, "message": "Invalid password."}), 401

    display_name = ""
    if "display_name" in user_row.keys() and user_row["display_name"]:
        display_name = user_row["display_name"]
    
    first_name = display_name or user_row["first_name"] or clean_first_name(user_row["email"])

    user_obj = {
        "id": user_row["id"],
        "email": user_row["email"],
        "firstName": first_name,
        "lastName": user_row["last_name"] or "",
        "displayName": first_name
    }
    subjects = get_user_syllabus(user_row["id"], conn)
    conn.close()
    return jsonify({"success": True, "user": user_obj, "subjects": subjects}), 200


"""
@app.route("/update-profile", methods=["POST"])
def update_profile():
    data = request.get_json() or {}
    user_id = data.get("userId")
    email = data.get("email", "").strip().lower()
    first_name = data.get("firstName", "").strip()
    display_name = data.get("displayName", "").strip() or first_name

    if not first_name and not display_name:
        return jsonify({"success": False, "message": "Name cannot be empty."}), 400

    final_name = display_name or first_name
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute(
            "UPDATE users SET first_name = ?, display_name = ? WHERE id = ?",
            (final_name, final_name, user_id)
        )
    elif email:
        cursor.execute(
            "UPDATE users SET first_name = ?, display_name = ? WHERE email = ?",
            (final_name, final_name, email)
        )
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "firstName": final_name,
        "displayName": final_name
    }), 200


@app.route("/demo-login", methods=["GET", "POST"])
def demo_login():
    """
    Phase 1 & 2: One-Click Instant Isolated Demo Login.
    - Creates a private, session-scoped demo user in SQLite (is_demo = 1)
    - Automatically seeds verified AKTU B.Tech CS/IT syllabus data (BCS301-303, BCS401-403, Labs, Workshops)
    - Preloads realistic sample study progress (~25% done, ~15% weak, ~15% imp)
    - Fully isolated per visitor with safe expiration
    """
    demo_uuid = str(uuid.uuid4())[:10]
    email = f"demo_{demo_uuid}@cognify.demo"
    first_name = "Demo Student"
    display_name = "Demo Student"

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute(
            "INSERT INTO users (email, password_hash, first_name, last_name, display_name, is_demo) VALUES (?, ?, ?, ?, ?, 1)",
            (email, "", first_name, "Visitor", display_name)
        )
        user_id = cursor.lastrowid
        seed_aktu_demo_for_user(user_id, conn)
        conn.commit()

        user_obj = {
            "id": user_id,
            "email": email,
            "firstName": first_name,
            "lastName": "Visitor",
            "displayName": display_name,
            "isDemo": True,
            "institutionType": "university",
            "academicLevel": "Semester 3",
            "demoToken": demo_uuid
        }
        subjects = get_user_syllabus(user_id, conn)
        conn.close()

        return jsonify({
            "success": True,
            "message": "Demo session initialized with AKTU curriculum.",
            "user": user_obj,
            "subjects": subjects,
            "isDemo": True
        }), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        app.logger.error("Demo login error: %s", e)
        return jsonify({"success": False, "message": f"Could not create demo session: {str(e)}"}), 500


@app.route("/reset-demo", methods=["POST"])
def reset_demo():
    """
    Phase 8: Resets the visitor's demo environment to default AKTU syllabus and sample progress.
    Restricted strictly to demo users (is_demo = 1).
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or data.get("user_id")
    email = (data.get("email") or "").strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor()
    if not user_id and email:
        row = cursor.execute("SELECT id, is_demo FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
        if row:
            user_id = row["id"]
            if not row["is_demo"]:
                conn.close()
                return jsonify({"success": False, "message": "Cannot reset a non-demo user account."}), 403

    if not user_id:
        conn.close()
        return jsonify({"success": False, "message": "Demo User ID required."}), 400

    try:
        cursor.execute("SELECT id, is_demo FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        if not user_row or not user_row["is_demo"]:
            conn.close()
            return jsonify({"success": False, "message": "Unauthorized or not a demo session."}), 403

        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE user_id = ?)", (user_id,))
        cursor.execute("DELETE FROM subjects WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM syllabus_drafts WHERE user_id = ?", (user_id,))

        seed_aktu_demo_for_user(user_id, conn)
        conn.commit()

        updated_subjects = get_user_syllabus(user_id, conn)
        conn.close()

        return jsonify({
            "success": True,
            "message": "Demo curriculum and sample progress reset successfully.",
            "subjects": updated_subjects
        }), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/exit-demo", methods=["POST"])
def exit_demo():
    """
    Phase 8: Safely terminates the visitor's isolated demo session and cleans up temporary records.
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or data.get("user_id")
    email = (data.get("email") or "").strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor()
    if not user_id and email:
        row = cursor.execute("SELECT id, is_demo FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
        if row:
            user_id = row["id"]

    if user_id:
        try:
            cursor.execute("SELECT id, is_demo FROM users WHERE id = ?", (user_id,))
            user_row = cursor.fetchone()
            if user_row and user_row["is_demo"]:
                cursor.execute("BEGIN IMMEDIATE")
                cursor.execute("DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE user_id = ?)", (user_id,))
                cursor.execute("DELETE FROM subjects WHERE user_id = ?", (user_id,))
                cursor.execute("DELETE FROM syllabus_drafts WHERE user_id = ?", (user_id,))
                cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
                conn.commit()
        except Exception:
            conn.rollback()

    conn.close()
    return jsonify({"success": True, "message": "Demo session ended."}), 200


@app.route("/load-demo-curriculum", methods=["POST"])
def load_demo_curriculum():
    """
    Phase 6: Loads verified AKTU demo subjects into a registered user's account safely:
    - Idempotent: replaces or updates only demo-tagged subjects (is_demo = 1)
    - Strictly preserves existing user-created and PDF-uploaded subjects (is_demo = 0)
    - Recalculates stats
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or data.get("user_id")
    email = (data.get("email") or "").strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor()
    if not user_id and email:
        row = cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
        if row:
            user_id = row["id"]

    if not user_id:
        conn.close()
        return jsonify({"success": False, "message": "User ID required."}), 400

    try:
        cursor.execute("BEGIN IMMEDIATE")
        # Remove any previously loaded demo subjects for this user (preserves user's real subjects is_demo = 0)
        cursor.execute("DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE user_id = ? AND is_demo = 1)", (user_id,))
        cursor.execute("DELETE FROM subjects WHERE user_id = ? AND is_demo = 1", (user_id,))

        seed_aktu_demo_for_user(user_id, conn)
        conn.commit()

        updated_subjects = get_user_syllabus(user_id, conn)

        # Recalculate stats
        cursor.execute("SELECT COUNT(*) FROM subjects WHERE user_id = ?", (user_id,))
        total_subjs = cursor.fetchone()[0]
        cursor.execute(
            "SELECT COUNT(t.id), SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) "
            "FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.user_id = ?",
            (user_id,)
        )
        t_row = cursor.fetchone()
        total_topics = t_row[0] or 0
        completed_topics = t_row[1] or 0
        overall_progress = round((completed_topics / total_topics * 100), 1) if total_topics > 0 else 0

        cursor.execute("SELECT units_json FROM subjects WHERE user_id = ?", (user_id,))
        total_units = 0
        for r in cursor.fetchall():
            if r["units_json"]:
                try:
                    total_units += len(json.loads(r["units_json"]))
                except Exception:
                    total_units += 1
            else:
                total_units += 1

        stats = {
            "total_subjects": total_subjs,
            "total_units": total_units,
            "total_topics": total_topics,
            "completed_topics": completed_topics,
            "overall_progress": overall_progress
        }
        conn.close()

        return jsonify({
            "success": True,
            "message": "AKTU B.Tech demo curriculum loaded successfully without affecting your personal subjects.",
            "subjects": updated_subjects,
            "stats": stats
        }), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/save-syllabus", methods=["POST"])
def save_syllabus():
    data = request.get_json() or {}
    user_id = data.get("userId")
    email = data.get("email", "").strip().lower()
    subjects = data.get("subjects", [])

    conn = get_db_connection()
    cursor = conn.cursor()

    if not user_id and email:
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            user_id = row["id"]
        else:
            # Auto-create user record if not present
            cursor.execute(
                "INSERT INTO users (email, password_hash, first_name) VALUES (?, ?, ?)",
                (email, generate_password_hash("autoPass123"), clean_first_name(email))
            )
            user_id = cursor.lastrowid
            conn.commit()

    if not user_id:
        conn.close()
        return jsonify({"success": False, "message": "Missing user identification."}), 400

    try:
        # Delete prior subjects for user (cascades to topics)
        cursor.execute("SELECT id FROM subjects WHERE user_id = ?", (user_id,))
        old_subjs = cursor.fetchall()
        old_ids = [s["id"] for s in old_subjs]
        if old_ids:
            cursor.execute(f"DELETE FROM topics WHERE subject_id IN ({','.join(['?']*len(old_ids))})", old_ids)
        cursor.execute("DELETE FROM subjects WHERE user_id = ?", (user_id,))

        for sub in subjects:
            s_name = sub.get("name") or sub.get("title") or "General Study"
            s_code = sub.get("code", "")
            s_sem = int(sub.get("semester", 3))
            units_data = sub.get("units", [])
            units_json_str = json.dumps(units_data) if units_data else ""
            s_inst = sub.get("institutionType") or sub.get("institution_type") or "university"
            s_term = sub.get("termLabel") or sub.get("term_label") or (f"Class {sub.get('classLevel', s_sem)}" if s_inst == "school" else (f"Course {s_code or s_name}" if s_inst == "course" else f"Semester {s_sem}"))

            cursor.execute(
                "INSERT INTO subjects (user_id, name, code, semester, units_json, institution_type, term_label) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, s_name, s_code, s_sem, units_json_str, s_inst, s_term)
            )
            new_subj_id = cursor.lastrowid

            sub_topics = sub.get("topics", [])
            for top in sub_topics:
                if isinstance(top, dict):
                    t_name = top.get("name") or top.get("title") or ""
                    needs_focus = 1 if (top.get("needsFocus") or top.get("needs_focus")) else 0
                    is_important = 1 if (top.get("isImportant") or top.get("is_important")) else 0
                    completed = 1 if top.get("completed") else 0
                    unit_val = int(top.get("unit", 1))
                else:
                    t_name = str(top).strip()
                    needs_focus = 0
                    is_important = 0
                    completed = 0
                    unit_val = 1

                if t_name:
                    cursor.execute(
                        "INSERT INTO topics (subject_id, name, needs_focus, is_important, completed, unit) VALUES (?, ?, ?, ?, ?, ?)",
                        (new_subj_id, t_name, needs_focus, is_important, completed, unit_val)
                    )

        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Syllabus synced."}), 200

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500


@app.route("/get-syllabus", methods=["GET"])
def get_syllabus():
    user_id = request.args.get("userId")
    email = request.args.get("email", "").strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor()

    if not user_id and email:
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            user_id = row["id"]

    if not user_id:
        conn.close()
        return jsonify({"success": True, "subjects": []}), 200

    subjects_list = get_user_syllabus(user_id, conn)
    conn.close()
    return jsonify({"success": True, "subjects": subjects_list}), 200


def normalize_subject_title(name: str) -> str:
    if not name:
        return ""
    s = name.lower().strip()
    s = s.replace("&", "and")
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def is_lab_subject(name: str) -> bool:
    return bool(re.search(r"\b(lab|laboratory|workshop|practical)\b", (name or "").lower()))


def normalize_topic_title(name: str) -> str:
    if not name:
        return ""
    s = name.lower().strip()
    s = re.sub(r"^(unit\s+[ivx\d]+[:\-.]?\s*|module\s+[\d]+[:\-.]?\s*|topic\s+[\d]+[:\-.]?\s*)", "", s)
    s = s.replace("&", "and")
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def find_duplicate_pairs(subjects):
    candidates = []
    n = len(subjects)
    for i in range(n):
        for j in range(i + 1, n):
            s1 = subjects[i]
            s2 = subjects[j]

            # 1. Must belong to the same semester
            sem1 = s1.get("semester", 3)
            sem2 = s2.get("semester", 3)
            if sem1 != sem2:
                continue

            # 2. Must be both lab or both theory
            n1_raw = s1.get("name") or s1.get("title") or ""
            n2_raw = s2.get("name") or s2.get("title") or ""
            lab1 = is_lab_subject(n1_raw)
            lab2 = is_lab_subject(n2_raw)
            if lab1 != lab2:
                continue

            # 3. Check course codes
            c1 = (s1.get("code") or "").strip().upper()
            c2 = (s2.get("code") or "").strip().upper()
            if c1 and c2 and c1 != c2:
                continue

            norm1 = normalize_subject_title(n1_raw)
            norm2 = normalize_subject_title(n2_raw)

            is_match = False
            reason = ""
            if norm1 == norm2:
                is_match = True
                reason = "Exact subject name match"
            elif c1 and c2 and c1 == c2:
                is_match = True
                reason = f"Matching course code ({c1})"
            else:
                w1 = set(norm1.split()) - {"and", "the", "of", "in", "&"}
                w2 = set(norm2.split()) - {"and", "the", "of", "in", "&"}
                overlap = w1 & w2
                union = w1 | w2
                jaccard = len(overlap) / len(union) if union else 0
                if jaccard >= 0.65 or w1.issubset(w2) or w2.issubset(w1):
                    is_match = True
                    reason = f"High keyword overlap ({int(jaccard*100)}%)"

            if is_match:
                t1_len = len(s1.get("topics", []))
                t2_len = len(s2.get("topics", []))
                if t1_len >= t2_len:
                    keep, merge = s1, s2
                else:
                    keep, merge = s2, s1

                candidates.append({
                    "keepSubject": keep,
                    "mergeSubject": merge,
                    "subject1": keep,
                    "subject2": merge,
                    "reason": reason,
                    "confidence": "High" if "Exact" in reason or "Matching" in reason else "Medium"
                })
    return candidates


def parse_raw_subject_id(val):
    if val is None:
        return None
    if isinstance(val, int):
        return val
    s = str(val).replace("subj_", "").strip()
    if s.isdigit():
        return int(s)
    return None


@app.route("/detect-duplicates", methods=["POST", "GET"])
def detect_duplicates_route():
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or data.get("user_id") or request.args.get("userId") or request.args.get("user_id")
    email = (data.get("email") or request.args.get("email") or "").strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor()
    if not user_id and email:
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            user_id = row["id"]

    if not user_id:
        conn.close()
        return jsonify({"success": False, "message": "User identification required."}), 400

    try:
        user_id = int(user_id)
    except ValueError:
        conn.close()
        return jsonify({"success": False, "message": "Invalid user_id."}), 400

    subjects = get_user_syllabus(user_id, conn)
    conn.close()

    duplicates = find_duplicate_pairs(subjects)
    return jsonify({
        "success": True,
        "duplicates": duplicates,
        "count": len(duplicates)
    }), 200


@app.route("/merge-duplicates", methods=["POST"])
def merge_duplicates_route():
    """
    Safely merges duplicate subjects:
    - Supports specific pairs array, single pair, or automatic duplicate detection
    - Atomic SQLite transaction with backup snapshot
    - Combines unique units and unique topics
    - Preserves completed, needs_focus, and is_important flags using OR logic
    - Recalculates and updates statistics
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or data.get("user_id")
    email = (data.get("email") or "").strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor()
    if not user_id and email:
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            user_id = row["id"]

    if not user_id:
        conn.close()
        return jsonify({"success": False, "message": "User identification required."}), 400

    try:
        user_id = int(user_id)
    except ValueError:
        conn.close()
        return jsonify({"success": False, "message": "Invalid user_id."}), 400

    pairs_to_process = []
    if "pairs" in data and isinstance(data["pairs"], list) and len(data["pairs"]) > 0:
        pairs_to_process = data["pairs"]
    elif data.get("primary_id") or data.get("primaryId") or data.get("keepId"):
        p_id_raw = data.get("primary_id") or data.get("primaryId") or data.get("keepId")
        s_id_raw = data.get("secondary_id") or data.get("secondaryId") or data.get("mergeId")
        pairs_to_process = [{"primary_id": p_id_raw, "secondary_id": s_id_raw}]
    else:
        subjects = get_user_syllabus(user_id, conn)
        dups = find_duplicate_pairs(subjects)
        for d in dups:
            pairs_to_process.append({
                "primary_id": d["keepSubject"]["id"],
                "secondary_id": d["mergeSubject"]["id"],
                "reason": d.get("reason", "Duplicate merge")
            })

    if not pairs_to_process:
        updated_subjs = get_user_syllabus(user_id, conn)
        conn.close()
        return jsonify({
            "success": True,
            "message": "No duplicate subjects to merge.",
            "subjects": updated_subjs,
            "mergedCount": 0
        }), 200

    try:
        cursor.execute("BEGIN IMMEDIATE")
        merged_count = 0
        merged_details = []

        for p in pairs_to_process:
            p_id_raw = p.get("primary_id") or p.get("keepId") or (p.get("keepSubject", {}).get("id"))
            s_id_raw = p.get("secondary_id") or p.get("mergeId") or (p.get("mergeSubject", {}).get("id"))

            p_id = parse_raw_subject_id(p_id_raw)
            s_id = parse_raw_subject_id(s_id_raw)

            if not p_id or not s_id or p_id == s_id:
                continue

            # Verify both subjects belong to user
            cursor.execute("SELECT id, name, code, semester, units_json FROM subjects WHERE id = ? AND user_id = ?", (p_id, user_id))
            primary_row = cursor.fetchone()
            cursor.execute("SELECT id, name, code, semester, units_json FROM subjects WHERE id = ? AND user_id = ?", (s_id, user_id))
            secondary_row = cursor.fetchone()

            if not primary_row or not secondary_row:
                continue

            # Fetch topics for both
            cursor.execute("SELECT id, name, completed, is_important, needs_focus, unit FROM topics WHERE subject_id = ? ORDER BY id ASC", (p_id,))
            primary_topics = [dict(r) for r in cursor.fetchall()]

            cursor.execute("SELECT id, name, completed, is_important, needs_focus, unit FROM topics WHERE subject_id = ? ORDER BY id ASC", (s_id,))
            secondary_topics = [dict(r) for r in cursor.fetchall()]

            # 1. Safe backup snapshot
            snapshot_payload = {
                "primary": {
                    "id": p_id,
                    "name": primary_row["name"],
                    "code": primary_row["code"],
                    "semester": primary_row["semester"],
                    "units_json": primary_row["units_json"],
                    "topics": primary_topics
                },
                "secondary": {
                    "id": s_id,
                    "name": secondary_row["name"],
                    "code": secondary_row["code"],
                    "semester": secondary_row["semester"],
                    "units_json": secondary_row["units_json"],
                    "topics": secondary_topics
                }
            }
            cursor.execute(
                "INSERT INTO subjects_merge_backup (user_id, primary_id, secondary_id, snapshot_json) VALUES (?, ?, ?, ?)",
                (user_id, p_id, s_id, json.dumps(snapshot_payload))
            )

            # 2. Merge topics with OR logic
            merged_topics_map = {}
            for t in primary_topics:
                norm = normalize_topic_title(t["name"])
                merged_topics_map[norm] = {
                    "name": t["name"],
                    "unit": t.get("unit", 1) or 1,
                    "needs_focus": int(bool(t.get("needs_focus"))),
                    "is_important": int(bool(t.get("is_important"))),
                    "completed": int(bool(t.get("completed"))),
                }

            for t in secondary_topics:
                norm = normalize_topic_title(t["name"])
                if norm in merged_topics_map:
                    merged_topics_map[norm]["needs_focus"] = int(bool(merged_topics_map[norm]["needs_focus"]) or bool(t.get("needs_focus")))
                    merged_topics_map[norm]["is_important"] = int(bool(merged_topics_map[norm]["is_important"]) or bool(t.get("is_important")))
                    merged_topics_map[norm]["completed"] = int(bool(merged_topics_map[norm]["completed"]) or bool(t.get("completed")))
                    if (not merged_topics_map[norm]["unit"] or merged_topics_map[norm]["unit"] == 1) and t.get("unit"):
                        merged_topics_map[norm]["unit"] = t.get("unit")
                else:
                    merged_topics_map[norm] = {
                        "name": t["name"],
                        "unit": t.get("unit", 1) or 1,
                        "needs_focus": int(bool(t.get("needs_focus"))),
                        "is_important": int(bool(t.get("is_important"))),
                        "completed": int(bool(t.get("completed"))),
                    }

            merged_topic_list = list(merged_topics_map.values())

            # 3. Merge units if units_json is present
            p_units = []
            if primary_row["units_json"]:
                try:
                    p_units = json.loads(primary_row["units_json"])
                except Exception:
                    p_units = []

            s_units = []
            if secondary_row["units_json"]:
                try:
                    s_units = json.loads(secondary_row["units_json"])
                except Exception:
                    s_units = []

            combined_units = []
            if p_units or s_units:
                unit_map = {}
                for u in (p_units + s_units):
                    unum = u.get("unitNumber", 1)
                    utitle = u.get("unitTitle", f"Unit {unum}")
                    if unum not in unit_map:
                        unit_map[unum] = {
                            "unitNumber": unum,
                            "unitTitle": utitle,
                            "topics": []
                        }
                    elif len(utitle) > len(unit_map[unum]["unitTitle"]):
                        unit_map[unum]["unitTitle"] = utitle

                for t in merged_topic_list:
                    unum = t.get("unit", 1) or 1
                    if unum not in unit_map:
                        unit_map[unum] = {
                            "unitNumber": unum,
                            "unitTitle": f"Unit {unum}",
                            "topics": []
                        }
                    unit_map[unum]["topics"].append({
                        "name": t["name"],
                        "needsFocus": bool(t["needs_focus"]),
                        "isImportant": bool(t["is_important"]),
                        "completed": bool(t["completed"])
                    })
                combined_units = sorted(unit_map.values(), key=lambda x: x.get("unitNumber", 1))

            final_code = primary_row["code"] or secondary_row["code"]
            cursor.execute(
                "UPDATE subjects SET code = ?, units_json = ? WHERE id = ?",
                (final_code, json.dumps(combined_units) if combined_units else "", p_id)
            )

            # Re-insert merged topics
            cursor.execute("DELETE FROM topics WHERE subject_id = ? OR subject_id = ?", (p_id, s_id))
            for t in merged_topic_list:
                cursor.execute(
                    "INSERT INTO topics (subject_id, name, unit, needs_focus, is_important, completed) VALUES (?, ?, ?, ?, ?, ?)",
                    (p_id, t["name"], t.get("unit", 1), t["needs_focus"], t["is_important"], t["completed"])
                )

            # Delete secondary subject
            cursor.execute("DELETE FROM subjects WHERE id = ?", (s_id,))
            merged_count += 1
            merged_details.append({
                "keptSubject": primary_row["name"],
                "mergedSubject": secondary_row["name"],
                "reason": p.get("reason", "Duplicate merge")
            })

        conn.commit()

        # Recalculate stats
        cursor.execute("SELECT COUNT(*) FROM subjects WHERE user_id = ?", (user_id,))
        total_subjs = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(t.id), SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) "
            "FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.user_id = ?",
            (user_id,)
        )
        t_row = cursor.fetchone()
        total_topics = t_row[0] or 0
        completed_topics = t_row[1] or 0
        overall_progress = round((completed_topics / total_topics * 100), 1) if total_topics > 0 else 0

        cursor.execute("SELECT units_json FROM subjects WHERE user_id = ?", (user_id,))
        total_units = 0
        for r in cursor.fetchall():
            if r["units_json"]:
                try:
                    total_units += len(json.loads(r["units_json"]))
                except Exception:
                    total_units += 1
            else:
                total_units += 1

        stats = {
            "total_subjects": total_subjs,
            "total_units": total_units,
            "total_topics": total_topics,
            "completed_topics": completed_topics,
            "overall_progress": overall_progress
        }

        updated_subjects = get_user_syllabus(user_id, conn)
        conn.close()

        return jsonify({
            "success": True,
            "message": f"Successfully merged {merged_count} duplicate subject(s).",
            "mergedCount": merged_count,
            "mergedDetails": merged_details,
            "subjects": updated_subjects,
            "stats": stats
        }), 200

    except Exception as e:
        conn.rollback()
        conn.close()
        app.logger.error("Merge duplicates error: %s", e)
        return jsonify({"success": False, "message": f"Failed to merge subjects: {str(e)}"}), 500


@app.route("/edit-subject", methods=["POST"])
def edit_subject_endpoint():
    """
    Updates subject metadata (name, code, semester, units) and its topics.
    Preserves existing progress flags (completed, needsFocus, isImportant).
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or data.get("user_id")
    email = (data.get("email") or "").strip().lower()
    subject_id_raw = data.get("subjectId") or data.get("subject_id")
    name = (data.get("name") or data.get("title") or "").strip()
    code = (data.get("code") or "").strip().upper()
    semester = data.get("semester") or 3
    units = data.get("units") or []
    topics = data.get("topics") or []
    institution_type = data.get("institutionType") or data.get("institution_type") or "university"
    term_label = data.get("termLabel") or data.get("term_label") or (f"Class {semester}" if institution_type == "school" else (f"Course {code or name}" if institution_type == "course" else f"Semester {semester}"))

    conn = get_db_connection()
    cursor = conn.cursor()

    if not user_id and email:
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
        row = cursor.fetchone()
        if row:
            user_id = row["id"]

    if not user_id or not subject_id_raw or not name:
        conn.close()
        return jsonify({"success": False, "message": "User ID, Subject ID, and Subject Name are required."}), 400

    s_id = parse_raw_subject_id(subject_id_raw)
    if not s_id:
        conn.close()
        return jsonify({"success": False, "message": "Invalid Subject ID."}), 400

    try:
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("SELECT id, name, code, semester, units_json FROM subjects WHERE id = ? AND user_id = ?", (s_id, user_id))
        subj_row = cursor.fetchone()
        if not subj_row:
            conn.rollback()
            conn.close()
            return jsonify({"success": False, "message": "Subject not found or unauthorized."}), 404

        # Fetch existing topics to preserve progress flags
        cursor.execute("SELECT id, name, needs_focus, is_important, completed, unit FROM topics WHERE subject_id = ?", (s_id,))
        existing_topics = cursor.fetchall()
        existing_map = {}
        for t in existing_topics:
            existing_map[normalize_topic_title(t["name"])] = t
            existing_map[str(t["id"])] = t

        # Update subject metadata
        cursor.execute(
            "UPDATE subjects SET name = ?, code = ?, semester = ?, units_json = ?, institution_type = ?, term_label = ? WHERE id = ?",
            (name, code, int(semester), json.dumps(units) if units else "", institution_type, term_label, s_id)
        )

        flat_topics = []
        if units:
            for u in units:
                unum = u.get("unitNumber", 1)
                for t in u.get("topics", []):
                    t_name = t.get("name") if isinstance(t, dict) else str(t)
                    if t_name and t_name.strip():
                        flat_topics.append({
                            "name": t_name.strip(),
                            "unit": unum,
                            "needsFocus": t.get("needsFocus", False) if isinstance(t, dict) else False,
                            "isImportant": t.get("isImportant", False) if isinstance(t, dict) else False,
                            "completed": t.get("completed", False) if isinstance(t, dict) else False,
                            "id": t.get("id") if isinstance(t, dict) else None
                        })
        elif topics:
            for t in topics:
                t_name = t.get("name") if isinstance(t, dict) else str(t)
                if t_name and t_name.strip():
                    flat_topics.append({
                        "name": t_name.strip(),
                        "unit": t.get("unit", 1) if isinstance(t, dict) else 1,
                        "needsFocus": t.get("needsFocus", False) if isinstance(t, dict) else False,
                        "isImportant": t.get("isImportant", False) if isinstance(t, dict) else False,
                        "completed": t.get("completed", False) if isinstance(t, dict) else False,
                        "id": t.get("id") if isinstance(t, dict) else None
                    })

        cursor.execute("DELETE FROM topics WHERE subject_id = ?", (s_id,))
        for t in flat_topics:
            norm = normalize_topic_title(t["name"])
            existing = existing_map.get(norm)
            if not existing and t.get("id"):
                existing = existing_map.get(str(t["id"]).replace("top_", ""))

            completed = 1 if (t["completed"] or (existing and existing["completed"])) else 0
            needs_focus = 1 if (t["needsFocus"] or (existing and existing["needs_focus"])) else 0
            is_important = 1 if (t["isImportant"] or (existing and existing["is_important"])) else 0

            cursor.execute(
                "INSERT INTO topics (subject_id, name, unit, needs_focus, is_important, completed) VALUES (?, ?, ?, ?, ?, ?)",
                (s_id, t["name"], t.get("unit", 1), needs_focus, is_important, completed)
            )

        conn.commit()

        # Recalculate stats
        cursor.execute("SELECT COUNT(*) FROM subjects WHERE user_id = ?", (user_id,))
        total_subjs = cursor.fetchone()[0]
        cursor.execute(
            "SELECT COUNT(t.id), SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) "
            "FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.user_id = ?",
            (user_id,)
        )
        t_row = cursor.fetchone()
        total_topics = t_row[0] or 0
        completed_topics = t_row[1] or 0
        overall_progress = round((completed_topics / total_topics * 100), 1) if total_topics > 0 else 0

        cursor.execute("SELECT units_json FROM subjects WHERE user_id = ?", (user_id,))
        total_units = 0
        for r in cursor.fetchall():
            if r["units_json"]:
                try:
                    total_units += len(json.loads(r["units_json"]))
                except Exception:
                    total_units += 1
            else:
                total_units += 1

        stats = {
            "total_subjects": total_subjs,
            "total_units": total_units,
            "total_topics": total_topics,
            "completed_topics": completed_topics,
            "overall_progress": overall_progress
        }

        updated_subjects = get_user_syllabus(user_id, conn)
        conn.close()

        updated_subj = next((s for s in updated_subjects if s["id"] == f"subj_{s_id}" or s["id"] == s_id), None)
        return jsonify({
            "success": True,
            "message": f"Updated subject '{name}' successfully.",
            "subject": updated_subj,
            "subjects": updated_subjects,
            "stats": stats
        }), 200

    except Exception as e:
        conn.rollback()
        conn.close()
        app.logger.error("Edit subject error: %s", e)
        return jsonify({"success": False, "message": f"Failed to edit subject: {str(e)}"}), 500


@app.route("/save-draft", methods=["POST"])
def save_draft_endpoint():
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or data.get("user_id")
    email = (data.get("email") or "").strip().lower()
    filename = data.get("filename", "")
    draft_data = data.get("draft") or data.get("draftJson")

    conn = get_db_connection()
    cursor = conn.cursor()

    if not user_id and email:
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
        row = cursor.fetchone()
        if row:
            user_id = row["id"]

    if not user_id or not draft_data:
        conn.close()
        return jsonify({"success": False, "message": "User ID and draft data required."}), 400

    try:
        cursor.execute("DELETE FROM syllabus_drafts WHERE user_id = ?", (user_id,))
        cursor.execute(
            "INSERT INTO syllabus_drafts (user_id, filename, draft_json) VALUES (?, ?, ?)",
            (user_id, filename, json.dumps(draft_data))
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Draft saved successfully."}), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/get-draft", methods=["GET"])
def get_draft_endpoint():
    user_id = request.args.get("userId") or request.args.get("user_id")
    email = (request.args.get("email") or "").strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor()

    if not user_id and email:
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
        row = cursor.fetchone()
        if row:
            user_id = row["id"]

    if not user_id:
        conn.close()
        return jsonify({"success": True, "hasDraft": False, "draft": None}), 200

    cursor.execute("SELECT filename, draft_json, updated_at FROM syllabus_drafts WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"success": True, "hasDraft": False, "draft": None}), 200

    try:
        draft = json.loads(row["draft_json"])
        return jsonify({
            "success": True,
            "hasDraft": True,
            "filename": row["filename"],
            "updatedAt": row["updated_at"],
            "draft": draft
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/discard-draft", methods=["POST"])
def discard_draft_endpoint():
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or data.get("user_id")
    email = (data.get("email") or "").strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor()

    if not user_id and email:
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
        row = cursor.fetchone()
        if row:
            user_id = row["id"]

    if not user_id:
        conn.close()
        return jsonify({"success": True, "message": "No draft to discard."}), 200

    cursor.execute("DELETE FROM syllabus_drafts WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Draft discarded."}), 200


# Uploads Directory for PDF Previews
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


@app.route('/uploads/<path:filename>')
def serve_uploaded_file(filename):
    # pyrefly: ignore[missing-import]
    from flask import send_from_directory
    return send_from_directory(UPLOADS_DIR, filename)


def is_evaluation_scheme_page(text):
    upper = text.upper()
    # If the page clearly contains multiple unit syllabus sections (e.g. Unit-I, Unit 1, Module 1), it's a syllabus content page
    unit_matches = len(re.findall(r'\b(UNIT\s*[-–—]?\s*(?:[IVX\d]+)|MODULE\s*[-–—]?\s*\d+)\b', upper))
    if unit_matches >= 2:
        return False

    scheme_keywords = [
        "EVALUATION SCHEME", "STUDY AND EVALUATION SCHEME", "STUDY & EVALUATION SCHEME",
        "SCHEME OF EVALUATION", "TEACHING SCHEME", "CREDIT SCHEME",
        "STRUCTURE OF STUDY", "SEMESTER-III", "SEMESTER-IV", "SEMESTER-V",
        "SEMESTER III", "SEMESTER IV", "SEMESTER V", "SEMESTER I", "SEMESTER II",
        "SCHEME OF INSTRUCTION", "EXAMINATION SCHEME"
    ]
    has_scheme_keyword = any(kw in upper for kw in scheme_keywords)

    table_markers = [
        "L T P", "L-T-P", "L:T:P", "CT TA", "CT", "TA", "ESE", "SW+ESE",
        "TOTAL MARKS", "TOTAL CREDIT", "COURSE CODE", "SUBJECT CODE",
        "SESSIONAL", "END SEMESTER", "PERIODS"
    ]
    table_score = sum(1 for tm in table_markers if tm in upper)

    if has_scheme_keyword and (table_score >= 2 or "L T P" in upper or "CT TA" in upper):
        return True

    if ("SUBJECT CODE" in upper or "COURSE CODE" in upper or "S.NO" in upper or "SN " in upper) and ("L T P" in upper or "CT TA" in upper or "ESE" in upper):
        return True

    return False


def is_lab_or_practical_subject(name):
    lower = name.lower()
    lab_keywords = [
        " lab", " laboratory", " practical", " workshop", " seminar",
        " mini project", " internship", " viva", " viva-voce", " project-i", " project-ii"
    ]
    return any(re.search(rf'\b{re.escape(kw.strip())}\b', lower) for kw in lab_keywords)


def clean_course_name(name):
    if not name or not isinstance(name, str):
        return ""
    
    # Take first line if multi-line
    s = name.strip().splitlines()[0].strip()

    # Strip leading serial numbers or table numbering: e.g. "1.", "1 ", "SN", "S.No."
    s = re.sub(r'^(?:S\.?No\.?|SN|\d+[\.\)]?)\s*', '', s, flags=re.IGNORECASE)
    
    # Strip course code and label prefixes repeatedly
    # e.g., "BCS301: DATA STRUCTURES", "Course Code: BCS301 Course Title: Discrete Structures"
    for _ in range(3):
        prev = s
        s = re.sub(r'^(?:Course\s*(?:Code|Title)|Subject\s*(?:Code|Name)|Code|Paper)\s*[:\-–]?\s*', '', s, flags=re.IGNORECASE)
        s = re.sub(r'^[A-Z]{2,5}[-\s]?\d{3}[A-Z0-9/*]*\s*[:\-–]?\s*', '', s, flags=re.IGNORECASE)
        s = s.strip(" :-–—\t\r\n")
        if s == prev:
            break
    
    # Strip trailing course codes in parens e.g. "Data Structures (BCS301)"
    s = re.sub(r'\([A-Z0-9\s/-]+\)$', '', s).strip()
    
    # Strip trailing credits or L-T-P notations: e.g. "3L:1T:0P", "4 Credits", "3L", "3 L"
    s = re.sub(r'\b\d+\s*L(?:\s*[:\s]\s*\d+\s*T(?:\s*[:\s]\s*\d+\s*P)?)?\b.*$', '', s, flags=re.IGNORECASE).strip()
    s = re.sub(r'\b\d+\s*Credits?\b.*$', '', s, flags=re.IGNORECASE).strip()
    
    s = s.strip(" :-–—\t\r\n")

    # Residual blacklist for leftover isolated table header tokens
    residual_blacklist = {
        'code', 'title', 'subject', 'course', 'name', 'paper', 'sn', 's.no', 
        'sl.no', 'sr.no', 'credits', 'credit', 'hours', 'marks', 'total',
        'periods', 'sessional', 'practical', 'theory', 'elective', 'lab',
        'lecture', 'tutorial', 'subject code', 'course code', 'course title',
        'subject name', 'sn subject code'
    }
    if s.lower() in residual_blacklist:
        return ""

    # Blacklist check for university/scheme/table headers
    blacklist = [
        'dr. a.p.j.', 'abdul kalam', 'technical university', 'evaluation scheme',
        'study and evaluation', 'l t p', 'ct ta', 'sw+ese', 'sessional', 'credit',
        'subject code', 'course code', 's.no', 'semester', 'b.tech', 'btech',
        'departmental elective', 'open elective', 'syllabus for', 'effective from',
        'total marks', 'internal assessment', 'end semester', 'theory subjects',
        'practical/design', 'course objectives', 'course outcomes', 'text books',
        'reference books', 'sn subject', 'sn ', 'periods'
    ]
    lower = s.lower()
    if any(b in lower for b in blacklist):
        return ""
    
    # Must contain alphabets and reasonable length
    letters = re.findall(r'[a-zA-Z]', s)
    if len(letters) < 4 or len(s) > 75:
        return ""

    # Normalize case to Title Case if all uppercase or all lowercase
    if s.isupper() or s.islower():
        acronyms = {'ai', 'ml', 'os', 'dbms', 'coa', 'it', 'cse', 'ece', 'vlsi', 'iot', 'api', 'toc', 'daa'}
        words = s.split()
        capitalized = []
        for w in words:
            w_clean = re.sub(r'[^\w]', '', w.lower())
            if w_clean in acronyms:
                capitalized.append(w.upper())
            elif w.lower() in ['and', '&', 'of', 'in', 'to', 'for', 'the', 'on', 'with', 'a', 'an']:
                capitalized.append(w.lower())
            else:
                capitalized.append(w.capitalize())
        s = " ".join(capitalized)
        if s and s[0].islower():
            s = s[0].upper() + s[1:]

    return s.strip()


def is_valid_academic_topic(topic_str):
    """
    Backend Python cleaning function that filters each extracted topic string before returning JSON.
    Discards any topic string that:
    1. Starts with action verbs commonly used in outcomes:
       Understand, Implement, Use, Create, Test, Write, Apply, Analyze, Demonstrate, Learn, Study.
    2. Contains outcome phrases like:
       at the end of course, student will be able to, course outcome, CO1, CO2, evaluation scheme, detailed syllabus.
    3. Exceeds 12 words in length.
    4. Ends with a period '.'
    5. Is empty, too short (< 3 chars), or matches pure credit/structure patterns.
    """
    if not topic_str or not isinstance(topic_str, str):
        return False
    
    t = topic_str.strip()
    if len(t) < 3:
        return False


    # Discard if exceeds 12 words in length
    words = t.split()
    if len(words) > 35:
        return False

    # Discard if starts with action verbs commonly used in outcomes
    action_verb_pattern = r'^(?:understand|implement|use|create|test|write|apply|analyze|demonstrate|learn|study)\b'
    # Action verbs may also occur in legitimate technical topic titles.
    # Reject explicit outcome sentences instead of rejecting all verb-led titles.

    # Discard if contains outcome phrases or garbage patterns
    outcome_phrases = [
        r'\bat the end of\b',
        r'\bstudent(?:s)? will be able\b',
        r'\bcourse outcomes?\b',
        r'\blearning outcomes?\b',
        r'\bprogram(?:me)? outcomes?\b',
        r'\bcourse objectives?\b',
        r'\bco[1-9]\b',
        r'\bpo[1-9]\b',
        r'\bpso\d+\b',
        r'\bevaluation scheme\b',
        r'\bteaching scheme\b',
        r'\bexamination scheme\b',
        r'\bmarking scheme\b',
        r'\bdetailed syllabus\b',
        r'\bl\s*[-–—:\s/]?\s*t\s*[-–—:\s/]?\s*p\b',
        r'\b\d+\s*[-–—:]\s*\d+\s*[-–—:]\s*\d+\b',
        r'\bcredits?\s*[:\-–]\s*\d+\b',
        r'^\s*(?:credits?|hours?|periods?)\s*[:\-–]?\s*\d+\s*$',
        r'^\s*\d+\s*credits?\s*$',
        r'\blist of experiments?\b',
        r'\blaboratory manual\b',
        r'\bexperiment \d+\b',
        r'\blab experiment\b'
    ]
    for pattern in outcome_phrases:
        if re.search(pattern, t, re.IGNORECASE):
            return False

    # Vague generic words alone
    vague_single_words = {
        'introduction', 'basics', 'overview', 'summary', 'conclusion',
        'unit', 'module', 'chapter', 'syllabus', 'objective', 'objectives',
        'outcome', 'outcomes', 'hours', 'credits', 'credit', 'general'
    }
    if t.lower() in vague_single_words:
        return False

    letters = re.findall(r'[a-zA-Z]', t)
    if len(letters) < 3:
        return False

    return True


def is_garbage_topic(name):
    """
    Inverse helper for backwards-compatibility with internal regex parser.
    """
    return not is_valid_academic_topic(name)


def clean_single_topic(t_raw):
    """
    Cleans a single topic string or dictionary, applying regex filters and normalizations.
    Returns standardized topic object:
    {"name": "Topic Title", "needsFocus": False, "isImportant": False, "completed": False}
    """
    if isinstance(t_raw, dict):
        name = t_raw.get("name") or t_raw.get("title") or ""
        needs_focus = bool(t_raw.get("needsFocus", False))
        is_imp = bool(t_raw.get("isImportant", False))
        completed = bool(t_raw.get("completed", False))
    else:
        name = str(t_raw)
        needs_focus = False
        is_imp = False
        completed = False

    name = name.strip()
    name = re.sub(r'^(?:[-*•\d\.\)]+)\s*', '', name).strip()
    name = re.sub(r'\b\d+\s*[-–—:]\s*\d+\s*[-–—:]\s*\d+\b.*$', '', name).strip()
    name = re.sub(r'\b\d+\s*Credits?\b.*$', '', name, flags=re.IGNORECASE).strip()
    name = re.sub(r'\bL\s*[-–—:\s/]?\s*T\s*[-–—:\s/]?\s*P\b.*$', '', name, flags=re.IGNORECASE).strip()
    name = name.strip(" :-–—\t\r\n")

    if not is_valid_academic_topic(name):
        return None

    if name.isupper():
        name = name.title()

    return {
        "name": name,
        "needsFocus": needs_focus,
        "isImportant": is_imp,
        "completed": completed
    }


def clean_extracted_topics(raw_topics):
    """
    Cleans raw topics, rejecting lab experiments, course outcomes (CO1, CO2),
    credit notations, and non-topic codes. Ensures granular, clean topics.
    """
    clean_list = []
    seen = set()

    for item in raw_topics:
        cleaned = clean_single_topic(item)
        if cleaned:
            key = cleaned["name"].lower()
            if key not in seen:
                seen.add(key)
                clean_list.append(cleaned)

    return clean_list


def get_subject_dedup_key(name):
    """
    Normalizes a subject name into a deduplication key (e.g. 'Data Structure' & 'Data Structures' -> 'data structure').
    """
    if not name:
        return ""
    s = name.lower().strip()
    s = re.sub(r'^[a-z]{2,5}[-\s]?\d{3}[a-z0-9/*]*\s*[:\-–]?\s*', '', s)
    s = re.sub(r'[^\w\s]', ' ', s)
    words = s.split()
    if words and len(words[-1]) > 3 and words[-1].endswith('s') and not words[-1].endswith(('ss', 'ics', 'us')):
        words[-1] = words[-1][:-1]
    return " ".join(words)


def merge_subject_entries(existing_list, new_list):
    """
    Dictionary-based merge step:
    Combines subjects matching the deduplication key (e.g. 'Data Structure' & 'Data Structures')
    into a single unified entry, merging and deduplicating their unit topics.
    Returns standardized topic objects.
    """
    subject_map = {}
    for sub in existing_list:
        clean_name = clean_course_name(sub.get("name") or sub.get("title") or "")
        if clean_name and not is_lab_or_practical_subject(clean_name):
            key = get_subject_dedup_key(clean_name)
            sub["name"] = clean_name
            sub["title"] = clean_name
            sub["topics"] = clean_extracted_topics(sub.get("topics", []))
            subject_map[key] = sub

    for new_sub in new_list:
        raw_name = new_sub.get("name") or new_sub.get("subject") or new_sub.get("title") or ""
        clean_name = clean_course_name(raw_name)
        if not clean_name or is_lab_or_practical_subject(clean_name):
            continue

        raw_topics = new_sub.get("topics", [])
        clean_topics = clean_extracted_topics(raw_topics)
        if not clean_topics:
            continue

        key = get_subject_dedup_key(clean_name)
        if not key:
            continue

        if key in subject_map:
            target_sub = subject_map[key]
            # Use longer or plural title if available
            if len(clean_name) > len(target_sub["name"]) or clean_name.endswith('s'):
                target_sub["name"] = clean_name
                target_sub["title"] = clean_name

            target_sub.setdefault("topics", [])
            existing_t_names = {t["name"].lower().strip() for t in target_sub.get("topics", [])}
            for t in clean_topics:
                t_key = t["name"].lower().strip()
                if t_key not in existing_t_names:
                    target_sub["topics"].append(t)
                    existing_t_names.add(t_key)
        else:
            entry = {
                "name": clean_name,
                "title": clean_name,
                "topics": clean_topics
            }
            subject_map[key] = entry

    final_subjects = []
    for s in subject_map.values():
        if s.get("topics") and len(s["topics"]) >= 1:
            final_subjects.append(s)

    return final_subjects


def extract_unit_topics(body_text):
    """Extract individual syllabus topics under each Unit/Module heading."""
    topics = []
    unit_pattern = re.compile(
        r"(?im)^\s*(?:UNIT|MODULE)\s*[-–—:]?\s*([IVX]+|\d+)\b\s*[:.\-–—]?\s*"
    )
    matches = list(unit_pattern.finditer(body_text))
    sections = []
    if matches:
        for i, match in enumerate(matches):
            end = matches[i + 1].start() if i + 1 < len(matches) else len(body_text)
            sections.append((match.group(1), body_text[match.end():end]))
    else:
        sections = [(None, body_text)]

    for unit, content in sections:
        cutoff = re.search(
            r"(?im)^\s*(?:Text\s*Books?|Reference\s*Books?|Course\s*Outcomes?|"
            r"Suggested\s*Readings?|List\s*of\s*Experiments?|Course\s*Objectives?)\b",
            content,
        )
        if cutoff:
            content = content[:cutoff.start()]
        for line in content.splitlines():
            line = re.sub(r"^\s*(?:[•*\-]|\d+[.)])\s*", "", line).strip()
            if not line or re.match(r"(?i)^(?:hours?|lectures?)\s*[:\d]", line):
                continue
            # Separate topics enumerated using semicolons or bullet characters.
            for part in re.split(r"\s*[;•]\s*", line):
                part = part.strip(" .,:-–—")
                if not part or not is_valid_academic_topic(part):
                    continue
                name = f"Unit {unit}: {part}" if unit else part
                topics.append(name)
    return clean_extracted_topics(topics)


def parse_syllabus_text(text):
    """
    Parses full syllabus text into structured subjects and unit topics using regex.
    """
    subjects = []
    
    # Split text into subject sections using subject headers
    course_header_pattern = re.compile(
        r'(?:^|\r?\n)[^\S\r\n]*(?:(?:[A-Z]{2,5}[-\s]?\d{3}[A-Z0-9/*]*[^\S\r\n]*[:\-–][^\S\r\n]*|Course\s*(?:Title|Name)[^\S\r\n]*[:\-–][^\S\r\n]*)([A-Za-z0-9&,/\' -]{4,70}))'
        r'|(?:^|\r?\n)[^\S\r\n]*([A-Z]{2,5}[-\s]?\d{3}[A-Z0-9/*]*[^\S\r\n]+[A-Z][A-Za-z0-9&,/\' -]{3,60})(?=[^\S\r\n]*(?:\r?\n[^\S\r\n]*(?:\d+L|Course|Unit)))',
        re.MULTILINE
    )

    matches = list(course_header_pattern.finditer(text))
    
    if not matches:
        # Fallback pattern: look for single-line titles immediately preceding Unit - I or Unit 1
        fallback_pattern = re.compile(
            r'(?:^|\r?\n)[^\S\r\n]*([A-Za-z0-9&,/:–\' -]{4,70})[^\S\r\n]*\r?\n(?:[^\S\r\n]*(?:(?:3L|4L|\d+\s*Credits?|Course\s*Objectives?)[^\r\n]*\r?\n[^\S\r\n]*))*(?=UNIT\s*[-–—]?[^\S\r\n]*(?:I\b|1\b))',
            re.IGNORECASE | re.MULTILINE
        )
        matches = list(fallback_pattern.finditer(text))

    if matches:
        for i, match in enumerate(matches):
            raw_title = match.group(1) or match.group(2) or match.group(0)
            clean_title = clean_course_name(raw_title)
            if not clean_title or is_lab_or_practical_subject(clean_title):
                continue

            start_pos = match.end()
            end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            subject_body = text[start_pos:end_pos]

            topics = extract_unit_topics(subject_body)
            if clean_title and topics:
                subjects.append({
                    "name": clean_title,
                    "title": clean_title,
                    "topics": topics
                })

    return merge_subject_entries([], subjects)


def clean_pdf_text_for_units(raw_text):
    """Remove only identifiable administrative/outcome lines; preserve syllabus topics."""
    cleaned = []
    for line in raw_text.splitlines():
        line = line.strip()
        if not line:
            continue
        if re.match(r"(?i)^(?:course outcomes?|learning outcomes?|course objectives?|"
                    r"at the end of (?:this|the) course|students? will be able to|"
                    r"evaluation scheme|teaching scheme|examination scheme)\b", line):
            continue
        if re.match(r"(?i)^CO\s*\d+\s*[:.\-]", line):
            continue
        if re.fullmatch(r"(?i)(?:CO\s*\d+|K[1-6]|L\s*T\s*P|\d+\s*[-:]\s*\d+\s*[-:]\s*\d+)", line):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)


def sanitize_syllabus_text(pdf_file):
    """Read text pages without dropping legitimate subject/unit headings."""
    if pdfplumber is None:
        return ""
    pages = []
    try:
        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                text = page.extract_text(layout=False) or ""
                if text.strip() and not is_evaluation_scheme_page(text):
                    pages.append(clean_pdf_text_for_units(text))
    except Exception as exc:
        app.logger.warning("sanitize_syllabus_text error: %s", exc)
        return ""
    return "\n".join(page for page in pages if page.strip())


def extract_with_gemini(cleaned_text="", pdf_path=""):
    """
    Multimodal & text chunking syllabus extractor using Gemini AI.
    1. If pdf_path is provided, attempts direct native PDF ingestion (multimodal vision + text),
       which seamlessly handles scanned images, screenshots, tables, and diverse document styles.
    2. Falls back to text chunking if pdf_path is not available or if binary payload exceeds limits.
    """
    if not GENAI_AVAILABLE or not os.getenv("GEMINI_API_KEY"):
        return []
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        return []
    client = genai.Client(api_key=api_key)

    system_prompt = (
        "Extract academic course subjects, their units/modules/sections, and specific study topics "
        "from the provided syllabus document. Return a JSON array of subject objects: "
        "[{\"name\": \"Subject Name\", \"code\": \"Optional Code\", \"semester\": 3, \"units\": [{\"unitNumber\": 1, \"unitTitle\": \"Unit Title\", \"topics\": [\"Topic 1\", \"Topic 2\"]}], \"topics\": [\"Topic 1\", \"Topic 2\"]}]. "
        "Ignore Course Outcomes (CO1-CO5), Bloom's taxonomy tags, credit hour ratios, and evaluation mark schemes. "
        "Preserve exact subject names and distinct study topics. Do not invent content."
    )

    # 1. Native Multimodal PDF Ingestion (handles scanned screenshots & complex layouts)
    if pdf_path and os.path.exists(pdf_path):
        try:
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
            if pdf_bytes and len(pdf_bytes) < 30 * 1024 * 1024:
                part = types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")
                for model_name in ('gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'):
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=[part, system_prompt],
                            config=types.GenerateContentConfig(response_mime_type="application/json"),
                        )
                        data = json.loads(response.text or '[]')
                        if isinstance(data, dict):
                            data = data.get('subjects') or data.get('courses') or [data]
                        if isinstance(data, list) and len(data) > 0:
                            extracted = []
                            for item in data:
                                if isinstance(item, dict) and (item.get('name') or item.get('subject')):
                                    extracted.append(item)
                            if extracted:
                                return extracted
                    except Exception as exc:
                        app.logger.warning("Gemini multimodal extraction with %s failed: %s", model_name, exc)
                        continue
        except Exception as e:
            app.logger.warning("Gemini multimodal read error: %s", e)

    # 2. Text Chunking Fallback
    if not cleaned_text:
        return []
    lines = cleaned_text.splitlines()
    chunks, chunk, length = [], [], 0
    for line in lines:
        if chunk and length + len(line) > 14000:
            chunks.append("\n".join(chunk))
            chunk = chunk[-8:]
            length = sum(len(x) + 1 for x in chunk)
        chunk.append(line)
        length += len(line) + 1
    if chunk:
        chunks.append("\n".join(chunk))

    extracted = []
    for chunk_text in chunks:
        prompt = system_prompt + "\n\n" + chunk_text
        for model_name in ('gemini-2.5-flash', 'gemini-2.0-flash'):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(response_mime_type="application/json"),
                )
                data = json.loads(response.text or '[]')
                if isinstance(data, dict):
                    data = data.get('subjects', [])
                if isinstance(data, list):
                    extracted.extend(item for item in data if isinstance(item, dict))
                    break
            except Exception as exc:
                app.logger.warning("Gemini extraction attempt failed: %s", exc)
                continue
    return extracted



def clean_subject_name(name):
    """
    Normalizes subject name for deduplication and matching by stripping leading
    course code prefixes, subject numbering, and extra punctuation/whitespace.
    """
    if not name:
        return ""
    cleaned = re.sub(r'^(?:subject\s*\d+\s*[:\-–—]\s*|[A-Z]{2,4}\s*\d{2,4}\s*[:\-–—]\s*)', '', str(name).strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned or str(name).strip()


@app.route('/upload-syllabus-pdf', methods=['POST'])
def upload_syllabus_pdf():
    """
    Multi-stage layout and table-aware PDF syllabus extraction endpoint.
    Supports uploading up to 3 PDFs simultaneously, processing each independently,
    tagging subjects with their source files, detecting duplicate subjects across files,
    and returning a unified extraction draft for review.
    """
    files = request.files.getlist('files')
    if not files and 'file' in request.files:
        files = [request.files['file']]
    if not files:
        return jsonify({"error": "No PDF file uploaded", "success": False}), 400
    if len(files) > 3:
        return jsonify({"error": "A maximum of 3 PDF files can be uploaded simultaneously.", "success": False}), 400

    valid_files = [f for f in files if f.filename and f.filename.lower().endswith('.pdf')]
    if not valid_files:
        return jsonify({"error": "All uploaded files must be valid PDF documents.", "success": False}), 400

    import tempfile
    import shutil
    from pdf_extractor import SyllabusPDFExtractor

    extractor = SyllabusPDFExtractor()
    combined_subjects = []
    subject_lookup = {}
    duplicates_detected = []
    all_warnings = []
    file_summaries = []
    total_pages = 0
    pdf_url = ""

    for f_idx, file in enumerate(valid_files):
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                file.save(tmp.name)
                temp_path = tmp.name

            # Save the primary PDF for side-by-side preview
            if f_idx == 0:
                latest_pdf_path = os.path.join(UPLOADS_DIR, "latest_syllabus.pdf")
                try:
                    shutil.copyfile(temp_path, latest_pdf_path)
                    pdf_url = "/uploads/latest_syllabus.pdf"
                except Exception:
                    pdf_url = ""

            result = extractor.extract(temp_path)
            f_subjects = result.get("subjects", [])
            f_pages = result.get("pagesProcessed", 0)
            total_pages += f_pages

            if result.get("warnings"):
                all_warnings.extend([f"[{file.filename}] {w}" for w in result["warnings"]])

            # If plain extraction returned no subjects, attempt Gemini fallback if key is present
            if not f_subjects:
                api_key = os.getenv("GEMINI_API_KEY")
                if GENAI_AVAILABLE and api_key and api_key != "your_gemini_api_key_here":
                    sanitized_text = sanitize_syllabus_text(temp_path)
                    gemini_subs = extract_with_gemini(cleaned_text=sanitized_text, pdf_path=temp_path)
                    if gemini_subs:
                        formatted_subs = []
                        for idx, s in enumerate(gemini_subs):
                            s_name = s.get("subject") or s.get("name") or f"Subject {idx + 1}"
                            s_topics_raw = s.get("topics", [])
                            formatted_topics = []
                            for t in s_topics_raw:
                                if isinstance(t, str):
                                    formatted_topics.append({"name": t.strip(), "needsFocus": False, "isImportant": False, "completed": False})
                                elif isinstance(t, dict):
                                    formatted_topics.append({"name": t.get("name", "").strip(), "needsFocus": bool(t.get("needsFocus", False)), "isImportant": bool(t.get("isImportant", False)), "completed": bool(t.get("completed", False))})
                            formatted_subs.append({
                                "name": s_name,
                                "title": s_name,
                                "code": s.get("code", ""),
                                "semester": s.get("semester", 1),
                                "topics": formatted_topics,
                                "units": s.get("units", [])
                            })
                        f_subjects = formatted_subs

            # Tag each subject with source file and merge
            for s in f_subjects:
                s["sourceFile"] = file.filename
                subj_key = (s.get("code") or clean_subject_name(s.get("name") or "")).strip().upper()
                
                if subj_key in subject_lookup:
                    existing = subject_lookup[subj_key]
                    duplicates_detected.append({
                        "name": s.get("name"),
                        "code": s.get("code"),
                        "existingFile": existing.get("sourceFile", ""),
                        "newFile": file.filename,
                        "conflict": True
                    })
                    s["hasDuplicateIn"] = existing.get("sourceFile", "")
                    s["duplicateOf"] = subj_key
                else:
                    subject_lookup[subj_key] = s
                
                combined_subjects.append(s)

            file_summaries.append({
                "filename": file.filename,
                "pages": f_pages,
                "subjectsDetected": len(f_subjects)
            })

        except Exception as exc:
            app.logger.warning("Error processing %s: %s", file.filename, exc)
            all_warnings.append(f"Failed to process '{file.filename}': {str(exc)}")
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

    if not combined_subjects:
        return jsonify({
            "error": "No course subjects with units could be identified from the uploaded PDF document(s).",
            "success": False
        }), 422

    total_units = sum(len(s.get("units", [])) for s in combined_subjects)
    total_topics = sum(len(s.get("topics", [])) for s in combined_subjects)

    return jsonify({
        "success": True,
        "pdfUrl": pdf_url,
        "filename": ", ".join(f.filename for f in valid_files),
        "filenames": [f.filename for f in valid_files],
        "subjects": combined_subjects,
        "subjectCount": len(combined_subjects),
        "totalUnits": total_units,
        "totalTopics": total_topics,
        "pagesProcessed": total_pages,
        "warnings": all_warnings,
        "diagnostics": {
            "filesProcessed": len(valid_files),
            "fileSummaries": file_summaries,
            "duplicateSubjectsDetected": duplicates_detected
        }
    }), 200



def calculate_topic_weight(topic):
    """
    Weighted time allocation:
    - Normal topic: 1.0
    - Important topic: 1.3
    - Weak topic: 1.5
    - Both weak and important: 1.8
    """
    needs_focus = bool(topic.get("needsFocus", False))
    is_imp = bool(topic.get("isImportant", False))
    if needs_focus and is_imp:
        return 1.8
    elif needs_focus:
        return 1.5
    elif is_imp:
        return 1.3
    return 1.0


def order_topics_smartly(items, focus_preference="balanced"):
    """
    Orders topics based on user focus preference:
    - 'early': high-weight topics in first half
    - 'late': high-weight topics in second half
    - 'balanced': alternates demanding and lighter topics to avoid cognitive overload
    """
    demanding = [x for x in items if x["weight"] > 1.0]
    lighter = [x for x in items if x["weight"] <= 1.0]

    # Sort demanding by highest weight first (1.8, 1.5, 1.3)
    demanding.sort(key=lambda x: x["weight"], reverse=True)

    if focus_preference == "early":
        return demanding + lighter
    elif focus_preference == "late":
        return lighter + demanding
    else:
        # Balanced: Interleave demanding and lighter topics
        result = []
        d_idx, l_idx = 0, 0
        while d_idx < len(demanding) or l_idx < len(lighter):
            if d_idx < len(demanding):
                result.append(demanding[d_idx])
                d_idx += 1
            if l_idx < len(lighter):
                result.append(lighter[l_idx])
                l_idx += 1
        return result


def parse_time_to_minutes(time_str, default_mins):
    try:
        parts = str(time_str).strip().split(":")
        return (int(parts[0]) * 60 + int(parts[1])) % 1440
    except Exception:
        return default_mins


def build_advanced_schedule(subjects, available_hours=3.5, start_time="18:00", end_time="22:30",
                            planning_mode="1", break_preference="medium", focus_preference="balanced"):
    """
    Multi-Day Weighted AI Timetable Generator:
    - Planning Modes: '1' (Today), '3' (Next 3 Days), '7' (Next 7 Days)
    - Break Preference: 'short' (5m), 'medium' (10m), 'long' (15m)
    - Weighted allocation: Normal 1.0, Imp 1.3, Weak 1.5, Weak+Imp 1.8
    - Minimum study session duration: 25 mins to avoid impractically short sessions
    - Maximum study session duration: 75 mins
    - Distributes topics across selected number of days without duplicate scheduling
    - Detects unscheduled topics that exceed study window capacity
    """
    try:
        days_count = int(planning_mode)
    except Exception:
        days_count = 1
    if days_count not in (1, 3, 7):
        days_count = 1

    break_map = {"short": 5, "medium": 10, "long": 15}
    break_mins = break_map.get(str(break_preference).lower(), 10)

    start_mins = parse_time_to_minutes(start_time, 18 * 60)
    end_mins = parse_time_to_minutes(end_time, 22 * 60 + 30)

    diff = (end_mins + 1440 - start_mins) % 1440 if end_mins <= start_mins else (end_mins - start_mins)
    if diff <= 0:
        diff = 240
    max_mins_by_hours = int(float(available_hours or 3.5) * 60)
    daily_capacity_mins = min(diff, max_mins_by_hours)

    candidate_topics = []
    for sub in subjects:
        s_name = sub.get("name", "Study Session").strip() if isinstance(sub, dict) else str(sub)
        sub_topics = sub.get("topics", []) if isinstance(sub, dict) else []
        for top in sub_topics:
            if isinstance(top, dict):
                t_name = top.get("name", "").strip()
                needs_focus = bool(top.get("needsFocus", False))
                is_imp = bool(top.get("isImportant", False))
                completed = bool(top.get("completed", False))
            else:
                t_name = str(top).strip()
                needs_focus = False
                is_imp = False
                completed = False

            if not t_name or completed:
                continue

            item = {
                "subject": s_name,
                "topic": t_name,
                "needsFocus": needs_focus,
                "isImportant": is_imp,
                "weight": calculate_topic_weight({"needsFocus": needs_focus, "isImportant": is_imp})
            }
            candidate_topics.append(item)

    if not candidate_topics:
        candidate_topics.append({
            "subject": "Core Review",
            "topic": "Comprehensive Concept Review & Practice Problems",
            "needsFocus": False,
            "isImportant": True,
            "weight": 1.3
        })

    ordered_topics = order_topics_smartly(candidate_topics, focus_preference)

    MIN_SESSION_MINS = 25
    MAX_SESSION_MINS = 75

    max_topics_per_day = max(1, (daily_capacity_mins + break_mins) // (MIN_SESSION_MINS + break_mins))
    days_topics = [[] for _ in range(days_count)]
    unscheduled = []

    total_capacity_topics = days_count * max_topics_per_day

    for idx, top in enumerate(ordered_topics):
        if idx < total_capacity_topics:
            target_day = min(range(days_count), key=lambda d: len(days_topics[d]))
            days_topics[target_day].append(top)
        else:
            unscheduled.append({
                "subject": top["subject"],
                "topic": top["topic"],
                "needsFocus": top["needsFocus"],
                "isImportant": top["isImportant"],
                "reason": f"Exceeded available study hours across {days_count} day(s) (Maximum {total_capacity_topics} topics can fit)."
            })

    today_date = datetime.date.today()
    schedule_days = []

    for d in range(days_count):
        day_date = today_date + datetime.timedelta(days=d)
        date_str = day_date.strftime("%Y-%m-%d")

        if days_count == 1:
            day_label = "Today"
        elif d == 0:
            day_label = "Day 1 (Today)"
        elif d == 1:
            day_label = f"Day 2 - Tomorrow ({day_date.strftime('%b %d')})"
        else:
            day_label = f"Day {d + 1} ({day_date.strftime('%b %d')})"

        d_topics = days_topics[d]
        if not d_topics:
            schedule_days.append({
                "day": day_label,
                "date": date_str,
                "dayIndex": d,
                "slots": [],
                "totalStudyMins": 0,
                "totalBreakMins": 0,
                "topicCount": 0
            })
            continue

        session_count = len(d_topics)
        total_breaks_time = (session_count - 1) * break_mins
        net_study_time = max(MIN_SESSION_MINS * session_count, daily_capacity_mins - total_breaks_time)
        sum_weights = sum(t["weight"] for t in d_topics) or 1.0

        durations = []
        for t in d_topics:
            raw_d = int(round((t["weight"] / sum_weights) * net_study_time))
            durations.append(max(MIN_SESSION_MINS, min(MAX_SESSION_MINS, raw_d)))

        target_sum = daily_capacity_mins - total_breaks_time
        current_sum = sum(durations)
        diff_mins = target_sum - current_sum

        if diff_mins != 0 and durations:
            adj_idx = max(range(len(durations)), key=lambda i: durations[i])
            durations[adj_idx] = max(MIN_SESSION_MINS, durations[adj_idx] + diff_mins)

        slots = []
        curr_time = start_mins
        study_accum = 0
        break_accum = 0

        for i, t in enumerate(d_topics):
            dur = durations[i]
            next_time = curr_time + dur
            s_h, s_m = divmod(curr_time % 1440, 60)
            e_h, e_m = divmod(next_time % 1440, 60)
            slot_id = f"slot_d{d}_s{i}_{uuid.uuid4().hex[:6]}"

            slots.append({
                "id": slot_id,
                "time": f"{s_h:02d}:{s_m:02d} - {e_h:02d}:{e_m:02d}",
                "startTime": f"{s_h:02d}:{s_m:02d}",
                "endTime": f"{e_h:02d}:{e_m:02d}",
                "durationMins": dur,
                "subject": t["subject"],
                "topic": t["topic"],
                "type": "study",
                "needsFocus": t["needsFocus"],
                "isImportant": t["isImportant"],
                "status": "pending",
                "dayIndex": d
            })
            study_accum += dur
            curr_time = next_time

            if i < session_count - 1 and break_mins > 0:
                b_end = curr_time + break_mins
                b_sh, b_sm = divmod(curr_time % 1440, 60)
                b_eh, b_em = divmod(b_end % 1440, 60)
                break_id = f"break_d{d}_b{i}_{uuid.uuid4().hex[:6]}"

                slots.append({
                    "id": break_id,
                    "time": f"{b_sh:02d}:{b_sm:02d} - {b_eh:02d}:{b_em:02d}",
                    "startTime": f"{b_sh:02d}:{b_sm:02d}",
                    "endTime": f"{b_eh:02d}:{b_em:02d}",
                    "durationMins": break_mins,
                    "subject": "Refresh Break",
                    "topic": "Hydrate, stretch, or rest your eyes for optimal focus",
                    "type": "break",
                    "needsFocus": False,
                    "isImportant": False,
                    "status": "pending",
                    "dayIndex": d
                })
                break_accum += break_mins
                curr_time = b_end

        schedule_days.append({
            "day": day_label,
            "date": date_str,
            "dayIndex": d,
            "slots": slots,
            "totalStudyMins": study_accum,
            "totalBreakMins": break_accum,
            "topicCount": len(d_topics)
        })

    return {
        "schedule": schedule_days,
        "unscheduled": unscheduled
    }


def generate_local_schedule(subjects, available_hours=3.5, start_time="18:00", end_time="22:30", planning_mode="1", break_preference="medium", focus_preference="balanced"):
    result = build_advanced_schedule(
        subjects=subjects,
        available_hours=available_hours,
        start_time=start_time,
        end_time=end_time,
        planning_mode=planning_mode,
        break_preference=break_preference,
        focus_preference=focus_preference
    )
    if result.get("schedule") and len(result["schedule"]) > 0:
        return result["schedule"][0]
    return {"day": "Today", "slots": []}


def _deprecated_generate_local_schedule(subjects, available_hours, start_time, end_time):
    """
    Deterministic schedule generator:
    1. Allocates ~60% study time to weak (needsFocus) or important topics and ~40% to normal topics.
    2. Excludes already completed topics (unless none left).
    3. Divides time into realistic 35-50 min study sessions with 5-10 min refreshing breaks.
    4. Guarantees schedule strictly fits within the selected start and end time window.
    """
    high_priority = []
    normal_priority = []

    for sub in subjects:
        s_name = sub.get("name", "Study Session").strip() if isinstance(sub, dict) else str(sub)
        sub_topics = sub.get("topics", []) if isinstance(sub, dict) else []
        for top in sub_topics:
            if isinstance(top, dict):
                t_name = top.get("name", "").strip()
                needs_focus = bool(top.get("needsFocus", False))
                is_imp = bool(top.get("isImportant", False))
                completed = bool(top.get("completed", False))
            else:
                t_name = str(top).strip()
                needs_focus = False
                is_imp = False
                completed = False

            if not t_name or completed:
                continue

            item = {
                "subject": s_name,
                "topic": t_name,
                "needsFocus": needs_focus,
                "isImportant": is_imp
            }
            if needs_focus or is_imp:
                high_priority.append(item)
            else:
                normal_priority.append(item)

    if not high_priority and not normal_priority:
        normal_priority.append({
            "subject": "Core Review",
            "topic": "Comprehensive Concept Review & Practice Problems",
            "needsFocus": False,
            "isImportant": True
        })

    try:
        parts_s = str(start_time).strip().split(":")
        start_mins = (int(parts_s[0]) * 60 + int(parts_s[1])) % 1440
    except Exception:
        start_mins = 18 * 60

    try:
        parts_e = str(end_time).strip().split(":")
        end_mins = (int(parts_e[0]) * 60 + int(parts_e[1])) % 1440
    except Exception:
        end_mins = 22 * 60

    diff = (end_mins + 1440 - start_mins) % 1440 if end_mins <= start_mins else (end_mins - start_mins)
    max_mins_by_hours = int(float(available_hours or 3) * 60)
    total_mins = min(diff if diff > 0 else 180, max_mins_by_hours)

    ordered_topics = []
    h_idx = 0
    n_idx = 0
    while (h_idx < len(high_priority) or n_idx < len(normal_priority)) and len(ordered_topics) < 8:
        if h_idx < len(high_priority):
            ordered_topics.append(high_priority[h_idx])
            h_idx += 1
        if h_idx < len(high_priority) and len(ordered_topics) < 8:
            ordered_topics.append(high_priority[h_idx])
            h_idx += 1
        if n_idx < len(normal_priority) and len(ordered_topics) < 8:
            ordered_topics.append(normal_priority[n_idx])
            n_idx += 1
        if h_idx >= len(high_priority) and n_idx >= len(normal_priority):
            break

    session_count = max(1, len(ordered_topics))
    break_mins = 10 if total_mins >= 120 and session_count > 1 else (5 if total_mins >= 60 and session_count > 1 else 0)
    total_break_time = break_mins * (session_count - 1)
    study_time = max(20 * session_count, total_mins - total_break_time)
    slot_study_mins = max(20, study_time // session_count)

    slots = []
    curr_mins = start_mins

    for i, item in enumerate(ordered_topics):
        is_last = (i == len(ordered_topics) - 1)
        next_study_mins = (start_mins + total_mins) if is_last else (curr_mins + slot_study_mins)
        
        s_h, s_m = divmod(curr_mins % 1440, 60)
        e_h, e_m = divmod(next_study_mins % 1440, 60)
        time_str = f"{s_h:02d}:{s_m:02d} - {e_h:02d}:{e_m:02d}"

        slots.append({
            "time": time_str,
            "subject": item["subject"],
            "topic": item["topic"],
            "type": "study",
            "needsFocus": item.get("needsFocus", False),
            "isImportant": item.get("isImportant", False)
        })
        curr_mins = next_study_mins

        if not is_last and break_mins > 0:
            b_end = curr_mins + break_mins
            b_sh, b_sm = divmod(curr_mins % 1440, 60)
            b_eh, b_em = divmod(b_end % 1440, 60)
            slots.append({
                "time": f"{b_sh:02d}:{b_sm:02d} - {b_eh:02d}:{b_em:02d}",
                "subject": "Refresh Break",
                "topic": "Hydrate, stretch, or rest your eyes for optimal focus",
                "type": "break",
                "needsFocus": False,
                "isImportant": False
            })
            curr_mins = b_end

    return {"day": "Today", "slots": slots}


@app.route("/generate-schedule", methods=["POST"])
def generate_schedule():
    data = request.get_json() or {}
    subjects = data.get("subjects", [])
    available_hours = data.get("availableHours", 3)
    start_time = data.get("startTime", "18:00")
    end_time = data.get("endTime", "22:30")
    planning_mode = str(data.get("planningMode", "1"))
    break_preference = data.get("breakPreference", "medium")
    focus_preference = data.get("focusPreference", "balanced")

    api_key = os.getenv("GEMINI_API_KEY")
    if planning_mode == "1" and GENAI_AVAILABLE and api_key and api_key != "your_gemini_api_key_here" and subjects:
        try:
            http_opts = types.HttpOptions(timeout=3500) if hasattr(types, "HttpOptions") else None
            client = genai.Client(api_key=api_key, http_options=http_opts) if http_opts else genai.Client(api_key=api_key)
            prompt = f"""
            You are an expert academic study strategist. Create an optimized study timetable for today.
            Input Subjects & Topics:
            {json.dumps(subjects)}

            Requirements:
            - Available Study Window: {available_hours} hours total, strictly between {start_time} and {end_time}.
            - Prioritize topics with 'needsFocus: true' or 'isImportant: true' by allocating ~60% of study time to them.
            - Do not schedule topics marked completed.
            - Include 5-10 minute breaks between intensive study blocks.
            - Return ONLY valid JSON:
            {{
              "schedule": [
                {{
                  "day": "Today",
                  "slots": [
                    {{"time": "18:00 - 18:45", "subject": "Subject Name", "topic": "Topic Title", "needsFocus": false, "isImportant": true, "type": "study"}},
                    {{"time": "18:45 - 18:55", "subject": "Refresh Break", "topic": "Short stretch and hydration", "needsFocus": false, "isImportant": false, "type": "break"}}
                  ]
                }}
              ]
            }}
            """

            for model_name in ['gemini-2.5-flash']:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(response_mime_type="application/json")
                    )
                    if response.text:
                        parsed = json.loads(response.text)
                        if parsed.get("schedule") and parsed["schedule"][0].get("slots"):
                            return jsonify({"success": True, "schedule": parsed["schedule"]}), 200
                except Exception as exc:
                    app.logger.warning("Gemini timetable generation failed with %s: %s", model_name, exc)
                    continue
        except Exception as e:
            app.logger.warning("Gemini scheduler error: %s", e)

    # Deterministic Local Fallback Generator
    result = build_advanced_schedule(
        subjects=subjects,
        available_hours=available_hours,
        start_time=start_time,
        end_time=end_time,
        planning_mode=planning_mode,
        break_preference=break_preference,
        focus_preference=focus_preference
    )
    return jsonify({
        "success": True,
        "schedule": result["schedule"],
        "unscheduled": result["unscheduled"]
    }), 200


@app.route("/save-timetable", methods=["POST"])
def save_timetable():
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or 999
    schedule = data.get("schedule", [])
    unscheduled = data.get("unscheduled", [])

    conn = get_db_connection()
    cursor = conn.cursor()
    payload = json.dumps({"schedule": schedule, "unscheduled": unscheduled})
    cursor.execute("SELECT id FROM user_timetables WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    if row:
        cursor.execute("UPDATE user_timetables SET schedule_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", (payload, user_id))
    else:
        cursor.execute("INSERT INTO user_timetables (user_id, schedule_json) VALUES (?, ?)", (user_id, payload))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Timetable saved successfully."}), 200


@app.route("/get-timetable", methods=["GET", "POST"])
def get_timetable():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        user_id = data.get("userId")
    else:
        user_id = request.args.get("userId")
    user_id = user_id or 999

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT schedule_json, updated_at FROM user_timetables WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if row and row["schedule_json"]:
        try:
            parsed = json.loads(row["schedule_json"])
            return jsonify({
                "success": True,
                "schedule": parsed.get("schedule", []),
                "unscheduled": parsed.get("unscheduled", []),
                "updatedAt": row["updated_at"]
            }), 200
        except Exception:
            pass

    return jsonify({"success": False, "message": "No saved timetable found.", "schedule": []}), 200




if __name__ == "__main__":
    port = int(os.getenv("PORT") or os.getenv("FLASK_PORT") or 5000)
    debug = os.getenv("FLASK_ENV", "development") == "development"
    app.run(debug=debug, port=port)