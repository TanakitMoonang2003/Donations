const multer = require("multer");
const path = require("path");
const {
  ALLOWED_EXTENSIONS,
  UPLOAD_DIR,
  ensureUploadDir,
} = require("../utils/alertSoundFiles");

const allowedMimeTypes = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/x-m4a",
]);

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    ensureUploadDir()
      .then(() => callback(null, UPLOAD_DIR))
      .catch((error) => callback(error));
  },
  filename(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeExtension = ALLOWED_EXTENSIONS.has(extension) ? extension : ".mp3";
    callback(null, `pending-${Date.now()}${safeExtension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (
      !allowedMimeTypes.has(file.mimetype) &&
      !ALLOWED_EXTENSIONS.has(extension)
    ) {
      const error = new Error("อัปโหลดได้เฉพาะไฟล์เสียง MP3, WAV, OGG, WEBM หรือ M4A");
      error.statusCode = 415;
      return callback(error);
    }
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      const error = new Error("นามสกุลไฟล์เสียงไม่รองรับ");
      error.statusCode = 415;
      return callback(error);
    }
    callback(null, true);
  },
});

function uploadAlertSound(req, res, next) {
  upload.single("sound")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "ไฟล์เสียงต้องมีขนาดไม่เกิน 8 MB",
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Alert sound upload failed:", error.message);
    return res.status(400).json({ message: "อัปโหลดไฟล์เสียงไม่สำเร็จ" });
  });
}

module.exports = uploadAlertSound;
