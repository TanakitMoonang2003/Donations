const multer = require("multer");
const path = require("path");

const allowedMimeTypes = new Set(["image/jpeg", "image/png"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    if (
      !allowedMimeTypes.has(file.mimetype) ||
      !allowedExtensions.has(extension)
    ) {
      const error = new Error("อัปโหลดได้เฉพาะไฟล์ JPG หรือ PNG");
      error.statusCode = 415;
      return callback(error);
    }

    callback(null, true);
  },
});

function uploadSlip(req, res, next) {
  upload.single("slip")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MB",
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Slip upload failed:", error.message);
    return res.status(400).json({ message: "อัปโหลดรูปสลิปไม่สำเร็จ" });
  });
}

module.exports = uploadSlip;
