const express = require("express");
const mongoose = require("mongoose");
const Donation = require("../models/Donations");
const { DEFAULT_STREAMER_ID } = require("../config/streamer");
const {
  getPromptPayIdForStreamer,
  getStreamerDisplayName,
} = require("../config/payment");
const validateDonationBody = require("../middleware/validateDonation");
const requireAdminSecret = require("../middleware/requireAdminSecret");
const uploadSlip = require("../middleware/uploadSlip");
const formatDonation = require("../utils/formatDonation");
const generatePromptPayQrDataUrl = require("../utils/generatePromptPayQr");
const readSlipQr = require("../utils/readSlipQr");
const extractSlipReference = require("../utils/extractSlipReference");
const { publishPaidDonation } = require("../services/overlayEvents");

const router = express.Router();

function resolveStreamerId(body) {
  return typeof body?.streamerId === "string" && body.streamerId.trim()
    ? body.streamerId.trim()
    : DEFAULT_STREAMER_ID;
}

async function buildPaymentResponse(streamerId, amount) {
  const promptPayId = getPromptPayIdForStreamer(streamerId);

  if (!promptPayId) {
    const error = new Error("PROMPTPAY_NOT_CONFIGURED");
    error.statusCode = 503;
    throw error;
  }

  const { qrDataUrl } = await generatePromptPayQrDataUrl(promptPayId, amount);

  return {
    qrDataUrl,
    amount,
    streamerName: getStreamerDisplayName(streamerId),
    instruction: "สแกนด้วยแอปธนาคารเพื่อโอนเงิน",
  };
}

/**
 * GET /api/donations
 * รายการล่าสุด — ค่าเริ่มต้นแสดงเฉพาะ status=paid (โผล่ในหน้าเว็บหลังยืนยันรับเงิน)
 */
router.get("/", async (req, res) => {
  try {
    const streamerId = req.query.streamerId || DEFAULT_STREAMER_ID;
    const status = req.query.status || "paid";

    const filter = { streamerId };
    if (status !== "all") {
      filter.status = status;
    }

    const donations = await Donation.find(filter)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      donations: donations.map((doc) => formatDonation(doc)),
    });
  } catch (error) {
    console.error("GET /api/donations error:", error.message);
    res.status(500).json({ message: "ไม่สามารถโหลดรายการ donate ได้" });
  }
});

/**
 * POST /api/donations
 * บันทึก donation (pending) + สร้าง QR ในครั้งเดียว
 * เหตุผล: ยอดใน QR ต้องตรงกับรายการใน DB หลังกดส่งฟอร์ม
 */
router.post("/", async (req, res) => {
  try {
    const validation = validateDonationBody(req.body);

    if (!validation.ok) {
      return res.status(400).json({
        message: "ข้อมูลไม่ถูกต้อง",
        errors: validation.errors,
      });
    }

    const { donorName, amount, message } = validation.data;
    const streamerId = resolveStreamerId(req.body);

    const donation = await Donation.create({
      donorName,
      amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
      message,
      streamerId,
      status: "pending",
    });

    let payment;
    try {
      payment = await buildPaymentResponse(streamerId, amount);
    } catch (qrError) {
      if (qrError.message === "PROMPTPAY_NOT_CONFIGURED") {
        return res.status(503).json({
          message:
            "ยังไม่ได้ตั้งค่า PROMPTPAY_ID ใน server/.env — บันทึกรายการแล้วแต่สร้าง QR ไม่ได้ (รีสตาร์ท backend หลังแก้ .env)",
          donation: formatDonation(donation),
          canRegenerateQr: true,
        });
      }
      console.error("QR generation failed:", qrError.message);
      return res.status(500).json({
        message: `สร้าง QR ไม่สำเร็จ: ${qrError.message}`,
        donation: formatDonation(donation),
        canRegenerateQr: true,
      });
    }

    res.status(201).json({
      message: "สร้างรายการและ QR สำเร็จ กรุณาโอนเงินตามยอด",
      donation: formatDonation(donation),
      payment,
    });
  } catch (error) {
    console.error("POST /api/donations error:", error.message);
    res.status(500).json({ message: "ไม่สามารถบันทึก donation ได้" });
  }
});

/**
 * POST /api/donations/:id/qr
 * สร้าง QR ใหม่สำหรับรายการ pending เดิม (ยอดเดิม)
 */
router.post("/:id/qr", async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({ message: "ไม่พบรายการ donate" });
    }

    if (donation.status !== "pending") {
      return res.status(400).json({
        message: "สร้าง QR ใหม่ได้เฉพาะรายการที่รอชำระ (pending)",
      });
    }

    const amount = parseFloat(donation.amount.toString());
    const payment = await buildPaymentResponse(donation.streamerId, amount);

    res.json({
      message: "สร้าง QR ใหม่แล้ว",
      donation: formatDonation(donation),
      payment,
    });
  } catch (error) {
    if (error.message === "PROMPTPAY_NOT_CONFIGURED") {
      return res.status(503).json({
        message: "ยังไม่ได้ตั้งค่า PROMPTPAY_ID ในไฟล์ .env",
      });
    }
    console.error("POST /api/donations/:id/qr error:", error.message);
    res.status(500).json({ message: "สร้าง QR ไม่สำเร็จ" });
  }
});

/**
 * POST /api/donations/:id/verify-slip
 * อ่าน QR จากสลิปใน memory และใช้ transaction reference ป้องกันการใช้ซ้ำ
 */
router.post("/:id/verify-slip", uploadSlip, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "รหัสรายการ donate ไม่ถูกต้อง" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "กรุณาเลือกรูปสลิป JPG หรือ PNG" });
    }

    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({ message: "ไม่พบรายการ donate" });
    }

    if (donation.status !== "pending") {
      return res.status(400).json({
        message: "ตรวจสอบสลิปได้เฉพาะรายการที่รอชำระ (pending)",
      });
    }

    const payload = await readSlipQr(req.file.buffer);
    if (!payload) {
      return res.status(422).json({
        message: "ไม่พบ QR บนสลิป กรุณาอัปโหลดรูปที่ชัดกว่านี้",
      });
    }

    const slipRef = extractSlipReference(payload);
    if (!slipRef) {
      return res.status(422).json({
        message:
          "อ่าน QR ได้ แต่ไม่พบเลขอ้างอิงธุรกรรมที่รองรับ กรุณาให้เจ้าของตรวจสอบและยืนยันด้วยตนเอง",
      });
    }

    const updatedDonation = await Donation.findOneAndUpdate(
      { _id: donation._id, status: "pending" },
      { $set: { status: "paid", slipRef } },
      { returnDocument: "after", runValidators: true }
    );

    if (!updatedDonation) {
      return res.status(409).json({
        message: "รายการนี้ได้รับการยืนยันแล้ว กรุณารีเฟรชรายการ",
      });
    }

    await publishPaidDonation(updatedDonation);

    return res.json({
      message: "อ่านเลขอ้างอิงจาก QR แล้ว — รายการถูกเปลี่ยนเป็น paid",
      donation: formatDonation(updatedDonation),
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    if (error.code === 11000 && error.keyPattern?.slipRef) {
      return res.status(409).json({
        message: "สลิปนี้ถูกใช้กับรายการอื่นแล้ว กรุณาตรวจสอบสลิปอีกครั้ง",
      });
    }

    if (error.message?.includes("Input buffer")) {
      return res.status(400).json({
        message: "ไฟล์รูปเสียหายหรือเปิดไม่ได้ กรุณาอัปโหลดรูปใหม่",
      });
    }

    console.error("POST /api/donations/:id/verify-slip error:", error.message);
    return res.status(500).json({ message: "ตรวจสอบ QR บนสลิปไม่สำเร็จ" });
  }
});

/**
 * PATCH /api/donations/:id/paid
 * เจ้าของยืนยันว่าได้รับเงินแล้ว (ต้องส่ง X-Admin-Secret)
 */
router.patch("/:id/paid", requireAdminSecret, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({ message: "ไม่พบรายการ donate" });
    }

    if (donation.status === "paid") {
      return res.json({
        message: "รายการนี้ยืนยันแล้ว",
        donation: formatDonation(donation),
      });
    }

    if (donation.status !== "pending") {
      return res.status(400).json({
        message: "ยืนยันได้เฉพาะรายการที่รอชำระ (pending)",
      });
    }

    const updatedDonation = await Donation.findOneAndUpdate(
      { _id: donation._id, status: "pending" },
      { $set: { status: "paid" } },
      { returnDocument: "after", runValidators: true }
    );

    if (!updatedDonation) {
      const currentDonation = await Donation.findById(donation._id);
      if (currentDonation?.status === "paid") {
        return res.json({
          message: "รายการนี้ยืนยันแล้ว",
          donation: formatDonation(currentDonation),
        });
      }

      return res.status(409).json({
        message: "รายการนี้ถูกเปลี่ยนสถานะแล้ว กรุณารีเฟรชรายการ",
      });
    }

    await publishPaidDonation(updatedDonation);

    res.json({
      message: "ยืนยันรับเงินแล้ว",
      donation: formatDonation(updatedDonation),
    });
  } catch (error) {
    console.error("PATCH /api/donations/:id/paid error:", error.message);
    res.status(500).json({ message: "ไม่สามารถอัปเดตสถานะได้" });
  }
});

module.exports = router;
