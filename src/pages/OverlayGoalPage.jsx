import OverlayGoalTube from "../components/OverlayGoalTube.jsx";
import { useOverlayConnection } from "../hooks/useOverlayConnection.js";
import "./overlay.css";

export default function OverlayGoalPage({ token }) {
  const { settings, loadError } = useOverlayConnection(token);

  return (
    <main className="overlay-canvas overlay-canvas--goal" aria-live="polite">
      {loadError ? (
        <p className="overlay-goal-load-error" role="alert">
          โหลดหลอดเป้าหมายไม่สำเร็จ — ตรวจสอบลิงก์และว่าเซิร์ฟเวอร์ทำงานอยู่
        </p>
      ) : (
        <OverlayGoalTube
          title={settings.goalTitle}
          current={settings.goalCurrent}
          target={settings.goalTarget}
          deadline={settings.goalDeadline}
          position={settings.goalPosition}
          fillColor={settings.goalFillColor}
          trackColor={settings.goalTrackColor}
          textColor={settings.textColor}
          fontFamily={settings.fontFamily}
        />
      )}
    </main>
  );
}
