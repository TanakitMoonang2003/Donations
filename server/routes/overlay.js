const express = require("express");
const OverlaySettings = require("../models/OverlaySettings");
const { subscribeToOverlay } = require("../services/overlayEvents");

const router = express.Router();

router.get("/:token", async (req, res) => {
  try {
    const settings = await OverlaySettings.findOne({
      overlayToken: req.params.token,
    }).lean();

    if (!settings) {
      return res.status(404).json({ message: "ไม่พบลิงก์ Overlay นี้" });
    }

    return res.json({
      settings: {
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
      },
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
