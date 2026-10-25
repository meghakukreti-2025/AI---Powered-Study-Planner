import io
from server import app

client = app.test_client()

print("--- Testing POST /upload-syllabus-pdf via Flask test client ---")
with open("2nd year syllabus.pdf", "rb") as f:
    pdf_bytes = f.read()

data = {
    'file': (io.BytesIO(pdf_bytes), '2nd year syllabus.pdf')
}

res = client.post('/upload-syllabus-pdf', data=data, content_type='multipart/form-data')
print("Status Code:", res.status_code)
resp_json = res.get_json()
print("Success:", resp_json.get("success"))
print("Subject Count:", resp_json.get("subjectCount"))
print("Total Units:", resp_json.get("totalUnits"))
print("Total Topics:", resp_json.get("totalTopics"))

assert res.status_code == 200, f"Expected 200, got {res.status_code}"
assert resp_json.get("subjectCount") == 6, f"Expected 6, got {resp_json.get('subjectCount')}"
assert resp_json.get("totalUnits") == 30, f"Expected 30, got {resp_json.get('totalUnits')}"

print("\n--- Testing POST /generate-schedule ---")
sched_res = client.post('/generate-schedule', json={
    "subjects": resp_json["subjects"][:2],
    "availableHours": 3.5,
    "startTime": "17:30",
    "endTime": "21:30"
})
print("Schedule status:", sched_res.status_code)
sched_data = sched_res.get_json()
print("Schedule slots count:", len(sched_data["schedule"][0]["slots"]))
for slot in sched_data["schedule"][0]["slots"]:
    line = f"  {slot['time']} | {slot['subject']} | {slot['topic'][:40]}"
    print(line.encode('ascii', errors='replace').decode('ascii'))

print("\n[ALL FLASK ENDPOINT TESTS PASSED SUCCESSFULLY!]")
