const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Get all pending users (Super Admin only)
router.get('/pending', authenticate, requireRole(['Super Admin']), async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT id, full_name, email, role, status, created_at FROM users WHERE status = 'Pending'");
    res.json(rows);
  } catch (err) {
    console.error('Error fetching pending users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve user (Super Admin only)
router.post('/approve/:id', authenticate, requireRole(['Super Admin']), async (req, res) => {
  try {
    const db = await getDb();
    const targetUserId = req.params.id;
    const { role } = req.body; // Allow Super Admin to optionally assign a specific role
    const assignedRole = role || 'User';

    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.status !== 'Pending') return res.status(400).json({ error: 'User is not pending approval' });

    // Prevent automatically making someone else Super Admin without explicit role assignment
    // But Super Admin is allowed to assign Super Admin if they explicitly choose to.
    
    await db.run(
      "UPDATE users SET status = 'Approved', role = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?",
      [assignedRole, req.user.id, targetUserId]
    );

    // Log the approval action
    await db.run(
      "INSERT INTO approval_logs (user_id, approved_by, action) VALUES (?, ?, ?)",
      [targetUserId, req.user.id, `Approved with role: ${assignedRole}`]
    );

    res.json({ message: 'User approved successfully', role: assignedRole });
  } catch (err) {
    console.error('Error approving user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject user (Super Admin only)
router.post('/reject/:id', authenticate, requireRole(['Super Admin']), async (req, res) => {
  try {
    const db = await getDb();
    const targetUserId = req.params.id;

    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.status !== 'Pending') return res.status(400).json({ error: 'User is not pending approval' });

    await db.run(
      "UPDATE users SET status = 'Rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?",
      [req.user.id, targetUserId]
    );

    // Log the rejection action
    await db.run(
      "INSERT INTO approval_logs (user_id, approved_by, action) VALUES (?, ?, ?)",
      [targetUserId, req.user.id, 'Rejected']
    );

    res.json({ message: 'User rejected successfully' });
  } catch (err) {
    console.error('Error rejecting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
