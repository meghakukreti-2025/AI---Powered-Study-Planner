import sys
import json
from pdf_extractor import SyllabusPDFExtractor

pdf_path = "2nd year syllabus.pdf"
extractor = SyllabusPDFExtractor()
res = extractor.extract(pdf_path)

print("=== PDF EXTRACTION VERIFICATION REPORT ===")
print(f"Pages Processed: {res['pagesProcessed']}")
print(f"Subjects Identified: {res['subjectCount']}")
print(f"Total Units Extracted: {res['totalUnits']}")
print(f"Total Topics Extracted: {res['totalTopics']}")
print(f"Warnings: {res['warnings']}")

print("\n--- SUBJECT & UNIT BREAKDOWN ---")
for s in res['subjects']:
    print(f"\n[Semester {s.get('semester')}] {s['code']}: {s['name']} (Page {s.get('sourcePage')})")
    print(f"   Units ({len(s['units'])}):")
    for u in s['units']:
        print(f"     - Unit {u['unitNumber']} ({u['unitTitle']}): {len(u['topics'])} topics")
        for t in u['topics'][:3]:
            print(f"         * {t['name']}")

# Check assertions
assert res['pagesProcessed'] == 18, f"Expected 18 pages, got {res['pagesProcessed']}"
assert res['subjectCount'] == 6, f"Expected 6 core theory subjects, got {res['subjectCount']}"
assert res['totalUnits'] == 30, f"Expected 30 units (6 subjects x 5 units), got {res['totalUnits']}"

# Check for zero course outcomes in topics
for s in res['subjects']:
    for t in s['topics']:
        name = t['name'].lower()
        assert not name.startswith("co 1") and not name.startswith("co 2") and not name.startswith("co 3"), f"Course outcome found: {t['name']}"
        assert "course outcome" not in name, f"Course outcome found in topic: {t['name']}"

print("\n>>> ALL CRITICAL ACCEPTANCE CRITERIA PASSED! 6 SUBJECTS, 30 UNITS, ZERO COURSE OUTCOMES! <<<")
