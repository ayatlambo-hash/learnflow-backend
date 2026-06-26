const express = require('express');
const db = require('../db');
const { auth, instructorOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/announcements
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, u.name as author_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
       ORDER BY a.created_at DESC
       LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/announcements - instructor creates announcement
router.post('/', auth, instructorOnly, async (req, res) => {
  try {
    const { title, body, type } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    const result = await db.query(
      'INSERT INTO announcements (title, body, type, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
      [title.trim(), body?.trim() || null, type || 'info', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/announcements/:id
router.delete('/:id', auth, instructorOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM announcements WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
