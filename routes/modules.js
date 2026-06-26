const express = require('express');
const db = require('../db');
const { auth, instructorOnly } = require('../middleware/auth');

const router = express.Router();

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
    const { title, description, color, icon, status } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const result = await db.query(
      'INSERT INTO modules (title, description, color, icon, status, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [title, description || null, color || '#2563eb', icon || '📖', status || 'published', req.user.id]
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
    const { title, description, color, icon, status } = req.body;
    const result = await db.query(
      'UPDATE modules SET title=$1, description=$2, color=$3, icon=$4, status=$5 WHERE id=$6 RETURNING *',
      [title, description, color, icon, status, req.params.id]
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
    const { title, type, video_url, form_url, content, duration, pages, deadline, order_index } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const result = await db.query(
      'INSERT INTO lessons (module_id, title, type, video_url, form_url, content, duration, pages, deadline, order_index) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [req.params.id, title, type || 'video', video_url || null, form_url || null, content || null, duration || null, pages || null, deadline || null, order_index ?? 0]
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
    const { title, type, video_url, form_url, content, duration, pages, deadline } = req.body;
    const result = await db.query(
      'UPDATE lessons SET title=$1, type=$2, video_url=$3, form_url=$4, content=$5, duration=$6, pages=$7, deadline=$8 WHERE id=$9 AND module_id=$10 RETURNING *',
      [title, type, video_url, form_url, content, duration, pages, deadline, req.params.lessonId, req.params.id]
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

// PATCH /api/modules/lessons/:lessonId - partial update (URL, duration, deadline)
router.patch('/lessons/:lessonId', auth, instructorOnly, async (req, res) => {
  try {
    const { video_url, duration, deadline } = req.body;
    const result = await db.query(
      `UPDATE lessons SET
        video_url = COALESCE($1, video_url),
        duration  = COALESCE($2, duration),
        deadline  = COALESCE($3, deadline)
       WHERE id = $4 RETURNING *`,
      [video_url || null, duration || null, deadline || null, req.params.lessonId]
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

module.exports = router;
