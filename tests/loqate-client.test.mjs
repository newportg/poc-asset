import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const clientSource = await readFile(new URL("../src/loqate-client.js", import.meta.url), "utf8");

function createClient(fetch) {
  const context = { window: {}, fetch, URL };
  runInNewContext(clientSource, context);
  return context.window.LoqateClient;
}

function jsonResponse(data, ok = true, status = 200) {
  return { ok, status, json: async () => data };
}

test("Address API search returns address results", async () => {
  const requests = [];
  const client = createClient(async (url, options) => {
    requests.push({ url: new URL(url), options });
    return jsonResponse({
      items: [{ id: "GB-ADDRESS", text: "93 Teagues Crescent", description: "Telford TF2 6RF" }]
    });
  });

  const results = await client.search("test-key", "GB", "TF2 6RF");
  assert.deepEqual(JSON.parse(JSON.stringify(results)), [
    { id: "GB-ADDRESS", text: "93 Teagues Crescent", description: "Telford TF2 6RF" }
  ]);
  assert.equal(requests[0].url.pathname, "/api/addresses/search");
  assert.equal(requests[0].url.searchParams.get("country"), "GB");
  assert.equal(requests[0].url.searchParams.get("q"), "TF2 6RF");
  assert.equal(requests[0].options.headers["X-Loqate-Api-Key"], "test-key");
});

test("Address API retrieve returns verified details", async () => {
  let requestOptions;
  const client = createClient(async (url, options) => {
    requestOptions = { url: String(url), options };
    return jsonResponse({ Address1: "93 Teagues Crescent", Latitude: "52.7", Longitude: "-2.4" });
  });

  const result = await client.retrieve("test-key", {
    id: "GB-ADDRESS", text: "93 Teagues Crescent", description: "Telford TF2 6RF"
  }, "GB");
  assert.equal(result.Address1, "93 Teagues Crescent");
  assert.match(requestOptions.url, /\/api\/addresses\/retrieve$/);
  const payload = JSON.parse(requestOptions.options.body);
  assert.equal(requestOptions.options.headers["X-Loqate-Api-Key"], "test-key");
  assert.equal(payload.id, "GB-ADDRESS");
  assert.equal(payload.country, "GB");
});

test("Address API errors are surfaced", async () => {
  const apiError = createClient(async () => jsonResponse({ detail: "Loqate rejected the request." }, false, 502));
  await assert.rejects(apiError.search("bad-key", "GB", "TF2 6RF"), /Loqate rejected the request/);

  const httpError = createClient(async () => jsonResponse({}, false, 503));
  await assert.rejects(httpError.search("test-key", "GB", "TF2 6RF"), /HTTP 503/);
});
