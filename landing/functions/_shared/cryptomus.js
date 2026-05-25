// Cryptomus payment processor integration.
// https://doc.cryptomus.com/payments/creating-invoice
//
// Why Cryptomus: no-KYC for low volumes (€1k/month at signup, raises
// with usage). Customer pays in BTC/ETH/USDT/USDC/etc via Cryptomus's
// hosted checkout, you receive USDT in your wallet. 0.5% fee.
//
// Auth: every API call signs the JSON body with md5(base64(body)+api_key).
// Webhook payloads carry their own `sign` field that we verify the same
// way (with the sign field removed before re-serialising).
//
// MD5 implementation is inlined because Web Crypto in Workers doesn't
// expose MD5 reliably across all runtimes.

// ─────────────────────────────────────────────────────────────────
// MD5 — pure JS, public domain reference (RFC 1321)
// ─────────────────────────────────────────────────────────────────
function md5(str) {
  function safeAdd(x, y) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }
  function rol(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
  function cmn(q, a, b, x, s, t) {
    return safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

  function cycle(x, k) {
    let [a, b, c, d] = x;
    a = ff(a, b, c, d, k[0], 7, -680876936);  d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17,  606105819);  b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);   d = ff(d, a, b, c, k[5], 12,  1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22,  -45705983);
    a = ff(a, b, c, d, k[8], 7,  1770035416);  d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);     b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7,  1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);   d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);  b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);   d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);  b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);  b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);      d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);  d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);  b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);   d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);  b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);   d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);  b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);   d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);  d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);   b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);   d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);   d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);   b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = safeAdd(a, x[0]); x[1] = safeAdd(b, x[1]);
    x[2] = safeAdd(c, x[2]); x[3] = safeAdd(d, x[3]);
  }

  function md5blk(s) {
    const blks = [];
    for (let i = 0; i < 64; i += 4) {
      blks[i >> 2] = s.charCodeAt(i)
        + (s.charCodeAt(i + 1) << 8)
        + (s.charCodeAt(i + 2) << 16)
        + (s.charCodeAt(i + 3) << 24);
    }
    return blks;
  }

  function md51(s) {
    const n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    for (i = 64; i <= s.length; i += 64) {
      cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++) {
      tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    }
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    cycle(state, tail);
    return state;
  }

  function rhex(n) {
    const HEX = '0123456789abcdef';
    let s = '';
    for (let j = 0; j < 4; j++) {
      s += HEX.charAt((n >> (j * 8 + 4)) & 0x0f) + HEX.charAt((n >> (j * 8)) & 0x0f);
    }
    return s;
  }
  function hex(x) { return rhex(x[0]) + rhex(x[1]) + rhex(x[2]) + rhex(x[3]); }

  // Convert UTF-8 string to byte string (Latin-1 representation of bytes)
  function utf8(s) {
    const bytes = new TextEncoder().encode(s);
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  return hex(md51(utf8(str)));
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function base64Encode(str) {
  // btoa works on Latin-1 strings; convert UTF-8 first.
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function signString(jsonStr, apiKey) {
  return md5(base64Encode(jsonStr) + apiKey);
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Create a Cryptomus invoice and get a hosted checkout URL.
 *
 * @param {object} opts
 * @param {string} opts.merchantId  Cryptomus merchant UUID
 * @param {string} opts.apiKey      Cryptomus payment API key
 * @param {number|string} opts.amount      USD amount, e.g. 39
 * @param {string} opts.orderId     unique order id we generate
 * @param {string} opts.urlCallback https://.../api/cryptomus-webhook
 * @param {string} opts.urlSuccess  where to send customer after successful payment
 * @param {string} opts.urlReturn   where to send customer if they cancel
 * @param {string} opts.customerUrl  the website URL the customer wants audited
 * @param {string} opts.customerEmail where to deliver the report
 * @param {string} [opts.toCurrency='USDT'] payout currency we receive
 * @returns {Promise<{uuid:string, orderId:string, url:string, expiredAt:string}>}
 */
export async function createInvoice(opts) {
  const {
    merchantId, apiKey, amount, orderId,
    urlCallback, urlSuccess, urlReturn,
    customerUrl, customerEmail,
    toCurrency = 'USDT',
  } = opts;

  if (!merchantId || !apiKey) {
    throw new Error('Cryptomus credentials missing: CRYPTOMUS_MERCHANT_ID + CRYPTOMUS_API_KEY required.');
  }

  const body = {
    amount: String(amount),
    currency: 'USD',
    order_id: orderId,
    url_callback: urlCallback,
    url_return: urlReturn,
    url_success: urlSuccess,
    lifetime: 7200,
    to_currency: toCurrency,
    additional_data: JSON.stringify({ audit_url: customerUrl, email: customerEmail }),
  };

  const jsonBody = JSON.stringify(body);
  const sign = signString(jsonBody, apiKey);

  const resp = await fetch('https://api.cryptomus.com/v1/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      merchant: merchantId,
      sign,
    },
    body: jsonBody,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Cryptomus API ${resp.status}: ${text.slice(0, 400)}`);
  }
  const data = await resp.json();
  if (data.state !== 0 || !data.result) {
    throw new Error(`Cryptomus invoice creation failed: ${JSON.stringify(data).slice(0, 400)}`);
  }

  return {
    uuid: data.result.uuid,
    orderId: data.result.order_id,
    url: data.result.url,
    expiredAt: data.result.expired_at,
  };
}

/**
 * Verifies the `sign` field in an incoming Cryptomus webhook body.
 * Returns true if the signature is valid.
 *
 * Cryptomus sends a JSON body that includes a `sign` field; we recompute
 * the hash over the body minus that field and compare.
 */
export function verifyWebhookSign(rawBody, apiKey) {
  if (!rawBody || !apiKey) return false;
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const sentSign = parsed && parsed.sign;
  if (typeof sentSign !== 'string') return false;
  delete parsed.sign;
  const computed = signString(JSON.stringify(parsed), apiKey);
  return computed === sentSign;
}

/**
 * Generates a unique order id (no PII).
 */
export function newOrderId(prefix = 'sxa') {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${ts}-${rnd}`;
}
