// backend/src/utils/orders.db.js
// Reuse the shared DB pool (backend/src/db) so SSL / connection options are consistent.

const db = require('../db'); // shared pool
const pool = db.pool;

/* ----------------------------------------------------
   CREATE TABLE IF NOT EXISTS orders
---------------------------------------------------- */
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        stripe_pid TEXT UNIQUE,
        status TEXT,
        total_gbp NUMERIC,
        notes TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        customer_address TEXT,
        paid_by TEXT,
        delivery_type VARCHAR(20)
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_pid ON orders(stripe_pid);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);`);

    console.log('✔ orders table exists / ensured');
  } catch (err) {
    console.error('Error creating orders table:', err && err.message ? err.message : err);
  }
})();

/* ----------------------------------------------------
   ADD ORDER
---------------------------------------------------- */
exports.addOrder = async ({
  user_id,
  stripe_pid = null,
  status,
  total_gbp,
  payload,
  notes = null,
  customer_name = null,
  customer_phone = null,
  customer_address = null,
  paid_by = null,
  delivery_type = null
}) => {
  const result = await pool.query(
    `
    INSERT INTO orders 
      (user_id, stripe_pid, status, total_gbp, payload, notes,
       customer_name, customer_phone, customer_address, paid_by, delivery_type)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
  `,
    [
      user_id,
      stripe_pid,
      status,
      total_gbp,
      payload,
      notes,
      customer_name,
      customer_phone,
      customer_address,
      paid_by,
      delivery_type
    ]
  );
  return result.rows[0];
};

/* ----------------------------------------------------
   UPDATE / SELECT / LIST helpers
---------------------------------------------------- */

exports.updateOrderStatusByPid = async (pid, status) => {
  const result = await pool.query(
    `
    UPDATE orders
    SET status = $1
    WHERE stripe_pid = $2
    RETURNING *
  `,
    [status, pid]
  );
  return result.rows[0];
};

exports.updateOrderStatusById = async (id, status) => {
  const result = await pool.query(
    `
    UPDATE orders
    SET status = $1
    WHERE id = $2
    RETURNING *
  `,
    [status, id]
  );
  return result.rows[0];
};

exports.updateOrderPaidByByPid = async (pid, paid_by) => {
  const result = await pool.query(
    `
    UPDATE orders
    SET paid_by = $1
    WHERE stripe_pid = $2
    RETURNING *
  `,
    [paid_by, pid]
  );
  return result.rows[0];
};

exports.getOrderByPid = async (pid) => {
  const result = await pool.query(
    `
    SELECT *
    FROM orders
    WHERE stripe_pid = $1
  `,
    [pid]
  );
  return result.rows[0];
};

exports.deleteOrderByPid = async (pid) => {
  const result = await pool.query(
    `
    DELETE FROM orders WHERE stripe_pid = $1 RETURNING *
  `,
    [pid]
  );
  return result.rows[0];
};

exports.getOrderById = async (id) => {
  const result = await pool.query(
    `
    SELECT *
    FROM orders
    WHERE id = $1
  `,
    [id]
  );
  return result.rows[0];
};

exports.listAllOrders = async () => {
  const result = await pool.query(`
    SELECT id, stripe_pid, status, total_gbp, notes, payload, created_at, user_id,
           customer_name, customer_phone, customer_address, paid_by, delivery_type
    FROM orders
    ORDER BY id DESC
  `);
  return result.rows;
};

exports.listOrdersByUser = async (userId) => {
  const result = await pool.query(
    `
    SELECT id, stripe_pid, status, total_gbp, notes, payload, created_at, user_id,
           customer_name, customer_phone, customer_address, paid_by, delivery_type
    FROM orders
    WHERE user_id = $1
    ORDER BY created_at DESC
  `,
    [userId]
  );
  return result.rows;
};

exports.listKitchenOrders = async () => {
  const result = await pool.query(
    `
    SELECT id, stripe_pid, status, total_gbp, notes, payload, created_at, user_id,
           customer_name, customer_phone, customer_address, paid_by, delivery_type
    FROM orders
    WHERE LOWER(status) = ANY($1)
    ORDER BY created_at DESC
  `,
    [['paid', 'preparing', 'prepared']]
  );
  return result.rows;
};
