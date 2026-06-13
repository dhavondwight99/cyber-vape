const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const BCRYPT_SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'cyber_vape_jwt_secret_2026';
const JWT_EXPIRES = '12h';

// ── 1. CUSTOMER REGISTRATION ROUTE (No OTP / Auto-Verify) ────────────────────
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password, confirm_password } = req.body;
    const db = await getDb();

    if (!full_name || !email || !password || !confirm_password) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    // Hash password gamit ang bcrypt bago i-save sa database
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Direktang ipapasok ang user bilang 'Active' at 'is_verified = 1'
    const result = await db.run(
      'INSERT INTO users (full_name, email, password, role, status, is_verified, otp_code, otp_expires_at) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)',
      [full_name, email.toLowerCase(), hashedPassword, 'customer', 'Active', 1]
    );

    res.status(201).json({
      message: 'Registration successful. You can now login immediately.',
      user_id: result.lastID,
      email: email.toLowerCase(),
      requires_verification: false
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 2. LOGIN ROUTE (Direct and Instant Validation) ───────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = await getDb();
    
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Paghambingin ang bcrypt password hashes
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Simple at direktang status validation. Dapat ay 'Active' ang account ng user o admin.
    if (user.status !== 'Active' && user.status !== 'Approved') {
      return res.status(403).json({ error: 'Your account is inactive or restricted. Please contact support.' });
    }

    // Pagbuo ng JSON Web Token (JWT) session payload
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;