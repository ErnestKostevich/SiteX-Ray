// On-chain USDT payment verification (TRC-20 + ERC-20).
// Uses public APIs — no third-party payment processor.

export const PRICE_USDT = 39;
export const PRICE_USDT_RAW = 39_000_000; // 6 decimals

export const NETWORKS = {
  trc20: {
    id: "trc20",
    label: "USDT · TRON (TRC-20)",
    address: "TV1EBHTyvpP98jZGerz6sRmZvipn15LqDA",
    usdtContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    explorer: "https://tronscan.org/#/transaction/",
  },
  erc20: {
    id: "erc20",
    label: "USDT · Ethereum (ERC-20)",
    address: "0x9339686861079c781e0249ee64a509F893E2367c",
    usdtContract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    explorer: "https://etherscan.io/tx/",
  },
};

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function normalizeTxHash(hash, network) {
  const h = String(hash || "").trim();
  if (network === "erc20") {
    if (!/^0x[a-fA-F0-9]{64}$/.test(h)) {
      throw new Error("Invalid Ethereum tx hash (expected 0x + 64 hex chars)");
    }
    return h.toLowerCase();
  }
  if (!/^[a-fA-F0-9]{64}$/.test(h)) {
    throw new Error("Invalid TRON tx hash (expected 64 hex chars)");
  }
  return h.toLowerCase();
}

function padEthAddress(addr) {
  const a = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + a.padStart(40, "0");
}

async function cacheKey(network, txHash) {
  return `https://sitexray.internal/tx/${network}/${txHash}`;
}

export async function isTxAlreadyUsed(network, txHash) {
  const hit = await caches.default.match(await cacheKey(network, txHash));
  return !!hit;
}

export async function markTxUsed(network, txHash) {
  await caches.default.put(
    await cacheKey(network, txHash),
    new Response("1", { status: 200 }),
    { expirationTtl: 60 * 60 * 24 * 30 }
  );
}

async function ethRpc(method, params) {
  const res = await fetch("https://eth.llamarpc.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "Ethereum RPC error");
  return json.result;
}

async function verifyTrc20(txHash) {
  const net = NETWORKS.trc20;
  let timestamp = null;
  let amount = null;
  let toAddress = null;

  const scanRes = await fetch(
    `https://apilist.tronscanapi.com/api/transaction-info?hash=${encodeURIComponent(txHash)}`
  );
  if (scanRes.ok) {
    const data = await scanRes.json();
    timestamp = Number(data.timestamp) || null;
    const transfers = data.trc20TransferInfo || data.trc20Transfer || [];
    for (const t of transfers) {
      const contract = (t.contract_address || t.tokenInfo?.tokenId || "").toLowerCase();
      const symbol = (t.symbol || t.tokenInfo?.tokenAbbr || "").toUpperCase();
      const to = t.to_address || t.to;
      const amt = Number(t.amount_str || t.amount || 0);
      if (
        (contract === net.usdtContract.toLowerCase() || symbol === "USDT") &&
        to &&
        to.toLowerCase() === net.address.toLowerCase()
      ) {
        toAddress = to;
        amount = amt;
        break;
      }
    }
  }

  if (!amount) {
    const evRes = await fetch(
      `https://api.trongrid.io/v1/transactions/${txHash}/events`
    );
    if (evRes.ok) {
      const evData = await evRes.json();
      for (const ev of evData.data || []) {
        if (ev.contract_address !== net.usdtContract) continue;
        const to = ev.result?.to || ev.result?.["1"];
        const raw = ev.result?.value || ev.result?.["2"];
        if (to && to.toLowerCase() === net.address.toLowerCase() && raw) {
          toAddress = to;
          amount = Number(raw);
        }
      }
      if (!timestamp && evData.data?.[0]?.block_timestamp) {
        timestamp = Number(evData.data[0].block_timestamp);
      }
    }
  }

  if (!amount || amount < PRICE_USDT_RAW) {
    throw new Error(
      `Payment not found or amount too low. Send exactly ${PRICE_USDT} USDT to ${net.address}`
    );
  }
  if (!timestamp) throw new Error("Could not read transaction timestamp");

  return { amount, timestamp, toAddress: toAddress || net.address, network: "trc20" };
}

async function verifyErc20(txHash) {
  const net = NETWORKS.erc20;
  const receipt = await ethRpc("eth_getTransactionReceipt", [txHash]);
  if (!receipt || receipt.status !== "0x1") {
    throw new Error("Transaction not found or failed on Ethereum");
  }

  const target = net.address.toLowerCase();
  const targetTopic = "0x" + "0".repeat(24) + target.slice(2);

  let amount = null;
  for (const log of receipt.logs || []) {
    if (log.address?.toLowerCase() !== net.usdtContract.toLowerCase()) continue;
    if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    const toTopic = log.topics[2]?.toLowerCase();
    if (toTopic !== targetTopic && toTopic !== padEthAddress(target).toLowerCase()) continue;
    amount = parseInt(log.data, 16);
    break;
  }

  if (!amount || amount < PRICE_USDT_RAW) {
    throw new Error(
      `Payment not found or amount too low. Send exactly ${PRICE_USDT} USDT to ${net.address}`
    );
  }

  const block = await ethRpc("eth_getBlockByNumber", [receipt.blockNumber, false]);
  const timestamp = parseInt(block.timestamp, 16) * 1000;

  return { amount, timestamp, toAddress: net.address, network: "erc20" };
}

export async function verifyUsdtPayment(network, txHashRaw) {
  const networkId = String(network || "").toLowerCase();
  if (!NETWORKS[networkId]) {
    throw new Error("Invalid network. Use trc20 or erc20");
  }

  const txHash = normalizeTxHash(txHashRaw, networkId);

  if (await isTxAlreadyUsed(networkId, txHash)) {
    throw new Error("This transaction hash was already used for an audit");
  }

  const result =
    networkId === "trc20"
      ? await verifyTrc20(txHash)
      : await verifyErc20(txHash);

  const age = Date.now() - result.timestamp;
  if (age > MAX_AGE_MS) {
    throw new Error("Payment must be from the last 24 hours");
  }
  if (age < -5 * 60 * 1000) {
    throw new Error("Transaction timestamp is in the future");
  }

  return { ...result, txHash, network: networkId };
}