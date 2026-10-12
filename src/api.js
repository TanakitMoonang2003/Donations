import { API_URL } from "./config/apiUrl.js";

async function parseJsonResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    const detail = data.errors?.join(" ") || data.message || "คำขอไม่สำเร็จ";
    const error = new Error(detail);
    if (data.donation) {
      error.donation = data.donation;
    }
    if (data.canRegenerateQr) {
      error.canRegenerateQr = true;
    }
    throw error;
  }
  return data;
}

/**
 * ดึงรายการ donate ที่ชำระแล้ว (paid) ล่าสุด
 */
export async function fetchDonations(streamerId = "default") {
  const url = `${API_URL}/api/donations?streamerId=${encodeURIComponent(streamerId)}&status=paid`;
  const response = await fetch(url);
  return parseJsonResponse(response).then((data) => data.donations);
}

/**
 * ส่งฟอร์ม → บันทึก pending + ได้ QR Data URL กลับมา
 */
export async function createDonation({ donorName, amount, message, streamerId }) {
  const response = await fetch(`${API_URL}/api/donations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ donorName, amount, message, streamerId }),
  });

  return parseJsonResponse(response);
}

/**
 * สร้าง QR ใหม่สำหรับรายการ pending เดิม
 */
export async function regenerateDonationQr(donationId) {
  const response = await fetch(`${API_URL}/api/donations/${donationId}/qr`, {
    method: "POST",
  });

  return parseJsonResponse(response);
}

/**
 * Upload a slip image for QR reference extraction.
 */
export async function verifyDonationSlip(donationId, file) {
  const formData = new FormData();
  formData.append("slip", file);

  const response = await fetch(
    `${API_URL}/api/donations/${encodeURIComponent(donationId)}/verify-slip`,
    {
      method: "POST",
      body: formData,
    }
  );

  return parseJsonResponse(response);
}

/**
 * เจ้าของยืนยันรับเงินแล้ว
 */
export async function confirmDonationPaid(donationId, adminSecret) {
  const response = await fetch(`${API_URL}/api/donations/${donationId}/paid`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": adminSecret,
    },
  });

  return parseJsonResponse(response);
}

export async function checkBackend() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error("Backend request failed");
  }

  return response.json();
}
