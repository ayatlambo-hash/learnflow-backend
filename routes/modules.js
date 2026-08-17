const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { auth, instructorOnly } = require('../middleware/auth');

const router = express.Router();

const materialsDir = path.join(__dirname, '../uploads/lesson-materials');
if (!fs.existsSync(materialsDir)) fs.mkdirSync(materialsDir, { recursive: true });

const materialsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, materialsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const uploadMaterial = multer({
  storage: materialsStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

// GET /api/modules - list all modules with progress for student
router.get('/', auth, async (req, res) => {
  try {
    const mods = await db.query("SELECT * FROM modules WHERE section = 'modules' OR section IS NULL ORDER BY order_index ASC, id ASC");
    if (req.user.role === 'student') {
      const result = await Promise.all(mods.rows.map(async (m) => {
        const lessons = await db.query('SELECT id FROM lessons WHERE module_id = $1', [m.id]);
        const lessonIds = lessons.rows.map(l => l.id);
        let progress = 0;
        if (lessonIds.length > 0) {
          const done = await db.query(
            'SELECT COUNT(*) FROM lesson_progress WHERE user_id = $1 AND lesson_id = ANY($2) AND completed = TRUE',
            [req.user.id, lessonIds]
          );
          progress = Math.round((parseInt(done.rows[0].count) / lessonIds.length) * 100);
        }
        return { ...m, lesson_count: lessonIds.length, progress };
      }));
      return res.json(result);
    }
    // instructor gets full data
    const result = await Promise.all(mods.rows.map(async (m) => {
      const lessons = await db.query('SELECT COUNT(*) FROM lessons WHERE module_id = $1', [m.id]);
      return { ...m, lesson_count: parseInt(lessons.rows[0].count), progress: 0 };
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/modules/coursenav - course navigation tab (section='nav')
router.get('/coursenav', auth, async (req, res) => {
  try {
    const mods = await db.query("SELECT * FROM modules WHERE section = 'nav' ORDER BY order_index ASC, id ASC");
    res.json(mods.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/modules - create module (instructor only)
router.post('/', auth, instructorOnly, async (req, res) => {
  try {
    const { title, description, key_topics, color, icon, status } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const result = await db.query(
      'INSERT INTO modules (title, description, key_topics, color, icon, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [title, description || null, key_topics || null, color || '#2563eb', icon || '📖', status || 'published', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/modules/:id - update module
router.put('/:id', auth, instructorOnly, async (req, res) => {
  try {
    const { title, description, key_topics, color, icon, status } = req.body;
    const result = await db.query(
      'UPDATE modules SET title=$1, description=$2, key_topics=$3, color=$4, icon=$5, status=$6 WHERE id=$7 RETURNING *',
      [title, description, key_topics, color, icon, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/modules/:id/order - reorder module (instructor only)
router.patch('/:id/order', auth, instructorOnly, async (req, res) => {
  try {
    const { order_index } = req.body;
    const result = await db.query(
      'UPDATE modules SET order_index=$1 WHERE id=$2 RETURNING *',
      [order_index, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/modules/:id
router.delete('/:id', auth, instructorOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM modules WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/modules/:id/lessons
router.get('/:id/lessons', auth, async (req, res) => {
  try {
    const lessons = await db.query(
      'SELECT * FROM lessons WHERE module_id = $1 ORDER BY order_index ASC, id ASC',
      [req.params.id]
    );
    if (req.user.role === 'student') {
      const withProgress = await Promise.all(lessons.rows.map(async (l) => {
        const p = await db.query(
          'SELECT completed, score FROM lesson_progress WHERE user_id=$1 AND lesson_id=$2',
          [req.user.id, l.id]
        );
        const prog = p.rows[0];
        return { ...l, done: prog?.completed || false, score: prog?.score ?? null };
      }));
      return res.json(withProgress);
    }
    res.json(lessons.rows.map(l => ({ ...l, done: false, score: null })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/modules/:id/lessons - create lesson
router.post('/:id/lessons', auth, instructorOnly, async (req, res) => {
  try {
    const { title, type, video_url, form_url, content, duration, pages, deadline, instructions, order_index } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const result = await db.query(
      'INSERT INTO lessons (module_id, title, type, video_url, form_url, content, duration, pages, deadline, instructions, order_index) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
      [req.params.id, title, type || 'video', video_url || null, form_url || null, content || null, duration || null, pages || null, deadline || null, instructions || null, order_index ?? 0]
    );
    res.status(201).json({ ...result.rows[0], done: false, score: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/modules/:id/lessons/:lessonId - update lesson
router.put('/:id/lessons/:lessonId', auth, instructorOnly, async (req, res) => {
  try {
    const { title, type, video_url, form_url, content, duration, pages, deadline, instructions } = req.body;
    const result = await db.query(
      'UPDATE lessons SET title=$1, type=$2, video_url=$3, form_url=$4, content=$5, duration=$6, pages=$7, deadline=$8, instructions=$9 WHERE id=$10 AND module_id=$11 RETURNING *',
      [title, type, video_url, form_url, content, duration, pages, deadline, instructions || null, req.params.lessonId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/modules/:id/lessons/:lessonId/order - reorder lesson (instructor only)
router.patch('/:id/lessons/:lessonId/order', auth, instructorOnly, async (req, res) => {
  try {
    const { order_index } = req.body;
    const result = await db.query(
      'UPDATE lessons SET order_index=$1 WHERE id=$2 AND module_id=$3 RETURNING *',
      [order_index, req.params.lessonId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/modules/:id/lessons/:lessonId
router.delete('/:id/lessons/:lessonId', auth, instructorOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM lessons WHERE id=$1 AND module_id=$2', [req.params.lessonId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/modules/lessons/all - delete ALL lessons (instructor only, dangerous)
router.delete('/lessons/all', auth, instructorOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM lessons');
    res.json({ success: true, message: 'All lessons deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/modules/lessons/:lessonId - partial update (URL, duration, deadline)
router.patch('/lessons/:lessonId', auth, instructorOnly, async (req, res) => {
  try {
    const { video_url, duration, deadline, instructions } = req.body;
    const result = await db.query(
      `UPDATE lessons SET
        video_url = COALESCE($1, video_url),
        duration  = COALESCE($2, duration),
        deadline  = COALESCE($3, deadline),
        instructions = COALESCE($4, instructions)
       WHERE id = $5 RETURNING *`,
      [video_url || null, duration || null, deadline || null, instructions || null, req.params.lessonId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/modules/progress/:lessonId - mark lesson done
router.post('/progress/:lessonId', auth, async (req, res) => {
  try {
    const { score } = req.body;
    await db.query(
      `INSERT INTO lesson_progress (user_id, lesson_id, completed, score, completed_at)
       VALUES ($1, $2, TRUE, $3, NOW())
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed = TRUE, score = COALESCE($3, lesson_progress.score), completed_at = NOW()`,
      [req.user.id, req.params.lessonId, score ?? null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/modules/lessons/:lessonId/materials - instructor attaches file(s) to a lesson (PDF, MP3, etc)
router.post('/lessons/:lessonId/materials', auth, instructorOnly, uploadMaterial.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const inserted = [];
    for (const file of req.files) {
      const result = await db.query(
        'INSERT INTO lesson_files (lesson_id, file_name, file_path, mime_type, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [req.params.lessonId, file.originalname, file.filename, file.mimetype, req.user.id]
      );
      inserted.push(result.rows[0]);
    }
    res.status(201).json(inserted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/modules/lessons/:lessonId/materials - list attached files (any authenticated role)
router.get('/lessons/:lessonId/materials', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM lesson_files WHERE lesson_id=$1 ORDER BY created_at ASC', [req.params.lessonId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/modules/lessons/materials/:fileId - instructor removes an attached file
router.delete('/lessons/materials/:fileId', auth, instructorOnly, async (req, res) => {
  try {
    const r = await db.query('SELECT file_path FROM lesson_files WHERE id=$1', [req.params.fileId]);
    if (r.rows[0]?.file_path) {
      const fp = path.join(materialsDir, r.rows[0].file_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await db.query('DELETE FROM lesson_files WHERE id=$1', [req.params.fileId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/modules/lessons/materials/file/:filename - serve attached file (downloadable)
router.get('/lessons/materials/file/:filename', auth, (req, res) => {
  const filePath = path.join(materialsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

module.exports = router;
