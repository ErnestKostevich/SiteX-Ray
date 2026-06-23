// Lifetime full-access licenses ($39 USDT). Stored in Cache API (~10 year TTL).

const LICENSE_TTL = 60 * 60 * 24 * 365 * 10;

function emailUrl(normalizedEmail) {
  return `https://sitexray.internal/license/email/${normalizedEmail}`;
}

function tokenUrl(tokenHash) {
  return `https://sitexray.internal/license/token/${tokenHash}`;
}

export function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function digestHex(input) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateUnlockToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function saveLicense(record, tokenHash) {
  const { unlockToken: _drop, ...persisted } = record;
  await caches.default.put(
    emailUrl(record.email),
    new Response(JSON.stringify(persisted), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    { expirationTtl: LICENSE_TTL }
  );
  await caches.default.put(
    tokenUrl(tokenHash),
    new Response(JSON.stringify({ email: record.email, lifetime: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    { expirationTtl: LICENSE_TTL }
  );
}

/** Create lifetime license. Returns new unlock token (shown once). */
export async function grantLifetimeLicense(email, meta = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Valid email is required");
  }

  const unlockToken = await generateUnlockToken();
  const tokenHash = await digestHex(unlockToken);

  const record = {
    email: normalized,
    lifetime: true,
    paidAt: Date.now(),
    unlockTokenHash: tokenHash,
    txHash: meta.txHash || null,
    network: meta.network || null,
    amount: meta.amount ?? null,
  };

  await saveLicense(record, tokenHash);
  return unlockToken;
}

/** Issue a new unlock token for an existing license (invalidates previous). */
export async function rotateUnlockToken(email) {
  const normalized = normalizeEmail(email);
  const existing = await getLicenseByEmail(normalized);
  if (!existing?.lifetime) return null;

  const unlockToken = await generateUnlockToken();
  const tokenHash = await digestHex(unlockToken);
  const record = {
    ...existing,
    unlockTokenHash: tokenHash,
    rotatedAt: Date.now(),
  };
  await saveLicense(record, tokenHash);
  return unlockToken;
}

export async function isLicensed(email) {
  const license = await getLicenseByEmail(email);
  return !!license?.lifetime;
}

export async function getLicenseByEmail(email) {
  const normalized = normalizeEmail(email);
  const hit = await caches.default.match(emailUrl(normalized));
  if (!hit) return null;
  try {
    return await hit.json();
  } catch {
    return null;
  }
}

export async function verifyLicense(email, unlockToken) {
  const normalized = normalizeEmail(email);
  const token = String(unlockToken || "").trim().toLowerCase();
  if (!normalized || token.length < 32) return false;

  const license = await getLicenseByEmail(normalized);
  if (!license?.lifetime) return false;

  const tokenHash = await digestHex(token);
  if (license.unlockTokenHash !== tokenHash) return false;

  const hit = await caches.default.match(tokenUrl(tokenHash));
  if (!hit) return false;
  try {
    const data = await hit.json();
    return data?.email === normalized && !!data?.lifetime;
  } catch {
    return false;
  }
}