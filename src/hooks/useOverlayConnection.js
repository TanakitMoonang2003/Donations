import { useEffect, useState } from "react";
import { API_URL } from "../config/apiUrl.js";

export const OVERLAY_DEFAULT_SETTINGS = {
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
  goalTitle: "เป้าหมายโดเนท",
  goalTarget: 10000,
  goalDeadline: null,
  goalPosition: "right",
  goalFillColor: "#7ad7a9",
  goalTrackColor: "#3a3a52",
  goalCurrent: 0,
};

export function useOverlayConnection(token, { listenAlerts = false, onAlertRef } = {}) {
  const [settings, setSettings] = useState(OVERLAY_DEFAULT_SETTINGS);
  const [loadError, setLoadError] = useState("");

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
    setLoadError("");

    fetch(`${API_URL}/api/overlay/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Overlay token is invalid");
        if (!cancelled) {
          setSettings((current) => ({
            ...current,
            ...data.settings,
            goalTarget: data.settings.goalTarget ?? current.goalTarget,
            goalCurrent: data.settings.goalCurrent ?? 0,
          }));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message);
          console.error("Could not load overlay settings:", error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const eventSource = new EventSource(
      `${API_URL}/api/overlay/${encodeURIComponent(token)}/events`
    );

    if (listenAlerts) {
      eventSource.onmessage = (event) => {
        try {
          const alert = JSON.parse(event.data);
          onAlertRef?.current?.(alert);
        } catch (error) {
          console.error("Received an invalid overlay alert:", error);
        }
      };
    }

    eventSource.addEventListener("settings", (event) => {
      try {
        setSettings((current) => ({
          ...current,
          ...JSON.parse(event.data),
        }));
      } catch (error) {
        console.error("Received invalid overlay settings:", error);
      }
    });

    eventSource.addEventListener("goal-progress", (event) => {
      try {
        const { current } = JSON.parse(event.data);
        if (typeof current === "number" && Number.isFinite(current)) {
          setSettings((prev) => ({ ...prev, goalCurrent: current }));
        }
      } catch (error) {
        console.error("Received invalid goal progress:", error);
      }
    });

    eventSource.onerror = (error) => {
      console.error("Overlay stream disconnected; EventSource will retry.", error);
    };

    return () => eventSource.close();
  }, [token, listenAlerts, onAlertRef]);

  return { settings, loadError };
}
