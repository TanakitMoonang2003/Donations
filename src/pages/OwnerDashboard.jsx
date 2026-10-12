import { useEffect, useState } from "react";
import AlertVisual from "../components/AlertVisual.jsx";
import { API_URL } from "../config/apiUrl.js";
import { resolveApiAssetUrl } from "../utils/resolveApiAssetUrl.js";
import "./owner.css";
const FONT_CHOICES = [
  ["system-ui, sans-serif", "System"],
  ["Arial, sans-serif", "Arial"],
  ["Georgia, serif", "Georgia"],
  ["monospace", "Monospace"],
];
const DEFAULT_SETTINGS = {
  backgroundColor: "#17172b",
  textColor: "#ffffff",
  fontFamily: "system-ui, sans-serif",
  fontSize: 28,
  messageTemplate: "{name} donate {amount} บาท",
  mediaUrl: "",
  soundUrl: "",
  speechEnabled: true,
  speechTemplate: "{name} บริจาค {amount} บาท {message}",
  speechRate: 1,
  duration: 6,
  enterAnimation: "slide-up",
  exitAnimation: "fade",
  minimumAmount: 1,
};

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.errors?.join(" ") || data.message || "คำขอไม่สำเร็จ");
    error.status = response.status;
    throw error;
  }
  return data;
}

function Field({ label, children, hint }) {
  return (
    <label className="dashboard-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function OwnerLogin({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await request("/api/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      await onLogin();
    } catch (requestError) {
      setError(requestError.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="dashboard-login">
      <a className="dashboard-brand" href="/">
        <span className="dashboard-brand-mark">D</span> Dome
      </a>
      <section className="dashboard-login-card">
        <span className="dashboard-eyebrow">OWNER AREA</span>
        <h1>เข้าสู่ระบบเจ้าของ</h1>
        <p>ลงชื่อเข้าใช้เพื่อปรับแต่ง Alert และจัดการลิงก์ Overlay</p>
        <form onSubmit={handleSubmit}>
          <Field label="รหัสผ่านเจ้าของ">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          {error ? <p className="dashboard-error" role="alert">{error}</p> : null}
          <button className="dashboard-primary-button" disabled={submitting}>
            {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
        <a className="dashboard-back-link" href="/">
          กลับหน้าหลัก
        </a>
      </section>
    </main>
  );
}

export default function OwnerDashboard() {
  const [authState, setAuthState] = useState("checking");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [overlayPath, setOverlayPath] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadingSound, setUploadingSound] = useState(false);

  async function loadSettings() {
    const data = await request("/api/owner/settings");
    setSettings(data.settings);
    setOverlayPath(data.settings.overlayPath);
  }

  useEffect(() => {
    let current = true;

    request("/api/owner/session")
      .then(() => request("/api/owner/settings"))
      .then((data) => {
        if (!current) return;
        setSettings(data.settings);
        setOverlayPath(data.settings.overlayPath);
        setAuthState("signed-in");
      })
      .catch((requestError) => {
        if (!current) return;
        if (requestError.status === 401) {
          setAuthState("signed-out");
        } else {
          setError(requestError.message);
          setAuthState("error");
        }
      });

    return () => {
      current = false;
    };
  }, []);

  function updateSetting(event) {
    const { name, value, type, checked } = event.target;
    setSettings((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number" || type === "range"
            ? Number(value)
            : value,
    }));
    setNotice("");
  }

  async function handleSoundUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setNotice("");
    setUploadingSound(true);
    try {
      const formData = new FormData();
      formData.append("sound", file);
      const response = await fetch(`${API_URL}/api/owner/alert-sound`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "อัปโหลดไฟล์เสียงไม่สำเร็จ");
      }
      setSettings(data.settings);
      setOverlayPath(data.settings.overlayPath);
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploadingSound(false);
    }
  }

  async function handleRemoveSound() {
    setError("");
    setNotice("");
    setUploadingSound(true);
    try {
      const data = await request("/api/owner/alert-sound", { method: "DELETE" });
      setSettings(data.settings);
      setOverlayPath(data.settings.overlayPath);
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploadingSound(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const data = await request("/api/owner/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSettings(data.settings);
      setOverlayPath(data.settings.overlayPath);
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRotateToken() {
    setError("");
    setNotice("");
    try {
      const data = await request("/api/owner/overlay-token/rotate", {
        method: "POST",
      });
      setOverlayPath(data.settings.overlayPath);
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleCopyLink() {
    const overlayUrl = `${window.location.origin}${overlayPath}`;
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      setNotice("คัดลอกลิงก์แล้ว");
      window.setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      console.error("Could not copy overlay link:", copyError);
      setError("คัดลอกไม่ได้ — กรุณาใช้ HTTPS หรือคัดลอกลิงก์จากช่องข้อความ");
    }
  }

  async function handleTestAlert() {
    setError("");
    setNotice("");
    try {
      const data = await request("/api/owner/test-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "ผู้สนับสนุนตัวอย่าง",
          amount: 100,
          message: "สู้ๆ นะ!",
        }),
      });
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleLogout() {
    try {
      await request("/api/owner/logout", { method: "POST" });
      setAuthState("signed-out");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (authState === "checking") {
    return <main className="dashboard-loading">กำลังตรวจสอบเซสชัน...</main>;
  }

  if (authState === "signed-out") {
    return (
      <OwnerLogin
        onLogin={async () => {
          await loadSettings();
          setAuthState("signed-in");
        }}
      />
    );
  }

  if (authState === "error") {
    return (
      <main className="dashboard-login">
        <section className="dashboard-login-card">
          <h1>เชื่อมต่อ Dashboard ไม่ได้</h1>
          <p className="dashboard-error" role="alert">{error}</p>
          <button
            className="dashboard-secondary-button"
            onClick={() => window.location.reload()}
          >
            ลองอีกครั้ง
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="owner-dashboard">
      <header className="dashboard-topbar">
        <a className="dashboard-brand" href="/">
          <span className="dashboard-brand-mark">D</span> Dome
          <span className="dashboard-brand-divider">/</span> Alert Studio
        </a>
        <div className="dashboard-topbar-actions">
          <span className="dashboard-owner-badge"><i /> Owner</span>
          <button className="dashboard-logout-button" onClick={handleLogout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-page-heading">
          <div>
            <span className="dashboard-eyebrow">YOUR STREAM, YOUR STYLE</span>
            <h1>ตกแต่ง Donation Alert</h1>
            <p>ปรับแต่งหน้าตาและทดลองก่อนนำไปใช้บนหน้าจอไลฟ์</p>
          </div>
        </div>

        {error ? <p className="dashboard-banner dashboard-banner-error" role="alert">{error}</p> : null}
        {notice ? <p className="dashboard-banner dashboard-banner-success" role="status">{notice}</p> : null}

        <form className="dashboard-grid" onSubmit={handleSave}>
          <section className="dashboard-card dashboard-settings-card">
            <div className="dashboard-card-heading">
              <div>
                <span className="dashboard-eyebrow">ALERT DESIGN</span>
                <h2>การแสดงผล</h2>
              </div>
            </div>

            <div className="dashboard-form-grid">
              <Field label="สีพื้นหลัง">
                <input
                  name="backgroundColor"
                  type="color"
                  value={settings.backgroundColor}
                  onChange={updateSetting}
                />
              </Field>
              <Field label="สีตัวอักษร">
                <input
                  name="textColor"
                  type="color"
                  value={settings.textColor}
                  onChange={updateSetting}
                />
              </Field>
              <Field label="ฟอนต์">
                <select name="fontFamily" value={settings.fontFamily} onChange={updateSetting}>
                  {FONT_CHOICES.map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field label={`ขนาดตัวอักษร (${settings.fontSize}px)`}>
                <input
                  name="fontSize"
                  type="range"
                  min="12"
                  max="96"
                  step="1"
                  value={settings.fontSize}
                  onChange={updateSetting}
                />
              </Field>
              <Field label="รูปแบบข้อความ" hint="ใช้ {name}, {amount} และ {message} เป็นตัวแปร">
                <input
                  name="messageTemplate"
                  value={settings.messageTemplate}
                  maxLength={200}
                  onChange={updateSetting}
                />
              </Field>
              <Field label="ยอดขั้นต่ำที่แสดง (บาท)">
                <input
                  name="minimumAmount"
                  type="number"
                  min="0"
                  max="50000"
                  step="1"
                  value={settings.minimumAmount}
                  onChange={updateSetting}
                />
              </Field>
              <Field label="รูปภาพหรือ GIF (URL)">
                <input
                  name="mediaUrl"
                  type="url"
                  value={settings.mediaUrl}
                  placeholder="https://example.com/alert.gif"
                  onChange={updateSetting}
                />
              </Field>
              <Field
                label="เสียงแจ้งเตือน"
                hint="อัปโหลดไฟล์เสียงเท่านั้น (MP3, WAV, OGG, WEBM, M4A ไม่เกิน 8 MB)"
              >
                <input
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,.mp3,.wav,.ogg,.webm,.m4a"
                  disabled={uploadingSound}
                  onChange={handleSoundUpload}
                />
                {settings.soundUrl ? (
                  <div className="dashboard-sound-preview">
                    <audio controls src={resolveApiAssetUrl(settings.soundUrl)} />
                    <button
                      type="button"
                      className="dashboard-secondary-button"
                      disabled={uploadingSound}
                      onClick={handleRemoveSound}
                    >
                      ลบไฟล์เสียง
                    </button>
                  </div>
                ) : (
                  <small>ยังไม่มีไฟล์เสียง — จะมีเฉพาะเสียงพูดอ่านข้อความ (ถ้าเปิดไว้)</small>
                )}
              </Field>
              <Field label="อ่านข้อความเป็นเสียงพูด">
                <label className="dashboard-checkbox">
                  <input
                    type="checkbox"
                    name="speechEnabled"
                    checked={settings.speechEnabled !== false}
                    onChange={updateSetting}
                  />
                  เปิดใช้งาน Text-to-Speech บน Overlay
                </label>
              </Field>
              <Field
                label="ข้อความที่ให้อ่านออกเสียง"
                hint="ใช้ {name}, {amount} และ {message} — ว่าง {message} ได้ถ้าไม่มีข้อความ"
              >
                <input
                  name="speechTemplate"
                  value={settings.speechTemplate}
                  maxLength={300}
                  disabled={settings.speechEnabled === false}
                  onChange={updateSetting}
                />
              </Field>
              <Field label={`ความเร็วเสียงพูด (${settings.speechRate}x)`}>
                <input
                  name="speechRate"
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.speechRate}
                  disabled={settings.speechEnabled === false}
                  onChange={updateSetting}
                />
              </Field>
              <Field label={`ระยะเวลาแสดง (${settings.duration} วินาที)`}>
                <input
                  name="duration"
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={settings.duration}
                  onChange={updateSetting}
                />
              </Field>
              <Field label="แอนิเมชันเข้า">
                <select name="enterAnimation" value={settings.enterAnimation} onChange={updateSetting}>
                  <option value="slide-up">เลื่อนขึ้น</option>
                  <option value="fade">ค่อย ๆ ปรากฏ</option>
                  <option value="pop">ขยายเข้ามา</option>
                  <option value="none">ไม่มี</option>
                </select>
              </Field>
              <Field label="แอนิเมชันออก">
                <select name="exitAnimation" value={settings.exitAnimation} onChange={updateSetting}>
                  <option value="fade">ค่อย ๆ หายไป</option>
                  <option value="slide-down">เลื่อนลง</option>
                  <option value="shrink">ย่อออก</option>
                  <option value="none">ไม่มี</option>
                </select>
              </Field>
            </div>
            <div className="dashboard-form-actions">
              <button className="dashboard-primary-button" disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
              </button>
              <button
                className="dashboard-secondary-button"
                type="button"
                onClick={handleTestAlert}
              >
                ทดสอบ Alert
              </button>
            </div>
          </section>

          <aside className="dashboard-preview-column">
            <section className="dashboard-card dashboard-preview-card">
              <div className="dashboard-card-heading">
                <div>
                  <span className="dashboard-eyebrow">LIVE PREVIEW</span>
                  <h2>ตัวอย่าง Alert</h2>
                </div>
                <span className="dashboard-live-badge"><i /> LIVE</span>
              </div>
              <div className="dashboard-preview-stage">
                <AlertVisual
                  settings={settings}
                  alert={{ name: "คุณใจดี", amount: 100, message: "สู้ๆ นะ!" }}
                />
              </div>
              <p className="dashboard-preview-note">ตัวอย่างนี้เปลี่ยนตามการตั้งค่าทันที</p>
            </section>

            <section className="dashboard-card dashboard-link-card">
              <span className="dashboard-eyebrow">OBS BROWSER SOURCE</span>
              <h2>ลิงก์ Overlay ของคุณ</h2>
              <p>เก็บลิงก์นี้เป็นความลับ หากเผยแพร่ให้สร้างลิงก์ใหม่</p>
              <input
                className="dashboard-overlay-url"
                readOnly
                value={overlayPath ? `${window.location.origin}${overlayPath}` : ""}
                aria-label="ลิงก์ Overlay สำหรับ OBS"
              />
              <div className="dashboard-link-actions">
                <button
                  type="button"
                  className="dashboard-secondary-button"
                  onClick={handleCopyLink}
                >
                  {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
                </button>
                <button
                  type="button"
                  className="dashboard-danger-button"
                  onClick={handleRotateToken}
                >
                  สร้างลิงก์ใหม่
                </button>
              </div>
              <ul className="dashboard-obs-hints">
                <li>เพิ่มเป็น Browser Source ใน OBS</li>
                <li>แนะนำขนาด 1920 × 1080 และเปิด Shutdown source when not visible</li>
                <li>ใช้ลิงก์ใหม่แล้วต้องแก้ URL ใน OBS ด้วย</li>
              </ul>
            </section>
          </aside>
        </form>
      </div>
    </main>
  );
}
