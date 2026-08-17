const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  let token = null;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query.token) {
    // Fallback for plain browser requests (img/audio/anchor downloads) that can't set headers
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function instructorOnly(req, res, next) {
  if (req.user?.role !== 'instructor') {
    return res.status(403).json({ error: 'Instructor access required' });
  }
  next();
}

module.exports = { auth, instructorOnly };
