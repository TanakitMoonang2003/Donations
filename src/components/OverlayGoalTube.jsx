import { useEffect, useState } from "react";
import { formatMoney } from "../utils/formatMoney.js";

export default function OverlayGoalTube({
  title,
  current,
  target,
  deadline,
  position = "right",
  fillColor = "#7ad7a9",
  trackColor = "#3a3a52",
  textColor = "#ffffff",
  fontFamily = "system-ui, sans-serif",
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!deadline) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [deadline]);

  if (!target || target <= 0) return null;

  const safeCurrent = Math.max(0, Number(current) || 0);
  const percent = Math.min(100, (safeCurrent / target) * 100);
  const deadlineTime = deadline ? new Date(deadline).getTime() : NaN;
  const remainingTime = deadlineTime - now;
  const remainingLabel = Number.isFinite(deadlineTime)
    ? remainingTime <= 0
      ? "สิ้นสุดแล้ว"
      : remainingTime < 24 * 60 * 60 * 1000
        ? `เหลือ ${Math.ceil(remainingTime / (60 * 60 * 1000))} ชม.`
        : `เหลือ ${Math.ceil(remainingTime / (24 * 60 * 60 * 1000))} วัน`
    : "";

  return (
    <aside
      className={`overlay-goal-tube overlay-goal-tube--${position}`}
      style={{ color: textColor, fontFamily }}
      aria-label={`${title}: ${formatMoney(safeCurrent)} จาก ${formatMoney(target)}`}
    >
      <div className="overlay-goal-tube__inner">
        <h2 className="overlay-goal-tube__title">{title}</h2>
        <div
          className="overlay-goal-tube__bar"
          style={{ background: trackColor }}
          role="progressbar"
          aria-valuenow={Math.round(safeCurrent)}
          aria-valuemin={0}
          aria-valuemax={target}
        >
          <div
            className="overlay-goal-tube__fill"
            style={{
              width: `${percent}%`,
              background: `linear-gradient(90deg, ${fillColor}, ${fillColor}cc)`,
            }}
          />
        </div>
        <p className="overlay-goal-tube__amounts">
          <strong>{formatMoney(safeCurrent)}</strong>
          <span className="overlay-goal-tube__sep">/</span>
          <span>{formatMoney(target)}</span>
          {remainingLabel ? (
            <span className="overlay-goal-tube__deadline">{remainingLabel}</span>
          ) : null}
        </p>
        <p className="overlay-goal-tube__percent">{Math.round(percent)}%</p>
      </div>
    </aside>
  );
}
