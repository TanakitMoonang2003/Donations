const jsQR = require("jsqr");
const sharp = require("sharp");

const MAX_IMAGE_PIXELS = 16_000_000;
const MAX_IMAGE_DIMENSION = 2400;

async function readSlipQr(imageBuffer) {
  const input = sharp(imageBuffer, {
    failOn: "error",
    limitInputPixels: MAX_IMAGE_PIXELS,
  });
  const metadata = await input.metadata();

  if (!["jpeg", "png"].includes(metadata.format)) {
    const error = new Error("ไฟล์ต้องเป็นรูป JPG หรือ PNG");
    error.statusCode = 415;
    throw error;
  }

  const { data, info } = await sharp(imageBuffer, {
    failOn: "error",
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(
    data.buffer,
    data.byteOffset,
    data.byteLength
  );
  const code = jsQR(pixels, info.width, info.height, {
    inversionAttempts: "attemptBoth",
  });

  return code ? code.data : null;
}

module.exports = readSlipQr;
