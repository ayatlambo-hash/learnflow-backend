const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

const AVATAR_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0369a1', '#9333ea'];

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });

    const validRole = role === 'instructor' ? 'instructor' : 'student';
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, role, avatar_color) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, avatar_color, created_at',
      [name.trim(), email.toLowerCase(), hash, validRole, color]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

    const result = await db.query(
      'SELECT id, name, email, role, avatar_color, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'No user found with this email' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });

    const { password_hash, ...safeUser } = user;
    const token = signToken(safeUser);
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, avatar_color, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
