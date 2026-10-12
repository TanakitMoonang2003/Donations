const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const OverlaySettings = require("../models/OverlaySettings");
const { DEFAULT_STREAMER_ID } = require("../config/streamer");
const requireOwner = require("../middleware/requireOwner");
const uploadAlertSound = require("../middleware/uploadAlertSound");
const {
  publishAlert,
  publishSettingsUpdated,
  revokeOverlayToken,
} = require("../services/overlayEvents");
const { getPaidDonationTotal } = require("../services/donationTotals");
const {
  deleteStoredSound,
  isValidStoredSoundUrl,
  soundUrlFromFilename,
} = require("../utils/alertSoundFiles");
const fs = require("fs/promises");
const path = require("path");

const router = express.Router();
const COOKIE_NAME = "dome_owner";
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000;
const FONT_CHOICES = new Set([
  "system-ui, sans-serif",
  "Arial, sans-serif",
  "Georgia, serif",
  "monospace",
]);
const ENTER_ANIMATIONS = new Set(["fade", "slide-up", "pop", "none"]);
const EXIT_ANIMATIONS = new Set(["fade", "slide-down", "shrink", "none"]);
const SETTING_FIELDS = [
  "backgroundColor",
  "textColor",
  "fontFamily",
  "fontSize",
  "messageTemplate",
  "mediaUrl",
  "soundUrl",
  "speechEnabled",
  "speechTemplate",
  "speechRate",
  "duration",
  "enterAnimation",
  "exitAnimation",
  "minimumAmount",
  "goalTitle",
  "goalTarget",
  "goalDeadline",
  "goalPosition",
  "goalFillColor",
  "goalTrackColor",
];

const GOAL_POSITIONS = new Set(["left", "right"]);

function configuredSecret() {
  return process.env.OWNER_JWT_SECRET;
}

function passwordMatches(provided, expected) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

async function getOrCreateSettings(streamerId) {
  const settings = await OverlaySettings.findOneAndUpdate(
    { streamerId },
    {
      $setOnInsert: {
        streamerId,
        overlayToken: crypto.randomBytes(32).toString("hex"),
      },
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );

  return settings;
}

function toOwnerResponse(settings, requestOrigin, goalCurrent) {
  const result = settings.toObject();
  result.overlayPath = `/overlay/${settings.overlayToken}`;
  result.overlayUrl = `${requestOrigin}${result.overlayPath}`;
  result.goalOverlayPath = `/overlay/${settings.overlayToken}/goal`;
  result.goalOverlayUrl = `${requestOrigin}${result.goalOverlayPath}`;
  result.soundUrl = isValidStoredSoundUrl(result.soundUrl) ? result.soundUrl : "";
  if (result.speechEnabled === undefined) result.speechEnabled = true;
  if (!result.speechTemplate) {
    result.speechTemplate = "{name} บริจาค {amount} บาท {message}";
  }
  if (result.speechRate === undefined) result.speechRate = 1;
  if (!result.goalTitle) result.goalTitle = "เป้าหมายโดเนท";
  if (result.goalTarget === undefined) result.goalTarget = 10000;
  if (!GOAL_POSITIONS.has(result.goalPosition)) result.goalPosition = "right";
  if (!result.goalFillColor) result.goalFillColor = "#7ad7a9";
  if (!result.goalTrackColor) result.goalTrackColor = "#3a3a52";
  if (goalCurrent !== undefined) result.goalCurrent = goalCurrent;
  return result;
}

async function enrichOwnerSettings(settings, origin) {
  const goalCurrent = await getPaidDonationTotal(settings.streamerId);
  return toOwnerResponse(settings, origin, goalCurrent);
}

async function publishPublicSettings(streamerId, settings) {
  const goalCurrent = await getPaidDonationTotal(streamerId);
  publishSettingsUpdated(streamerId, toPublicSettings(settings, goalCurrent));
}

function toPublicSettings(settings, goalCurrent = 0) {
  return {
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    messageTemplate: settings.messageTemplate,
    mediaUrl: settings.mediaUrl,
    soundUrl: settings.soundUrl,
    speechEnabled: settings.speechEnabled !== false,
    speechTemplate: settings.speechTemplate,
    speechRate: settings.speechRate ?? 1,
    duration: settings.duration,
    enterAnimation: settings.enterAnimation,
    exitAnimation: settings.exitAnimation,
    goalTitle: settings.goalTitle || "เป้าหมายโดเนท",
    goalTarget: settings.goalTarget ?? 10000,
    goalDeadline: settings.goalDeadline ?? null,
    goalPosition: GOAL_POSITIONS.has(settings.goalPosition) ? settings.goalPosition : "right",
    goalFillColor: settings.goalFillColor || "#7ad7a9",
    goalTrackColor: settings.goalTrackColor || "#3a3a52",
    goalCurrent,
  };
}

function isValidAssetUrl(value) {
  if (value === "") return true;
  if (typeof value !== "string" || value.length > 500) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validateSettings(body) {
  const errors = [];
  const settings = {};

  for (const field of ["backgroundColor", "textColor"]) {
    if (
      typeof body[field] !== "string" ||
      !/^#[0-9a-fA-F]{6}$/.test(body[field])
    ) {
      errors.push(`${field} ต้องเป็นสี HEX รูปแบบ #RRGGBB`);
    } else {
      settings[field] = body[field];
    }
  }

  if (!FONT_CHOICES.has(body.fontFamily)) {
    errors.push("fontFamily ไม่อยู่ในรายการฟอนต์ที่รองรับ");
  } else {
    settings.fontFamily = body.fontFamily;
  }

  if (!Number.isInteger(body.fontSize) || body.fontSize < 12 || body.fontSize > 96) {
    errors.push("fontSize ต้องเป็นจำนวนเต็มระหว่าง 12 ถึง 96");
  } else {
    settings.fontSize = body.fontSize;
  }

  if (
    typeof body.messageTemplate !== "string" ||
    body.messageTemplate.trim().length === 0 ||
    body.messageTemplate.length > 200
  ) {
    errors.push("messageTemplate ต้องมีความยาว 1 ถึง 200 ตัวอักษร");
  } else {
    settings.messageTemplate = body.messageTemplate;
  }

  const mediaValue = body.mediaUrl ?? "";
  if (!isValidAssetUrl(mediaValue)) {
    errors.push("mediaUrl ต้องเป็น URL http หรือ https ที่ถูกต้อง");
  } else {
    settings.mediaUrl = mediaValue;
  }

  const soundValue = body.soundUrl ?? "";
  if (!isValidStoredSoundUrl(soundValue)) {
    errors.push("soundUrl ต้องว่างหรือเป็นไฟล์ที่อัปโหลดผ่านระบบเท่านั้น");
  } else {
    settings.soundUrl = soundValue;
  }

  if (typeof body.speechEnabled !== "boolean") {
    errors.push("speechEnabled ต้องเป็น true หรือ false");
  } else {
    settings.speechEnabled = body.speechEnabled;
  }

  if (
    typeof body.speechTemplate !== "string" ||
    body.speechTemplate.trim().length === 0 ||
    body.speechTemplate.length > 300
  ) {
    errors.push("speechTemplate ต้องมีความยาว 1 ถึง 300 ตัวอักษร");
  } else {
    settings.speechTemplate = body.speechTemplate.trim();
  }

  if (
    typeof body.speechRate !== "number" ||
    !Number.isFinite(body.speechRate) ||
    body.speechRate < 0.5 ||
    body.speechRate > 2
  ) {
    errors.push("speechRate ต้องอยู่ระหว่าง 0.5 ถึง 2");
  } else {
    settings.speechRate = body.speechRate;
  }

  if (!Number.isInteger(body.duration) || body.duration < 1 || body.duration > 20) {
    errors.push("duration ต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 20 วินาที");
  } else {
    settings.duration = body.duration;
  }

  if (!ENTER_ANIMATIONS.has(body.enterAnimation)) {
    errors.push("enterAnimation ไม่อยู่ในรายการแอนิเมชันที่รองรับ");
  } else {
    settings.enterAnimation = body.enterAnimation;
  }

  if (!EXIT_ANIMATIONS.has(body.exitAnimation)) {
    errors.push("exitAnimation ไม่อยู่ในรายการแอนิเมชันที่รองรับ");
  } else {
    settings.exitAnimation = body.exitAnimation;
  }

  if (
    typeof body.minimumAmount !== "number" ||
    !Number.isFinite(body.minimumAmount) ||
    body.minimumAmount < 0 ||
    body.minimumAmount > 50000
  ) {
    errors.push("minimumAmount ต้องอยู่ระหว่าง 0 ถึง 50000 บาท");
  } else {
    settings.minimumAmount = body.minimumAmount;
  }

  if (
    typeof body.goalTitle !== "string" ||
    body.goalTitle.trim().length === 0 ||
    body.goalTitle.length > 80
  ) {
    errors.push("goalTitle ต้องมีความยาว 1 ถึง 80 ตัวอักษร");
  } else {
    settings.goalTitle = body.goalTitle.trim();
  }

  if (
    typeof body.goalTarget !== "number" ||
    !Number.isFinite(body.goalTarget) ||
    body.goalTarget < 1 ||
    body.goalTarget > 10000000
  ) {
    errors.push("goalTarget ต้องอยู่ระหว่าง 1 ถึง 10,000,000 บาท");
  } else {
    settings.goalTarget = body.goalTarget;
  }

  if (body.goalDeadline === null || body.goalDeadline === "") {
    settings.goalDeadline = null;
  } else if (
    typeof body.goalDeadline !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(body.goalDeadline) ||
    !Number.isFinite(Date.parse(body.goalDeadline)) ||
    new Date(body.goalDeadline).toISOString() !== body.goalDeadline
  ) {
    errors.push("goalDeadline ต้องเป็นวันและเวลาที่ถูกต้อง หรือเว้นว่าง");
  } else {
    settings.goalDeadline = new Date(body.goalDeadline);
  }

  if (!GOAL_POSITIONS.has(body.goalPosition)) {
    errors.push("goalPosition ต้องเป็น left หรือ right");
  } else {
    settings.goalPosition = body.goalPosition;
  }

  for (const field of ["goalFillColor", "goalTrackColor"]) {
    if (typeof body[field] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(body[field])) {
      errors.push(`${field} ต้องเป็นสี HEX รูปแบบ #RRGGBB`);
    } else {
      settings[field] = body[field];
    }
  }

  return { errors, settings };
}

router.post("/login", (req, res) => {
  const ownerPassword = process.env.OWNER_PASSWORD;
  const jwtSecret = configuredSecret();

  if (!ownerPassword || !jwtSecret || jwtSecret.length < 32) {
    return res.status(503).json({
      message:
        "กรุณาตั้งค่า OWNER_PASSWORD และ OWNER_JWT_SECRET (อย่างน้อย 32 ตัวอักษร) ใน server/.env",
    });
  }

  if (
    typeof req.body?.password !== "string" ||
    !passwordMatches(req.body.password, ownerPassword)
  ) {
    return res.status(401).json({ message: "รหัสผ่านเจ้าของไม่ถูกต้อง" });
  }

  const token = jwt.sign(
    { streamerId: DEFAULT_STREAMER_ID },
    jwtSecret,
    { algorithm: "HS256", subject: "owner", expiresIn: "8h" }
  );

  return res
    .cookie(COOKIE_NAME, token, cookieOptions())
    .json({ message: "เข้าสู่ระบบเจ้าของแล้ว" });
});

router.post("/logout", (_req, res) => {
  return res
    .clearCookie(COOKIE_NAME, cookieOptions())
    .json({ message: "ออกจากระบบแล้ว" });
});

router.get("/session", requireOwner, (req, res) => {
  res.json({ loggedIn: true, streamerId: req.owner.streamerId });
});

router.get("/settings", requireOwner, async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.owner.streamerId);
    res.json({ settings: await enrichOwnerSettings(settings, req.get("Origin") || "") });
  } catch (error) {
    console.error("GET /api/owner/settings error:", error.message);
    res.status(500).json({ message: "โหลดการตั้งค่า Alert ไม่สำเร็จ" });
  }
});

router.put("/settings", requireOwner, async (req, res) => {
  const { errors, settings: validatedSettings } = validateSettings(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ message: "ข้อมูลการตั้งค่าไม่ถูกต้อง", errors });
  }

  try {
    const settings = await getOrCreateSettings(req.owner.streamerId);
    for (const field of SETTING_FIELDS) {
      settings[field] = validatedSettings[field];
    }
    await settings.save();
    await publishPublicSettings(req.owner.streamerId, settings);

    return res.json({
      message: "บันทึกการตั้งค่าแล้ว",
      settings: await enrichOwnerSettings(settings, req.get("Origin") || ""),
    });
  } catch (error) {
    console.error("PUT /api/owner/settings error:", error.message);
    return res.status(500).json({ message: "บันทึกการตั้งค่า Alert ไม่สำเร็จ" });
  }
});

router.post("/alert-sound", requireOwner, uploadAlertSound, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "กรุณาเลือกไฟล์เสียง" });
  }

  let finalPath;
  let settingsSaved = false;
  try {
    const settings = await getOrCreateSettings(req.owner.streamerId);
    const previousSoundUrl = settings.soundUrl;
    const extension = path.extname(req.file.originalname).toLowerCase();
    const finalName = `${crypto.randomUUID()}${extension}`;
    finalPath = path.join(req.file.destination, finalName);

    await fs.rename(req.file.path, finalPath);

    settings.soundUrl = soundUrlFromFilename(finalName);
    await settings.save();
    settingsSaved = true;
    await publishPublicSettings(req.owner.streamerId, settings);

    let message = "อัปโหลดเสียงแจ้งเตือนแล้ว";
    try {
      await deleteStoredSound(previousSoundUrl);
    } catch (cleanupError) {
      console.error("Could not remove replaced alert sound:", cleanupError.message);
      message = "อัปโหลดเสียงใหม่แล้ว แต่ลบไฟล์เสียงเดิมไม่สำเร็จ";
    }

    return res.json({
      message,
      settings: await enrichOwnerSettings(settings, req.get("Origin") || ""),
    });
  } catch (error) {
    console.error("POST /api/owner/alert-sound error:", error.message);
    if (!settingsSaved) {
      for (const filePath of [req.file.path, finalPath]) {
        if (!filePath) continue;
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          if (cleanupError.code !== "ENOENT") {
            console.error("Could not clean up failed alert sound:", cleanupError.message);
          }
        }
      }
    }
    return res.status(500).json({ message: "อัปโหลดไฟล์เสียงไม่สำเร็จ" });
  }
});

router.delete("/alert-sound", requireOwner, async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.owner.streamerId);
    await deleteStoredSound(settings.soundUrl);
    settings.soundUrl = "";
    await settings.save();
    await publishPublicSettings(req.owner.streamerId, settings);

    return res.json({
      message: "ลบเสียงแจ้งเตือนแล้ว",
      settings: await enrichOwnerSettings(settings, req.get("Origin") || ""),
    });
  } catch (error) {
    console.error("DELETE /api/owner/alert-sound error:", error.message);
    return res.status(500).json({ message: "ลบไฟล์เสียงไม่สำเร็จ" });
  }
});

router.post("/overlay-token/rotate", requireOwner, async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.owner.streamerId);
    const previousToken = settings.overlayToken;
    settings.overlayToken = crypto.randomBytes(32).toString("hex");
    await settings.save();
    revokeOverlayToken(previousToken);
    return res.json({
      message: "สร้างลิงก์ใหม่แล้ว ลิงก์เดิมใช้ไม่ได้อีกต่อไป",
      settings: await enrichOwnerSettings(settings, req.get("Origin") || ""),
    });
  } catch (error) {
    console.error("POST /api/owner/overlay-token/rotate error:", error.message);
    return res.status(500).json({ message: "สร้างลิงก์ Overlay ใหม่ไม่สำเร็จ" });
  }
});

router.post("/test-alert", requireOwner, async (req, res) => {
  const name =
    typeof req.body?.name === "string" && req.body.name.trim()
      ? req.body.name.trim().slice(0, 50)
      : "ผู้สนับสนุนตัวอย่าง";
  const amount = Number(req.body?.amount ?? 100);

  if (!Number.isFinite(amount) || amount < 0 || amount > 50000) {
    return res.status(400).json({ message: "ยอดทดสอบต้องอยู่ระหว่าง 0 ถึง 50000 บาท" });
  }

  const message =
    typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 300) : "สู้ๆ นะ!";

  const delivered = publishAlert(req.owner.streamerId, {
    name,
    amount,
    message,
  });
  if (delivered === 0) {
    return res.status(409).json({
      message: "ไม่พบ Overlay ที่เชื่อมต่ออยู่ กรุณาเปิดหรือรีเฟรช Browser Source ใน OBS แล้วลองอีกครั้ง",
    });
  }
  return res.json({ message: "ส่ง Test Alert ไปยัง Overlay แล้ว" });
});

module.exports = router;
