// backend/src/utils/sse.js
// Simple SSE manager: addClient(res), broadcastSse(payload)

const clients = new Set();

function safeWrite(res, text) {
  try {
    if (!res.writableEnded && !res.finished) {
      res.write(text);
    }
  } catch (e) {
    // ignore
  }
}

function addClient(res) {
  try {
    if (!res.headersSent) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      // node/express may support flushHeaders
      res.flushHeaders?.();
    }
  } catch (e) {}

  // send initial ping
  safeWrite(
    res,
    `data: ${JSON.stringify({ event: "connected", ts: Date.now() })}\n\n`
  );

  clients.add(res);
  console.log("[sse] client connected (total=%d)", clients.size);

  function remove() {
    clients.delete(res);
    try {
      if (!res.writableEnded && !res.finished) res.end();
    } catch (e) {}
    console.log("[sse] client disconnected (total=%d)", clients.size);
  }

  // remove when connection closes
  if (typeof res.on === "function") {
    res.on("close", remove);
    res.on("finish", remove);
  } else {
    // fallback
    setTimeout(() => {
      if (!res.writable) remove();
    }, 60_000);
  }
}

function broadcastSse(payload) {
  const text = `data: ${JSON.stringify(payload)}\n\n`;
  let sent = 0;
  for (const res of Array.from(clients)) {
    try {
      if (res.writableEnded || res.finished) {
        clients.delete(res);
        continue;
      }
      safeWrite(res, text);
      sent++;
    } catch (e) {
      clients.delete(res);
    }
  }
  console.log(`[sse] broadcast "${payload.event}" to ${sent} clients`);
}

module.exports = { addClient, broadcastSse };
