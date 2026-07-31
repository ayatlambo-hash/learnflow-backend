const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { auth } = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/mailer');

const router = express.Router();

const AVATAR_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0369a1', '#9333ea'];

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/register — creates a pending registration and emails a code
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });

    const normalizedEmail = email.toLowerCase().trim();
    const validRole = role === 'instructor' ? 'instructor' : 'student';
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.query('DELETE FROM email_verifications WHERE email = $1', [normalizedEmail]);
    await db.query(
      'INSERT INTO email_verifications (email, code, name, password_hash, role, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [normalizedEmail, code, name.trim(), hash, validRole, expiresAt]
    );

    await sendVerificationEmail(normalizedEmail, code);

    res.status(200).json({ message: 'Verification code sent', email: normalizedEmail });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/verify-email — verifies the code and creates the user
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Missing email or code' });
    const normalizedEmail = email.toLowerCase().trim();

    const result = await db.query(
      'SELECT * FROM email_verifications WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
      [normalizedEmail]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'No pending registration found. Please register again.' });

    const record = result.rows[0];
    if (record.code !== code.trim()) return res.status(400).json({ error: 'Invalid verification code' });
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const insertResult = await db.query(
      'INSERT INTO users (name, email, password_hash, role, avatar_color, email_verified) VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id, name, email, role, avatar_color, created_at',
      [record.name, normalizedEmail, record.password_hash, record.role, color]
    );

    await db.query('DELETE FROM email_verifications WHERE email = $1', [normalizedEmail]);

    const user = insertResult.rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/resend-code — resends a new verification code
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });
    const normalizedEmail = email.toLowerCase().trim();

    const existingPending = await db.query(
      'SELECT * FROM email_verifications WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
      [normalizedEmail]
    );
    if (existingPending.rows.length === 0) return res.status(400).json({ error: 'No pending registration found. Please register again.' });
    const pending = existingPending.rows[0];

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.query('DELETE FROM email_verifications WHERE email = $1', [normalizedEmail]);
    await db.query(
      'INSERT INTO email_verifications (email, code, name, password_hash, role, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [normalizedEmail, code, pending.name, pending.password_hash, pending.role, expiresAt]
    );

    await sendVerificationEmail(normalizedEmail, code);
    res.json({ message: 'Verification code resent' });
  } catch (err) {
    console.error('Resend code error:', err);
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
