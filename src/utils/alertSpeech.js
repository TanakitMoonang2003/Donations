export function formatAlertTemplate(template, alert) {
  return template
    .replace(/\{name\}/g, alert.name ?? "")
    .replace(/\{amount\}/g, String(alert.amount ?? ""))
    .replace(/\{message\}/g, alert.message ?? "");
}

export function speakAlertText(text, { lang = "th-TH", rate = 1 } = {}) {
  const trimmed = text.trim();
  if (!trimmed || typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = lang;
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

export function cancelAlertSpeech() {
  window.speechSynthesis?.cancel();
}
