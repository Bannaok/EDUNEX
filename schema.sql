-- ============================================================================
-- CLOUDFLARE D1 SQL SCHEMA: Academic Management System (ระบบบริหารวิชาการและธุรการ)
-- สำหรับจัดเก็บข้อมูลระดับ Developer, ID Admin โรงเรียน และ ID สมาชิก (บุคลากรครู)
-- ============================================================================

-- 1. ตาราง Developer (ผู้พัฒนาระบบสูงสุด)
CREATE TABLE IF NOT EXISTS developers (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- เพิ่ม Developer เริ่มต้น (Airfan / 456789)
INSERT OR IGNORE INTO developers (id, username, password, full_name)
VALUES ('dev-airfan', 'Airfan', '456789', 'Airfan (ผู้พัฒนาระบบ)');

-- 2. ตาราง School Admins (ผู้ดูแลระบบระดับโรงเรียน)
CREATE TABLE IF NOT EXISTS school_admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  school_name TEXT NOT NULL,
  school_code TEXT,
  affiliation TEXT,
  director_name TEXT,
  google_sheet_id TEXT,
  google_sheet_url TEXT,
  drive_folder_id TEXT,
  is_suspended INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 3. ตาราง Members (บุคลากรครูสังกัดโรงเรียน)
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  prefix TEXT DEFAULT 'ครู',
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'member',
  grade_level TEXT,
  position TEXT DEFAULT 'ครูประจำชั้น',
  learning_group TEXT,
  avatar_url TEXT,
  is_suspended INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES school_admins(id) ON DELETE CASCADE
);

-- 4. ตาราง Academic Years (ปีการศึกษาในระบบ)
CREATE TABLE IF NOT EXISTS academic_years (
  year_code TEXT PRIMARY KEY,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- เพิ่มปีการศึกษาเริ่มต้น
INSERT OR IGNORE INTO academic_years (year_code) VALUES ('2567'), ('2568'), ('2569');

-- ดัชนีเพื่อเพิ่มความเร็วในการสืบค้น
CREATE INDEX IF NOT EXISTS idx_members_school ON members(school_id);
CREATE INDEX IF NOT EXISTS idx_admins_username ON school_admins(username);
CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);
