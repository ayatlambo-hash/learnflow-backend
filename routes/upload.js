const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { auth, instructorOnly } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB — any file type
});

// POST /api/upload/:lessonId - student submits assignment
router.post('/:lessonId', auth, upload.array('files', 10), async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const inserted = [];
    for (const file of req.files) {
      const result = await db.query(
        'INSERT INTO submissions (lesson_id, student_id, file_name, file_path, file_size, mime_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [lessonId, req.user.id, file.originalname, file.filename, file.size, file.mimetype]
      );
      inserted.push(result.rows[0]);
    }
    // Mark lesson as submitted (completed without score yet)
    await db.query(
      `INSERT INTO lesson_progress (user_id, lesson_id, completed, completed_at)
       VALUES ($1, $2, TRUE, NOW())
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed = TRUE, completed_at = NOW()`,
      [req.user.id, lessonId]
    );
    res.status(201).json({ success: true, submissions: inserted });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/upload/submissions/:lessonId - unified: instructor sees all, student sees own
router.get('/submissions/:lessonId', auth, async (req, res) => {
  try {
    if (req.user.role === 'instructor') {
      const result = await db.query(
        `SELECT s.*, u.name as student_name, u.email as student_email, u.avatar_color
         FROM submissions s JOIN users u ON u.id = s.student_id
         WHERE s.lesson_id = $1 ORDER BY s.submitted_at DESC`,
        [req.params.lessonId]
      );
      return res.json(result.rows);
    } else {
      const result = await db.query(
        'SELECT * FROM submissions WHERE lesson_id=$1 AND student_id=$2 ORDER BY submitted_at DESC',
        [req.params.lessonId, req.user.id]
      );
      return res.json(result.rows);
    }
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/upload/:lessonId/submissions - instructor views all submissions for a lesson
router.get('/:lessonId/submissions', auth, instructorOnly, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, u.name as student_name, u.email as student_email, u.avatar_color
       FROM submissions s
       JOIN users u ON u.id = s.student_id
       WHERE s.lesson_id = $1
       ORDER BY s.submitted_at DESC`,
      [req.params.lessonId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/upload/:lessonId/my-submissions - student views their own submissions
router.get('/:lessonId/my-submissions', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM submissions WHERE lesson_id=$1 AND student_id=$2 ORDER BY submitted_at DESC',
      [req.params.lessonId, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/upload/grade/:submissionId - instructor grades a submission
router.post('/grade/:submissionId', auth, instructorOnly, async (req, res) => {
  try {
    const { grade, feedback } = req.body;
    const result = await db.query(
      'UPDATE submissions SET grade=$1, feedback=$2, graded_by=$3, graded_at=NOW() WHERE id=$4 RETURNING *',
      [grade, feedback || null, req.user.id, req.params.submissionId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const sub = result.rows[0];
    // Update lesson progress score
    if (grade != null) {
      await db.query(
        `INSERT INTO lesson_progress (user_id, lesson_id, completed, score, completed_at)
         VALUES ($1, $2, TRUE, $3, NOW())
         ON CONFLICT (user_id, lesson_id) DO UPDATE SET score = $3`,
        [sub.student_id, sub.lesson_id, grade]
      );
    }
    res.json(sub);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/upload/file/:filename - serve uploaded file
router.get('/file/:filename', auth, (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

module.exports = router;
