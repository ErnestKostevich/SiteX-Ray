// BYOK API keys — in-memory cache only, 30 min TTL, deleted after use.

const TTL = 60 * 30;

function keyUrl(reportKey) {
  return `https://sitexray.internal/byok/${reportKey}`;
}

export async function stashByokKey(reportKey, apiKey) {
  if (!reportKey || !apiKey) return;
  await caches.default.put(
    keyUrl(reportKey),
    new Response(JSON.stringify({ key: apiKey }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    { expirationTtl: TTL }
  );
}

export async function peekByokKey(reportKey) {
  const hit = await caches.default.match(keyUrl(reportKey));
  if (!hit) return null;
  try {
    const data = await hit.json();
    return data?.key || null;
  } catch {
    return null;
  }
}

export async function takeByokKey(reportKey) {
  const key = await peekByokKey(reportKey);
  if (key) {
    await caches.default.delete(keyUrl(reportKey));
  }
  return key;
}

export async function clearByokKey(reportKey) {
  await caches.default.delete(keyUrl(reportKey));
}