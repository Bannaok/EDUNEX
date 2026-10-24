CREATE TABLE IF NOT EXISTS developers (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO developers (id, username, password, full_name)
VALUES ('dev-airfan', 'Airfan', '456789', 'Airfan');

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
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

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
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES school_admins(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academic_years (
  year_code TEXT PRIMARY KEY,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO academic_years (year_code) VALUES ('2567');
INSERT OR IGNORE INTO academic_years (year_code) VALUES ('2568');
INSERT OR IGNORE INTO academic_years (year_code) VALUES ('2569');

CREATE INDEX IF NOT EXISTS idx_members_school ON members(school_id);
CREATE INDEX IF NOT EXISTS idx_admins_username ON school_admins(username);
CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);
