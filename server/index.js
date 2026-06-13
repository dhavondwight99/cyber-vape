const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db'); // I-require ang database initialization handler

const authRoutes     = require('./routes/auth');
const orderRoutes    = require('./routes/orders');
const adminRoutes    = require('./routes/admin');
const productRoutes  = require('./routes/products');
const userRoutes     = require('./routes/users');
// INALIS: paymentsRoutes dahil wala itong katapat na file sa iyong server/routes folder

const app  = express();
const PORT = process.env.PORT || 8000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

//attendance
app.use('/api/attendance', require('./routes/attendance'));

// Serve client-facing storefront source files first so /store/ uses the latest source versions.
app.use('/store', express.static(path.join(__dirname, '../store')));

// Serve the built frontend from /dist (primary)
app.use(express.static(path.join(__dirname, '../dist')));

// Serve admin panel pages and shared assets (not in dist/)
app.use('/admin',  express.static(path.join(__dirname, '../admin')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users',    userRoutes);

// Convenience aliases so login/register work at both /api/auth/* and /api/*
app.use('/api/login',    (req, res, next) => { req.url = '/login';    authRoutes(req, res, next); });
app.use('/api/register', (req, res, next) => { req.url = '/register'; authRoutes(req, res, next); });

// Dashboard summary alias (used by shared.js health-check)
app.get('/api/dashboard/summary', (req, res, next) => {
  req.url = '/dashboard/summary';
  adminRoutes(req, res, next);
});

// ── Public storefront root ────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../store/homepage.html'));
});

// ── SPA catch-all — serve index.html for any unmatched GET ───────────────────
app.get('*', (req, res) => {
  // Naglagay tayo ng mabilisang fallback check para kung wala pang /dist/index.html, 
  // hindi magka-error ang browser at itatapon ka muna nito sa storefront homepage.
  const spaPath = path.join(__dirname, '../dist/index.html');
  const fs = require('fs');
  if (fs.existsSync(spaPath)) {
    res.sendFile(spaPath);
  } else {
    res.sendFile(path.join(__dirname, '../store/homepage.html'));
  }
});

// ── Safe Database Connection & Server Boot ────────────────────────────────────
async function startServer() {
  try {
    console.log('[CYBER-VAPE] Connecting to SQLite database...');
    // Siguraduhing gawa at seeded ang database bago buksan ang network port
    await getDb(); 
    
    app.listen(PORT, () => {
      console.log(`\n🚀 ===================================================`);
      console.log(`[CYBER-VAPE] Server running at http://localhost:${PORT}`);
      console.log(`[CYBER-VAPE] Storefront available at http://localhost:${PORT}/store/shop.html`);
      console.log(`[CYBER-VAPE] Administrative Core successfully bound.`);
      console.log(`=======================================================\n`);
    });
  } catch (error) {
    console.error('[CYBER-VAPE] Failed to initialize database on startup:', error);
    process.exit(1); // Patayin ang node process kapag may fatal error sa DB connection
  }
}

// Patakbuhin ang startup handler
startServer();

