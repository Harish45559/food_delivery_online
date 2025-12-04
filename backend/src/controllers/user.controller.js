// backend/src/controllers/user.controller.js
const db = require('../db');

async function me(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const q = `
      SELECT
        id,
        name,
        email,
        role,
        mobile,
        dob,
        addressline1   AS "addressLine1",
        addressline2   AS "addressLine2",
        city,
        county,
        postcode,
        country,
        created_at     AS "createdAt",
        updated_at     AS "updatedAt"
      FROM users
      WHERE id=$1
    `;
    const { rows } = await db.query(q, [userId]);
    const user = rows[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({ user });
  } catch (err) {
    console.error('me error', err && err.stack ? err.stack : err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function updateMe(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const {
      name,
      mobile,
      dob,
      addressLine1,
      addressLine2,
      city,
      county,
      postcode,
      country,
    } = req.body || {};

    // map camelCase request fields into DB column values (DB columns are snake-case)
    const normalizedPostcode = typeof postcode === 'string' ? postcode.toUpperCase().trim() : postcode;

    const fields = [];
    const values = [];
    let idx = 1;
    const add = (col, val) => { fields.push(`${col}=$${idx++}`); values.push(val); };

    if (typeof name !== 'undefined') add('name', name);
    if (typeof mobile !== 'undefined') add('mobile', mobile);
    if (typeof dob !== 'undefined') add('dob', dob || null);
    if (typeof addressLine1 !== 'undefined') add('addressline1', addressLine1 || null);
    if (typeof addressLine2 !== 'undefined') add('addressline2', addressLine2 || null);
    if (typeof city !== 'undefined') add('city', city || null);
    if (typeof county !== 'undefined') add('county', county || null);
    if (typeof normalizedPostcode !== 'undefined') add('postcode', normalizedPostcode || null);
    if (typeof country !== 'undefined') add('country', country || null);

    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });

    const q = `
      UPDATE users
      SET ${fields.join(', ')}, updated_at = now()
      WHERE id=$${idx}
      RETURNING
        id,
        name,
        email,
        role,
        mobile,
        dob,
        addressline1 AS "addressLine1",
        addressline2 AS "addressLine2",
        city,
        county,
        postcode,
        country,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
    values.push(userId);

    const { rows } = await db.query(q, values);
    const updated = rows[0];
    if (!updated) return res.status(404).json({ message: 'User not found' });

    return res.json({ user: updated });
  } catch (err) {
    console.error('updateMe error', err && err.stack ? err.stack : err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { me, updateMe };
