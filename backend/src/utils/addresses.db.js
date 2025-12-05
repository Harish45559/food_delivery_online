// backend/src/utils/addresses.db.js
// Use the shared DB pool (from src/db) so SSL and connection settings are consistent.

const db = require('../db'); // reuse the central pool
const pool = db.pool;

/**
 * List addresses for a user
 * @param {number} userId
 * @returns {Promise<Array>}
 */
exports.listAddressesByUser = async function (userId) {
  const q = `SELECT id, user_id, address, label, name, phone, is_default, created_at
             FROM user_addresses WHERE user_id = $1 ORDER BY id DESC`;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

/**
 * Count addresses for a user (used to limit number of addresses)
 * @param {number} userId
 * @returns {Promise<number>}
 */
exports.countAddresses = async function (userId) {
  const q = `SELECT COUNT(*)::int AS cnt FROM user_addresses WHERE user_id = $1`;
  const { rows } = await pool.query(q, [userId]);
  return rows[0] ? rows[0].cnt : 0;
};

/**
 * Create address
 * @param {object} payload - { user_id, address, label, name, phone, is_default }
 * @returns {Promise<object>} inserted row
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
 * Delete address (by id + user)
 */
exports.deleteAddress = async function (userId, addressId) {
  const q = `DELETE FROM user_addresses WHERE id = $1 AND user_id = $2 RETURNING *`;
  const { rows } = await pool.query(q, [addressId, userId]);
  return rows[0];
};

/**
 * Update address
 */
exports.updateAddress = async function (userId, addressId, updates = {}) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const key of ['address', 'label', 'name', 'phone', 'is_default']) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${key} = $${idx}`);
      values.push(updates[key]);
      idx++;
    }
  }

  if (fields.length === 0) return null;

  values.push(addressId, userId); // last two params
  const q = `UPDATE user_addresses SET ${fields.join(', ')}, created_at = created_at WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`;
  const { rows } = await pool.query(q, values);
  return rows[0];
};
