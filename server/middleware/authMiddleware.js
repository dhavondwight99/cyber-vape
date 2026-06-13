const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'cyber_vape_jwt_secret_2026';

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [payload.id]);

    if (!user || user.status !== 'Approved') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = normalizeRole(req.user.role);
    const normalizedAllowed = allowedRoles.map(normalizeRole);

    if (normalizedAllowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ error: 'Forbidden: Insufficient role privileges' });
  };
}

module.exports = { authenticate, requireRole };
