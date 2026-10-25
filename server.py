import os
import json
import re
# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify
from flask_cors import CORS
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}})

USERS_DB = {}
SYLLABUS_DB = {}

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
    if provided_name and provided_name.strip():
        return provided_name.strip().capitalize()
    prefix = email.split("@")[0]
    cleaned = re.sub(r'\d+', '', prefix).strip()
    return cleaned.capitalize() if cleaned else prefix.capitalize()


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    first_name = clean_first_name(email, data.get("firstName", ""))
    last_name = data.get("lastName", "").strip()

    if not email:
        return jsonify({"success": False, "message": "Email is required."}), 400

    USERS_DB[email] = {
        "id": len(USERS_DB) + 1,
        "email": email,
        "password": password,
        "firstName": first_name,
        "lastName": last_name
    }

    if email not in SYLLABUS_DB:
        SYLLABUS_DB[email] = []

    return jsonify({"success": True, "user": USERS_DB[email], "subjects": SYLLABUS_DB[email]}), 200


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    
    if not email:
        return jsonify({"success": False, "message": "Email is required."}), 400

    if email not in USERS_DB:
        first_name = clean_first_name(email, data.get("firstName", ""))
        USERS_DB[email] = {
            "id": len(USERS_DB) + 1,
            "email": email,
            "password": password,
            "firstName": first_name,
            "lastName": data.get("lastName", "").strip()
        }
        if email not in SYLLABUS_DB:
            SYLLABUS_DB[email] = []

    return jsonify({"success": True, "user": USERS_DB[email], "subjects": SYLLABUS_DB.get(email, [])}), 200


@app.route("/save-syllabus", methods=["POST"])
def save_syllabus():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    subjects = data.get("subjects", [])

    if email:
        SYLLABUS_DB[email] = subjects
        return jsonify({"success": True, "message": "Syllabus synced."}), 200
    return jsonify({"success": False, "message": "Missing email."}), 400


@app.route("/get-syllabus", methods=["GET"])
def get_syllabus():
    email = request.args.get("email", "").strip().lower()
    if email in SYLLABUS_DB:
        return jsonify({"success": True, "subjects": SYLLABUS_DB[email]}), 200
    return jsonify({"success": True, "subjects": []}), 200


@app.route("/upload-syllabus-pdf", methods=["POST"])
def upload_pdf():
    try:
        # pyrefly: ignore [missing-import]
        from pypdf import PdfReader
    except ImportError:
        return jsonify({"success": False, "message": "pypdf library missing."}), 500

    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file uploaded."}), 400

    file = request.files['file']
    
    try:
        reader = PdfReader(file)
        extracted_text = ""
        for page in reader.pages:
            p_text = page.extract_text() or ""
            # Filter out evaluation scheme table pages automatically
            if "EVALUATION SCHEME" in p_text.upper() or "L T P CT TA" in p_text.upper():
                continue
            extracted_text += p_text + "\n"

        if not extracted_text.strip():
            # If all pages were filtered, take full text
            for page in reader.pages:
                extracted_text += (page.extract_text() or "") + "\n"

        api_key = os.getenv("GEMINI_API_KEY")
        if GENAI_AVAILABLE and api_key:
            client = genai.Client(api_key=api_key)
            prompt = f"""
            Extract ONLY real academic course subjects and their corresponding unit topics from this college syllabus text.

            STRICT EXCLUSIONS:
            - DO NOT extract university headers (e.g. 'DR. A.P.J. ABDUL KALAM TECHNICAL UNIVERSITY').
            - DO NOT extract table headers, mark schemes, or credit tables (e.g. 'L T P CT TA', 'SW+ESE', 'SN Subject Code', '1 BOE3**', '2 BVE301', '3 BCS301', '4 BCS302').
            - Extract ONLY complete course names (e.g. 'Data Structures', 'Computer Organization and Architecture', 'Discrete Structures & Theory of Logic', 'Universal Human Values and Professional Ethics').

            Return ONLY valid JSON matching this exact structure:
            {{
              "subjects": [
                {{
                  "name": "Subject Name",
                  "topics": [
                    {{"name": "Topic Name", "needsFocus": false, "isImportant": false}}
                  ]
                }}
              ]
            }}

            Syllabus Text:
            {extracted_text[:18000]}
            """

            for model_name in ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.8-flash']:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(response_mime_type="application/json")
                    )
                    if response.text:
                        parsed = json.loads(response.text)
                        valid_subs = []
                        blacklist = ['dr. a.p.j.', 'sn subject', 'l t p', 'sw+ese', 'technical university', 'evaluation scheme', 't va/hs']
                        
                        for sub in parsed.get("subjects", []):
                            s_name = sub.get("name", "").strip()
                            if s_name and not any(b in s_name.lower() for b in blacklist) and len(s_name) > 3:
                                cleaned_name = re.sub(r'^\d+\s*[A-Z0-9/*]+\s*', '', s_name).strip()
                                sub["name"] = cleaned_name if cleaned_name else s_name
                                valid_subs.append(sub)

                        if valid_subs:
                            return jsonify({"success": True, "data": {"subjects": valid_subs}}), 200
                except Exception:
                    continue

        return jsonify({"success": False, "message": "Could not parse valid course subjects."}), 400

    except Exception as e:
        return jsonify({"success": False, "message": f"PDF Error: {str(e)}"}), 500


@app.route("/generate-schedule", methods=["POST"])
def generate_schedule():
    data = request.get_json() or {}
    subjects = data.get("subjects", [])
    available_hours = data.get("availableHours", 3)
    start_time = data.get("startTime", "18:00")
    end_time = data.get("endTime", "23:00")

    if not subjects:
        return jsonify({"success": False, "message": "No subjects selected."}), 400

    api_key = os.getenv("GEMINI_API_KEY")
    if GENAI_AVAILABLE and api_key:
        try:
            client = genai.Client(api_key=api_key)
            prompt = f"""
            Create a study timetable for today based on these selected subjects and topics:
            {json.dumps(subjects)}
            
            Available Time: {available_hours} hours total between {start_time} and {end_time}.
            Return ONLY a valid JSON:
            {{
              "schedule": [
                {{
                  "day": "Today",
                  "slots": [
                    {{"time": "18:00 - 19:00", "subject": "Subject Title", "topic": "Topic Title", "needsFocus": false, "isImportant": true}}
                  ]
                }}
              ]
            }}
            """

            for model_name in ['gemini-flash-latest', 'gemini-2.5-flash']:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(response_mime_type="application/json")
                    )
                    if response.text:
                        parsed = json.loads(response.text)
                        if parsed.get("schedule"):
                            return jsonify({"success": True, "schedule": parsed["schedule"]}), 200
                except Exception:
                    continue
        except Exception:
            pass

    # Fallback Local Generator
    slots = []
    flat_topics = []
    for sub in subjects:
        s_name = sub.get("name", "Study Session")
        for top in sub.get("topics", []):
            t_name = top.get("name") if isinstance(top, dict) else str(top)
            if t_name.strip():
                flat_topics.append({"subject": s_name, "topic": t_name.strip()})

    if not flat_topics:
        return jsonify({"success": False, "message": "No valid topics selected."}), 400

    try:
        start_h, start_m = map(int, start_time.split(":"))
        end_h, end_m = map(int, end_time.split(":"))
    except ValueError:
        start_h, start_m, end_h, end_m = 18, 0, 21, 0

    total_mins = (end_h * 60 + end_m) - (start_h * 60 + start_m)
    if total_mins <= 0:
        total_mins = int(available_hours * 60)

    slot_duration = max(30, total_mins // max(1, len(flat_topics)))
    curr_mins = start_h * 60 + start_m

    for item in flat_topics[:8]:
        s_h, s_m = divmod(curr_mins, 60)
        e_mins = curr_mins + slot_duration
        e_h, e_m = divmod(e_mins, 60)

        time_str = f"{s_h:02d}:{s_m:02d} - {e_h:02d}:{e_m:02d}"
        slots.append({
            "time": time_str,
            "subject": item["subject"],
            "topic": item["topic"],
            "needsFocus": False,
            "isImportant": True
        })
        curr_mins = e_mins

    return jsonify({"success": True, "schedule": [{"day": "Today", "slots": slots}]}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)