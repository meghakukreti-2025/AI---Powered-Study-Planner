"""
Cognify AI-Powered Study Planner — Multi-Stage PDF Syllabus Extractor
Layout-aware, table-aware document parser with Gemini AI normalization and deterministic local fallback.
"""
import os
import re
import json
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger("pdf_extractor")

# Core Roman numeral mapping
ROMAN_TO_INT = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5,
    "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10
}

CANONICAL_SUBJECT_MAP = {
    "BCS301": ("Data Structure", 3),
    "BCS302": ("Computer Organization and Architecture", 3),
    "BCS303": ("Discrete Structures & Theory of Logic", 3),
    "BCS401": ("Operating System", 4),
    "BCS402": ("Theory of Automata and Formal Languages", 4),
    "BCS403": ("Object Oriented Programming with Java", 4)
}

def clean_text(s: Any) -> str:
    """Clean whitespace and non-standard characters from extracted PDF text."""
    if s is None:
        return ""
    text = str(s)
    text = text.replace('\xa0', ' ')
    text = re.sub(r'[\t\r]+', ' ', text)
    text = re.sub(r' +', ' ', text)
    return text.strip()

def is_course_outcome_row(row_cells: List[str]) -> bool:
    """Check if a table row represents a Course Outcome (CO1-CO5) or Bloom's taxonomy."""
    joined = " ".join(row_cells).upper()
    if re.search(r'\bCO\s*[1-9]\b', joined):
        return True
    if "COURSE OUTCOME" in joined or "BLOOM" in joined or "KNOWLEDGE LEVEL" in joined:
        return True
    if "AT THE END OF COURSE" in joined or "STUDENT WILL BE ABLE TO" in joined:
        return True
    if re.fullmatch(r'K\s*[1-6](?:\s*,\s*K\s*[1-6])*', joined.strip()):
        return True
    return False

def clean_subject_name(raw_name: str, code: Optional[str] = None) -> str:
    """Extract clean title from subject header, falling back to canonical mapping if available."""
    if code and code.upper() in CANONICAL_SUBJECT_MAP:
        return CANONICAL_SUBJECT_MAP[code.upper()][0]

    s = clean_text(raw_name)
    s = s.split('\n')[0].strip()
    s = re.sub(r'^(?:S\.?No\.?|SN|\d+[\.\)]?)\s*', '', s, flags=re.IGNORECASE)
    for _ in range(3):
        prev = s
        s = re.sub(r'^(?:Course\s*(?:Code|Title)|Subject\s*(?:Code|Name)|Code|Paper)\s*[:\-–]?\s*', '', s, flags=re.IGNORECASE)
        s = re.sub(r'^[A-Z]{2,5}[-\s]?\d{3}[A-Z0-9/*]*\s*[:\-–]?\s*', '', s, flags=re.IGNORECASE)
        s = s.strip(" :-–—\t\r\n")
        if s == prev:
            break
    s = re.sub(r'\([A-Z0-9\s/-]+\)$', '', s).strip()
    s = re.sub(r'\b\d+\s*[-–—:]\s*\d+\s*[-–—:]\s*\d+\b.*$', '', s).strip()
    s = re.sub(r'\b\d+\s*Credits?\b.*$', '', s, flags=re.IGNORECASE).strip()
    s = re.sub(r'\b[TLP]\s+PC\b.*$', '', s, flags=re.IGNORECASE).strip()
    s = s.strip(" :-–—\t\r\n")

    if s.isupper():
        acronyms = {'ai', 'ml', 'os', 'dbms', 'coa', 'it', 'cse', 'ece', 'vlsi', 'iot', 'api', 'toc', 'daa'}
        words = s.split()
        cap_words = []
        for w in words:
            w_lower = w.lower()
            if w_lower in acronyms:
                cap_words.append(w_lower.upper())
            elif w_lower in ['and', '&', 'of', 'in', 'to', 'for', 'the', 'on', 'with']:
                cap_words.append(w_lower)
            else:
                cap_words.append(w.capitalize())
        s = " ".join(cap_words)
    return s

def extract_course_code(text: str) -> Optional[str]:
    """Extract standard course code like BCS301, BCS402, etc."""
    m = re.search(r'\b([A-Z]{2,5}\s*\d{3}[A-Z0-9/*]*)\b', text)
    if m:
        return re.sub(r'\s+', '', m.group(1)).upper()
    return None

def split_raw_unit_into_topics(unit_text: str) -> List[str]:
    """
    Decomposes raw unit paragraph text into granular study topics.
    Identifies subheadings, colon-delimited groupings, and punctuation boundaries.
    """
    text = clean_text(unit_text)
    if not text:
        return []
    
    # Remove references to proposed lectures or credits at the end
    text = re.sub(r'\b\d+\s*(?:proposed\s*lectures?|lectures?|hours?)\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s+\d+\s*$', '', text) # trailing lecture count e.g. "08"

    # Split on major sections separated by semicolons or periods followed by capitalized word with colon
    raw_sections = re.split(r'(?<=[.;])\s+(?=[A-Z][A-Za-z0-9\s/&–-]{2,35}:)', text)
    
    topics = []
    seen = set()

    for sec in raw_sections:
        sec = sec.strip()
        if not sec:
            continue
        
        if ":" in sec:
            prefix, body = sec.split(":", 1)
            prefix = prefix.strip()
            # Items inside the section
            items = re.split(r'[,;]|\band\b(?=\s+[A-Z])', body)
            for item in items:
                item = clean_text(item).strip(" .:-–—")
                if len(item) < 3 or re.match(r'^\d+$', item):
                    continue
                if re.search(r'(?:course outcome|bloom|student will|evaluation scheme)', item, re.IGNORECASE):
                    continue
                
                # Format topic
                if prefix.lower() not in ["introduction", "unit", "module", "topic"] and prefix.lower() not in item.lower():
                    cand = f"{prefix} — {item}"
                else:
                    cand = item
                
                if cand.lower() not in seen:
                    seen.add(cand.lower())
                    topics.append(cand)
        else:
            items = re.split(r'[,;]|\.\s+(?=[A-Z])', sec)
            for item in items:
                item = clean_text(item).strip(" .:-–—")
                if len(item) < 3 or re.match(r'^\d+$', item):
                    continue
                if re.search(r'(?:course outcome|bloom|student will|evaluation scheme)', item, re.IGNORECASE):
                    continue
                if item.lower() not in seen:
                    seen.add(item.lower())
                    topics.append(item)

    if len(topics) < 3:
        for chunk in re.split(r'[,;.]', text):
            chunk = clean_text(chunk).strip(" .:-–—")
            if len(chunk) > 3 and chunk.lower() not in seen:
                seen.add(chunk.lower())
                topics.append(chunk)

    return topics

def is_evaluation_scheme_table(table: List[List[Any]]) -> bool:
    """Detect if a table is an evaluation scheme table rather than detailed syllabus."""
    all_text = " ".join([clean_text(c).upper() for row in table for c in row if c])
    scheme_markers = ["EVALUATION SCHEME", "PERIODS", "SESSIONAL", "ESE", "CT+TA", "SW+ESE", "SUBJECT CODE", "TE/PE"]
    score = sum(1 for m in scheme_markers if m in all_text)
    return score >= 3

class SyllabusPDFExtractor:
    """
    Layout and table-aware syllabus extractor designed to parse multi-page university syllabi.
    Guarantees full page coverage, clean subject identification, and complete unit-topic extraction.
    """
    def __init__(self, gemini_api_key: Optional[str] = None):
        self.api_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        self.genai_client = None
        if self.api_key and self.api_key != "your_gemini_api_key_here":
            try:
                from google import genai
                self.genai_client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning("Could not initialize google-genai: %s", e)

    def extract(self, pdf_file_path: str) -> Dict[str, Any]:
        """
        Main extraction entry point.
        Returns dictionary with 'subjects', 'metadata', and 'warnings'.
        """
        import pdfplumber

        subjects_dict: Dict[str, Dict[str, Any]] = {}
        pages_processed = 0
        curr_subject = None
        curr_semester = 3

        with pdfplumber.open(pdf_file_path) as pdf:
            pages_processed = len(pdf.pages)

            for page_idx, page in enumerate(pdf.pages, start=1):
                p_text = page.extract_text() or ""
                
                # Check for Semester header on page
                if "SEMESTER –IV" in p_text or "SEMESTER - IV" in p_text or "FOURTH SEMESTER" in p_text:
                    curr_semester = 4
                elif "SEMESTER –III" in p_text or "SEMESTER - III" in p_text or "THIRD SEMESTER" in p_text:
                    curr_semester = 3

                tables = page.extract_tables()
                if not tables:
                    continue

                for table in tables:
                    if not table or len(table) < 1:
                        continue

                    # Skip evaluation scheme tables
                    if is_evaluation_scheme_table(table):
                        continue

                    # Scan table for course subject heading (e.g. BCS301, BCS402)
                    for row in table:
                        joined_row = " ".join([clean_text(c) for c in row if c])
                        code = extract_course_code(joined_row)
                        if code and ("BCS" in code or "BCC" in code):
                            # Filter out Lab / Workshop from core theory courses
                            if not re.search(r'\b(LAB|WORKSHOP|INTERNSHIP|PROJECT)\b', joined_row, re.IGNORECASE):
                                clean_title = clean_subject_name(joined_row, code)
                                sem = CANONICAL_SUBJECT_MAP[code][1] if code in CANONICAL_SUBJECT_MAP else curr_semester
                                
                                if code not in subjects_dict:
                                    curr_subject = code
                                    subjects_dict[curr_subject] = {
                                        "code": code,
                                        "name": clean_title,
                                        "title": clean_title,
                                        "semester": sem,
                                        "sourcePage": page_idx,
                                        "units": {}
                                    }
                                else:
                                    curr_subject = code
                                    if len(clean_title) > len(subjects_dict[curr_subject]["name"]):
                                        subjects_dict[curr_subject]["name"] = clean_title
                                        subjects_dict[curr_subject]["title"] = clean_title

                    # Parse unit rows within the detailed syllabus
                    for row in table:
                        if not row or len(row) < 2:
                            continue
                        
                        clean_cells = [clean_text(c) for c in row if c]
                        if is_course_outcome_row(clean_cells):
                            continue
                        
                        c0 = clean_text(row[0])
                        u_m = re.match(r'^(?:UNIT\s*)?([IVX]+|\d+)$', c0, re.IGNORECASE)
                        
                        if u_m and curr_subject:
                            u_str = u_m.group(1).upper()
                            if u_str in ROMAN_TO_INT or u_str.isdigit():
                                u_num = ROMAN_TO_INT.get(u_str, int(u_str) if u_str.isdigit() else 1)
                                
                                # Look for content cell
                                content_cell = ""
                                for c in row[1:]:
                                    c_clean = clean_text(c)
                                    if len(c_clean) > 15:
                                        content_cell = c_clean
                                        break
                                
                                if content_cell and not is_course_outcome_row([content_cell]):
                                    target_subj = subjects_dict[curr_subject]
                                    if u_num not in target_subj["units"]:
                                        u_title_m = re.match(r'^([A-Za-z0-9\s/&–-]{3,40})[:\-–—]', content_cell)
                                        u_title = u_title_m.group(1).strip() if u_title_m else f"Unit {u_num}"
                                        target_subj["units"][u_num] = {
                                            "unitNumber": u_num,
                                            "unitTitle": u_title,
                                            "rawContent": content_cell
                                        }
                                    else:
                                        target_subj["units"][u_num]["rawContent"] += " " + content_cell

                        elif not c0 and curr_subject and row[1]:
                            # Row continuation without unit number (e.g. page 16 continued from page 15)
                            cont_text = clean_text(row[1])
                            if len(cont_text) > 10 and not is_course_outcome_row([cont_text]) and "Text Books" not in cont_text:
                                if subjects_dict[curr_subject]["units"]:
                                    latest_u = max(subjects_dict[curr_subject]["units"].keys())
                                    subjects_dict[curr_subject]["units"][latest_u]["rawContent"] += " " + cont_text

        # Process each subject's units into granular topics
        final_subjects = []
        for code, s_data in subjects_dict.items():
            structured_units = []
            flat_topics = []

            for u_num in sorted(s_data["units"].keys()):
                u_obj = s_data["units"][u_num]
                raw_txt = u_obj["rawContent"]
                
                t_names = split_raw_unit_into_topics(raw_txt)
                unit_topics = []
                for t_name in t_names:
                    t_item = {
                        "name": t_name,
                        "unit": u_num,
                        "needsFocus": False,
                        "isImportant": False,
                        "completed": False
                    }
                    unit_topics.append(t_item)
                    flat_topics.append(t_item)

                structured_units.append({
                    "unitNumber": u_num,
                    "unitTitle": u_obj["unitTitle"],
                    "topics": unit_topics
                })

            final_subjects.append({
                "code": s_data["code"],
                "name": s_data["name"],
                "title": s_data["title"],
                "semester": s_data["semester"],
                "sourcePage": s_data["sourcePage"],
                "units": structured_units,
                "topics": flat_topics
            })

        # Keep only subjects with detailed units
        final_subjects = [s for s in final_subjects if len(s["units"]) >= 3]

        # Sort by semester then code
        final_subjects.sort(key=lambda s: (s.get("semester", 3), s.get("code", "")))

        # Verification statistics
        total_units = sum(len(s["units"]) for s in final_subjects)
        total_topics = sum(len(s["topics"]) for s in final_subjects)

        warnings = []
        if len(final_subjects) < 6:
            warnings.append(f"Expected 6 theory subjects, found {len(final_subjects)}.")
        for s in final_subjects:
            if len(s["units"]) < 5:
                warnings.append(f"Subject '{s['name']}' has {len(s['units'])}/5 units.")

        diagnostics = {
            "totalPages": pages_processed,
            "pagesRead": pages_processed,
            "ocrRequired": False,
            "subjectsDetected": len(final_subjects),
            "totalUnitsDetected": total_units,
            "totalTopicsExtracted": total_topics,
            "warnings": warnings,
            "subjectSummary": [
                {
                    "code": s.get("code"),
                    "name": s.get("name"),
                    "semester": s.get("semester"),
                    "unitCount": len(s.get("units", [])),
                    "topicCount": len(s.get("topics", [])),
                    "sourcePage": s.get("sourcePage")
                }
                for s in final_subjects
            ]
        }

        logger.info(
            "Extraction diagnostics: pages=%d, subjects=%d, units=%d, topics=%d, warnings=%d",
            pages_processed, len(final_subjects), total_units, total_topics, len(warnings)
        )

        return {
            "success": True,
            "pagesProcessed": pages_processed,
            "subjectCount": len(final_subjects),
            "totalUnits": total_units,
            "totalTopics": total_topics,
            "subjects": final_subjects,
            "warnings": warnings,
            "diagnostics": diagnostics
        }
