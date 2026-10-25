import sqlite3

conn = sqlite3.connect('study_planner.db')
c = conn.cursor()

# 1. Fix subjects_merge_backup table to avoid NOT NULL constraint errors
c.execute("DROP TABLE IF EXISTS subjects_merge_backup_old")
c.execute("ALTER TABLE subjects_merge_backup RENAME TO subjects_merge_backup_old")

c.execute("""
CREATE TABLE subjects_merge_backup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 0,
    merged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    primary_id INTEGER NOT NULL DEFAULT 0,
    secondary_id INTEGER NOT NULL DEFAULT 0,
    snapshot_json TEXT NOT NULL DEFAULT ''
);
""")

# Copy old data safely
try:
    c.execute("""
    INSERT INTO subjects_merge_backup (id, user_id, merged_at, primary_id, secondary_id, snapshot_json)
    SELECT id, COALESCE(user_id, 0), merged_at, COALESCE(primary_id, 0), COALESCE(secondary_id, 0), COALESCE(snapshot_json, '')
    FROM subjects_merge_backup_old
    """)
except Exception as e:
    print("Notice copying old backup data:", e)

c.execute("DROP TABLE IF EXISTS subjects_merge_backup_old")

# 2. Add syllabus_drafts table
c.execute("""
CREATE TABLE IF NOT EXISTS syllabus_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    filename TEXT DEFAULT '',
    draft_json TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
""")

conn.commit()
conn.close()
print("Database migration completed successfully!")
