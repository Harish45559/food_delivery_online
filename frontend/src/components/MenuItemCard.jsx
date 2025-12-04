// client/src/components/MenuItemCard.jsx
import React, { useEffect, useState } from "react";

/*
  Robust image loader for menu items:
  - prefer item.image_url if provided (relative or absolute)
  - otherwise attempt to load /menu/<slug>.<ext> via Image()
  - cache results to avoid repeated network checks
  - final fallback -> /menu/default.jpg (please add this file in public/menu/)
*/

function makeSlug(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const detectionCache = new Map();

function testImage(url, timeout = 5000) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        img.onload = img.onerror = null;
        resolve(false);
      }
    }, timeout);

    img.onload = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        img.onload = img.onerror = null;
        resolve(true);
      }
    };
    img.onerror = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        img.onload = img.onerror = null;
        resolve(false);
      }
    };

    // Kick off load
    img.src = url;
    // In case the image is cached and already complete:
    if (img.complete && !done) {
      done = true;
      clearTimeout(timer);
      resolve(true);
    }
  });
}

async function findImageForItem(title) {
  const slug = makeSlug(title);
  const exts = ["png", "jpg", "jpeg", "webp", "avif"];
  // check cache
  if (detectionCache.has(slug)) return detectionCache.get(slug);

  // try each extension
  for (const ext of exts) {
    const url = `/menu/${slug}.${ext}`;
    try {
      const ok = await testImage(url);
      if (ok) {
        detectionCache.set(slug, url);
        return url;
      }
    } catch (e) {
      // ignore and continue
    }
  }

  // not found
  detectionCache.set(slug, null);
  return null;
}

export default function MenuItemCard({ item, onAdd, adminControls }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  const priceLabel =
    item.price_gbp || (item.price ? `£${Number(item.price).toFixed(2)}` : null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    async function load() {
      // 1) Prefer explicit image_url from DB / API
      if (item.image_url) {
        // if image_url is relative (starts with "/"), normalize to same origin
        const candidate = item.image_url;
        const ok = await testImage(candidate).catch(() => false);
        if (active) {
          setImgSrc(ok ? candidate : "/menu/default.jpg");
          setLoading(false);
        }
        return;
      }

      // 2) Detect by slug in /menu/
      const detected = await findImageForItem(item.title);
      if (!active) return;
      if (detected) {
        setImgSrc(detected);
      } else {
        setImgSrc("/menu/default.jpg");
      }
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [item]);

  return (
    <div
      className="item-card"
      style={{ display: "flex", gap: 12, alignItems: "center" }}
    >
      <div
        style={{
          width: 120,
          height: 84,
          borderRadius: 10,
          background: "#f3f4f6",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {!loading ? (
          <img
            src={imgSrc || "/menu/default.jpg"}
            alt={item.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/menu/default.jpg";
            }}
          />
        ) : (
          // small inline spinner / placeholder while detecting
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: "#e6e9ef",
            }}
          />
        )}
      </div>

      <div className="item-body" style={{ flex: 1 }}>
        <div className="item-title" style={{ fontWeight: 700 }}>
          {item.title}
        </div>
        <div className="item-desc" style={{ color: "#6b7280", marginTop: 6 }}>
          {item.description || ""}
        </div>
        <div
          className="item-bottom"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 10,
          }}
        >
          <div className="price" style={{ fontWeight: 800 }}>
            {priceLabel}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="add-btn"
              onClick={() => onAdd && onAdd(item)}
              disabled={!item.available}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                background: item.available ? "#16a34a" : "#ccc",
                color: "#fff",
                border: "none",
                fontWeight: 800,
                cursor: item.available ? "pointer" : "not-allowed",
              }}
            >
              {item.available ? "Add" : "Sold out"}
            </button>
            {adminControls}
          </div>
        </div>
      </div>
    </div>
  );
}
