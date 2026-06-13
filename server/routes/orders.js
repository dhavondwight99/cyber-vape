const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const crypto = require('crypto');
const QRCode = require('qrcode');

// Create checkout order (with Idempotency Key validation, write intent & ledger)
router.post('/', async (req, res) => {
  const db = await getDb();
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Missing Idempotency-Key header.' });
  }

  try {
    const cached = await db.get('SELECT * FROM idempotency_keys WHERE key = ?', idempotencyKey);
    if (cached) {
      console.log(`[Idempotency] Duplicate request detected for key: ${idempotencyKey}. Returning cached response.`);
      return res.status(cached.response_status).json(JSON.parse(cached.response_body));
    }
  } catch (err) {
    console.error('[Idempotency] Error checking cache:', err);
    return res.status(500).json({ error: 'Database error checking idempotency key.' });
  }

  const { full_name, contact_number, address, city, postal_code, payment_method, items, subtotal, shipping_fee, discount, total_amount } = req.body;

  if (!full_name || !contact_number || !address || !city || !postal_code || !payment_method) {
    return res.status(400).json({ error: 'Missing required delivery details.' });
  }

  const orderId = 'CV-' + Math.floor(10000 + Math.random() * 90000) + '-FOG';

  try {
    await db.exec('BEGIN IMMEDIATE TRANSACTION');

    // Validate and deduct inventory stock
    for (const item of (items || [])) {
      const product = await db.get('SELECT * FROM products WHERE name = ?', [item.name]);
      if (!product) {
        throw new Error(`Product "${item.name}" not found in inventory database.`);
      }
      if (product.stock < item.qty) {
        throw new Error(`Insufficient stock for "${item.name}". Only ${product.stock} units available.`);
      }

      const newStock = product.stock - item.qty;
      await db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, product.id]);

      // Log stock adjustment in inventory audit logs
      await db.run(
        `INSERT INTO inventory_logs (staff_name, item_name, sku, action_type, prev_qty, new_qty, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        'System Checkout', product.name, 'N/A', 'Customer Order Deduct', product.stock, newStock, 'Verified'
      );
    }

    // Generate Dynamic QR Code for non-COD payment methods
    let qr_url = null;
    let payment_status = payment_method === 'COD' ? 'COD' : 'PENDING';

    if (payment_method !== 'COD') {
      // Guide Note: To use a real Payment Gateway (e.g. PayMongo or Maya):
      // 1. Call the gateway API here with the total_amount to create a Payment Intent.
      // 2. The API will return an intent ID and a checkout/QR URL.
      // 3. Set qr_url = API_RESPONSE.qr_code_url
      // 4. E.g., const response = await axios.post('https://api.paymongo.com/v1/links', payload, { headers: { Authorization: `Basic ${Buffer.from('sk_test_YOUR_KEY:').toString('base64')}` } });
      
      // Temporary Mock Generation:
      const qrPayload = JSON.stringify({
        order_id: orderId,
        amount: total_amount,
        merchant: "CYBER-VAPE",
        gateway: payment_method
      });
      // Generate a data URI base64 string image of the QR Code (styled to match the cyberpunk aesthetic)
      qr_url = await QRCode.toDataURL(qrPayload, { color: { dark: "#00f0ff", light: "#121317" }, width: 300, margin: 2 });
    }

    await db.run(
      `INSERT INTO orders (id, full_name, contact_number, address, city, postal_code, payment_method, items, subtotal, shipping_fee, discount, total_amount, payment_status, qr_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      orderId, full_name, contact_number, address, city, postal_code, payment_method, JSON.stringify(items || []), subtotal || 0, shipping_fee || 0, discount || 0, total_amount || 0, payment_status, qr_url
    );

    await db.run(
      `INSERT INTO transaction_ledger (order_id, status, description) VALUES (?, 'CREATED', 'Order checkout initialized.')`,
      orderId
    );

    await db.run(
      `INSERT INTO transaction_ledger (order_id, status, description) VALUES (?, 'PENDING_PAYMENT', 'Awaiting customer payment via ' || ?)`,
      orderId, payment_method
    );

    const responseStatus = 201;
    const responseBody = { success: true, order_id: orderId, total_amount, status: 'PENDING_PAYMENT', message: 'Order created successfully. Awaiting payment capture.', qr_url };

    await db.run(
      `INSERT INTO idempotency_keys (key, response_status, response_body) VALUES (?, ?, ?)`,
      idempotencyKey, responseStatus, JSON.stringify(responseBody)
    );

    await db.exec('COMMIT');
    console.log(`[Order Checkout] Order ${orderId} created, ledger entries written, inventory deducted.`);
    return res.status(responseStatus).json(responseBody);

  } catch (transactionErr) {
    try { await db.exec('ROLLBACK'); } catch (rollbackErr) {}
    console.error('[Order Checkout] Transaction failed:', transactionErr);
    if (transactionErr.message.includes('not found') || transactionErr.message.includes('Insufficient stock')) {
      return res.status(400).json({ error: transactionErr.message });
    }
    return res.status(500).json({ error: 'Internal transaction error during checkout.' });
  }
});

// Get order details and its complete ledger status timeline
router.get('/:order_id', async (req, res) => {
  const db = await getDb();
  const { order_id } = req.params;
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', order_id);
    if (!order) return res.status(404).json({ error: `Order ${order_id} not found.` });

    const ledgerRows = await db.all('SELECT * FROM transaction_ledger WHERE order_id = ? ORDER BY id ASC', order_id);

    if (order.items) {
      try { order.items = JSON.parse(order.items); } catch (e) { order.items = []; }
    }
    return res.json({ order, ledger: ledgerRows });
  } catch (err) {
    console.error('[Order Status] Error retrieving order details:', err);
    return res.status(500).json({ error: 'Database error retrieving order details.' });
  }
});

// Webhook
router.post('/webhook', async (req, res) => {
  const db = await getDb();
  const webhookSecret = 'cyber_vape_webhook_secret_2026';
  const signature = req.headers['x-signature'];

  if (!signature) return res.status(401).json({ error: 'Missing x-signature header.' });

  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

  if (signature !== expectedSignature) return res.status(403).json({ error: 'Invalid HMAC signature.' });

  const { event_id, order_id, status, payment_reference, failure_reason } = req.body;
  if (!event_id || !order_id || !status) return res.status(400).json({ error: 'Missing required webhook fields.' });

  try {
    const alreadyProcessed = await db.get('SELECT * FROM processed_webhook_events WHERE event_id = ?', event_id);
    if (alreadyProcessed) return res.status(200).json({ success: true, message: 'Event already processed.' });
  } catch (err) {
    return res.status(500).json({ error: 'Database error checking event log.' });
  }

  try {
    await db.exec('BEGIN IMMEDIATE TRANSACTION');
    await db.run('INSERT INTO processed_webhook_events (event_id) VALUES (?)', event_id);
    const order = await db.get('SELECT * FROM orders WHERE id = ?', order_id);
    if (!order) {
      await db.exec('COMMIT');
      return res.status(404).json({ error: `Order ${order_id} not found.` });
    }

    const latestLedger = await db.get('SELECT * FROM transaction_ledger WHERE order_id = ? ORDER BY id DESC LIMIT 1', order_id);
    const currentStatus = latestLedger ? latestLedger.status : 'CREATED';

    // Define valid state transitions
    const allowed = {
      'CREATED': ['PENDING_PAYMENT', 'PAYMENT_SUCCESSFUL', 'PAYMENT_FAILED'],
      'PENDING_PAYMENT': ['PAYMENT_SUCCESSFUL', 'PAYMENT_FAILED'],
      'PAYMENT_SUCCESSFUL': ['IN_TRANSIT'],
      'IN_TRANSIT': ['DELIVERED', 'COMPLETED'],
      'DELIVERED': ['COMPLETED'],
      'COMPLETED': [],
      'PAYMENT_FAILED': []
    };

    if (currentStatus === status) {
      await db.exec('COMMIT');
      return res.json({ success: true, message: `Order is already in ${status} status.` });
    }

    const nextStates = allowed[currentStatus] || [];
    if (!nextStates.includes(status)) {
      await db.exec('COMMIT');
      return res.status(400).json({ error: `Invalid status transition from ${currentStatus} to ${status}.` });
    }

    let desc = '';
    if (status === 'PAYMENT_SUCCESSFUL') {
      desc = `Payment of ₱${order.total_amount.toFixed(2)} captured successfully via webhook. Reference: ${payment_reference || 'REF-GCASH'}`;
    } else if (status === 'PAYMENT_FAILED') {
      desc = `Payment attempt failed via webhook. Reason: ${failure_reason || 'Unknown error'}`;
    } else if (status === 'IN_TRANSIT') {
      desc = `Order is in transit. Courier Ryan Cooper has dispatched with your package.`;
    } else if (status === 'DELIVERED') {
      desc = `Order successfully delivered to your dropzone. Enjoy the fog!`;
    } else {
      desc = `Order status updated to ${status}.`;
    }

    await db.run(`INSERT INTO transaction_ledger (order_id, status, description) VALUES (?, ?, ?)`, order_id, status, desc);
    await db.exec('COMMIT');
    return res.json({ success: true, message: `Webhook processed. Order status is now ${status}.` });

  } catch (err) {
    try { await db.exec('ROLLBACK'); } catch (rollbackErr) {}
    return res.status(500).json({ error: 'Internal transaction error processing webhook.' });
  }
});

router.post('/simulate-webhook', async (req, res) => {
  const webhookSecret = 'cyber_vape_webhook_secret_2026';
  const { order_id, status, payment_reference, failure_reason } = req.body;

  if (!order_id || !status) return res.status(400).json({ error: 'Missing order_id or status for simulation.' });

  const eventId = 'evt_' + Math.random().toString(36).substring(2, 15);
  const payloadStr = JSON.stringify({
    event_id: eventId, order_id, status, payment_reference: payment_reference || 'REF-SIM', failure_reason: failure_reason || null, timestamp: new Date().toISOString()
  });

  const signature = crypto.createHmac('sha256', webhookSecret).update(payloadStr).digest('hex');

  try {
    // Determine the port or default to 8000
    const PORT = process.env.PORT || 8000;
    const response = await fetch(`http://localhost:${PORT}/api/orders/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-signature': signature },
      body: payloadStr
    });
    const data = await response.json();
    return res.status(response.status).json({ simulation: 'SUCCESS', webhook_response: data });
  } catch (err) {
    return res.status(500).json({ error: 'Simulation failed to call webhook endpoint.' });
  }
});

module.exports = router;
