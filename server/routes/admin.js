const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// In-memory cache logic (simplified for the refactor)
let cache = new Map();
function getCache(key) { return cache.has(key) ? cache.get(key) : null; }
function setCache(key, value, ttlSec = 60) {
  cache.set(key, value);
  setTimeout(() => cache.delete(key), ttlSec * 1000);
}

router.get('/inventory', authenticate, requireRole(['Super Admin', 'Admin', 'Staff']), async (req, res) => {
  const db = await getDb();
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;
  const q = req.query.q;
  const params = [];
  let where = '';
  if (status && status !== 'all') { where += (where ? ' AND ' : '') + 'status = ?'; params.push(status); }
  if (q) {
    where += (where ? ' AND ' : '') + '(item_name LIKE ? OR sku LIKE ? OR staff_name LIKE ?)';
    const like = `%${q}%`; params.push(like, like, like);
  }
  const clause = where ? `WHERE ${where}` : '';
  const rows = await db.all(`SELECT * FROM inventory_logs ${clause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
  const totalRow = await db.get(`SELECT COUNT(*) as cnt FROM inventory_logs ${clause}`, ...params);
  const total = totalRow.cnt;
  const discrepancies = await db.get(`SELECT COUNT(*) as cnt FROM inventory_logs WHERE status='Pending'`).then(r => r.cnt);
  const audited24h = await db.get(`SELECT COUNT(*) as cnt FROM inventory_logs WHERE timestamp >= datetime('now','-1 day','localtime')`).then(r => r.cnt);
  const valueAdj = await db.get(`SELECT SUM(new_qty - prev_qty) as sum FROM inventory_logs WHERE action_type LIKE '%Damaged%'`).then(r => r.sum || 0);
  res.json({ rows, total, stats: { discrepancies, audited_24h: audited24h, value_adjustment: valueAdj } });
});

router.post('/inventory', authenticate, requireRole(['Super Admin', 'Admin', 'Staff']), async (req, res) => {
  const db = await getDb();
  const { staff_name, sku, item_name, action_type, prev_qty, new_qty, status } = req.body;
  const result = await db.run(
    `INSERT INTO inventory_logs (staff_name, item_name, sku, action_type, prev_qty, new_qty, status) VALUES (?,?,?,?,?,?,?)`,
    staff_name, item_name, sku, action_type, prev_qty, new_qty, status || 'Pending'
  );
  const row = await db.get('SELECT * FROM inventory_logs WHERE id = ?', result.lastID);
  cache.delete('inventory_all');
  res.status(201).json(row);
});

router.put('/inventory/:id', authenticate, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const db = await getDb();
  const { id } = req.params;
  const data = req.body;
  await db.run(
    `UPDATE inventory_logs SET staff_name=?, item_name=?, sku=?, action_type=?, prev_qty=?, new_qty=?, status=? WHERE id=?`,
    data.staff_name, data.item_name, data.sku, data.action_type, data.prev_qty, data.new_qty, data.status, id
  );
  const row = await db.get('SELECT * FROM inventory_logs WHERE id = ?', id);
  cache.delete('inventory_all');
  res.json(row);
});

router.get('/attendance', authenticate, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const db = await getDb();
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const rows = await db.all('SELECT * FROM attendance_logs WHERE date = ? ORDER BY clock_in', date);
  const onDuty = await db.get("SELECT COUNT(*) as cnt FROM attendance_logs WHERE date=? AND status IN ('Active','On Break')", date).then(r => r.cnt);
  const total = await db.get('SELECT COUNT(*) as cnt FROM attendance_logs WHERE date=?', date).then(r => r.cnt);
  const late = await db.get("SELECT COUNT(*) as cnt FROM attendance_logs WHERE date=? AND status='Late'", date).then(r => r.cnt);
  const manHours = await db.get('SELECT SUM(total_hours) as sum FROM attendance_logs WHERE date=?', date).then(r => r.sum || 0);
  res.json({ rows, date, stats: { on_duty: onDuty, total_staff: total, late, total_man_hours: Math.round(manHours * 10) / 10 } });
});

router.post('/attendance', authenticate, requireRole(['Super Admin', 'Admin', 'Staff']), async (req, res) => {
  const db = await getDb();
  const today = new Date().toISOString().split('T')[0];
  const { staff_name, branch, clock_in, clock_out, total_hours, status, notes } = req.body;
  const result = await db.run(
    `INSERT INTO attendance_logs (date, staff_name, branch, clock_in, clock_out, total_hours, status, notes) VALUES (?,?,?,?,?,?,?,?)`,
    today, staff_name, branch || 'Main Branch', clock_in, clock_out, total_hours || 0, status || 'Active', notes || ''
  );
  const row = await db.get('SELECT * FROM attendance_logs WHERE id = ?', result.lastID);
  cache.delete('attendance_all');
  res.status(201).json(row);
});

router.get('/payroll', authenticate, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const db = await getDb();
  const period = req.query.period;
  const where = period ? 'WHERE period = ?' : '';
  const args = period ? [period] : [];
  const rows = await db.all(`SELECT * FROM payroll_records ${where} ORDER BY staff_name`, ...args);
  const totals = await db.get(`SELECT SUM(final_net) as net, SUM(commission) as comm, SUM(deductions) as deduct FROM payroll_records ${where}`, ...args);
  const periods = await db.all('SELECT DISTINCT period FROM payroll_records ORDER BY period DESC');
  res.json({ rows, stats: { total_net: Math.round((totals?.net || 0) * 100) / 100, total_commission: Math.round((totals?.comm || 0) * 100) / 100, total_deductions: Math.round((totals?.deduct || 0) * 100) / 100 }, periods: periods.map(r => r.period) });
});

router.post('/payroll', authenticate, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const db = await getDb();
  const { period, staff_name, role, base_salary, commission, ot_bonus, deductions, pay_status } = req.body;
  const result = await db.run(
    `INSERT INTO payroll_records (period, staff_name, role, base_salary, commission, ot_bonus, deductions, pay_status) VALUES (?,?,?,?,?,?,?,?)`,
    period, staff_name, role || 'Staff', base_salary || 0, commission || 0, ot_bonus || 0, deductions || 0, pay_status || 'Pending'
  );
  const row = await db.get('SELECT * FROM payroll_records WHERE id = ?', result.lastID);
  cache.delete('payroll_all');
  res.status(201).json(row);
});

router.get('/shifts', authenticate, requireRole(['Super Admin', 'Admin', 'Staff']), async (req, res) => {
  const db = await getDb();
  const week = req.query.week;
  const where = week ? 'WHERE week_start = ?' : '';
  const args = week ? [week] : [];
  const rows = await db.all(`SELECT * FROM shift_schedules ${where} ORDER BY staff_name`, ...args);
  const weeks = await db.all('SELECT DISTINCT week_start FROM shift_schedules ORDER BY week_start DESC');
  res.json({ rows, weeks: weeks.map(r => r.week_start) });
});

router.post('/shifts', authenticate, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const db = await getDb();
  const { week_start, staff_name, role, monday, tuesday, wednesday, thursday, friday, saturday, sunday } = req.body;
  const result = await db.run(
    `INSERT INTO shift_schedules (week_start, staff_name, role, monday, tuesday, wednesday, thursday, friday, saturday, sunday) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    week_start, staff_name, role || 'Staff', monday || 'OFF', tuesday || 'OFF', wednesday || 'OFF', thursday || 'OFF', friday || 'OFF', saturday || 'OFF', sunday || 'OFF'
  );
  const row = await db.get('SELECT * FROM shift_schedules WHERE id = ?', result.lastID);
  cache.delete('shifts_all');
  res.status(201).json(row);
});

router.delete('/:resource/:id', authenticate, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const db = await getDb();
  const { resource, id } = req.params;
  const tableMap = { inventory: 'inventory_logs', attendance: 'attendance_logs', payroll: 'payroll_records', shifts: 'shift_schedules' };
  const table = tableMap[resource];
  if (!table) return res.status(404).json({ error: 'Not found' });
  await db.run(`DELETE FROM ${table} WHERE id=?`, id);
  cache.delete(`${resource}_all`);
  res.json({ deleted: true, id });
});

router.get('/dashboard/summary', authenticate, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const db = await getDb();
  const cached = getCache('dashboard');
  if (cached) return res.json(cached);
  const today = new Date().toISOString().split('T')[0];
  
  const revResult = await db.get("SELECT SUM(total_amount) as total FROM orders WHERE created_at >= date('now')");
  const actStaff = await db.get("SELECT COUNT(*) as cnt FROM attendance_logs WHERE date=? AND status IN ('Active','On Break')", today);
  const pendingOrd = await db.get("SELECT COUNT(*) as cnt FROM transaction_ledger WHERE status='PENDING_PAYMENT' AND timestamp >= date('now')");
  
  const data = {
    today_revenue: revResult?.total || 0,
    active_staff: actStaff?.cnt || 0,
    pending_orders: pendingOrd?.cnt || 0
  };
  setCache('dashboard', data, 30);
  res.json(data);
});

module.exports = router;
