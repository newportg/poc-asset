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

test("Loqate search drills into containers and returns address results", async () => {
  const requests = [];
  const client = createClient(async url => {
    requests.push(new URL(url));
    return requests.length === 1
      ? jsonResponse({ Items: [{ Id: "GB-POSTCODE", Type: "Postcode", Text: "TF2 6RF" }] })
      : jsonResponse({ Items: [{ Id: "GB-ADDRESS", Type: "Address", Text: "93 Teagues Crescent", Description: "Telford TF2 6RF" }] });
  });

  const results = await client.search("test-key", "GB", "TF2 6RF");
  assert.deepEqual(JSON.parse(JSON.stringify(results)), [
    { id: "GB-ADDRESS", text: "93 Teagues Crescent", description: "Telford TF2 6RF" }
  ]);
  assert.equal(requests[0].searchParams.get("Countries"), "GB");
  assert.equal(requests[0].searchParams.get("Text"), "TF2 6RF");
  assert.equal(requests[1].searchParams.get("Container"), "GB-POSTCODE");
});

test("Loqate retrieve requests verification with geocoding and returns a match", async () => {
  let requestOptions;
  const client = createClient(async (url, options) => {
    requestOptions = { url: String(url), options };
    return jsonResponse({ Items: [{ Matches: [{ Address1: "93 Teagues Crescent", Latitude: "52.7", Longitude: "-2.4" }] }] });
  });

  const result = await client.retrieve("test-key", {
    id: "GB-ADDRESS", text: "93 Teagues Crescent", description: "Telford TF2 6RF"
  }, "GB");
  assert.equal(result.Address1, "93 Teagues Crescent");
  assert.match(requestOptions.url, /Cleansing\/International\/Batch/);
  const payload = JSON.parse(requestOptions.options.body);
  assert.equal(payload.Key, "test-key");
  assert.equal(payload.GeoCode, true);
  assert.equal(payload.Addresses[0].Id, "GB-ADDRESS");
  assert.equal(payload.Addresses[0].Country, "GB");
});

test("Loqate API and HTTP errors are surfaced", async () => {
  const apiError = createClient(async () => jsonResponse({ Items: [{ Error: "6", Description: "Invalid key" }] }));
  await assert.rejects(apiError.search("bad-key", "GB", "TF2 6RF"), /LOQATE Error: Invalid key/);

  const httpError = createClient(async () => jsonResponse({}, false, 503));
  await assert.rejects(httpError.search("test-key", "GB", "TF2 6RF"), /HTTP 503/);
});
