const assert = require("node:assert/strict");
const express = require("express");
const test = require("node:test");
const ownerRouter = require("../routes/owner");

const previousPassword = process.env.OWNER_PASSWORD;
const previousJwtSecret = process.env.OWNER_JWT_SECRET;
let server;
let baseUrl;

test.before(async () => {
  process.env.OWNER_PASSWORD = "test-owner-password";
  process.env.OWNER_JWT_SECRET =
    "test-owner-jwt-secret-that-is-at-least-32-characters-long";

  const app = express();
  app.use(express.json());
  app.use("/api/owner", ownerRouter);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (previousPassword === undefined) {
    delete process.env.OWNER_PASSWORD;
  } else {
    process.env.OWNER_PASSWORD = previousPassword;
  }

  if (previousJwtSecret === undefined) {
    delete process.env.OWNER_JWT_SECRET;
  } else {
    process.env.OWNER_JWT_SECRET = previousJwtSecret;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("owner-only APIs reject a request without a login cookie", async () => {
  const response = await fetch(`${baseUrl}/api/owner/session`);
  assert.equal(response.status, 401);
});

test("owner login issues an httpOnly JWT cookie accepted by protected APIs", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/owner/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "test-owner-password" }),
  });

  assert.equal(loginResponse.status, 200);
  const setCookie = loginResponse.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  const cookie = setCookie.split(";")[0];

  const sessionResponse = await fetch(`${baseUrl}/api/owner/session`, {
    headers: { Cookie: cookie },
  });
  assert.equal(sessionResponse.status, 200);
  assert.deepEqual(await sessionResponse.json(), {
    loggedIn: true,
    streamerId: "default",
  });
});

test("owner login rejects an incorrect password", async () => {
  const response = await fetch(`${baseUrl}/api/owner/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong-password" }),
  });
  assert.equal(response.status, 401);
});
