function formatAlertMessage(template, alert) {
  return template
    .replace(/\{name\}/g, alert.name ?? "")
    .replace(/\{amount\}/g, String(alert.amount ?? ""))
    .replace(/\{message\}/g, alert.message ?? "");
}

export default function AlertVisual({ settings, alert }) {
  const messageInTemplate = settings.messageTemplate.includes("{message}");
  const donorMessage =
    typeof alert.message === "string" ? alert.message.trim() : "";

  return (
    <div
      className="alert-visual"
      style={{
        backgroundColor: settings.backgroundColor,
        color: settings.textColor,
        fontFamily: settings.fontFamily,
        fontSize: `${settings.fontSize}px`,
      }}
    >
      {settings.mediaUrl ? (
        <img className="alert-visual-media" src={settings.mediaUrl} alt="" />
      ) : null}
      <div className="alert-visual-copy">
        <div>{formatAlertMessage(settings.messageTemplate, alert)}</div>
        {donorMessage && !messageInTemplate ? (
          <p className="alert-visual-donor-message">“{donorMessage}”</p>
        ) : null}
      </div>
    </div>
  );
}
