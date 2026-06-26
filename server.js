require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const modulesRoutes = require('./routes/modules');
const uploadRoutes = require('./routes/upload');
const studentsRoutes = require('./routes/students');
const resourcesRoutes = require('./routes/resources');
const chatRoutes = require('./routes/chat');
const forumRoutes = require('./routes/forum');
const announcementsRoutes = require('./routes/announcements');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/announcements', announcementsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`LearnFlow backend running on port ${PORT}`);
});
