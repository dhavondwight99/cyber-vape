const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcrypt');

let dbInstance = null;

async function getDb() {
  if (dbInstance) return dbInstance;

  const DB_FILE = path.join(__dirname, '../data.db');
  dbInstance = await open({ filename: DB_FILE, driver: sqlite3.Database });
  dbInstance.configure('busyTimeout', 5000);

  try {
    await dbInstance.exec('PRAGMA journal_mode = WAL;');
    
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        full_name TEXT,
        contact_number TEXT,
        address TEXT,
        city TEXT,
        postal_code TEXT,
        payment_method TEXT,
        items TEXT,
        subtotal REAL,
        shipping_fee REAL,
        discount REAL,
        total_amount REAL,
        payment_status TEXT DEFAULT 'PENDING',
        qr_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS transaction_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT,
        status TEXT,
        description TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        response_status INTEGER,
        response_body TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS processed_webhook_events (
        event_id TEXT PRIMARY KEY,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        staff_name TEXT,
        item_name TEXT,
        sku TEXT,
        action_type TEXT,
        prev_qty INTEGER,
        new_qty INTEGER,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        staff_name TEXT,
        branch TEXT,
        clock_in TEXT,
        clock_out TEXT,
        total_hours REAL,
        status TEXT,
        notes TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS payroll_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period TEXT,
        staff_name TEXT,
        role TEXT,
        base_salary REAL,
        commission REAL,
        ot_bonus REAL,
        deductions REAL,
        pay_status TEXT,
        final_net REAL GENERATED ALWAYS AS (base_salary + commission + ot_bonus - deductions) VIRTUAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS shift_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start TEXT,
        staff_name TEXT,
        role TEXT,
        monday TEXT,
        tuesday TEXT,
        wednesday TEXT,
        thursday TEXT,
        friday TEXT,
        saturday TEXT,
        sunday TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_name TEXT UNIQUE
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        permission_name TEXT UNIQUE
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_name TEXT,
        permission_name TEXT,
        UNIQUE(role_name, permission_name),
        FOREIGN KEY(role_name) REFERENCES roles(role_name),
        FOREIGN KEY(permission_name) REFERENCES permissions(permission_name)
      );
    `);

    // INAYOS NA TABLE SCHEMA: Ang default status ng bagong rehistro ay 'Active' at 'is_verified' ay 1 na agad (No OTP/Approval required)
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'customer',
        status TEXT DEFAULT 'Active',
        is_verified INTEGER DEFAULT 1,
        otp_code TEXT,
        otp_expires_at DATETIME,
        approved_by INTEGER,
        approved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(approved_by) REFERENCES users(id)
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS approval_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        approved_by INTEGER,
        action TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(approved_by) REFERENCES users(id)
      );
    `);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        image_url TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_name TEXT NOT NULL,
            type TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    // Seed Roles 
    const roles = ['super_admin', 'staff', 'customer'];
    for (const role of roles) {
      await dbInstance.run('INSERT OR IGNORE INTO roles (role_name) VALUES (?)', role);
    }
    console.log('[Database] Ensured roles table seeded');

    // Seed Permissions
    const perms = [
      'manage_system',
      'manage_users',
      'approve_registrations',
      'view_logs',
      'manage_products',
      'process_orders',
      'monitor_stock',
      'view_dashboard'
    ];
    for (const p of perms) {
      await dbInstance.run('INSERT OR IGNORE INTO permissions (permission_name) VALUES (?)', p);
    }
    console.log('[Database] Ensured permissions table seeded');

    // Pinag-isang Mappings gamit ang maliliit na titik na roles
    const mapping = [
      ['super_admin', 'manage_system'],
      ['super_admin', 'manage_users'],
      ['super_admin', 'approve_registrations'],
      ['super_admin', 'view_logs'],
      ['super_admin', 'manage_products'],
      ['super_admin', 'process_orders'],
      ['super_admin', 'monitor_stock'],
      ['super_admin', 'view_dashboard'],

      ['staff', 'process_orders'],
      ['staff', 'monitor_stock'],
      ['staff', 'view_dashboard'],
      ['staff', 'manage_products'], // Pinayagan na rin ang staff mag-manage ng products kung kinakailangan

      ['customer', 'view_dashboard']
    ];

    for (const [role, permission] of mapping) {
      await dbInstance.run(
        'INSERT OR IGNORE INTO role_permissions (role_name, permission_name) VALUES (?, ?)',
        role,
        permission
      );
    }
    console.log('[Database] Seeded role_permissions table');

    // ===== FIXED ADMIN ACCOUNTS SEEDING CONFIGURATION =====
    const adminUsers = [
      { email: 'cyberstaff@gmail.com', password: 'cyberstaffadmin123', role: 'staff', full_name: 'Cyber Staff' },
      { email: 'cyberadmin@gmail.com', password: 'cyberadmin123', role: 'super_admin', full_name: 'Cyber Super Admin' }
    ];

    for (const admin of adminUsers) {
      const existing = await dbInstance.get('SELECT id, password FROM users WHERE email = ?', [admin.email.toLowerCase()]);

      if (!existing) {
        // Gagawa ng sariwang hash gamit ang tamang asynchronous configuration
        const hashedPassword = await bcrypt.hash(admin.password, 12);
        
        await dbInstance.run(
          'INSERT INTO users (full_name, email, password, role, status, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
          [admin.full_name, admin.email.toLowerCase(), hashedPassword, admin.role, 'Active', 1]
        );
        console.log(`[Database] Created admin user: ${admin.email} with role: ${admin.role}`);
      } else {
        // Force override kung ang lumang record sa db file mo ay hindi naka-hash o plain text pa rin
        const passwordIsPlainText = !existing.password.startsWith('$2');
        if (passwordIsPlainText) {
          const hashedPassword = await bcrypt.hash(admin.password, 12);
          await dbInstance.run(
            "UPDATE users SET password = ?, status = 'Active', is_verified = 1, role = ? WHERE email = ?",
            [hashedPassword, admin.role, admin.email.toLowerCase()]
          );
          console.log(`[Database] Overrode plain text admin password for: ${admin.email}`);
        } else {
          console.log(`[Database] Admin ${admin.email} already has bcrypt-hashed password`);
        }
      }
    }

    // Seed Products
    const productCount = await dbInstance.get('SELECT COUNT(*) as count FROM products');
    if (productCount.count === 0) {
      const products = [
        ['CyberPulse 5000', 'Vapes', 24.99, 'https://placehold.co/100x100/1e1e24/00f0ff?text=CyberPulse', 150],
        ['NeonCloud X', 'Vapes', 29.99, 'https://placehold.co/100x100/1e1e24/bc13fe?text=NeonCloud', 80],
        ['Quantum Coil', 'Accessories', 12.50, 'https://placehold.co/100x100/1e1e24/c3f400?text=Coil', 300],
        ['Synthwave Juice (Mango)', 'E-Liquid', 18.00, 'https://placehold.co/100x100/1e1e24/00dbe9?text=Juice', 120]
      ];
      for (const p of products) {
        await dbInstance.run(
          "INSERT INTO products (name, category, price, image_url, stock) VALUES (?, ?, ?, ?, ?)",
          p
        );
      }
      console.log('[Database] Seeded products table');
    }

  } catch (err) {
    console.error('Database initialization error:', err);
  }

  return dbInstance;
}

module.exports = { getDb };