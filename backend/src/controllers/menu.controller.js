// backend/src/controllers/menu.controller.js
const db = require("../db");

/* Helper: parse an input price (string or number) to a numeric value in GBP (2 decimals)
   Accepts:
     - "6.99" -> 6.99
     - 6.99   -> 6.99
     - "699"  -> 699.00 (but that's suspicious; prefer sending "6.99")
   We will store the value in a numeric(8,2) column called price_gbp.
*/
function parseToGbp(value) {
  if (value === null || value === undefined || value === "") return 0.0;
  // if it's already a number
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }
  const s = String(value).trim().replace(/,/g, "");
  // If contains dot -> parse as pounds
  if (s.includes(".")) {
    const f = Number(s);
    if (Number.isNaN(f)) throw new Error("Invalid price");
    return Number(f.toFixed(2));
  }
  // No dot -> ambiguous. We'll treat small numbers (< 1000) as pounds (e.g. "6" => 6.00)
  // and large numbers (>=1000) likely as pence (e.g. 699 -> 699.00) — but prefer frontend send "6.99".
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error("Invalid price");
  if (n >= 1000) {
    // value looks like pence (e.g. 69900) — convert to pounds
    return Number((n / 100.0).toFixed(2));
  }
  // otherwise interpret as pounds
  return Number(n.toFixed(2));
}

/* Utility: format GBP numeric to GBP string "£6.99" */
function formatGbpToString(gbp) {
  const n = Number(gbp) || 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

/* ----------------- CATEGORIES ----------------- */
async function listCategories(req, res) {
  try {
    const q = `SELECT id, name, slug, description, is_active FROM categories WHERE is_active = true ORDER BY id`;
    const { rows } = await db.query(q);
    return res.json({ categories: rows });
  } catch (err) {
    console.error("listCategories", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function adminListCategories(req, res) {
  try {
    const q = `SELECT id, name, slug, description, is_active FROM categories ORDER BY id`;
    const { rows } = await db.query(q);
    return res.json({ categories: rows });
  } catch (err) {
    console.error("adminListCategories", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function createCategory(req, res) {
  try {
    const { name, slug, description, is_active } = req.body;
    if (!name || !slug)
      return res.status(400).json({ message: "name and slug required" });

    const { rows } = await db.query(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ($1,$2,$3,$4)
       RETURNING id,name,slug,description,is_active`,
      [name, slug, description || null, !!is_active]
    );
    return res.status(201).json({ category: rows[0] });
  } catch (err) {
    console.error("createCategory", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function updateCategory(req, res) {
  try {
    const id = Number(req.params.id);
    const { name, slug, description, is_active } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;
    const add = (col, val) => {
      fields.push(`${col}=$${idx++}`);
      values.push(val);
    };
    if (typeof name !== "undefined") add("name", name);
    if (typeof slug !== "undefined") add("slug", slug);
    if (typeof description !== "undefined") add("description", description);
    if (typeof is_active !== "undefined") add("is_active", is_active);
    if (!fields.length) return res.status(400).json({ message: "No fields" });

    const q = `UPDATE categories SET ${fields.join(
      ", "
    )}, updated_at = now() WHERE id=$${idx} RETURNING id,name,slug,description,is_active`;
    values.push(id);
    const { rows } = await db.query(q, values);
    if (!rows[0]) return res.status(404).json({ message: "Not found" });
    return res.json({ category: rows[0] });
  } catch (err) {
    console.error("updateCategory", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function deleteCategory(req, res) {
  try {
    const id = Number(req.params.id);
    await db.query("DELETE FROM categories WHERE id=$1", [id]);
    return res.json({ message: "deleted" });
  } catch (err) {
    console.error("deleteCategory", err);
    return res.status(500).json({ message: "Server error" });
  }
}

/* ----------------- ITEMS (Public list) ----------------- */
async function listItems(req, res) {
  try {
    const cat = req.query.category || null;
    let q = `
      SELECT mi.id, mi.title, mi.description, mi.price_gbp, mi.price_pence, mi.available,
             c.id AS category_id, c.name AS category_name, c.slug AS category_slug
      FROM menu_items mi
      LEFT JOIN categories c ON c.id = mi.category_id
      WHERE mi.available = true
    `;
    const params = [];
    if (cat) {
      q += " AND c.slug = $1";
      params.push(cat);
    }
    q += " ORDER BY mi.id";
    const { rows } = await db.query(q, params);

    const items = rows.map((r) => {
      const priceGbp =
        r.price_gbp !== null
          ? Number(r.price_gbp)
          : r.price_pence
          ? Number((r.price_pence / 100).toFixed(2))
          : 0;
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        price_gbp: priceGbp, // numeric 6.99
        price_gbp_str: formatGbpToString(priceGbp), // "£6.99"
        available: r.available,
        category: {
          id: r.category_id,
          name: r.category_name,
          slug: r.category_slug,
        },
      };
    });

    return res.json({ items });
  } catch (err) {
    console.error("listItems", err);
    return res.status(500).json({ message: "Server error" });
  }
}

/* ----------------- ITEMS (Admin CRUD) ----------------- */
/* Admin endpoints accept price_gbp (string or number). We will parse to numeric(8,2). */

async function adminCreateItem(req, res) {
  try {
    const { category_id, title, description, price_gbp, available } = req.body;
    if (!title || price_gbp === undefined)
      return res.status(400).json({ message: "title and price_gbp required" });

    let gbp;
    try {
      gbp = parseToGbp(price_gbp);
    } catch (e) {
      return res.status(400).json({ message: "Invalid price" });
    }

    const q = `
      INSERT INTO menu_items (category_id, title, description, price_gbp, available)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id, category_id, title, description, price_gbp, available
    `;
    const { rows } = await db.query(q, [
      category_id || null,
      title,
      description || null,
      gbp,
      !!available,
    ]);
    const r = rows[0];
    return res.status(201).json({
      item: {
        ...r,
        price_gbp: Number(r.price_gbp),
        price_gbp_str: formatGbpToString(r.price_gbp),
      },
    });
  } catch (err) {
    console.error("adminCreateItem", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function adminUpdateItem(req, res) {
  try {
    const id = Number(req.params.id);
    const { category_id, title, description, price_gbp, available } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;
    const add = (col, val) => {
      fields.push(`${col}=$${idx++}`);
      values.push(val);
    };

    if (typeof category_id !== "undefined")
      add("category_id", category_id || null);
    if (typeof title !== "undefined") add("title", title);
    if (typeof description !== "undefined")
      add("description", description || null);
    if (typeof price_gbp !== "undefined") {
      let gbp;
      try {
        gbp = parseToGbp(price_gbp);
      } catch (e) {
        return res.status(400).json({ message: "Invalid price" });
      }
      add("price_gbp", gbp);
    }
    if (typeof available !== "undefined") add("available", available);

    if (!fields.length)
      return res.status(400).json({ message: "No fields to update" });

    const q = `UPDATE menu_items SET ${fields.join(
      ", "
    )}, updated_at = now() WHERE id=$${idx} RETURNING id, category_id, title, description, price_gbp, available`;
    values.push(id);
    const { rows } = await db.query(q, values);
    if (!rows[0]) return res.status(404).json({ message: "Not found" });

    const r = rows[0];
    return res.json({
      item: {
        ...r,
        price_gbp: Number(r.price_gbp),
        price_gbp_str: formatGbpToString(r.price_gbp),
      },
    });
  } catch (err) {
    console.error("adminUpdateItem", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function adminDeleteItem(req, res) {
  try {
    const id = Number(req.params.id);
    await db.query("DELETE FROM menu_items WHERE id=$1", [id]);
    return res.json({ message: "deleted" });
  } catch (err) {
    console.error("adminDeleteItem", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  listCategories,
  adminListCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listItems,
  adminCreateItem,
  adminUpdateItem,
  adminDeleteItem,
};
