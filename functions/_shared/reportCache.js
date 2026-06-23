// Report + job storage via Cache API (free, no KV needed).

function cacheUrl(kind, id) {
  return `https://sitexray.internal/report/${kind}/${id}`;
}

function jobUrl(kind, id) {
  return `https://sitexray.internal/job/${kind}/${id}`;
}

const TTL = 60 * 60 * 24 * 7;

export async function cacheReport(kind, id, html) {
  if (!kind || !id || !html) return;
  await caches.default.put(
    cacheUrl(kind, id),
    new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
    { expirationTtl: TTL }
  );
}

export async function getCachedReport(kind, id) {
  const hit = await caches.default.match(cacheUrl(kind, id));
  return hit ? await hit.text() : null;
}

export async function putJob(kind, id, job) {
  await caches.default.put(
    jobUrl(kind, id),
    new Response(JSON.stringify(job), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    { expirationTtl: TTL }
  );
}

export async function getJob(kind, id) {
  const hit = await caches.default.match(jobUrl(kind, id));
  if (!hit) return null;
  try {
    return await hit.json();
  } catch {
    return null;
  }
}

