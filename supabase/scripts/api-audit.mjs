#!/usr/bin/env node
// Grants and RLS audit over the real Data API, using only the public anon key: everyone can read,
// the anon key alone can't write anything, and (with --signup) one signed-in user can't insert as,
// edit or delete another user's rows.
//
//   node supabase/scripts/api-audit.mjs                      # local stack, anon checks
//   node supabase/scripts/api-audit.mjs --signup             # local stack, plus two throwaway users
//   node supabase/scripts/api-audit.mjs <SUPABASE_URL> <ANON_KEY>   # prod, anon checks only
//
// --signup creates two email/password users, so only use it against the local stack. The pgTAP
// suite (supabase/tests) covers the same rules inside the database.

const args = process.argv.slice(2);
const signup = args.includes("--signup");
const [url = "http://127.0.0.1:54321", anonKey = LOCAL_ANON_KEY()] =
  args.filter((arg) => !arg.startsWith("--"));

function LOCAL_ANON_KEY() {
  // The local stack's well-known demo anon key (same value as web/.env.example).
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
}

let failures = 0;

async function request(method, path, { body, token, prefer } = {}) {
  const headers = { apikey: anonKey, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON; keep the text for the report.
  }
  return { status: response.status, json, text };
}

function check(description, passed, detail) {
  console.log(
    `${passed ? "ok  " : "FAIL"}  ${description}${passed ? "" : `  (${detail})`}`,
  );
  if (!passed) failures++;
}

async function expectStatus(description, method, path, allowed, options) {
  const result = await request(method, path, options);
  check(
    description,
    allowed.includes(result.status),
    `HTTP ${result.status}: ${result.text.slice(0, 160)}`,
  );
  return result;
}

const DENIED = [401, 403];
const newSubmission = (deviceId, extra = {}) => ({
  device_id: deviceId,
  device_count: 1,
  raw_command: "llama-bench -m audit.gguf",
  runtime: "llama.cpp",
  model: "audit-model",
  gen_tok_s: 10,
  prompt_tok_s: 100,
  ...extra,
});

console.log(`Auditing ${url}\n`);

// ---------------------------------------------------------------------------------------------
// Anonymous: read everything public, write nothing.
for (const table of [
  "devices",
  "device_aliases",
  "submissions",
  "results_by_device",
]) {
  await expectStatus(
    `anon can read ${table}`,
    "GET",
    `/rest/v1/${table}?limit=1`,
    [200],
  );
}

const devices = await request("GET", "/rest/v1/devices?select=id&limit=1");
const deviceId = devices.json?.[0]?.id;
check(
  "there is at least one device to test against",
  deviceId !== undefined,
  devices.text,
);

await expectStatus(
  "anon cannot add a device",
  "POST",
  "/rest/v1/devices",
  DENIED,
  {
    body: { name: "Audit GPU" },
  },
);
await expectStatus(
  "anon cannot edit devices",
  "PATCH",
  `/rest/v1/devices?id=eq.${deviceId}`,
  DENIED,
  {
    body: { vram_gb: 1 },
  },
);
await expectStatus(
  "anon cannot delete devices",
  "DELETE",
  `/rest/v1/devices?id=eq.${deviceId}`,
  DENIED,
);
await expectStatus(
  "anon cannot add aliases",
  "POST",
  "/rest/v1/device_aliases",
  DENIED,
  {
    body: { normalized_alias: "audit alias", device_id: deviceId },
  },
);
await expectStatus(
  "anon cannot delete aliases",
  "DELETE",
  "/rest/v1/device_aliases?device_id=gt.0",
  DENIED,
);
await expectStatus(
  "anon cannot submit results",
  "POST",
  "/rest/v1/submissions",
  DENIED,
  {
    body: newSubmission(deviceId),
  },
);
await expectStatus(
  "anon cannot edit submissions",
  "PATCH",
  "/rest/v1/submissions?id=gt.0",
  DENIED,
  {
    body: { gen_tok_s: 1 },
  },
);
await expectStatus(
  "anon cannot delete submissions",
  "DELETE",
  "/rest/v1/submissions?id=gt.0",
  DENIED,
);
// Postgres refuses writes to an aggregate view before it checks privileges, so any error counts.
const viewWrite = await request("POST", "/rest/v1/results_by_device", {
  body: { model: "x" },
});
check(
  "anon cannot write through the view",
  viewWrite.status >= 400,
  `HTTP ${viewWrite.status}`,
);
await expectStatus(
  "anon cannot call database functions",
  "POST",
  "/rest/v1/rpc/normalize_device_name",
  DENIED.concat([404]),
  { body: { raw: "RTX 4090" } },
);

// ---------------------------------------------------------------------------------------------
// Two signed-in users: each can only write as themselves.
if (signup) {
  const session = async (name) => {
    const email = `audit-${name}-${Date.now()}@example.com`;
    const result = await request("POST", "/auth/v1/signup", {
      body: {
        email,
        password: `audit-${Math.random().toString(36).slice(2)}-Aa1`,
      },
    });
    return { id: result.json?.user?.id, token: result.json?.access_token };
  };
  const alice = await session("alice");
  const bob = await session("bob");
  check(
    "signed up two throwaway users",
    Boolean(alice.token && bob.token),
    "signup failed; is email confirmation off?",
  );

  const created = await expectStatus(
    "a user can submit a result",
    "POST",
    "/rest/v1/submissions",
    [201],
    {
      token: alice.token,
      body: newSubmission(deviceId),
      prefer: "return=representation",
    },
  );
  const aliceRow = created.json?.[0];
  check(
    "the result belongs to that user",
    aliceRow?.user_id === alice.id,
    JSON.stringify(aliceRow),
  );

  await expectStatus(
    "a user cannot submit as someone else",
    "POST",
    "/rest/v1/submissions",
    DENIED,
    {
      token: bob.token,
      body: newSubmission(deviceId, { user_id: alice.id }),
    },
  );
  await expectStatus(
    "a user cannot backdate a submission",
    "POST",
    "/rest/v1/submissions",
    DENIED,
    {
      token: bob.token,
      body: newSubmission(deviceId, { created_at: "2000-01-01T00:00:00Z" }),
    },
  );
  await expectStatus(
    "a user cannot edit another user's result",
    "PATCH",
    `/rest/v1/submissions?id=eq.${aliceRow?.id}`,
    DENIED,
    {
      token: bob.token,
      body: { gen_tok_s: 99999 },
    },
  );
  const bobDelete = await request(
    "DELETE",
    `/rest/v1/submissions?id=eq.${aliceRow?.id}`,
    {
      token: bob.token,
      prefer: "return=representation",
    },
  );
  check(
    "a user cannot delete another user's result",
    bobDelete.status < 300 &&
      Array.isArray(bobDelete.json) &&
      bobDelete.json.length === 0,
    `HTTP ${bobDelete.status}: ${bobDelete.text.slice(0, 160)}`,
  );
  await expectStatus(
    "a user cannot add a curated device",
    "POST",
    "/rest/v1/devices",
    DENIED,
    {
      token: bob.token,
      body: { name: `Audit Curated ${Date.now()}`, status: "curated" },
    },
  );
  const aliceDelete = await request(
    "DELETE",
    `/rest/v1/submissions?id=eq.${aliceRow?.id}`,
    {
      token: alice.token,
      prefer: "return=representation",
    },
  );
  check(
    "a user can delete their own result",
    aliceDelete.status < 300 && aliceDelete.json?.length === 1,
    `HTTP ${aliceDelete.status}: ${aliceDelete.text.slice(0, 160)}`,
  );
}

console.log(
  failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
