const { parseSlipVerify, parseTrueMoneySlipVerify } = require("thai-qr-payment");

const REFERENCE_KEYS = new Set([
  "ref",
  "reference",
  "transactionref",
  "transactionreference",
  "transactionid",
  "transref",
  "transid",
  "transactionno",
  "rrn",
  "traceid",
]);

function normalizeReference(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const reference = String(value).trim();
  if (reference.length < 4 || reference.length > 200) {
    return null;
  }

  return reference;
}

function findReferenceInObject(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const reference = findReferenceInObject(item);
      if (reference) return reference;
    }
    return null;
  }

  for (const [key, fieldValue] of Object.entries(value)) {
    if (REFERENCE_KEYS.has(key.toLowerCase())) {
      const reference = normalizeReference(fieldValue);
      if (reference) return reference;
    }
  }

  for (const fieldValue of Object.values(value)) {
    const reference = findReferenceInObject(fieldValue);
    if (reference) return reference;
  }

  return null;
}

/** สลิปโอนเงินไทย (QR เล็กบนสลิป) — รูปแบบ EMVCo TLV ตามมาตรฐาน Slip Verify / TrueMoney */
function extractThaiSlipVerifyReference(text) {
  const bankSlip = parseSlipVerify(text);
  if (bankSlip) {
    return normalizeReference(`${bankSlip.sendingBank}:${bankSlip.transRef}`);
  }

  const trueMoneySlip = parseTrueMoneySlipVerify(text);
  if (trueMoneySlip) {
    return normalizeReference(
      `truemoney:${trueMoneySlip.transactionId}:${trueMoneySlip.date}`
    );
  }

  return null;
}

function extractSlipReference(payload) {
  if (typeof payload !== "string" || !payload.trim()) {
    return null;
  }

  const text = payload.trim();

  const thaiSlipRef = extractThaiSlipVerifyReference(text);
  if (thaiSlipRef) return thaiSlipRef;

  try {
    const reference = findReferenceInObject(JSON.parse(text));
    if (reference) return reference;
  } catch {
    // QR payloads are often URLs or provider-specific text rather than JSON.
  }

  try {
    const url = new URL(text);
    for (const [key, value] of url.searchParams) {
      if (REFERENCE_KEYS.has(key.toLowerCase())) {
        const reference = normalizeReference(value);
        if (reference) return reference;
      }
    }
  } catch {
    // Continue with key/value text commonly used in QR payloads.
  }

  const keys = [...REFERENCE_KEYS].join("|");
  const match = text.match(
    new RegExp(`(?:^|[?&#,;\\s])(?:${keys})["']?\\s*[:=]\\s*["']?([^&;,\\s"'<>]+)`, "i")
  );

  return match ? normalizeReference(match[1]) : null;
}

module.exports = extractSlipReference;
