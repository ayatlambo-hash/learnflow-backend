const express = require('express');
const db = require('../db');
const { auth, instructorOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/students - instructor views all students with overall progress
router.get('/', auth, instructorOnly, async (req, res) => {
  try {
    const students = await db.query(
      "SELECT id, name, email, avatar_color, created_at FROM users WHERE role = 'student' ORDER BY name ASC"
    );
    const totalLessons = await db.query('SELECT COUNT(*) FROM lessons');
    const total = parseInt(totalLessons.rows[0].count);

    const result = await Promise.all(students.rows.map(async (s) => {
      const done = await db.query(
        'SELECT COUNT(*) FROM lesson_progress WHERE user_id=$1 AND completed=TRUE',
        [s.id]
      );
      const scored = await db.query(
        'SELECT AVG(score) FROM lesson_progress WHERE user_id=$1 AND score IS NOT NULL',
        [s.id]
      );
      const doneCount = parseInt(done.rows[0].count);
      const overall = total > 0 ? Math.round((doneCount / total) * 100) : 0;
      const avgScore = scored.rows[0].avg ? Math.round(parseFloat(scored.rows[0].avg)) : null;
      return { ...s, overall, avg_score: avgScore, completed_lessons: doneCount, total_lessons: total };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/:id/progress - detailed progress for one student
router.get('/:id/progress', auth, instructorOnly, async (req, res) => {
  try {
    const student = await db.query(
      'SELECT id, name, email, avatar_color FROM users WHERE id=$1',
      [req.params.id]
    );
    if (student.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

    const modules = await db.query('SELECT * FROM modules ORDER BY order_index ASC, id ASC');
    const result = await Promise.all(modules.rows.map(async (m) => {
      const lessons = await db.query('SELECT * FROM lessons WHERE module_id=$1 ORDER BY order_index ASC', [m.id]);
      const lessonsWithProgress = await Promise.all(lessons.rows.map(async (l) => {
        const p = await db.query(
          'SELECT completed, score, completed_at FROM lesson_progress WHERE user_id=$1 AND lesson_id=$2',
          [req.params.id, l.id]
        );
        const prog = p.rows[0];
        return { ...l, done: prog?.completed || false, score: prog?.score ?? null, completed_at: prog?.completed_at };
      }));
      const done = lessonsWithProgress.filter(l => l.done).length;
      const progress = lessons.rows.length > 0 ? Math.round((done / lessons.rows.length) * 100) : 0;
      return { ...m, lessons: lessonsWithProgress, progress };
    }));

    res.json({ student: student.rows[0], modules: result });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/submissions - all pending submissions across all lessons
router.get('/submissions/all', auth, instructorOnly, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, u.name as student_name, u.avatar_color, l.title as lesson_title, m.title as module_title
       FROM submissions s
       JOIN users u ON u.id = s.student_id
       JOIN lessons l ON l.id = s.lesson_id
       JOIN modules m ON m.id = l.module_id
       ORDER BY s.submitted_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
