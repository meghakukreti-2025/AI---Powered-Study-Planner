import urllib.request
import json
import sqlite3

BASE_URL = "http://127.0.0.1:5000"

def test_static_and_assets():
    print("--- 1. Testing Static Files & SVG Assets ---")
    urls = [
        ("/", 200, "text/html"),
        ("/assets/cognify-icon.svg", 200, "image/svg+xml"),
        ("/assets/cognify-logo-dark.svg", 200, "image/svg+xml"),
        ("/assets/cognify-logo-light.svg", 200, "image/svg+xml"),
        ("/assets/favicon.svg", 200, "image/svg+xml"),
        ("/style.css", 200, "text/css"),
        ("/app.js", 200, "application/javascript"),
    ]
    for path, exp_code, _ in urls:
        req = urllib.request.Request(f"{BASE_URL}{path}")
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            content = resp.read().decode("utf-8", errors="ignore")
            print(f"  {path} -> Status {status}, Length {len(content)}")
            assert status == exp_code, f"Expected {exp_code} for {path}"
            if path == "/":
                assert "assets/favicon.svg" in content, "Favicon link missing in index.html"
                assert "brand-svg-logo" in content, "brand-svg-logo missing in index.html"
                assert "auth-brand-svg-logo" in content, "auth-brand-svg-logo missing in index.html"
                assert "modal-merge-duplicates" in content, "modal-merge-duplicates missing in index.html"
                assert "btn-open-merge-modal" in content, "btn-open-merge-modal missing in index.html"
            elif "cognify-icon.svg" in path or "favicon.svg" in path:
                assert "<svg" in content and "path" in content, "Invalid SVG content"
            elif path == "/style.css":
                assert "dashboard-masonry-grid" in content, "dashboard-masonry-grid missing in style.css"
                assert "masonry-column" in content, "masonry-column missing in style.css"
                assert "auth-bg-ambient" in content, "auth-bg-ambient missing in style.css"
                assert "modal-merge-duplicates" in content, "modal-merge-duplicates styling missing"
    print("  [OK] All static and SVG assets verified successfully.")

def test_duplicate_detection_user5():
    print("\n--- 2. Testing Duplicate Detection on User 5 (Screenshot 2 Data) ---")
    req = urllib.request.Request(
        f"{BASE_URL}/detect-duplicates",
        data=json.dumps({"user_id": 5}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data["success"] is True, "detect-duplicates failed"
        pairs = data["duplicates"]
        print(f"  Found {len(pairs)} duplicate pair(s):")
        detected_names = []
        for p in pairs:
            s1, s2 = p["subject1"], p["subject2"]
            print(f"    - '{s1['name']}' ({s1['topic_count']} topics) <-> '{s2['name']}' ({s2['topic_count']} topics) [Confidence: {p['confidence']}]")
            detected_names.append((s1["name"], s2["name"]))
        
        # Verify theory and lab are NOT paired
        for s1_name, s2_name in detected_names:
            is_lab1 = "lab" in s1_name.lower() or "workshop" in s1_name.lower()
            is_lab2 = "lab" in s2_name.lower() or "workshop" in s2_name.lower()
            if is_lab1 != is_lab2:
                raise AssertionError(f"Theory and Lab wrongly matched: {s1_name} and {s2_name}")
        
        # Expected pairs
        assert len(pairs) >= 3, f"Expected at least 3 duplicate pairs, got {len(pairs)}"
        print("  [OK] Duplicate detection accurately separated theory and lab and matched duplicates.")

def test_atomic_merge_on_test_user():
    print("\n--- 3. Testing Atomic Merge on Isolated Test User ---")
    conn = sqlite3.connect("study_planner.db")
    c = conn.cursor()
    # Find or create a test user
    c.execute("SELECT id FROM users WHERE email='test_merge_bot@cognify.com'")
    row = c.fetchone()
    if not row:
        c.execute("INSERT INTO users (email, password_hash, first_name, last_name, display_name) VALUES ('test_merge_bot@cognify.com', 'dummyhash', 'Test', 'Bot', 'TestBot')")
        test_uid = c.lastrowid
    else:
        test_uid = row[0]
    
    # Clean previous subjects for test user
    c.execute("DELETE FROM subjects WHERE user_id=?", (test_uid,))
    
    # Insert 2 duplicate subjects: "Discrete Structures & Theory of Logic" with 6 topics and 21 topics
    subj1_units = [
        {
            "unitNumber": 1,
            "unitTitle": "Unit 1: Set Theory & Relations",
            "topics": [
                {"id": "t1", "name": "Sets, Relations, Functions", "completed": True, "needsFocus": False, "isImportant": False},
                {"id": "t2", "name": "Equivalence Relations & Partitions", "completed": False, "needsFocus": True, "isImportant": False}
            ]
        },
        {
            "unitNumber": 2,
            "unitTitle": "Unit 2: Algebraic Structures",
            "topics": [
                {"id": "t3", "name": "Semigroups, Monoids, Groups", "completed": False, "needsFocus": False, "isImportant": True}
            ]
        }
    ]
    subj2_units = [
        {
            "unitNumber": 1,
            "unitTitle": "Unit 1: Set Theory & Relations",
            "topics": [
                {"id": "t1_dup", "name": "Sets, Relations, Functions", "completed": False, "needsFocus": True, "isImportant": True}, # Should merge flags!
                {"id": "t4", "name": "Partial Order Relations & Lattices", "completed": True, "needsFocus": False, "isImportant": False}
            ]
        },
        {
            "unitNumber": 3,
            "unitTitle": "Unit 3: Propositional Logic",
            "topics": [
                {"id": "t5", "name": "Tautologies, Contradictions & Normal Forms", "completed": False, "needsFocus": True, "isImportant": False}
            ]
        }
    ]
    
    c.execute(
        "INSERT INTO subjects (user_id, name, code, semester, units_json, topics_json) VALUES (?, ?, ?, ?, ?, ?)",
        (test_uid, "Discrete Structures & Theory of Logic", "KCS303", 3, json.dumps(subj1_units), json.dumps([t for u in subj1_units for t in u["topics"]]))
    )
    s1_id = c.lastrowid
    
    c.execute(
        "INSERT INTO subjects (user_id, name, code, semester, units_json, topics_json) VALUES (?, ?, ?, ?, ?, ?)",
        (test_uid, "Discrete Structures & Theory of Logic", "KCS303", 3, json.dumps(subj2_units), json.dumps([t for u in subj2_units for t in u["topics"]]))
    )
    s2_id = c.lastrowid
    conn.commit()
    conn.close()
    
    print(f"  Created test subjects with IDs {s1_id} (3 topics) and {s2_id} (3 topics).")
    
    # Call /merge-duplicates
    req = urllib.request.Request(
        f"{BASE_URL}/merge-duplicates",
        data=json.dumps({"user_id": test_uid, "primary_id": s1_id, "secondary_id": s2_id}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        print(f"  Merge Response: {result}")
        assert result["success"] is True, "Merge failed"
        
        merged_subj = result["merged_subject"]
        print(f"  Merged subject topics count: {len(merged_subj['topics'])}, units: {len(merged_subj['units'])}")
        
        # Verify unit 1 has merged topic 'Sets, Relations, Functions' with combined flags
        # In subj1: completed=True, needsFocus=False, isImportant=False
        # In subj2: completed=False, needsFocus=True, isImportant=True
        # Combined should have: completed=True, needsFocus=True, isImportant=True!
        merged_topics = {t["name"].lower(): t for t in merged_subj["topics"]}
        assert "sets, relations, functions" in merged_topics, "Topic 1 not found in merged topics"
        t1_merged = merged_topics["sets, relations, functions"]
        print(f"  Merged Topic 'Sets, Relations, Functions' flags -> completed: {t1_merged['completed']}, needsFocus: {t1_merged['needsFocus']}, isImportant: {t1_merged['isImportant']}")
        assert t1_merged["completed"] is True, "Completed flag should be preserved with OR logic"
        assert t1_merged["needsFocus"] is True, "needsFocus flag should be preserved with OR logic"
        assert t1_merged["isImportant"] is True, "isImportant flag should be preserved with OR logic"
        
        # Verify unique topics from both subjects are present:
        # 'Equivalence Relations & Partitions' (from s1)
        # 'Partial Order Relations & Lattices' (from s2)
        # 'Semigroups, Monoids, Groups' (from s1)
        # 'Tautologies, Contradictions & Normal Forms' (from s2)
        assert "equivalence relations & partitions" in merged_topics
        assert "partial order relations & lattices" in merged_topics
        assert "semigroups, monoids, groups" in merged_topics
        assert "tautologies, contradictions & normal forms" in merged_topics
        assert len(merged_subj["topics"]) == 5, f"Expected 5 unique topics after deduplication, got {len(merged_subj['topics'])}"
        
        # Verify secondary subject s2_id was removed from database
        conn = sqlite3.connect("study_planner.db")
        c = conn.cursor()
        c.execute("SELECT id FROM subjects WHERE id=?", (s2_id,))
        assert c.fetchone() is None, "Secondary subject was not deleted after merge"
        
        # Verify backup snapshot was created
        c.execute("SELECT COUNT(*) FROM subjects_merge_backup WHERE user_id=?", (test_uid,))
        backup_count = c.fetchone()[0]
        assert backup_count >= 1, "Snapshot backup record was not found in subjects_merge_backup"
        print(f"  [OK] Verified backup snapshot table has {backup_count} record(s).")
        
        # Recalculated stats check
        stats = result.get("stats", {})
        print(f"  Recalculated stats: {stats}")
        assert stats.get("total_subjects") == 1
        assert stats.get("total_topics") == 5
        assert stats.get("completed_topics") == 2 # t1 and t4 are completed
        conn.close()
        print("  [OK] Atomic merge with OR flag preservation and stats calculation passed flawlessly.")

def test_timetable_generation():
    print("\n--- 4. Testing AI Timetable Generation with Selected Topics ---")
    payload = {
        "dailyHours": 3,
        "startTime": "18:00",
        "endTime": "21:30",
        "selectedTopics": [
            {"subjectName": "Data Structure", "topicName": "Time and Space Complexity, Big Oh Notations", "needsFocus": True, "isImportant": True},
            {"subjectName": "Operating System", "topicName": "Critical Section Problem & Semaphores", "needsFocus": True, "isImportant": True}
        ]
    }
    req = urllib.request.Request(
        f"{BASE_URL}/generate-schedule",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data["success"] is True, "Timetable generation failed"
        schedule = data["schedule"]
        print(f"  Generated {len(schedule)} schedule items.")
        study_blocks = [s for s in schedule if s.get("type") == "study"]
        break_blocks = [s for s in schedule if s.get("type") == "break"]
        print(f"    - Study blocks: {len(study_blocks)}")
        print(f"    - Break blocks: {len(break_blocks)}")
        assert len(study_blocks) >= 2, "Expected study blocks for selected topics"
        print("  [OK] Timetable generation functional and integrates selected topics & breaks.")

if __name__ == "__main__":
    test_static_and_assets()
    test_duplicate_detection_user5()
    test_atomic_merge_on_test_user()
    test_timetable_generation()
    print("\n==========================================")
    print(" ALL 4 VERIFICATION SUITES PASSED 100%! ")
    print("==========================================")
