import { useEffect, useState } from "react";
import { STREAMER } from "../config/streamer.js";
import {
  confirmDonationPaid,
  createDonation,
  fetchDonations,
  regenerateDonationQr,
  verifyDonationSlip,
} from "../api.js";

function formatDateTime(isoString) {
  if (!isoString) return "";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoString));
}

function formatMoney(amount) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function SiteHeader() {
  return (
    <header className="donate-header section-shell">
      <a className="brand" href="#top">
        <span className="brand-dot" aria-hidden="true" />
        Dome Donate
      </a>
      <p className="header-note">PromptPay สำหรับสตรีมเมอร์</p>
    </header>
  );
}

function StreamerHero() {
  return (
    <section className="streamer-hero section-shell" id="top">
      <img
        className="streamer-avatar"
        src={STREAMER.avatarUrl}
        alt={`รูปโปรไฟล์ ${STREAMER.name}`}
        width={120}
        height={120}
      />
      <div className="streamer-hero-text">
        <p className="eyebrow">{STREAMER.handle}</p>
        <h1>{STREAMER.name}</h1>
        <p className="welcome">{STREAMER.welcomeMessage}</p>
      </div>
    </section>
  );
}

function PromptPayPanel({
  session,
  onNewForm,
  onRegenerated,
  onMarkedPaid,
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [confirmSuccess, setConfirmSuccess] = useState("");
  const [slipFile, setSlipFile] = useState(null);
  const [verifyingSlip, setVerifyingSlip] = useState(false);
  const [slipError, setSlipError] = useState("");
  const [slipSuccess, setSlipSuccess] = useState("");

  const { donation, payment, needsQr } = session;
  const streamerLabel = payment?.streamerName || STREAMER.name;
  const amount = payment?.amount ?? donation.amount;

  async function handleRegenerate() {
    setRegenError("");
    setRegenerating(true);
    try {
      const data = await regenerateDonationQr(donation.id);
      onRegenerated({
        donation: data.donation,
        payment: data.payment,
      });
    } catch (err) {
      setRegenError(err.message || "สร้าง QR ใหม่ไม่สำเร็จ");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleConfirmPaid(event) {
    event.preventDefault();
    setConfirmError("");
    setConfirmSuccess("");
    setConfirming(true);
    try {
      const data = await confirmDonationPaid(donation.id, adminSecret);
      setConfirmSuccess("ยืนยันรับเงินแล้ว — รายการจะโผล่ใน Donate ล่าสุด");
      onMarkedPaid(data.donation);
    } catch (err) {
      setConfirmError(err.message || "ยืนยันไม่สำเร็จ");
    } finally {
      setConfirming(false);
    }
  }

  async function handleVerifySlip(event) {
    event.preventDefault();
    if (!slipFile) return;

    setSlipError("");
    setSlipSuccess("");
    setVerifyingSlip(true);

    try {
      const data = await verifyDonationSlip(donation.id, slipFile);
      setSlipSuccess(data.message);
      onMarkedPaid(data.donation);
    } catch (err) {
      setSlipError(err.message || "ตรวจสอบสลิปไม่สำเร็จ");
    } finally {
      setVerifyingSlip(false);
    }
  }

  return (
    <section
      className="donate-form-section qr-panel"
      aria-labelledby="qr-panel-title"
    >
      <h2 id="qr-panel-title">ชำระด้วย PromptPay</h2>
      <p className="section-lead">
        {payment?.instruction || "สร้าง QR เพื่อโอนด้วยแอปธนาคาร"}
      </p>

      <div className="qr-summary">
        <p>
          โอนให้ <strong>{streamerLabel}</strong>
        </p>
        <p className="qr-amount">{formatMoney(amount)}</p>
        <p className="qr-donor">
          จาก: <strong>{donation.donorName}</strong>
          {donation.message ? ` — “${donation.message}”` : null}
        </p>
      </div>

      {payment?.qrDataUrl ? (
        <div className="qr-image-wrap">
          <img
            className="qr-image"
            src={payment.qrDataUrl}
            alt={`QR PromptPay ยอด ${formatMoney(amount)}`}
            width={280}
            height={280}
          />
        </div>
      ) : (
        <p className="form-message form-message-error" role="alert">
          ยังไม่มี QR — ตรวจสอบ `PROMPTPAY_ID` ใน server/.env แล้วรีสตาร์ท backend
        </p>
      )}

      <p className="qr-note">
        การอ่าน QR ช่วยดึงเลขอ้างอิงเท่านั้น ไม่ได้ยืนยันยอดเงินหรือความแท้ของสลิป
      </p>

      <form className="slip-upload-form" onSubmit={handleVerifySlip}>
        <label className="field">
          <span>อัปโหลดรูปสลิปหลังโอน (JPG/PNG, ไม่เกิน 5 MB)</span>
          <input
            type="file"
            name="slip"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            onChange={(event) => {
              setSlipFile(event.target.files?.[0] || null);
              setSlipError("");
              setSlipSuccess("");
            }}
          />
        </label>
        <button
          type="submit"
          className="button button-primary"
          disabled={!slipFile || verifyingSlip || donation.status !== "pending"}
        >
          {verifyingSlip ? "กำลังอ่าน QR..." : "ส่งสลิปเพื่อตรวจ QR"}
        </button>
        {slipError ? (
          <p className="form-message form-message-error" role="alert">
            {slipError}
          </p>
        ) : null}
        {slipSuccess ? (
          <p className="form-message form-message-success" role="status">
            {slipSuccess}
          </p>
        ) : null}
      </form>

      <div className="qr-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={handleRegenerate}
          disabled={regenerating}
        >
          {regenerating
            ? "กำลังสร้าง QR..."
            : needsQr
              ? "สร้าง QR จากรายการนี้"
              : "สร้าง QR ใหม่"}
        </button>
        <button type="button" className="button button-primary" onClick={onNewForm}>
          กรอกฟอร์มใหม่
        </button>
      </div>

      {regenError ? (
        <p className="form-message form-message-error" role="alert">
          {regenError}
        </p>
      ) : null}

      <details className="owner-panel">
        <summary>เจ้าของ: ยืนยันว่าได้รับเงินแล้ว</summary>
        <p className="owner-note">
          หากอ่าน QR ไม่ได้ ให้ตรวจสอบยอดเงินจริงในแอปธนาคารก่อนกดยืนยัน
        </p>
        <form className="owner-form" onSubmit={handleConfirmPaid}>
          <label className="field">
            <span>รหัสเจ้าของ (ADMIN_SECRET)</span>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="ใส่รหัสจากไฟล์ .env"
              required
            />
          </label>
          <button
            type="submit"
            className="button button-primary"
            disabled={confirming || donation.status !== "pending"}
          >
            {confirming ? "กำลังยืนยัน..." : "เปลี่ยนเป็น paid"}
          </button>
          {confirmError ? (
            <p className="form-message form-message-error" role="alert">
              {confirmError}
            </p>
          ) : null}
          {confirmSuccess ? (
            <p className="form-message form-message-success" role="status">
              {confirmSuccess}
            </p>
          ) : null}
        </form>
      </details>
    </section>
  );
}

function DonateForm({ onPaymentReady }) {
  const [donorName, setDonorName] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data = await createDonation({
        donorName,
        amount: Number(amount),
        message,
        streamerId: STREAMER.id,
      });

      if (!data.payment?.qrDataUrl) {
        throw new Error(
          data.message || "บันทึกแล้วแต่สร้าง QR ไม่ได้ — ตรวจสอบ PROMPTPAY_ID"
        );
      }

      onPaymentReady({
        donation: data.donation,
        payment: data.payment,
      });
    } catch (err) {
      if (err.canRegenerateQr && err.donation?.id) {
        setError(
          `${err.message} — ลองกด "สร้าง QR จากรายการนี้" หลังรีสตาร์ท backend`
        );
        onPaymentReady({
          donation: err.donation,
          payment: null,
          needsQr: true,
        });
        return;
      }
      setError(err.message || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="donate-form-section" aria-labelledby="donate-form-title">
      <h2 id="donate-form-title">ส่ง Donate</h2>
      <p className="section-lead">กรอกข้อมูลแล้วระบบจะสร้าง QR ตามยอดที่กรอก</p>

      <form className="donate-form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>ชื่อผู้ donate</span>
          <input
            type="text"
            name="donorName"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder="เช่น คุณเอ"
            maxLength={50}
            required
            autoComplete="name"
          />
        </label>

        <label className="field">
          <span>จำนวนเงิน (บาท)</span>
          <input
            type="number"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50"
            min="1"
            step="1"
            required
          />
        </label>

        <label className="field">
          <span>ข้อความถึงสตรีมเมอร์</span>
          <textarea
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="สู้ๆ นะ!"
            maxLength={300}
            rows={4}
          />
        </label>

        {error ? (
          <p className="form-message form-message-error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? "กำลังสร้าง QR..." : "ส่งและสร้าง QR"}
        </button>
      </form>
    </section>
  );
}

function DonationListItem({ donation }) {
  return (
    <li className="donation-item">
      <div className="donation-item-head">
        <strong>{donation.donorName}</strong>
        <span className="donation-amount">{formatMoney(donation.amount)}</span>
      </div>
      {donation.message ? (
        <p className="donation-message">{donation.message}</p>
      ) : (
        <p className="donation-message donation-message-empty">ไม่มีข้อความ</p>
      )}
      <time className="donation-time" dateTime={donation.createdAt}>
        {formatDateTime(donation.createdAt)}
      </time>
    </li>
  );
}


export default function HomePage() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [paymentSession, setPaymentSession] = useState(null);

  async function loadDonations() {
    setLoadError("");
    try {
      const list = await fetchDonations(STREAMER.id);
      setDonations(list);
    } catch (err) {
      setLoadError(
        err.message ||
          "โหลดไม่ได้ — ตรวจสอบว่าเปิด Backend (port 3001) และเชื่อม MongoDB แล้ว"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDonations();
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="donate-main">
        <StreamerHero />
        <div className="donate-grid section-shell">
          {paymentSession ? (
            <PromptPayPanel
              session={paymentSession}
              onNewForm={() => setPaymentSession(null)}
              onRegenerated={setPaymentSession}
              onMarkedPaid={(updatedDonation) => {
                setPaymentSession((current) =>
                  current ? { ...current, donation: updatedDonation } : current
                );
                loadDonations();
              }}
            />
          ) : (
            <DonateForm onPaymentReady={setPaymentSession} />
          )}
    
        </div>
      </main>
      <footer className="donate-footer section-shell">
        <p>© {new Date().getFullYear()} Dome — PromptPay QR (ยืนยันการโอนด้วยมือ)</p>
      </footer>
    </>
  );
}
