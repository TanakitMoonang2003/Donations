const generatePayload = require("promptpay-qr");
const QRCode = require("qrcode");

/**
 * สร้าง payload PromptPay ที่มียอดเงินฝังอยู่ แล้วแปลงเป็น Data URL (รูป PNG base64)
 */
async function generatePromptPayQrDataUrl(promptPayId, amount) {
  const payload = generatePayload(promptPayId, { amount });
  const qrDataUrl = await QRCode.toDataURL(payload, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return { payload, qrDataUrl };
}

module.exports = generatePromptPayQrDataUrl;
