import { useEffect, useRef, useState } from "react";
import AlertVisual from "../components/AlertVisual.jsx";
import { useOverlayConnection } from "../hooks/useOverlayConnection.js";
import {
  cancelAlertSpeech,
  formatAlertTemplate,
  speakAlertText,
} from "../utils/alertSpeech.js";
import { resolveApiAssetUrl } from "../utils/resolveApiAssetUrl.js";
import "./overlay.css";

export default function OverlayPage({ token }) {
  const [activeAlert, setActiveAlert] = useState(null);
  const [exiting, setExiting] = useState(false);
  const activeAlertRef = useRef(null);
  const alertQueueRef = useRef([]);
  const onAlertRef = useRef(null);

  onAlertRef.current = (alert) => {
    if (activeAlertRef.current) {
      alertQueueRef.current.push(alert);
    } else {
      activeAlertRef.current = alert;
      setExiting(false);
      setActiveAlert(alert);
    }
  };

  const { settings } = useOverlayConnection(token, {
    listenAlerts: true,
    onAlertRef,
  });

  useEffect(() => {
    if (!activeAlert) return undefined;

    const exitTimer = window.setTimeout(
      () => setExiting(true),
      settings.duration * 1000
    );
    const clearTimer = window.setTimeout(
      () => {
        const nextAlert = alertQueueRef.current.shift() || null;
        activeAlertRef.current = nextAlert;
        setExiting(false);
        setActiveAlert(nextAlert);
      },
      settings.duration * 1000 + 450
    );

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(clearTimer);
    };
  }, [activeAlert, settings.duration]);

  useEffect(() => {
    if (!activeAlert) return undefined;

    let cancelled = false;

    function runSpeech() {
      if (cancelled || settings.speechEnabled === false) return;
      const text = formatAlertTemplate(settings.speechTemplate, activeAlert);
      speakAlertText(text, {
        lang: "th-TH",
        rate: settings.speechRate ?? 1,
      });
    }

    if (settings.soundUrl) {
      const audio = new Audio(resolveApiAssetUrl(settings.soundUrl));
      audio.addEventListener("ended", runSpeech);
      audio.play().catch((error) => {
        console.warn("Alert sound could not be played:", error.message);
        runSpeech();
      });

      return () => {
        cancelled = true;
        audio.pause();
        audio.removeEventListener("ended", runSpeech);
        cancelAlertSpeech();
      };
    }

    runSpeech();
    return () => {
      cancelled = true;
      cancelAlertSpeech();
    };
  }, [
    activeAlert,
    settings.soundUrl,
    settings.speechEnabled,
    settings.speechTemplate,
    settings.speechRate,
  ]);

  return (
    <main className="overlay-canvas overlay-canvas--alert" aria-live="polite">
      {activeAlert ? (
        <div
          className={[
            "overlay-alert",
            exiting
              ? `overlay-exit-${settings.exitAnimation}`
              : `overlay-enter-${settings.enterAnimation}`,
          ].join(" ")}
        >
          <AlertVisual settings={settings} alert={activeAlert} />
        </div>
      ) : null}
    </main>
  );
}
