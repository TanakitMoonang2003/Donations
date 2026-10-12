import { useEffect, useRef, useState } from "react";
import AlertVisual from "../components/AlertVisual.jsx";
import {
  cancelAlertSpeech,
  formatAlertTemplate,
  speakAlertText,
} from "../utils/alertSpeech.js";
import { API_URL } from "../config/apiUrl.js";
import { resolveApiAssetUrl } from "../utils/resolveApiAssetUrl.js";
import "./overlay.css";
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
};

export default function OverlayPage({ token }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeAlert, setActiveAlert] = useState(null);
  const [exiting, setExiting] = useState(false);
  const activeAlertRef = useRef(null);
  const alertQueueRef = useRef([]);

  useEffect(() => {
    document.documentElement.classList.add("overlay-page");
    document.body.classList.add("overlay-page");
    return () => {
      document.documentElement.classList.remove("overlay-page");
      document.body.classList.remove("overlay-page");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/overlay/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Overlay token is invalid");
        if (!cancelled) setSettings(data.settings);
      })
      .catch((error) => {
        console.error("Could not load overlay settings:", error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const eventSource = new EventSource(
      `${API_URL}/api/overlay/${encodeURIComponent(token)}/events`
    );
    eventSource.onmessage = (event) => {
      try {
        const alert = JSON.parse(event.data);
        if (activeAlertRef.current) {
          alertQueueRef.current.push(alert);
        } else {
          activeAlertRef.current = alert;
          setExiting(false);
          setActiveAlert(alert);
        }
      } catch (error) {
        console.error("Received an invalid overlay alert:", error);
      }
    };
    eventSource.addEventListener("settings", (event) => {
      try {
        setSettings(JSON.parse(event.data));
      } catch (error) {
        console.error("Received invalid overlay settings:", error);
      }
    });
    eventSource.onerror = (error) => {
      console.error("Overlay alert stream disconnected; EventSource will retry.", error);
    };

    return () => eventSource.close();
  }, [token]);

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
    <main className="overlay-canvas" aria-live="polite">
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
