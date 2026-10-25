import sqlite3

conn = sqlite3.connect('study_planner.db')
c = conn.cursor()
c.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
for row in c.fetchall():
    print("TABLE:", row[0])
    print(row[1])
    print("-" * 50)
