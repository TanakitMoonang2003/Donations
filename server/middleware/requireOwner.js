const jwt = require("jsonwebtoken");

function readCookie(req, name) {
  const cookieHeader = req.get("Cookie") || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return null;
  }
}

function requireOwner(req, res, next) {
  const secret = process.env.OWNER_JWT_SECRET;
  if (!secret || secret.length < 32) {
    return res.status(503).json({
      message: "เจ้าของระบบยังไม่ได้ตั้งค่า OWNER_JWT_SECRET (อย่างน้อย 32 ตัวอักษร)",
    });
  }

  const token = readCookie(req, "dome_owner");
  if (!token) {
    return res.status(401).json({ message: "กรุณาเข้าสู่ระบบเจ้าของก่อน" });
  }

  try {
    const claims = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (claims.sub !== "owner" || typeof claims.streamerId !== "string") {
      return res.status(401).json({ message: "เซสชันเจ้าของไม่ถูกต้อง" });
    }

    req.owner = { streamerId: claims.streamerId };
    return next();
  } catch {
    return res.status(401).json({ message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" });
  }
}

module.exports = requireOwner;
