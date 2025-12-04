// backend/src/controllers/addresses.controller.js
const {
  listAddressesByUser,
  addAddress,
  updateAddress,
  deleteAddress,
  countAddresses,
  unsetDefaultForUser,
} = require("../utils/addresses.db");

// Config
const MAX_ADDRESSES_PER_USER = Number(process.env.MAX_ADDRESSES_PER_USER || 5);

exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const rows = await listAddressesByUser(Number(userId));
    return res.json({ addresses: rows });
  } catch (err) {
    console.error("getAddresses error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.createAddress = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { address, label, is_default, name, phone } = req.body || {};
    if (!address || !String(address).trim()) {
      return res.status(400).json({ error: "Address is required" });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Recipient name is required" });
    }

    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ error: "Mobile number is required" });
    }

    const currentCount = await countAddresses(Number(userId));
    if (currentCount >= MAX_ADDRESSES_PER_USER) {
      return res
        .status(400)
        .json({ error: `Address limit reached (${MAX_ADDRESSES_PER_USER})` });
    }

    if (is_default) await unsetDefaultForUser(Number(userId));
    const created = await addAddress({
      user_id: Number(userId),
      address: String(address).trim(),
      label: label ? String(label).trim() : null,
      is_default: !!is_default,
      name: String(name).trim(),
      phone: String(phone).trim(),
    });

    return res.status(201).json({ address: created });
  } catch (err) {
    console.error("createAddress error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    const { address, label, is_default, name, phone } = req.body || {};

    if (!address || !String(address).trim()) {
      return res.status(400).json({ error: "Address is required" });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Recipient name is required" });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ error: "Mobile number is required" });
    }

    if (is_default) await unsetDefaultForUser(Number(userId));
    const updated = await updateAddress({
      id,
      user_id: Number(userId),
      address: String(address).trim(),
      label: label ? String(label).trim() : null,
      is_default: !!is_default,
      name: String(name).trim(),
      phone: String(phone).trim(),
    });

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json({ address: updated });
  } catch (err) {
    console.error("updateAddress error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    const deleted = await deleteAddress(id, Number(userId));
    if (!deleted) return res.status(404).json({ error: "Not found" });
    return res.json({ address: deleted });
  } catch (err) {
    console.error("deleteAddress error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
