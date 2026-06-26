const express = require('express');
const db = require('../db');
const { auth, instructorOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/forum - list posts
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT fp.id, fp.title, fp.body, fp.pinned, fp.created_at, fp.user_id,
              u.name as author_name, u.avatar_color,
              (SELECT COUNT(*) FROM forum_replies WHERE post_id = fp.id) as reply_count
       FROM forum_posts fp
       JOIN users u ON u.id = fp.user_id
       ORDER BY fp.pinned DESC, fp.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/forum - create post
router.post('/', auth, async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    const result = await db.query(
      `INSERT INTO forum_posts (user_id, title, body) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, title.trim(), body?.trim() || null]
    );
    const post = result.rows[0];
    res.status(201).json({
      ...post,
      author_name: req.user.name,
      avatar_color: req.user.avatar_color || '#2563eb',
      reply_count: 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/forum/:id/replies
router.get('/:id/replies', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT fr.*, u.name as author_name, u.avatar_color
       FROM forum_replies fr
       JOIN users u ON u.id = fr.user_id
       WHERE fr.post_id = $1
       ORDER BY fr.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/forum/:id/replies
router.post('/:id/replies', auth, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Reply required' });
    const result = await db.query(
      'INSERT INTO forum_replies (post_id, user_id, body) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, req.user.id, body.trim()]
    );
    res.status(201).json({
      ...result.rows[0],
      author_name: req.user.name,
      avatar_color: req.user.avatar_color || '#2563eb',
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/forum/:id/pin - instructor pins post
router.patch('/:id/pin', auth, instructorOnly, async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE forum_posts SET pinned = NOT pinned WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
