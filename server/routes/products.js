const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getDb } = require('../db');

// 🚨 FIX NOTE: Kung sakaling ibabalik mo ang auth sa hinaharap, i-uncomment lang ang linya sa ibaba:
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// 1. I-SETUP ANG MULTER (Para sa File Explorer Uploads)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Isasave ang mga larawan direkta sa iyong assets folder
    cb(null, path.join(__dirname, '../../assets'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Mga larawan lamang ang pwedeng i-upload!'), false);
    }
  }
});

// 2. GET ROUTE - Para i-display ang mga produkto sa Store Front / Feed
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const category = req.query.category;
    let query = 'SELECT * FROM products';
    const params = [];

    if (category && category !== 'All') {
      query += ' WHERE category = ?';
      params.push(category);
    }

    const rows = await db.all(query, params);

    // Kuhanin ang mga natatanging kategorya para sa sidebar filter
    const catRows = await db.all('SELECT DISTINCT category FROM products ORDER BY category ASC');
    const categories = catRows.map(r => r.category);

    return res.json({ rows, categories });
  } catch (err) {
    console.error('Products GET error:', err);
    return res.status(500).json({ error: 'Internal server error', rows: [], categories: [] });
  }
});

// 3. POST ROUTE - Para sa pag-add ng bagong produkto (Walang middleware para sa madaling testing)
router.post('/', upload.single('product_image'), async (req, res) => {
  try {
    const { name, category, price, stock } = req.body;

    // Siguraduhing may file na dumating galing sa form
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Kailangan mag-upload ng larawan.' });
    }

    // Kunin ang naging file path mula sa multer configuration
    const imageUrl = `/assets/${req.file.filename}`;

    // Kunin ang database instance
    const db = await getDb();

    // I-insert ang bagong data sa 'products' table
    const sql = `
      INSERT INTO products (name, category, price, stock, image_url) 
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await db.run(sql, [
      name,
      category,
      parseFloat(price) || 0,
      parseInt(stock) || 0,
      imageUrl
    ]);

    // Magpadala ng tagumpay na response sa iyong Frontend Form
    return res.status(201).json({
      success: true,
      message: 'Product successfully added to cyberpunk core!',
      id: result.lastID
    });

  } catch (error) {
    console.error("POST /api/products error:", error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 4. DELETE ROUTE - Inalisan din ng middleware para tugma sa POST testing mo ngayon!
router.delete('/:id', async (req, res) => {
    try {
        const db = await getDb();
        const productId = req.params.id;

        // 1. Suriin muna kung umiiral ang produkto
        const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product) {
            return res.status(404).json({ success: false, error: 'Hindi nahanap ang produkto.' });
        }

        // 2. I-execute ang pagbura sa database
        await db.run('DELETE FROM products WHERE id = ?', [productId]);

        return res.json({ success: true, message: 'Produkto ay matagumpay na nabura.' });
    } catch (error) {
        console.error('Database delete error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error habang nagbubura.' });
    }
});

module.exports = router;