const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/chat - get recent messages
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cm.id, cm.message, cm.created_at, cm.user_id,
              u.name as author_name, u.avatar_color
       FROM chat_messages cm
       JOIN users u ON u.id = cm.user_id
       ORDER BY cm.created_at ASC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/chat - send message
router.post('/', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
    const result = await db.query(
      `INSERT INTO chat_messages (user_id, message) VALUES ($1, $2)
       RETURNING id, message, created_at, user_id`,
      [req.user.id, message.trim()]
    );
    const msg = result.rows[0];
    res.status(201).json({
      ...msg,
      author_name: req.user.name,
      avatar_color: req.user.avatar_color || '#2563eb',
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
