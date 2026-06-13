const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// POST ROUTE - Para sa Time In at Time Out ng Staff
router.post('/log', async (req, res) => {
    try {
        const { staff_name, type } = req.body;

        if (!staff_name || !type) {
            return res.status(400).json({ success: false, error: 'Kailangan ang pangalan at uri ng attendance.' });
        }

        const db = await getDb();
        const sql = `INSERT INTO attendance (staff_name, type) VALUES (?, ?)`;
        
        await db.run(sql, [staff_name, type]);

        return res.json({ 
            success: true, 
            message: `Matagumpay na na-record ang ${type} para kay ${staff_name}!` 
        });
    } catch (error) {
        console.error("Attendance log error:", error);
        return res.status(500).json({ success: false, error: 'Internal server error sa attendance.' });
    }
});

// GET ROUTE - Para makita ang logs (Opsyonal para sa Admin)
router.get('/logs', async (req, res) => {
    try {
        const db = await getDb();
        const logs = await db.all('SELECT * FROM attendance ORDER BY timestamp DESC');
        return res.json(logs);
    } catch (error) {
        console.error("Error fetching attendance logs:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;