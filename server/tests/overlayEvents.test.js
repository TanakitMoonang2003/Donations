const assert = require("node:assert/strict");
const test = require("node:test");
const {
  publishAlert,
  publishSettingsUpdated,
  revokeOverlayToken,
  subscribeToOverlay,
} = require("../services/overlayEvents");

test("overlay alerts send display name, amount, and donor message", () => {
  const messages = [];
  const response = {
    destroyed: false,
    writableEnded: false,
    write(message) {
      messages.push(message);
    },
    end() {
      this.writableEnded = true;
    },
  };

  const unsubscribe = subscribeToOverlay("events-test", "token-test", response);
  const delivered = publishAlert("events-test", {
    name: "Test supporter",
    amount: 50,
    message: "  hello streamer  ",
    privateMessage: "not sent",
  });

  assert.deepEqual(JSON.parse(messages[0].replace(/^data: |\n\n$/g, "")), {
    name: "Test supporter",
    amount: 50,
    message: "hello streamer",
  });
  assert.equal(delivered, 1);

  unsubscribe();
});

test("publishing an alert reports when no overlay is connected", () => {
  assert.equal(
    publishAlert("disconnected-overlay-test", { name: "Test", amount: 1 }),
    0
  );
});

test("settings updates reach connected overlays and revoked tokens are closed", () => {
  const messages = [];
  const response = {
    destroyed: false,
    writableEnded: false,
    write(message) {
      messages.push(message);
    },
    end() {
      this.writableEnded = true;
    },
  };
  subscribeToOverlay("rotation-test", "old-token", response);

  publishSettingsUpdated("rotation-test", { fontSize: 32 });
  assert.match(messages[0], /event: settings/);

  revokeOverlayToken("old-token");
  assert.equal(response.writableEnded, true);
  publishAlert("rotation-test", { name: "Test", amount: 1 });
  assert.equal(messages.length, 1);
});
