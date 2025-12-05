// backend/src/utils/addresses.db.js
// Shared DB pool usage so SSL and connection options are consistent.
const db = require('../db');
const pool = db.pool;

/**
 * List addresses for a user
 */
exports.listAddressesByUser = async function (userId) {
  const q = `SELECT id, user_id, address, label, name, phone, is_default, created_at
             FROM user_addresses WHERE user_id = $1 ORDER BY id DESC`;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

/**
 * Count addresses for a user
 */
exports.countAddresses = async function (userId) {
  const q = `SELECT COUNT(*)::int AS cnt FROM user_addresses WHERE user_id = $1`;
  const { rows } = await pool.query(q, [userId]);
  return rows[0] ? rows[0].cnt : 0;
};

/**
 * Unset the is_default flag for all addresses for a user.
 * Used when creating/updating an address that should become default.
 */
exports.unsetDefaultForUser = async function (userId) {
  const q = `UPDATE user_addresses SET is_default = false WHERE user_id = $1 AND is_default = true`;
  await pool.query(q, [userId]);
  return true;
};

/**
 * Create address
 * payload: { user_id, address, label, name, phone, is_default }
 */
exports.createAddress = async function (payload) {
  const {
    user_id,
    address,
    label = null,
    name = null,
    phone = null,
    is_default = false
  } = payload;

  if (is_default) {
    // unset other defaults
    await exports.unsetDefaultForUser(user_id);
  }

  const q = `
    INSERT INTO user_addresses (user_id, address, label, name, phone, is_default, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, now())
    RETURNING *;
  `;
  const vals = [user_id, address, label, name, phone, is_default];
  const { rows } = await pool.query(q, vals);
  return rows[0];
};

/**
 * Delete address by id and user
 */
exports.deleteAddress = async function (userId, addressId) {
  const q = `DELETE FROM user_addresses WHERE id = $1 AND user_id = $2 RETURNING *`;
  const { rows } = await pool.query(q, [addressId, userId]);
  return rows[0];
};

/**
 * Update address (partial update)
 * updates: object with any of address,label,name,phone,is_default
 */
exports.updateAddress = async function (userId, addressId, updates = {}) {
  const fields = [];
  const values = [];
  let idx = 1;

  // If is_default is being set true, unset others first
  if (Object.prototype.hasOwnProperty.call(updates, 'is_default') && updates.is_default === true) {
    await exports.unsetDefaultForUser(userId);
  }

  for (const key of ['address', 'label', 'name', 'phone', 'is_default']) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${key} = $${idx}`);
      values.push(updates[key]);
      idx++;
    }
  }

  if (fields.length === 0) {
    // Nothing to update
    const { rows } = await pool.query(`SELECT * FROM user_addresses WHERE id=$1 AND user_id=$2`, [addressId, userId]);
    return rows[0] || null;
  }

  values.push(addressId, userId); // last two params
  const q = `UPDATE user_addresses SET ${fields.join(', ')}, created_at = created_at WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`;
  const { rows } = await pool.query(q, values);
  return rows[0];
};
