/**
 * ตรวจ secret สำหรับ action ของเจ้าของ (ยังไม่มี login)
 * ส่งมาใน header: X-Admin-Secret: <ค่าใน .env ADMIN_SECRET>
 */
function requireAdminSecret(req, res, next) {
  const configured = process.env.ADMIN_SECRET;

  if (!configured || !String(configured).trim()) {
    return res.status(503).json({
      message: "ยังไม่ได้ตั้งค่า ADMIN_SECRET บนเซิร์ฟเวอร์",
    });
  }

  const provided = req.get("X-Admin-Secret");

  if (!provided || provided !== configured) {
    return res.status(401).json({ message: "รหัสเจ้าของไม่ถูกต้อง" });
  }

  next();
}

module.exports = requireAdminSecret;
