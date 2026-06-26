-- LearnFlow LMS Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'instructor')),
  avatar_color VARCHAR(20) DEFAULT '#2563eb',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modules
CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#2563eb',
  icon VARCHAR(10) DEFAULT '📖',
  status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  order_index INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lessons
CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'video' CHECK (type IN ('video', 'quiz', 'assignment', 'reading')),
  video_url TEXT,
  form_url TEXT,
  content TEXT,
  duration VARCHAR(20),
  pages VARCHAR(20),
  deadline DATE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student lesson progress
CREATE TABLE IF NOT EXISTS lesson_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  score INTEGER,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, lesson_id)
);

-- File submissions (assignments)
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  grade INTEGER,
  feedback TEXT,
  graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resources (PDFs, docs, links per module)
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(20) DEFAULT 'file' CHECK (type IN ('file', 'link', 'reading')),
  url TEXT,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  description TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forum posts
CREATE TABLE IF NOT EXISTS forum_posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forum replies
CREATE TABLE IF NOT EXISTS forum_replies (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'event', 'new')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_submissions_lesson ON submissions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_forum_created ON forum_posts(created_at DESC);
