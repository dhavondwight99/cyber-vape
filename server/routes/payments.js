const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY || 'sk_test_YOUR_PAYMONGO_SANDBOX_KEY';
const PAYMONGO_API_BASE = 'https://api.paymongo.com/v1';

function mapPaymentMethod(method) {
  const normalized = String(method || '').trim().toUpperCase();
  if (normalized === 'GCASH') return 'gcash';
  if (normalized === 'MAYA') return 'maya';
  if (normalized === 'BANK_TRANSFER' || normalized === 'BANK' || normalized === 'BDO' || normalized === 'BPI') return 'bank_transfer';
  return null;
}

function createOrderId() {
  return `CV-${Math.floor(10000 + Math.random() * 90000)}-NEON`;
}

router.post('/checkout', async (req, res) => {
  const db = await getDb();
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Missing Idempotency-Key header.' });
  }

  const {
    full_name,
    contact_number,
    address,
    city,
    postal_code,
    payment_method,
    items,
    subtotal,
    shipping_fee,
    discount,
    total_amount
  } = req.body;

  if (!full_name || !contact_number || !address || !city || !postal_code || !payment_method) {
    return res.status(400).json({ error: 'Missing required checkout fields.' });
  }

  try {
    const cached = await db.get('SELECT * FROM idempotency_keys WHERE key = ?', idempotencyKey);
    if (cached) {
      return res.status(cached.response_status).json(JSON.parse(cached.response_body));
    }
  } catch (err) {
    console.error('[Payments] Error checking idempotency key:', err);
    return res.status(500).json({ error: 'Database error checking idempotency key.' });
  }

  const orderId = createOrderId();
  const paymentType = mapPaymentMethod(payment_method);
  const paymentStatus = payment_method === 'COD' ? 'COD' : 'PENDING_PAYMENT';

  if (payment_method !== 'COD' && !paymentType) {
    return res.status(400).json({ error: 'Unsupported payment method for PayMongo checkout.' });
  }

  let checkoutUrl = null;
  let qrUrl = null;

  try {
    if (paymentType) {
      const amountCents = Math.round(Number(total_amount || 0) * 100);
      const payload = {
        data: {
          type: 'sources',
          attributes: {
            amount: amountCents,
            currency: 'PHP',
            redirect: {
              success: `${req.protocol}://${req.get('host')}/store/order-tracking.html?order_id=${orderId}`,
              failed: `${req.protocol}://${req.get('host')}/store/checkout.html`
            },
            type: paymentType,
            billing: {
              name: full_name,
              phone: contact_number,
              email: req.body.email || 'customer@cyber-vape.local'
            },
            metadata: {
              order_id: orderId
            }
          }
        }
      };

      const response = await fetch(`${PAYMONGO_API_BASE}/sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[PayMongo] Source create failed:', errBody);
        throw new Error('Failed to initialize payment source with PayMongo.');
      }

      const result = await response.json();
      const sourceAttributes = result.data?.attributes;
      checkoutUrl = sourceAttributes?.redirect?.checkout_url || null;
      qrUrl = sourceAttributes?.display?.qr_code || null;
    }

    await db.exec('BEGIN IMMEDIATE TRANSACTION');

    await db.run(
      `INSERT INTO orders (id, full_name, contact_number, address, city, postal_code, payment_method, items, subtotal, shipping_fee, discount, total_amount, payment_status, qr_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      orderId,
      full_name,
      contact_number,
      address,
      city,
      postal_code,
      payment_method,
      JSON.stringify(items || []),
      subtotal || 0,
      shipping_fee || 0,
      discount || 0,
      total_amount || 0,
      paymentStatus,
      qrUrl || checkoutUrl
    );

    await db.run(
      `INSERT INTO transaction_ledger (order_id, status, description) VALUES (?, 'CREATED', ?)`,
      orderId,
      `Checkout created with ${payment_method} via PayMongo integration.`
    );

    if (payment_method !== 'COD') {
      await db.run(`INSERT INTO transaction_ledger (order_id, status, description) VALUES (?, 'PENDING_PAYMENT', ?)`,
        orderId, `Awaiting payment completion using ${payment_method}.`);
    }

    const responsePayload = {
      success: true,
      order_id: orderId,
      total_amount,
      payment_method,
      status: paymentStatus,
      checkout_url: checkoutUrl,
      qr_url: qrUrl,
      message: payment_method === 'COD' ? 'Cash on delivery order created.' : 'Payment checkout created successfully.'
    };

    await db.run(
      `INSERT INTO idempotency_keys (key, response_status, response_body) VALUES (?, ?, ?)`,
      idempotencyKey,
      201,
      JSON.stringify(responsePayload)
    );

    await db.exec('COMMIT');
    return res.status(201).json(responsePayload);
  } catch (err) {
    try { await db.exec('ROLLBACK'); } catch (rollbackErr) {}
    console.error('[Payments] checkout error:', err);
    return res.status(500).json({ error: err.message || 'Payment checkout failed.' });
  }
});

module.exports = router;
