"""
Automated Backend Verification Test
Tests /register, /login, /save-syllabus, and /get-syllabus endpoints
"""
import json
from server import app, init_db, get_db_connection

def test_api():
    print("[TEST] Initializing database...")
    init_db()

    client = app.test_client()

    import time
    unique_email = f"student_{int(time.time())}@college.edu"
    test_user = {"email": unique_email, "password": "securePassword123"}

    # 1. Test /register
    print(f"\n[TEST 1] Testing POST /register with {unique_email}...")
    res = client.post("/register", data=json.dumps(test_user), content_type="application/json")
    print(f"Status Code: {res.status_code}")
    print(f"Response: {res.get_json()}")
    assert res.status_code == 201, "Register failed"

    # 2. Test /login
    print("\n[TEST 2] Testing POST /login...")
    res = client.post("/login", data=json.dumps(test_user), content_type="application/json")
    print(f"Status Code: {res.status_code}")
    login_data = res.get_json()
    print(f"Response: {login_data}")
    assert res.status_code == 200, "Login failed"
    user_id = login_data["user"]["id"]

    # 3. Test /save-syllabus
    print("\n[TEST 3] Testing POST /save-syllabus...")
    syllabus_payload = {
        "userId": user_id,
        "email": test_user["email"],
        "subjects": [
            {
                "name": "Data Structures & Algorithms",
                "topics": [
                    {"name": "Dynamic Programming", "needsFocus": True},
                    {"name": "Binary Search", "needsFocus": False}
                ]
            },
            {
                "name": "Operating Systems",
                "topics": [
                    {"name": "Virtual Memory & Paging", "needsFocus": True},
                    {"name": "CPU Scheduling Algorithms", "needsFocus": False}
                ]
            }
        ]
    }
    res = client.post("/save-syllabus", data=json.dumps(syllabus_payload), content_type="application/json")
    print(f"Status Code: {res.status_code}")
    print(f"Response: {res.get_json()}")
    assert res.status_code == 200, "Save syllabus failed"

    # 4. Test /get-syllabus
    print("\n[TEST 4] Testing GET /get-syllabus...")
    res = client.get(f"/get-syllabus?userId={user_id}")
    print(f"Status Code: {res.status_code}")
    get_data = res.get_json()
    print(f"Response: {get_data}")
    assert res.status_code == 200, "Get syllabus failed"
    assert len(get_data["subjects"]) == 2, "Expected 2 subjects"

    # 5. Check SQLite database directly
    print("\n[TEST 5] Checking SQLite tables directly...")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email FROM users WHERE email = ?", (test_user["email"],))
    u = cursor.fetchone()
    print(f"SQLite User Found: id={u['id']}, email={u['email']}")

    cursor.execute("SELECT id, name FROM subjects WHERE user_id = ?", (user_id,))
    subs = cursor.fetchall()
    print(f"SQLite Subjects: {[s['name'] for s in subs]}")

    cursor.execute("SELECT name, needs_focus FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE user_id = ?)", (user_id,))
    tops = cursor.fetchall()
    print(f"SQLite Topics: {[(t['name'], 'Needs Focus: ' + str(bool(t['needs_focus']))) for t in tops]}")
    conn.close()

    print("\n[ALL TESTS PASSED SUCCESSFULLY!]")

if __name__ == "__main__":
    test_api()
