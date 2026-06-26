/**
 * LearnFlow Mock Server
 * Runs without PostgreSQL — stores data in memory.
 * Use this for local UI testing. Replace with server.js for production.
 */
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5001;
const JWT_SECRET = 'learnflow_mock_secret_dev';

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// ---- In-memory store ----
let users = [];
let modules = [];
let lessons = [];
let progress = []; // { userId, lessonId, completed, score }
let submissions = [];
let resources = [];
let chatMessages = [];
let forumPosts = [];
let announcements = [];
let idSeq = { user: 1, module: 1, lesson: 1, submission: 1, resource: 1, chat: 1, forum: 1, ann: 1 };

const COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#16a34a', '#d97706'];

// Seed some demo data
function seed() {
  const hash = bcrypt.hashSync('Teacher2024!', 10);
  users.push({ id: idSeq.user++, name: 'Ms. Sarah (Demo Teacher)', email: 'teacher@learnflow.demo', password_hash: hash, role: 'instructor', avatar_color: '#d97706' });

  const shash = bcrypt.hashSync('Student2024!', 10);
  users.push({ id: idSeq.user++, name: 'Alex (Demo Student)', email: 'student@learnflow.demo', password_hash: shash, role: 'student', avatar_color: '#2563eb' });

  const m1 = { id: idSeq.module++, title: 'Module 1: Foundations of English', description: 'Grammar basics and vocabulary building', color: '#2563eb', icon: '📖', status: 'published', order_index: 0 };
  const m2 = { id: idSeq.module++, title: 'Module 2: Speaking & Listening', description: 'Pronunciation and comprehension skills', color: '#0891b2', icon: '📖', status: 'published', order_index: 1 };
  modules.push(m1, m2);

  lessons.push(
    { id: idSeq.lesson++, module_id: m1.id, title: 'Introduction to English Grammar', type: 'video', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: '12:30', order_index: 0 },
    { id: idSeq.lesson++, module_id: m1.id, title: 'Vocabulary Quiz 1', type: 'quiz', video_url: 'https://forms.google.com/example', duration: '10:00', order_index: 1 },
    { id: idSeq.lesson++, module_id: m1.id, title: 'Writing Assignment 1', type: 'assignment', duration: null, order_index: 2 },
    { id: idSeq.lesson++, module_id: m2.id, title: 'Pronunciation Basics', type: 'video', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: '8:45', order_index: 0 },
    { id: idSeq.lesson++, module_id: m2.id, title: 'Listening Comprehension Quiz', type: 'quiz', video_url: 'https://forms.google.com/example', duration: '15:00', order_index: 1 }
  );

  announcements.push({ id: idSeq.ann++, title: 'Welcome to LearnFlow!', body: 'This is a demo environment. All data is stored in memory and will reset when the server restarts.', type: 'new', created_by: 1, created_at: new Date().toISOString() });
}
seed();

// ---- Auth helpers ----
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name, avatar_color: user.avatar_color }, JWT_SECRET, { expiresIn: '30d' });
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function instructorOnly(req, res, next) {
  if (req.user?.role !== 'instructor') return res.status(403).json({ error: 'Instructor only' });
  next();
}

// ---- Auth routes ----
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (users.find(u => u.email === email.toLowerCase())) return res.status(409).json({ error: 'Email already registered' });
  const hash = await bcrypt.hash(password, 10);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const user = { id: idSeq.user++, name: name.trim(), email: email.toLowerCase(), password_hash: hash, role: role === 'instructor' ? 'instructor' : 'student', avatar_color: color, created_at: new Date().toISOString() };
  users.push(user);
  const { password_hash, ...safe } = user;
  res.status(201).json({ token: signToken(safe), user: safe });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email?.toLowerCase());
  if (!user) return res.status(401).json({ error: 'No user found with this email' });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid password' });
  const { password_hash, ...safe } = user;
  res.json({ token: signToken(safe), user: safe });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { password_hash, ...safe } = user;
  res.json(safe);
});

// ---- Modules ----
app.get('/api/modules', authMiddleware, (req, res) => {
  const result = modules.map(m => {
    const mLessons = lessons.filter(l => l.module_id === m.id);
    let prog = 0;
    if (req.user.role === 'student' && mLessons.length > 0) {
      const done = mLessons.filter(l => progress.find(p => p.userId === req.user.id && p.lessonId === l.id && p.completed)).length;
      prog = Math.round((done / mLessons.length) * 100);
    }
    return { ...m, lesson_count: mLessons.length, progress: prog };
  });
  res.json(result);
});

app.get('/api/modules/coursenav', authMiddleware, (req, res) => res.json(modules));

app.post('/api/modules', authMiddleware, instructorOnly, (req, res) => {
  const { title, description, color, icon, status } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const m = { id: idSeq.module++, title, description: description || null, color: color || '#2563eb', icon: icon || '📖', status: status || 'published', order_index: modules.length, created_at: new Date().toISOString() };
  modules.push(m);
  res.status(201).json(m);
});

app.put('/api/modules/:id', authMiddleware, instructorOnly, (req, res) => {
  const idx = modules.findIndex(m => m.id === +req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  modules[idx] = { ...modules[idx], ...req.body };
  res.json(modules[idx]);
});

app.delete('/api/modules/:id', authMiddleware, instructorOnly, (req, res) => {
  modules = modules.filter(m => m.id !== +req.params.id);
  res.json({ success: true });
});

app.get('/api/modules/:id/lessons', authMiddleware, (req, res) => {
  const mLessons = lessons.filter(l => l.module_id === +req.params.id).sort((a, b) => a.order_index - b.order_index);
  if (req.user.role === 'student') {
    return res.json(mLessons.map(l => {
      const p = progress.find(p => p.userId === req.user.id && p.lessonId === l.id);
      return { ...l, done: p?.completed || false, score: p?.score ?? null };
    }));
  }
  res.json(mLessons.map(l => ({ ...l, done: false, score: null })));
});

app.post('/api/modules/:id/lessons', authMiddleware, instructorOnly, (req, res) => {
  const { title, type, video_url, form_url, content, duration, pages, deadline, order_index } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const l = { id: idSeq.lesson++, module_id: +req.params.id, title, type: type || 'video', video_url: video_url || null, form_url: form_url || null, content: content || null, duration: duration || null, pages: pages || null, deadline: deadline || null, order_index: order_index ?? lessons.length, created_at: new Date().toISOString() };
  lessons.push(l);
  res.status(201).json({ ...l, done: false, score: null });
});

app.put('/api/modules/:id/lessons/:lid', authMiddleware, instructorOnly, (req, res) => {
  const idx = lessons.findIndex(l => l.id === +req.params.lid);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  lessons[idx] = { ...lessons[idx], ...req.body };
  res.json(lessons[idx]);
});

app.delete('/api/modules/:id/lessons/:lid', authMiddleware, instructorOnly, (req, res) => {
  lessons = lessons.filter(l => l.id !== +req.params.lid);
  res.json({ success: true });
});

app.post('/api/modules/progress/:lessonId', authMiddleware, (req, res) => {
  const { score } = req.body;
  const lid = +req.params.lessonId;
  const idx = progress.findIndex(p => p.userId === req.user.id && p.lessonId === lid);
  if (idx >= 0) {
    progress[idx].completed = true;
    if (score != null) progress[idx].score = score;
  } else {
    progress.push({ userId: req.user.id, lessonId: lid, completed: true, score: score ?? null, completed_at: new Date().toISOString() });
  }
  res.json({ success: true });
});

// ---- File upload (mock — saves to disk) ----
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({ destination: (r, f, cb) => cb(null, uploadDir), filename: (r, f, cb) => cb(null, `${Date.now()}-${f.originalname}`) });
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/api/upload/:lessonId', authMiddleware, upload.array('files', 10), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No files' });
  const lesson = lessons.find(l => l.id === +req.params.lessonId);
  const module = lesson ? modules.find(m => m.id === lesson.module_id) : null;
  const subs = req.files.map(f => {
    const sub = { id: idSeq.submission++, lesson_id: +req.params.lessonId, student_id: req.user.id, student_name: req.user.name, avatar_color: req.user.avatar_color, file_name: f.originalname, file_path: f.filename, file_size: f.size, grade: null, feedback: null, submitted_at: new Date().toISOString(), lesson_title: lesson?.title || '', module_title: module?.title || '' };
    submissions.push(sub);
    return sub;
  });
  const lid = +req.params.lessonId;
  const idx = progress.findIndex(p => p.userId === req.user.id && p.lessonId === lid);
  if (idx >= 0) { progress[idx].completed = true; } else { progress.push({ userId: req.user.id, lessonId: lid, completed: true, score: null, completed_at: new Date().toISOString() }); }
  res.status(201).json({ success: true, submissions: subs });
});

app.get('/api/upload/:lessonId/submissions', authMiddleware, instructorOnly, (req, res) => {
  res.json(submissions.filter(s => s.lesson_id === +req.params.lessonId));
});

app.get('/api/upload/:lessonId/my-submissions', authMiddleware, (req, res) => {
  res.json(submissions.filter(s => s.lesson_id === +req.params.lessonId && s.student_id === req.user.id));
});

app.post('/api/upload/grade/:submissionId', authMiddleware, instructorOnly, (req, res) => {
  const { grade, feedback } = req.body;
  const idx = submissions.findIndex(s => s.id === +req.params.submissionId);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  submissions[idx] = { ...submissions[idx], grade, feedback: feedback || null, graded_at: new Date().toISOString() };
  // Update progress score
  const sub = submissions[idx];
  const pi = progress.findIndex(p => p.userId === sub.student_id && p.lessonId === sub.lesson_id);
  if (pi >= 0) progress[pi].score = grade;
  res.json(submissions[idx]);
});

app.use('/api/upload/file', express.static(uploadDir));

// ---- Students ----
app.get('/api/students', authMiddleware, instructorOnly, (req, res) => {
  const total = lessons.length;
  const studs = users.filter(u => u.role === 'student');
  res.json(studs.map(s => {
    const done = progress.filter(p => p.userId === s.id && p.completed).length;
    const scored = progress.filter(p => p.userId === s.id && p.score != null);
    const avg = scored.length ? Math.round(scored.reduce((a, p) => a + p.score, 0) / scored.length) : null;
    const { password_hash, ...safe } = s;
    return { ...safe, overall: total > 0 ? Math.round((done / total) * 100) : 0, avg_score: avg, completed_lessons: done, total_lessons: total };
  }));
});

app.get('/api/students/:id/progress', authMiddleware, instructorOnly, (req, res) => {
  const student = users.find(u => u.id === +req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found' });
  const { password_hash, ...safe } = student;
  const mods = modules.map(m => {
    const mLessons = lessons.filter(l => l.module_id === m.id).map(l => {
      const p = progress.find(p => p.userId === +req.params.id && p.lessonId === l.id);
      return { ...l, done: p?.completed || false, score: p?.score ?? null };
    });
    const done = mLessons.filter(l => l.done).length;
    return { ...m, lessons: mLessons, progress: mLessons.length > 0 ? Math.round((done / mLessons.length) * 100) : 0 };
  });
  res.json({ student: safe, modules: mods });
});

app.get('/api/students/submissions/all', authMiddleware, instructorOnly, (req, res) => {
  res.json([...submissions].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)));
});

// ---- Resources ----
const resUploadDir = path.join(__dirname, 'uploads/resources');
if (!fs.existsSync(resUploadDir)) fs.mkdirSync(resUploadDir, { recursive: true });
const resStorage = multer.diskStorage({ destination: (r, f, cb) => cb(null, resUploadDir), filename: (r, f, cb) => cb(null, `${Date.now()}-${f.originalname}`) });
const resUpload = multer({ storage: resStorage, limits: { fileSize: 100 * 1024 * 1024 } });

app.get('/api/resources', authMiddleware, (req, res) => {
  const { module_id } = req.query;
  let r = resources;
  if (module_id) r = r.filter(x => x.module_id === +module_id);
  res.json(r.map(x => ({ ...x, module_title: modules.find(m => m.id === x.module_id)?.title || null })));
});

app.post('/api/resources', authMiddleware, instructorOnly, resUpload.single('file'), (req, res) => {
  const { module_id, title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const r = { id: idSeq.resource++, module_id: module_id ? +module_id : null, title, type: 'file', file_path: req.file?.filename || null, file_name: req.file?.originalname || null, url: null, description: description || null, created_at: new Date().toISOString() };
  resources.push(r);
  res.status(201).json(r);
});

app.post('/api/resources/link', authMiddleware, instructorOnly, (req, res) => {
  const { module_id, title, url, description, type } = req.body;
  if (!title || !url) return res.status(400).json({ error: 'Title and URL required' });
  const r = { id: idSeq.resource++, module_id: module_id ? +module_id : null, title, type: type || 'link', url, file_path: null, file_name: null, description: description || null, created_at: new Date().toISOString() };
  resources.push(r);
  res.status(201).json(r);
});

app.delete('/api/resources/:id', authMiddleware, instructorOnly, (req, res) => {
  resources = resources.filter(r => r.id !== +req.params.id);
  res.json({ success: true });
});

app.use('/api/resources/file', express.static(resUploadDir));

// ---- Chat ----
app.get('/api/chat', authMiddleware, (req, res) => res.json(chatMessages.slice(-100)));
app.post('/api/chat', authMiddleware, (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
  const msg = { id: idSeq.chat++, user_id: req.user.id, message: message.trim(), author_name: req.user.name, avatar_color: req.user.avatar_color || '#2563eb', created_at: new Date().toISOString() };
  chatMessages.push(msg);
  res.status(201).json(msg);
});

// ---- Forum ----
app.get('/api/forum', authMiddleware, (req, res) => {
  res.json(forumPosts.map(p => ({ ...p, reply_count: 0 })).sort((a, b) => b.pinned - a.pinned || new Date(b.created_at) - new Date(a.created_at)));
});
app.post('/api/forum', authMiddleware, (req, res) => {
  const { title, body } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  const p = { id: idSeq.forum++, user_id: req.user.id, title: title.trim(), body: body?.trim() || null, pinned: false, author_name: req.user.name, avatar_color: req.user.avatar_color || '#2563eb', created_at: new Date().toISOString(), reply_count: 0 };
  forumPosts.push(p);
  res.status(201).json(p);
});
app.patch('/api/forum/:id/pin', authMiddleware, instructorOnly, (req, res) => {
  const p = forumPosts.find(p => p.id === +req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.pinned = !p.pinned;
  res.json(p);
});

// ---- Announcements ----
app.get('/api/announcements', authMiddleware, (req, res) => res.json([...announcements].reverse()));
app.post('/api/announcements', authMiddleware, instructorOnly, (req, res) => {
  const { title, body, type } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  const a = { id: idSeq.ann++, title: title.trim(), body: body?.trim() || null, type: type || 'info', created_by: req.user.id, created_at: new Date().toISOString() };
  announcements.push(a);
  res.status(201).json(a);
});
app.delete('/api/announcements/:id', authMiddleware, instructorOnly, (req, res) => {
  announcements = announcements.filter(a => a.id !== +req.params.id);
  res.json({ success: true });
});

// ---- Health ----
app.get('/api/health', (req, res) => res.json({ status: 'ok (mock)', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`\n🚀 LearnFlow MOCK server running at http://localhost:${PORT}`);
  console.log(`\nDemo accounts:`);
  console.log(`  Teacher: teacher@learnflow.demo / Teacher2024!`);
  console.log(`  Student: student@learnflow.demo / Student2024!\n`);
});
