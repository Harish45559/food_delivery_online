import React, { useEffect, useState } from "react";
import api from "../services/api";
import "../styles/masterdata.css";

/* ---------------------------------------------------
    IMAGE MATCHING – NO SLUG NEEDED
--------------------------------------------------- */

function normalizeForFilenames(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[’'`"“”]/g, "")
    .replace(/[^a-z0-9\s-_.]/g, "");
}

/* Search FE public/menu/ for any matching image */
async function findMatchingImageByName(title) {
  if (!title) return null;
  const base = normalizeForFilenames(title);

  const variants = new Set();
  variants.add(base);
  variants.add(base.replace(/\s+/g, "-"));
  variants.add(base.replace(/\s+/g, "_"));
  variants.add(base.replace(/\s+/g, ""));
  base.split(" ").forEach((w) => w && variants.add(w));

  const exts = ["png", "jpg", "jpeg", "webp"];

  for (const v of variants) {
    for (const ext of exts) {
      const candidate = `/menu/${v}.${ext}`;
      try {
        const r = await fetch(candidate, { method: "HEAD" });
        if (r.ok) return candidate;
      } catch (_) {}
    }
  }

  return null;
}

/* ---------------------------------------------------
    MODAL WRAPPER
--------------------------------------------------- */
function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="md-overlay" onMouseDown={onClose}>
      <div className="md-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-header">
          <h3>{title}</h3>
          <button className="md-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="md-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------
    MAIN COMPONENT
--------------------------------------------------- */
export default function MasterData() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);

  const [catEditor, setCatEditor] = useState(null);
  const [itemEditor, setItemEditor] = useState(null);

  /* 🔍 NEW STATES FOR SEARCH */
  const [catSearch, setCatSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");

  /* ---------- Load all ---------- */
  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [cRes, iRes] = await Promise.all([
        api.get("/menu/admin/categories"),
        api.get("/menu/items"),
      ]);
      setCategories(cRes.data.categories || []);
      setItems(iRes.data.items || []);
    } catch (err) {
      console.error("loadAll error", err);
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Filtered Lists ---------- */
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  const filteredItems = items.filter((it) =>
    it.title.toLowerCase().includes(itemSearch.toLowerCase())
  );

  /* ---------- Category CRUD ---------- */
  function openAddCategory() {
    setCatEditor({ name: "", slug: "" });
    setCatModalOpen(true);
  }

  function openEditCategory(c) {
    setCatEditor({ ...c });
    setCatModalOpen(true);
  }

  async function saveCategory(payload) {
    try {
      if (catEditor?.id) {
        await api.put(`/menu/admin/categories/${catEditor.id}`, payload);
      } else {
        await api.post("/menu/admin/categories", payload);
      }
      setCatModalOpen(false);
      setCatEditor(null);
      loadAll();
    } catch (err) {
      console.error("saveCategory", err);
      alert(err.response?.data?.message || "Failed to save");
    }
  }

  async function deleteCategory(id) {
    if (!confirm("Delete category?")) return;
    try {
      await api.delete(`/menu/admin/categories/${id}`);
      loadAll();
    } catch (err) {
      console.error("deleteCategory", err);
      alert("Delete failed");
    }
  }

  /* ---------- Item CRUD ---------- */
  function openAddItem() {
    setItemEditor({
      title: "",
      description: "",
      price_gbp: "0.00",
      category_id: categories[0]?.id || null,
      available: true,
    });
    setItemModalOpen(true);
  }

  function openEditItem(it) {
    const price =
      typeof it.price_gbp !== "undefined" && it.price_gbp !== null
        ? String(Number(it.price_gbp).toFixed(2))
        : typeof it.price_pence === "number"
        ? (it.price_pence / 100).toFixed(2)
        : "0.00";

    setItemEditor({
      id: it.id,
      title: it.title || "",
      description: it.description || "",
      price_gbp: price,
      category_id: it.category?.id || null,
      available: it.available ?? true,
    });
    setItemModalOpen(true);
  }

  async function saveItem(payload) {
    try {
      if (itemEditor?.id) {
        await api.put(`/menu/admin/items/${itemEditor.id}`, payload);
      } else {
        await api.post("/menu/admin/items", payload);
      }
      setItemModalOpen(false);
      setItemEditor(null);
      loadAll();
    } catch (err) {
      console.error("saveItem", err);
      alert(err.response?.data?.message || "Failed to save");
    }
  }

  async function deleteItem(id) {
    if (!confirm("Delete item?")) return;
    try {
      await api.delete(`/menu/admin/items/${id}`);
      loadAll();
    } catch (err) {
      console.error("deleteItem", err);
    }
  }

  /* Helpers */
  function catFieldChange(name, value) {
    setCatEditor((s) => ({ ...(s || {}), [name]: value }));
  }

  function itemFieldChange(name, value) {
    setItemEditor((s) => ({ ...(s || {}), [name]: value }));
  }

  /* Price formatter */
  function formatPrice(it) {
    if (it.price_gbp_str) return it.price_gbp_str;
    if (it.price_gbp !== undefined && it.price_gbp !== null)
      return `£${Number(it.price_gbp).toFixed(2)}`;
    if (it.price_pence) return `£${(it.price_pence / 100).toFixed(2)}`;
    return "£0.00";
  }

  /* ---------------------------------------------------
      RENDERING
  --------------------------------------------------- */
  return (
    <div className="master-page container">
      <h1 className="page-title">Admin Menu</h1>
      <p className="page-sub">Manage categories & items</p>

      <div className="master-grid">
        {/* -------------- Categories -------------- */}
        <section className="card card-left">
          <div className="card-head">
            <h3>Categories</h3>
            <button className="btn btn-outline" onClick={openAddCategory}>
              Add Category
            </button>
          </div>

          {/* 🔍 Category Search */}
          <input
            className="search-input"
            placeholder="Search categories..."
            value={catSearch}
            onChange={(e) => setCatSearch(e.target.value)}
            style={{ marginBottom: "10px" }}
          />

          <div className="categories-list">
            {filteredCategories.map((c) => (
              <div key={c.id} className="category-pill-card">
                <div className="pill-title">{c.name}</div>
                <div className="pill-actions">
                  <button
                    className="small-btn"
                    onClick={() => openEditCategory(c)}
                  >
                    Edit
                  </button>
                  <button
                    className="small-btn danger"
                    onClick={() => deleteCategory(c.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* -------------- Items -------------- */}
        <section className="card card-right">
          <div className="card-head">
            <h3>Items</h3>
            <button className="btn btn-primary" onClick={openAddItem}>
              Add Item
            </button>
          </div>

          {/* 🔍 Item Search */}
          <input
            className="search-input"
            placeholder="Search items..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            style={{ marginBottom: "10px" }}
          />

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="items-grid-admin">
              {filteredItems.map((it) => (
                <div key={it.id} className="item-admin-card no-image-card">
                  <div className="item-admin-body">
                    <div className="item-admin-title">{it.title}</div>
                    <div className="text-muted">{it.description}</div>

                    <div className="item-admin-meta">
                      <div className="price">{formatPrice(it)}</div>

                      <div className="meta-right">
                        <button
                          className="small-btn"
                          onClick={() => openEditItem(it)}
                        >
                          Edit
                        </button>
                        <button
                          className="small-btn danger"
                          onClick={() => deleteItem(it.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ---------------- Category Modal ---------------- */}
      <Modal
        open={catModalOpen}
        title={catEditor?.id ? "Edit Category" : "Add Category"}
        onClose={() => {
          setCatModalOpen(false);
          setCatEditor(null);
        }}
      >
        <div className="form-row">
          <label>Name</label>
          <input
            value={catEditor?.name || ""}
            onChange={(e) => catFieldChange("name", e.target.value)}
          />
        </div>
        <div className="form-row">
          <label>Slug</label>
          <input
            value={catEditor?.slug || ""}
            onChange={(e) => catFieldChange("slug", e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-outline"
            onClick={() => setCatModalOpen(false)}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              saveCategory({
                name: catEditor.name,
                slug: catEditor.slug,
              })
            }
          >
            Save
          </button>
        </div>
      </Modal>

      {/* ---------------- Item Modal ---------------- */}
      <Modal
        open={itemModalOpen}
        title={itemEditor?.id ? "Edit Item" : "Add Item"}
        onClose={() => {
          setItemModalOpen(false);
          setItemEditor(null);
        }}
      >
        <div className="form-row">
          <label>Title</label>
          <input
            value={itemEditor?.title || ""}
            onChange={(e) => itemFieldChange("title", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label>Description</label>
          <textarea
            value={itemEditor?.description || ""}
            onChange={(e) => itemFieldChange("description", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label>Price (GBP)</label>
          <input
            value={itemEditor?.price_gbp}
            onChange={(e) => itemFieldChange("price_gbp", e.target.value)}
            placeholder="6.99"
          />
        </div>

        <div className="form-row">
          <label>Category</label>
          <select
            value={itemEditor?.category_id || ""}
            onChange={(e) =>
              itemFieldChange("category_id", Number(e.target.value))
            }
          >
            <option value="">-- Choose --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row-inline">
          <label>
            <input
              type="checkbox"
              checked={!!itemEditor?.available}
              onChange={(e) => itemFieldChange("available", e.target.checked)}
            />
            Available
          </label>
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-outline"
            onClick={() => setItemModalOpen(false)}
          >
            Cancel
          </button>

          <button
            className="btn btn-primary"
            onClick={async () => {
              const raw = String(itemEditor.price_gbp || "")
                .replace(/,/g, "")
                .trim();
              const n = Number(raw);
              if (Number.isNaN(n)) {
                alert("Invalid price");
                return;
              }
              const priceStr = n.toFixed(2);

              let foundImage = null;
              try {
                foundImage = await findMatchingImageByName(itemEditor.title);
              } catch (_) {}

              const payload = {
                category_id: itemEditor.category_id,
                title: itemEditor.title,
                description: itemEditor.description,
                price_gbp: priceStr,
                available: !!itemEditor.available,
                ...(foundImage ? { image_url: foundImage } : {}),
              };

              saveItem(payload);
            }}
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}
