import sqlite3
import json
import re

def normalize_name(s):
    if not s:
        return ""
    s = s.lower().strip()
    s = s.replace('&', 'and')
    s = re.sub(r'[^\w\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def is_lab(s):
    return bool(re.search(r'\b(lab|laboratory|workshop|practical)\b', s.lower()))

def detect_duplicates(subjects):
    candidates = []
    n = len(subjects)
    for i in range(n):
        for j in range(i + 1, n):
            s1 = subjects[i]
            s2 = subjects[j]

            # 1. Must belong to the same semester
            sem1 = s1.get('semester', 3)
            sem2 = s2.get('semester', 3)
            if sem1 != sem2:
                continue

            # 2. Must be both lab or both theory
            n1_raw = s1.get('name') or s1.get('title') or ''
            n2_raw = s2.get('name') or s2.get('title') or ''
            lab1 = is_lab(n1_raw)
            lab2 = is_lab(n2_raw)
            if lab1 != lab2:
                continue

            # 3. Check course codes if present
            c1 = (s1.get('code') or '').strip().upper()
            c2 = (s2.get('code') or '').strip().upper()
            code_match = bool(c1 and c2 and c1 == c2)
            code_conflict = bool(c1 and c2 and c1 != c2)
            if code_conflict:
                continue

            # 4. Check name similarity
            norm1 = normalize_name(n1_raw)
            norm2 = normalize_name(n2_raw)

            # Exact normalized match
            is_match = False
            reason = ""
            if norm1 == norm2:
                is_match = True
                reason = "Exact name match"
            elif code_match:
                is_match = True
                reason = f"Matching course code ({c1})"
            else:
                # Check containment / abbreviation for labs
                # e.g., 'computer organization lab' vs 'computer organization and architecture lab'
                w1 = set(norm1.split())
                w2 = set(norm2.split())
                # remove stop words like 'and', 'the', 'of'
                stops = {'and', 'the', 'of', 'in', '&'}
                w1_clean = w1 - stops
                w2_clean = w2 - stops
                overlap = w1_clean & w2_clean
                union = w1_clean | w2_clean
                jaccard = len(overlap) / len(union) if union else 0
                if jaccard >= 0.65 or w1_clean.issubset(w2_clean) or w2_clean.issubset(w1_clean):
                    is_match = True
                    reason = f"High keyword overlap ({int(jaccard*100)}%)"

            if is_match:
                candidates.append({
                    "subjectA": s1,
                    "subjectB": s2,
                    "reason": reason
                })
    return candidates

# Test on User 5 from study_planner.db
conn = sqlite3.connect('study_planner.db')
c = conn.cursor()
c.execute("SELECT id, name, code, semester FROM subjects WHERE user_id=5")
subjs = []
for row in c.fetchall():
    s_id, name, code, sem = row
    c.execute("SELECT id, name, completed, is_important, needs_focus FROM topics WHERE subject_id=?", (s_id,))
    tops = [{"id": r[0], "name": r[1], "completed": bool(r[2]), "isImportant": bool(r[3]), "needsFocus": bool(r[4])} for r in c.fetchall()]
    subjs.append({
        "id": s_id,
        "name": name,
        "code": code,
        "semester": sem,
        "topics": tops
    })

results = detect_duplicates(subjs)
print(f"Detected {len(results)} duplicate pairs for User 5:")
for r in results:
    sA = r['subjectA']
    sB = r['subjectB']
    print(f"- {sA['name']} ({len(sA['topics'])} topics) vs {sB['name']} ({len(sB['topics'])} topics) => Reason: {r['reason']}")
