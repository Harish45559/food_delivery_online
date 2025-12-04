// backend/src/utils/addresses.db.js
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * listAddressesByUser(userId)
 * addAddress({ user_id, address, label, name, phone, is_default })
 * updateAddress({ id, user_id, address, label, name, phone, is_default })
 * deleteAddress(id, user_id)
 * countAddresses(user_id)
 * unsetDefaultForUser(user_id)
 */

exports.listAddressesByUser = async (userId) => {
  const res = await pool.query(
    `SELECT id, user_id, address, label, name, phone, is_default, created_at
     FROM user_addresses
     WHERE user_id = $1
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );
  return res.rows;
};

exports.countAddresses = async (userId) => {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS cnt 
     FROM user_addresses 
     WHERE user_id = $1`,
    [userId]
  );
  return res.rows[0].cnt;
};

exports.addAddress = async ({
  user_id,
  address,
  label = null,
  name,
  phone,
  is_default = false,
}) => {
  const res = await pool.query(
    `INSERT INTO user_addresses 
      (user_id, address, label, name, phone, is_default)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [user_id, address, label, name, phone, is_default]
  );
  return res.rows[0];
};

exports.updateAddress = async ({
  id,
  user_id,
  address,
  label = null,
  name,
  phone,
  is_default = false,
}) => {
  const res = await pool.query(
    `UPDATE user_addresses
     SET address = $1,
         label = $2,
         name = $3,
         phone = $4,
         is_default = $5
     WHERE id = $6 AND user_id = $7
     RETURNING *`,
    [address, label, name, phone, is_default, id, user_id]
  );
  return res.rows[0];
};

exports.deleteAddress = async (id, user_id) => {
  const res = await pool.query(
    `DELETE FROM user_addresses 
     WHERE id = $1 AND user_id = $2 
     RETURNING *`,
    [id, user_id]
  );
  return res.rows[0];
};

exports.unsetDefaultForUser = async (user_id) => {
  await pool.query(
    `UPDATE user_addresses 
     SET is_default = false 
     WHERE user_id = $1`,
    [user_id]
  );
};
