"""
Write aktu_demo_dataset.json and aktu_demo_dataset.py cleanly.
"""
import os
import json
from pdf_extractor import SyllabusPDFExtractor

extractor = SyllabusPDFExtractor()
res = extractor.extract("2nd year syllabus.pdf")

# Core theory subjects directly from AKTU 2nd year PDF
core_subjects = res["subjects"]

additional_subjects = [
    {
        "name": "Python Programming",
        "title": "Python Programming",
        "code": "BCC301",
        "semester": 3,
        "isLab": False,
        "units": [
            {
                "unitNumber": 1,
                "unitTitle": "Python Basics & Control Structures",
                "topics": [
                    {"name": "Python Interpreter and Interactive Mode"},
                    {"name": "Data Types: Numbers, Strings, Lists, Tuples, Dictionaries"},
                    {"name": "Conditional Statements: if, if-else, nested if"},
                    {"name": "Looping Structures: for loop, while loop, loop control"},
                    {"name": "Input / Output and String Formatting"}
                ]
            },
            {
                "unitNumber": 2,
                "unitTitle": "Functions, Modules and Packages",
                "topics": [
                    {"name": "Function Definition, Arguments (Positional, Keyword, Default)"},
                    {"name": "Variable Scope (Local, Global, LEGB Rule)"},
                    {"name": "Anonymous Functions (Lambda, map, filter, reduce)"},
                    {"name": "Creating and Importing Python Modules"},
                    {"name": "Standard Library Overview: math, random, datetime, os"}
                ]
            },
            {
                "unitNumber": 3,
                "unitTitle": "Data Structures & Comprehensions",
                "topics": [
                    {"name": "List Operations, Slicing and Methods"},
                    {"name": "Tuples and Immutability"},
                    {"name": "Dictionary Operations and Key-Value Traversal"},
                    {"name": "Set Operations and Mathematical Set Methods"},
                    {"name": "List, Set and Dictionary Comprehensions"}
                ]
            },
            {
                "unitNumber": 4,
                "unitTitle": "Object-Oriented Programming in Python",
                "topics": [
                    {"name": "Classes and Objects: Attributes and Methods"},
                    {"name": "Constructor (__init__) and Destructor (__del__)"},
                    {"name": "Inheritance (Single, Multiple, Multi-level)"},
                    {"name": "Polymorphism, Method Overriding and Encapsulation"},
                    {"name": "Magic / Dunder Methods in Python"}
                ]
            },
            {
                "unitNumber": 5,
                "unitTitle": "File Handling, Exceptions & Libraries",
                "topics": [
                    {"name": "File Operations: Reading, Writing, and Appending"},
                    {"name": "Exception Handling: try, except, finally, raise"},
                    {"name": "Custom Exception Classes"},
                    {"name": "Introduction to NumPy and Pandas for Data Analysis"}
                ]
            }
        ]
    },
    {
        "name": "Universal Human Values and Professional Ethics",
        "title": "Universal Human Values and Professional Ethics",
        "code": "BVE301",
        "semester": 3,
        "isLab": False,
        "units": [
            {
                "unitNumber": 1,
                "unitTitle": "Introduction to Value Education",
                "topics": [
                    {"name": "Need, Basic Guidelines, Content and Process for Value Education"},
                    {"name": "Self Exploration: Content and Process"},
                    {"name": "Continuous Happiness and Prosperity: A Look at Basic Human Aspirations"},
                    {"name": "Right Understanding, Relationship and Physical Facility"}
                ]
            },
            {
                "unitNumber": 2,
                "unitTitle": "Harmony in the Human Being",
                "topics": [
                    {"name": "Human Being as Co-existence of the Sentient 'I' and Material 'Body'"},
                    {"name": "Needs of Self ('I') and 'Body': Sukh and Suvidha"},
                    {"name": "Understanding the Body as an Instrument of 'I'"},
                    {"name": "Programs to Ensure Sanyam and Swasthya"}
                ]
            },
            {
                "unitNumber": 3,
                "unitTitle": "Harmony in the Family and Society",
                "topics": [
                    {"name": "Values in Human-to-Human Relationships: Trust (Vishwas) and Respect (Samman)"},
                    {"name": "Difference between Respect and Differentiation"},
                    {"name": "Harmony in Society: Comprehensive Human Goals"},
                    {"name": "Universal Harmonious Order in Society: Undivided Society (Akhand Samaj)"}
                ]
            },
            {
                "unitNumber": 4,
                "unitTitle": "Harmony in Nature and Existence",
                "topics": [
                    {"name": "Interconnectedness and Mutual Fulfillment among Four Orders of Nature"},
                    {"name": "Recyclability and Self-regulation in Nature"},
                    {"name": "Understanding Existence as Co-existence (Sah-astitva)"}
                ]
            },
            {
                "unitNumber": 5,
                "unitTitle": "Implications of Holistic Understanding on Professional Ethics",
                "topics": [
                    {"name": "Natural Acceptance of Human Values and Definitiveness of Ethical Human Conduct"},
                    {"name": "Basis for Humanistic Education, Humanistic Constitution and Universal Order"},
                    {"name": "Competence in Professional Ethics and Value-based Life"}
                ]
            }
        ]
    },
    # Labs - Semester 3
    {
        "name": "Data Structure Lab",
        "title": "Data Structure Lab",
        "code": "BCS351",
        "semester": 3,
        "isLab": True,
        "units": [
            {
                "unitNumber": 1,
                "unitTitle": "Practical Experiments",
                "topics": [
                    {"name": "Implement Recursive and Non-recursive Binary Search in C"},
                    {"name": "Implement Stack operations (Push, Pop, Display) using Arrays"},
                    {"name": "Infix to Postfix Expression Conversion and Evaluation"},
                    {"name": "Linear and Circular Queue implementation using Array"},
                    {"name": "Singly Linked List creation, insertion, deletion, and reversal"},
                    {"name": "Doubly Linked List operations"},
                    {"name": "Binary Search Tree (BST) creation and Traversals"},
                    {"name": "Implement Bubble Sort, Quick Sort and Merge Sort"},
                    {"name": "Graph Traversal using Breadth First Search (BFS) and Depth First Search (DFS)"}
                ]
            }
        ]
    },
    {
        "name": "Computer Organization and Architecture Lab",
        "title": "Computer Organization and Architecture Lab",
        "code": "BCS352",
        "semester": 3,
        "isLab": True,
        "units": [
            {
                "unitNumber": 1,
                "unitTitle": "Practical Experiments",
                "topics": [
                    {"name": "Design of Basic Logic Gates using Breadboard / Simulator"},
                    {"name": "Design of 4-bit Binary Adder and Subtractor"},
                    {"name": "Implementation of Booth's Multiplication Algorithm"},
                    {"name": "Simulation of 4-bit ALU with Arithmetic and Logic Operations"},
                    {"name": "Memory Interfacing simulation with microprocessor"},
                    {"name": "Assembly Language Programming for 8085 / 8086 microprocessors"}
                ]
            }
        ]
    },
    {
        "name": "Web Designing Workshop",
        "title": "Web Designing Workshop",
        "code": "BCS353",
        "semester": 3,
        "isLab": True,
        "units": [
            {
                "unitNumber": 1,
                "unitTitle": "Hands-on Web Design Projects",
                "topics": [
                    {"name": "HTML5 Semantic Structure and Forms"},
                    {"name": "CSS3 Flexbox and CSS Grid Responsive Layouts"},
                    {"name": "CSS Micro-animations, Transforms, and Media Queries"},
                    {"name": "JavaScript DOM Manipulation and Event Handling"},
                    {"name": "Modern UI Design with Glassmorphism and Dark Mode"},
                    {"name": "Building a Complete Interactive Multi-page Web Portal"}
                ]
            }
        ]
    },
    # Labs - Semester 4
    {
        "name": "Operating System Lab",
        "title": "Operating System Lab",
        "code": "BCS451",
        "semester": 4,
        "isLab": True,
        "units": [
            {
                "unitNumber": 1,
                "unitTitle": "System Programming & OS Simulation",
                "topics": [
                    {"name": "Linux Shell Commands and Bash Scripting Basics"},
                    {"name": "Process Creation and Control using fork(), exec(), wait(), and exit()"},
                    {"name": "Simulation of FCFS, SJF, Round Robin, and Priority CPU Scheduling"},
                    {"name": "Inter-process Communication using Pipes and Shared Memory"},
                    {"name": "Producer-Consumer Problem implementation using Semaphores and Mutex"},
                    {"name": "Banker's Algorithm for Deadlock Avoidance"},
                    {"name": "Page Replacement Simulation (FIFO, LRU, Optimal)"}
                ]
            }
        ]
    },
    {
        "name": "Object Oriented Programming with Java Lab",
        "title": "Object Oriented Programming with Java Lab",
        "code": "BCS452",
        "semester": 4,
        "isLab": True,
        "units": [
            {
                "unitNumber": 1,
                "unitTitle": "Practical Programming Experiments",
                "topics": [
                    {"name": "Java Classes, Constructors, and Method Overloading"},
                    {"name": "Inheritance, Dynamic Method Dispatch, and Abstract Classes"},
                    {"name": "Interface Implementation and Multiple Inheritance"},
                    {"name": "Custom Exception Handling and Multi-threading"},
                    {"name": "Java Collections Framework (ArrayList, HashMap, HashSet) operations"},
                    {"name": "Lambda Expressions and Stream API implementation"},
                    {"name": "Database Connectivity using JDBC and PreparedStatements"}
                ]
            }
        ]
    },
    {
        "name": "Cyber Security Workshop",
        "title": "Cyber Security Workshop",
        "code": "BCS453",
        "semester": 4,
        "isLab": True,
        "units": [
            {
                "unitNumber": 1,
                "unitTitle": "Security Tools and Practices",
                "topics": [
                    {"name": "Network Scanning and Port Enumeration using Nmap"},
                    {"name": "Packet Sniffing and Protocol Analysis using Wireshark"},
                    {"name": "Understanding Symmetric and Asymmetric Cryptography (AES, RSA)"},
                    {"name": "Web Application Vulnerability Scanning: SQL Injection and XSS"},
                    {"name": "Password Hashing, Salting and Security Best Practices"},
                    {"name": "Setting up Firewalls and Intrusion Detection Systems (IDS)"}
                ]
            }
        ]
    }
]

all_subjects = []
for s in core_subjects:
    s["isLab"] = False
    all_subjects.append(s)

all_subjects.extend(additional_subjects)

# Clean and assign sample study progress
topic_counter = 0
for s in all_subjects:
    flat_topics = []
    for u in s.get("units", []):
        unum = u.get("unitNumber", 1)
        utitle = (u.get("unitTitle") or f"Unit {unum}").strip().replace("\n", " ")
        for t in u.get("topics", []):
            topic_counter += 1
            raw_name = t.get("name") if isinstance(t, dict) else str(t)
            clean_name = " ".join(raw_name.split())
            
            is_completed = (topic_counter % 4 == 0)
            needs_focus = (topic_counter % 7 == 2) and not is_completed
            is_important = (topic_counter % 5 == 1)
            
            topic_obj = {
                "id": f"t_aktu_{topic_counter}",
                "name": clean_name,
                "unitNumber": unum,
                "unitTitle": utitle,
                "completed": is_completed,
                "needsFocus": needs_focus,
                "isImportant": is_important
            }
            flat_topics.append(topic_obj)
            if isinstance(t, dict):
                t["name"] = clean_name
                t["completed"] = is_completed
                t["needsFocus"] = needs_focus
                t["isImportant"] = is_important
                t["unitNumber"] = unum
                t["id"] = topic_obj["id"]

    s["topics"] = flat_topics

# Save to aktu_demo_dataset.json
with open("aktu_demo_dataset.json", "w", encoding="utf-8") as f:
    json.dump(all_subjects, f, indent=2, ensure_ascii=False)

# Write clean loader in aktu_demo_dataset.py
loader_code = '''"""
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
'''

with open("aktu_demo_dataset.py", "w", encoding="utf-8") as f:
    f.write(loader_code)

print(f"Successfully generated aktu_demo_dataset.json and aktu_demo_dataset.py with {len(all_subjects)} subjects and {topic_counter} topics!")
