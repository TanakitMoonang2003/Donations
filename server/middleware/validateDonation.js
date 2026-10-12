const {
  DONATION_MIN_AMOUNT,
  DONATION_MAX_AMOUNT,
} = require("../config/payment");

/**
 * ตรวจสอบข้อมูลจากฟอร์มก่อนบันทึกลง DB
 */
function validateDonationBody(body) {
  const errors = [];

  const donorName =
    typeof body.donorName === "string" ? body.donorName.trim() : "";

  if (!donorName) {
    errors.push("กรุณากรอกชื่อผู้ donate");
  } else if (donorName.length > 50) {
    errors.push("ชื่อต้องไม่เกิน 50 ตัวอักษร");
  }

  const amountNumber = Number(body.amount);

  if (body.amount === "" || body.amount === null || body.amount === undefined) {
    errors.push("กรุณากรอกจำนวนเงิน");
  } else if (!Number.isFinite(amountNumber)) {
    errors.push("จำนวนเงินต้องเป็นตัวเลข");
  } else if (amountNumber <= 0) {
    errors.push("จำนวนเงินต้องมากกว่า 0");
  } else if (amountNumber < DONATION_MIN_AMOUNT) {
    errors.push(`จำนวนเงินขั้นต่ำ ${DONATION_MIN_AMOUNT} บาท`);
  } else if (amountNumber > DONATION_MAX_AMOUNT) {
    errors.push(`จำนวนเงินสูงสุด ${DONATION_MAX_AMOUNT} บาท`);
  }

  let message = "";
  if (body.message !== undefined && body.message !== null) {
    message = String(body.message).trim();
    if (message.length > 300) {
      errors.push("ข้อความต้องไม่เกิน 300 ตัวอักษร");
    }
  }

  const normalizedAmount = Number.isFinite(amountNumber)
    ? Math.round(amountNumber * 100) / 100
    : amountNumber;

  return {
    ok: errors.length === 0,
    errors,
    data: {
      donorName,
      amount: normalizedAmount,
      message,
    },
  };
}

module.exports = validateDonationBody;
