const OverlaySettings = require("../models/OverlaySettings");

const subscribersByStreamer = new Map();

function subscribeToOverlay(streamerId, token, response) {
  let subscribers = subscribersByStreamer.get(streamerId);
  if (!subscribers) {
    subscribers = new Map();
    subscribersByStreamer.set(streamerId, subscribers);
  }

  subscribers.set(response, token);

  return () => {
    subscribers.delete(response);
    if (subscribers.size === 0) {
      subscribersByStreamer.delete(streamerId);
    }
  };
}

function publishAlert(streamerId, alert) {
  const subscribers = subscribersByStreamer.get(streamerId);
  if (!subscribers) return 0;

  if (
    typeof alert.name !== "string" ||
    typeof alert.amount !== "number" ||
    !Number.isFinite(alert.amount)
  ) {
    console.error("Skipped an overlay alert with invalid display data");
    return 0;
  }

  const safeAlert = { name: alert.name.slice(0, 50), amount: alert.amount };
  if (typeof alert.message === "string") {
    const trimmed = alert.message.trim();
    if (trimmed) safeAlert.message = trimmed.slice(0, 300);
  }
  const message = `data: ${JSON.stringify(safeAlert)}\n\n`;
  let delivered = 0;
  for (const response of subscribers.keys()) {
    if (response.destroyed || response.writableEnded) {
      subscribers.delete(response);
      continue;
    }

    try {
      response.write(message);
      delivered += 1;
    } catch (error) {
      console.error("Could not send overlay alert:", error.message);
      subscribers.delete(response);
    }
  }

  if (subscribers.size === 0) {
    subscribersByStreamer.delete(streamerId);
  }
  return delivered;
}

function publishSettingsUpdated(streamerId, settings) {
  const subscribers = subscribersByStreamer.get(streamerId);
  if (!subscribers) return;

  const message = `event: settings\ndata: ${JSON.stringify(settings)}\n\n`;
  for (const response of subscribers.keys()) {
    if (response.destroyed || response.writableEnded) {
      subscribers.delete(response);
      continue;
    }

    try {
      response.write(message);
    } catch (error) {
      console.error("Could not update overlay settings:", error.message);
      subscribers.delete(response);
    }
  }

  if (subscribers.size === 0) {
    subscribersByStreamer.delete(streamerId);
  }
}

function revokeOverlayToken(token) {
  for (const [streamerId, subscribers] of subscribersByStreamer) {
    for (const [response, subscriberToken] of subscribers) {
      if (subscriberToken !== token) continue;
      subscribers.delete(response);
      try {
        response.end();
      } catch (error) {
        console.error("Could not close revoked overlay connection:", error.message);
      }
    }

    if (subscribers.size === 0) {
      subscribersByStreamer.delete(streamerId);
    }
  }
}

async function publishPaidDonation(donation) {
  try {
    const settings = await OverlaySettings.findOne({
      streamerId: donation.streamerId,
    })
      .select("minimumAmount")
      .lean();
    const amount = Number(donation.amount.toString());
    if (amount < (settings?.minimumAmount ?? 1)) return;

    publishAlert(donation.streamerId, {
      name: donation.donorName,
      amount,
      message: donation.message || "",
    });
  } catch (error) {
    console.error("Could not prepare paid donation alert:", error.message);
  }
}

module.exports = {
  publishAlert,
  publishPaidDonation,
  publishSettingsUpdated,
  revokeOverlayToken,
  subscribeToOverlay,
};
