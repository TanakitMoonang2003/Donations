const assert = require("node:assert/strict");
const express = require("express");
const test = require("node:test");
const uploadSlip = require("../middleware/uploadSlip");

let server;
let baseUrl;

test.before(async () => {
  const app = express();
  app.post("/upload", uploadSlip, (req, res) => {
    res.json({ byteLength: req.file.buffer.length });
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("accepts a supported image into memory", async () => {
  const form = new FormData();
  form.append("slip", new Blob(["png test data"], { type: "image/png" }), "slip.png");
  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    body: form,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { byteLength: 13 });
});

test("rejects unsupported file types", async () => {
  const form = new FormData();
  form.append("slip", new Blob(["gif"], { type: "image/gif" }), "slip.gif");
  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    body: form,
  });

  assert.equal(response.status, 415);
});

test("rejects files larger than 5 MB", async () => {
  const form = new FormData();
  form.append(
    "slip",
    new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: "image/jpeg" }),
    "slip.jpg"
  );
  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    body: form,
  });

  assert.equal(response.status, 413);
});
