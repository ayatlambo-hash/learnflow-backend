const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { auth, instructorOnly } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads/resources');
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
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.zip', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// GET /api/resources - get all resources (optionally filtered by module)
router.get('/', auth, async (req, res) => {
  try {
    const { module_id } = req.query;
    let query = 'SELECT r.*, m.title as module_title FROM resources r LEFT JOIN modules m ON m.id = r.module_id';
    const params = [];
    if (module_id) {
      query += ' WHERE r.module_id = $1';
      params.push(module_id);
    }
    query += ' ORDER BY r.created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/resources - upload resource file (instructor only)
router.post('/', auth, instructorOnly, upload.single('file'), async (req, res) => {
  try {
    const { module_id, title, description, type } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    let file_path = null;
    let file_name = null;
    if (req.file) {
      file_path = req.file.filename;
      file_name = req.file.originalname;
    }

    const result = await db.query(
      'INSERT INTO resources (module_id, title, type, file_path, file_name, description, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [module_id || null, title, type || 'file', file_path, file_name, description || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/resources/link - add a URL link resource
router.post('/link', auth, instructorOnly, async (req, res) => {
  try {
    const { module_id, title, url, description, type } = req.body;
    if (!title || !url) return res.status(400).json({ error: 'Title and URL required' });
    const result = await db.query(
      'INSERT INTO resources (module_id, title, type, url, description, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [module_id || null, title, type || 'link', url, description || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/resources/:id
router.delete('/:id', auth, instructorOnly, async (req, res) => {
  try {
    const r = await db.query('SELECT file_path FROM resources WHERE id=$1', [req.params.id]);
    if (r.rows[0]?.file_path) {
      const fp = path.join(uploadDir, r.rows[0].file_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await db.query('DELETE FROM resources WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/resources/file/:filename - serve resource file
router.get('/file/:filename', auth, (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

module.exports = router;
