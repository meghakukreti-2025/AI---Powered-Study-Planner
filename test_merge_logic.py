import sqlite3
import re

def normalize_topic(t):
    s = t.lower().strip()
    s = re.sub(r'^(unit\s+[ivx\d]+[:\-.]?\s*|module\s+[\d]+[:\-.]?\s*|topic\s+[\d]+[:\-.]?\s*)', '', s)
    s = s.replace('&', 'and')
    s = re.sub(r'[^\w\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

conn = sqlite3.connect('study_planner.db')
c = conn.cursor()

def test_merge(idA, idB):
    c.execute("SELECT name, semester, code FROM subjects WHERE id=?", (idA,))
    nameA, semA, codeA = c.fetchone()
    c.execute("SELECT name, semester, code FROM subjects WHERE id=?", (idB,))
    nameB, semB, codeB = c.fetchone()

    c.execute("SELECT id, name, completed, is_important, needs_focus, unit FROM topics WHERE subject_id=?", (idA,))
    topsA = c.fetchall()
    c.execute("SELECT id, name, completed, is_important, needs_focus, unit FROM topics WHERE subject_id=?", (idB,))
    topsB = c.fetchall()

    seen = {}
    overlapping = []
    unique_A = []
    unique_B = []

    for t in topsA:
        norm = normalize_topic(t[1])
        seen[norm] = {
            "name": t[1],
            "completed": bool(t[2]),
            "isImportant": bool(t[3]),
            "needsFocus": bool(t[4]),
            "unit": t[5],
            "source": "A"
        }

    for t in topsB:
        norm = normalize_topic(t[1])
        if norm in seen:
            overlapping.append((seen[norm]["name"], t[1]))
            # Merge progress flags (OR logic)
            seen[norm]["completed"] = seen[norm]["completed"] or bool(t[2])
            seen[norm]["isImportant"] = seen[norm]["isImportant"] or bool(t[3])
            seen[norm]["needsFocus"] = seen[norm]["needsFocus"] or bool(t[4])
        else:
            seen[norm] = {
                "name": t[1],
                "completed": bool(t[2]),
                "isImportant": bool(t[3]),
                "needsFocus": bool(t[4]),
                "unit": t[5],
                "source": "B"
            }
            unique_B.append(t[1])

    unique_A = [val["name"] for val in seen.values() if val.get("source") == "A"]

    print(f"\nMerging '{nameA}' ({len(topsA)} topics) + '{nameB}' ({len(topsB)} topics):")
    print(f"Total merged unique topics: {len(seen)}")
    print(f"Overlapping topics: {len(overlapping)}")
    print(f"Unique to A: {len(unique_A)}, Unique to B: {len(unique_B)}")

test_merge(522, 527) # Discrete Structures
test_merge(523, 529) # COA Lab
test_merge(524, 530) # Web Designing Workshop
