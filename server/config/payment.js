const { DEFAULT_STREAMER_ID } = require("./streamer");

/**
 * อ่านค่าจาก .env ผ่าน dotenv (เรียก require('dotenv').config() ใน server.js แล้ว)
 * process.env จึงมี PROMPTPAY_ID, DONATION_MIN_AMOUNT ฯลฯ
 */
function readNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

const DONATION_MIN_AMOUNT = readNumberEnv("DONATION_MIN_AMOUNT", 1);
const DONATION_MAX_AMOUNT = readNumberEnv("DONATION_MAX_AMOUNT", 50000);

/**
 * เลขพร้อมเพย์ตามสตรีมเมอร์
 * ตอนนี้: PROMPTPAY_ID ใน .env
 * อนาคต: PROMPTPAY_ID_<STREAMER_ID> เช่น PROMPTPAY_ID_DEFAULT
 */
function readEnvString(name) {
  const value = process.env[name];
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getPromptPayIdForStreamer(streamerId = DEFAULT_STREAMER_ID) {
  // single-user: ใช้ PROMPTPAY_ID เป็นหลัก
  if (streamerId === DEFAULT_STREAMER_ID) {
    const mainId = readEnvString("PROMPTPAY_ID");
    if (mainId) {
      return mainId;
    }
  }

  const envKey = `PROMPTPAY_ID_${String(streamerId)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")}`;

  const perStreamer = readEnvString(envKey);
  if (perStreamer) {
    return perStreamer;
  }

  return readEnvString("PROMPTPAY_ID");
}

function getStreamerDisplayName(streamerId = DEFAULT_STREAMER_ID) {
  const envKey = `STREAMER_NAME_${String(streamerId)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")}`;

  if (process.env[envKey]) {
    return process.env[envKey];
  }

  return process.env.STREAMER_NAME || "สตรีมเมอร์";
}

module.exports = {
  DONATION_MIN_AMOUNT,
  DONATION_MAX_AMOUNT,
  getPromptPayIdForStreamer,
  getStreamerDisplayName,
};
