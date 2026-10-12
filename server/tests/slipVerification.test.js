const assert = require("node:assert/strict");
const test = require("node:test");
const QRCode = require("qrcode");
const sharp = require("sharp");
const { buildSlipVerify } = require("thai-qr-payment");
const extractSlipReference = require("../utils/extractSlipReference");
const readSlipQr = require("../utils/readSlipQr");

test("extracts a reference from a Thai bank Slip Verify TLV QR", () => {
  const payload = buildSlipVerify({
    sendingBank: "002",
    transRef: "0002123123121200011",
  });
  assert.equal(extractSlipReference(payload), "002:0002123123121200011");
});

test("extracts a transaction reference from a slip verification URL", () => {
  assert.equal(
    extractSlipReference(
      "https://bank.example/verify?transRef=TXN-2026-000123&status=success"
    ),
    "TXN-2026-000123"
  );
});

test("extracts a reference from nested JSON", () => {
  assert.equal(
    extractSlipReference(
      JSON.stringify({ result: { transactionReference: "BANKREF98765" } })
    ),
    "BANKREF98765"
  );
});

test("does not guess a reference from an unrelated QR payload", () => {
  assert.equal(extractSlipReference("PromptPay recipient 0812345678"), null);
});

test("reads a QR from an in-memory PNG slip", async () => {
  const expected = "https://bank.example/slip?transactionId=TXN123456";
  const png = await QRCode.toBuffer(expected, { type: "png" });

  assert.equal(await readSlipQr(png), expected);
});

test("returns null when an image contains no QR", async () => {
  const image = await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: "#ffffff",
    },
  })
    .png()
    .toBuffer();

  assert.equal(await readSlipQr(image), null);
});

test("rejects unsupported image formats", async () => {
  const image = await sharp({
    create: {
      width: 20,
      height: 20,
      channels: 4,
      background: "#ffffff",
    },
  })
    .webp()
    .toBuffer();

  await assert.rejects(readSlipQr(image), {
    message: "ไฟล์ต้องเป็นรูป JPG หรือ PNG",
    statusCode: 415,
  });
});
