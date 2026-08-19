const jwt = require('jsonwebtoken');
const { query } = require('./db');

function signUser(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(u) {
  return {
    id: String(u.id), fullName: u.full_name, email: u.email,
    position: u.position, role: u.role, status: u.status
  };
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const r = await query('SELECT * FROM users WHERE id=$1', [payload.sub]);
    if (!r.rowCount || r.rows[0].status !== 'Active') return res.status(401).json({ error: 'Account is not active.' });
    req.user = r.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Administrator') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}

module.exports = { signUser, publicUser, authenticate, requireAdmin };
