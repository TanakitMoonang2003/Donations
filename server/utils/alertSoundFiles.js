const fs = require("fs/promises");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "alert-sounds");
const SOUND_URL_PREFIX = "/api/uploads/alert-sounds/";
const ALLOWED_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".webm", ".m4a"]);

function isValidStoredSoundUrl(value) {
  if (value === "") return true;
  if (typeof value !== "string" || value.length > 500) return false;
  if (!value.startsWith(SOUND_URL_PREFIX)) return false;
  const filename = value.slice(SOUND_URL_PREFIX.length);
  if (!filename || filename.includes("/") || filename.includes("..")) return false;
  const extension = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension);
}

function soundUrlFromFilename(filename) {
  return `${SOUND_URL_PREFIX}${filename}`;
}

function filePathFromSoundUrl(soundUrl) {
  if (!isValidStoredSoundUrl(soundUrl)) return null;
  const filename = soundUrl.slice(SOUND_URL_PREFIX.length);
  return path.join(UPLOAD_DIR, filename);
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function deleteStoredSound(soundUrl) {
  const filePath = filePathFromSoundUrl(soundUrl);
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

module.exports = {
  ALLOWED_EXTENSIONS,
  UPLOAD_DIR,
  SOUND_URL_PREFIX,
  deleteStoredSound,
  ensureUploadDir,
  filePathFromSoundUrl,
  isValidStoredSoundUrl,
  soundUrlFromFilename,
};
