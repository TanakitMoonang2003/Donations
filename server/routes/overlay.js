const express = require("express");
const OverlaySettings = require("../models/OverlaySettings");
const { subscribeToOverlay } = require("../services/overlayEvents");
const { getPaidDonationTotal } = require("../services/donationTotals");

const GOAL_POSITIONS = new Set(["left", "right"]);

function toOverlaySettings(doc, goalCurrent) {
  return {
    backgroundColor: doc.backgroundColor,
    textColor: doc.textColor,
    fontFamily: doc.fontFamily,
    fontSize: doc.fontSize,
    messageTemplate: doc.messageTemplate,
    mediaUrl: doc.mediaUrl,
    soundUrl: doc.soundUrl,
    speechEnabled: doc.speechEnabled !== false,
    speechTemplate: doc.speechTemplate,
    speechRate: doc.speechRate ?? 1,
    duration: doc.duration,
    enterAnimation: doc.enterAnimation,
    exitAnimation: doc.exitAnimation,
    goalTitle: doc.goalTitle || "เป้าหมายโดเนท",
    goalTarget: doc.goalTarget ?? 10000,
    goalDeadline: doc.goalDeadline ?? null,
    goalPosition: GOAL_POSITIONS.has(doc.goalPosition) ? doc.goalPosition : "right",
    goalFillColor: doc.goalFillColor || "#7ad7a9",
    goalTrackColor: doc.goalTrackColor || "#3a3a52",
    goalCurrent,
  };
}

const router = express.Router();

router.get("/:token", async (req, res) => {
  try {
    const settings = await OverlaySettings.findOne({
      overlayToken: req.params.token,
    }).lean();

    if (!settings) {
      return res.status(404).json({ message: "ไม่พบลิงก์ Overlay นี้" });
    }

    const goalCurrent = await getPaidDonationTotal(settings.streamerId);

    return res.json({
      settings: toOverlaySettings(settings, goalCurrent),
    });
  } catch (error) {
    console.error("GET /api/overlay/:token error:", error.message);
    return res.status(500).json({ message: "โหลดการตั้งค่า Overlay ไม่สำเร็จ" });
  }
});

router.get("/:token/events", async (req, res) => {
  try {
    const settings = await OverlaySettings.findOne({
      overlayToken: req.params.token,
    })
      .select("streamerId")
      .lean();

    if (!settings) {
      return res.status(404).json({ message: "ไม่พบลิงก์ Overlay นี้" });
    }

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write(": connected\n\n");

    const unsubscribe = subscribeToOverlay(settings.streamerId, req.params.token, res);
    const heartbeat = setInterval(() => {
      if (!res.destroyed && !res.writableEnded) {
        res.write(": keep-alive\n\n");
      }
    }, 25000);

    res.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (error) {
    console.error("GET /api/overlay/:token/events error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: "เชื่อมต่อ Overlay ไม่สำเร็จ" });
    } else {
      res.end();
    }
  }
});

module.exports = router;
