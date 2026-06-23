// Temporary report storage (Cache API) — backup delivery when email is delayed.

function cacheUrl(kind, id) {
  return `https://sitexray.internal/report/${kind}/${id}`;
}

export async function cacheReport(kind, id, html) {
  if (!kind || !id || !html) return;
  await caches.default.put(
    cacheUrl(kind, id),
    new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
    { expirationTtl: 60 * 60 * 24 * 7 }
  );
}

export async function getCachedReport(kind, id) {
  const hit = await caches.default.match(cacheUrl(kind, id));
  return hit ? await hit.text() : null;
}