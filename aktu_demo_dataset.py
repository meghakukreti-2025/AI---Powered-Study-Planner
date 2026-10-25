"""
AKTU B.Tech Computer Science & Information Technology (2nd Year / Semesters 3 & 4)
Verified Demo Curriculum Dataset.
"""
import os
import json
import copy

_DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aktu_demo_dataset.json")

def _load_data():
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

AKTU_DEMO_SUBJECTS = _load_data()

def get_aktu_demo_dataset():
    """Returns a deep copy of the verified AKTU demo subjects."""
    return copy.deepcopy(AKTU_DEMO_SUBJECTS)
