import sqlite3
import json
import re

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
                # Decide primary/keep vs secondary/merge:
                # Prefer the subject with more topics, or the one with a course code
                t1_len = len(s1.get("topics", []))
                t2_len = len(s2.get("topics", []))
                if t1_len >= t2_len:
                    keep, merge = s1, s2
                else:
                    keep, merge = s2, s1

                candidates.append({
                    "keepSubject": keep,
                    "mergeSubject": merge,
                    "reason": reason
                })
    return candidates

print("Duplicate finding logic tested OK")
