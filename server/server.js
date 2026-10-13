const fs = require("fs");
const path = require("path");

// โหลด server/.env เสมอ แม้รัน node จากโฟลเดอร์อื่น
// override: true ให้ค่าในไฟล์ชนะตัวแปรว่างที่อาจตั้งไว้ใน Windows/IDE
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true,
});

const express = require("express");
const {
  getPromptPayIdForStreamer,
} = require("./config/payment");
const cors = require("cors");
const connectDB = require("./db");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(
  "/api/uploads/alert-sounds",
  express.static(path.join(__dirname, "uploads", "alert-sounds"))
);

const donationsRouter = require("./routes/donations");
app.use("/api/donations", donationsRouter);
app.use("/api/owner", require("./routes/owner"));
app.use("/api/overlay", require("./routes/overlay"));

const distPath = path.join(__dirname, "..", "dist");
const serveFrontend =
  process.env.NODE_ENV === "production" && fs.existsSync(distPath);

if (serveFrontend) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({
      message: "Donation Backend is running!",
    });
  });
}

// เริ่มเซิร์ฟเวอร์หลังเชื่อมต่อฐานข้อมูลสำเร็จ
async function startServer() {
  await connectDB();

  app.listen(process.env.PORT || 3001, () => {
    const port = process.env.PORT || 3001;
    console.log(`Backend running on port ${port}`);

    const promptPayId = getPromptPayIdForStreamer();
    if (promptPayId) {
      console.log("PromptPay ID loaded from .env (masked)");
    } else {
      console.warn(
        "WARNING: PROMPTPAY_ID is missing in server/.env — QR will not work"
      );
    }
  });
}

startServer().catch((error) => {
  console.error("Cannot start server:", error.message);
  process.exit(1);
});
