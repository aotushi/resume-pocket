import test from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { authOptions, hasAdminAccess } from "../app/lib/auth-options.ts";

const baseURL = "http://localhost:5173";
const password = "Synthetic-original-password-123";
const cookieOf = (response) => response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");

function fixture(deleteUserData) {
  const data = { user: [], session: [], account: [], verification: [] };
  const codes = new Map();
  const database = memoryAdapter(data);
  const common = { database, baseURL, secret: "synthetic-test-secret-at-least-32-characters", rateLimit: { enabled: false } };
  // Reproduce credentials/cached sessions issued by the version being replaced.
  const legacy = betterAuth({ ...common, emailAndPassword: { enabled: true }, session: { cookieCache: { enabled: true } } });
  const auth = betterAuth(authOptions({ ...common,
    deleteUserData,
    sendCode: async ({ email, otp, type }) => { codes.set(`${email}:${type}`, otp); },
    revokeUnverifiedAccess: async (userId) => {
      for (const table of [data.session, data.account]) {
        for (let index = table.length - 1; index >= 0; index--) if (table[index].userId === userId) table.splice(index, 1);
      }
    },
  }));
  const call = (path, body, cookie = "", service = auth) => service.handler(new Request(`${baseURL}/api/auth${path}`, {
    method: body ? "POST" : "GET", headers: { origin: baseURL, "content-type": "application/json", cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  const seed = async (email) => {
    const response = await call("/sign-up/email", { email, password, name: "Synthetic user" }, "", legacy);
    assert.equal(response.status, 200);
    return cookieOf(response);
  };
  const otp = async (email, type = "sign-in") => {
    const response = await call("/email-otp/send-verification-otp", { email, type });
    assert.equal(response.status, 200);
    assert.ok(codes.get(`${email}:${type}`));
    return codes.get(`${email}:${type}`);
  };
  return { auth, data, call, seed, otp };
}

test("password registration is blocked, including a forged verification field and trailing slash", async () => {
  const { call, data } = fixture();
  for (const path of ["/sign-up/email", "/sign-up/email/"]) {
    const response = await call(path, { email: "new@example.invalid", name: "New", password, emailVerified: true });
    assert.equal(response.ok, false);
    assert.equal(cookieOf(response).includes("session_token="), false);
  }
  assert.equal(data.user.length, 0);
});

test("legacy unverified sessions cannot enter account APIs or gain admin access", async () => {
  const { call, seed, data } = fixture();
  const email = "admin@example.invalid";
  const cookie = await seed(email);
  assert.ok(cookie.includes("session_data="), "test must include the old signed cookie cache");
  assert.equal((await call("/sign-in/email", { email, password })).status, 403);
  assert.equal(await (await call("/get-session", null, cookie)).json(), null);
  assert.equal((await call("/update-user", { name: "Attacker" }, cookie)).status, 403);
  assert.equal((await call("/change-password", { currentPassword: password, newPassword: `${password}new` }, cookie)).status, 403);
  assert.equal(data.user[0].name, "Synthetic user");
  assert.equal(hasAdminAccess(data.user[0], email), false);
  assert.equal(hasAdminAccess({ email, emailVerified: true }, " ADMIN@example.invalid "), true);
  assert.equal(hasAdminAccess({ email: "other@example.invalid", emailVerified: true }, email), false);
});

test("OTP signup requires proof, rejects replay, and preserves verified profile updates", async () => {
  const { call, otp, data } = fixture();
  const email = "new@example.invalid";
  assert.equal((await call("/sign-in/email-otp", { email, otp: "000000", emailVerified: true })).ok, false);
  assert.equal(data.user.length, 0);
  const code = await otp(email);
  const response = await call("/sign-in/email-otp", { email, otp: code, name: "New user" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.emailVerified, true);
  const cookie = cookieOf(response);
  assert.equal((await call("/update-user", { name: "Updated" }, cookie)).status, 200);
  assert.equal((await (await call("/get-session", null, cookie)).json()).user.name, "Updated");
  assert.equal((await call("/sign-in/email-otp", { email, otp: code })).ok, false);
});

test("OTP recovery removes a pre-registration's password and cached session permanently", async () => {
  const { call, seed, otp, data } = fixture();
  const email = "recovery@example.invalid";
  const attackerCookie = await seed(email);
  const response = await call("/sign-in/email-otp", { email, otp: await otp(email) }, attackerCookie);
  assert.equal(response.status, 200);
  assert.equal(data.user[0].emailVerified, true);
  assert.equal((await call("/sign-in/email", { email, password })).ok, false);
  assert.equal(await (await call("/get-session", null, attackerCookie)).json(), null);
  assert.equal((await call("/update-user", { name: "Takeover" }, attackerCookie)).ok, false);
  assert.equal((await call("/update-user", { name: "Owner" }, cookieOf(response))).status, 200);
});

test("password reset verifies ownership, revokes old sessions, and preserves the new password", async () => {
  const { call, seed, otp } = fixture();
  const email = "reset@example.invalid";
  const attackerCookie = await seed(email);
  const newPassword = `${password}-reset`;
  assert.equal((await call("/email-otp/reset-password", { email, password: newPassword, otp: await otp(email, "forget-password") }, attackerCookie)).status, 200);
  assert.equal(await (await call("/get-session", null, attackerCookie)).json(), null);
  assert.equal((await call("/update-user", { name: "Takeover" }, attackerCookie)).ok, false);
  assert.equal((await call("/sign-in/email", { email, password })).ok, false);
  const signedIn = await call("/sign-in/email", { email, password: newPassword });
  assert.equal(signedIn.status, 200);
  const ownerCookie = cookieOf(signedIn);
  assert.equal((await call("/change-password", { currentPassword: newPassword, newPassword: `${newPassword}-again` }, ownerCookie)).status, 200);
});

test("standalone email verification also strips unproven credentials and sessions", async () => {
  const { call, seed, otp } = fixture();
  const email = "verify@example.invalid";
  const attackerCookie = await seed(email);
  assert.equal((await call("/email-otp/verify-email", { email, otp: await otp(email, "email-verification") })).status, 200);
  assert.equal((await call("/sign-in/email", { email, password })).ok, false);
  assert.equal(await (await call("/get-session", null, attackerCookie)).json(), null);
  assert.equal((await call("/update-user", { name: "Takeover" }, attackerCookie)).ok, false);
  assert.equal((await call("/sign-in/email-otp", { email, otp: await otp(email) })).status, 200);
});

test("an existing verified password account continues to work", async () => {
  const { call, seed, data } = fixture();
  const email = "verified@example.invalid";
  const cookie = await seed(email);
  data.user[0].emailVerified = true;
  assert.equal((await call("/sign-in/email", { email, password })).status, 200);
  assert.equal((await (await call("/get-session", null, cookie)).json()).user.emailVerified, true);
});

test("account deletion rejects anonymous, unverified, and stale sessions; fresh verification deletes only the owner", async () => {
  const cleaned = [];
  const { call, seed, otp, data } = fixture(async (user) => { cleaned.push(user.id); });
  const email = "delete@example.invalid";
  assert.equal((await call("/delete-user", {})).ok, false);
  const legacyCookie = await seed(email);
  assert.equal((await call("/delete-user", {}, legacyCookie)).status, 403);
  const other = "keep@example.invalid";
  const otherResponse = await call("/sign-in/email-otp", { email: other, otp: await otp(other) });
  const ownerResponse = await call("/sign-in/email-otp", { email, otp: await otp(email) });
  const owner = data.user.find((user) => user.email === email);
  const staleCookie = cookieOf(ownerResponse);
  data.session.find((session) => session.userId === owner.id).createdAt = new Date(Date.now() - 6 * 60_000);
  assert.equal((await call("/delete-user", {}, staleCookie)).ok, false);
  assert.deepEqual(cleaned, []);
  const fresh = await call("/sign-in/email-otp", { email, otp: await otp(email) });
  assert.equal((await call("/delete-user", {}, cookieOf(fresh))).status, 200);
  assert.deepEqual(cleaned, [owner.id]);
  assert.equal(data.user.some((user) => user.id === owner.id), false);
  assert.equal(data.session.some((session) => session.userId === owner.id), false);
  assert.equal(await (await call("/get-session", null, staleCookie)).json(), null);
  assert.equal(await (await call("/get-session", null, cookieOf(fresh))).json(), null);
  assert.equal((await (await call("/get-session", null, cookieOf(otherResponse))).json()).user.email, other);
});

test("failed account cleanup leaves an authenticated owner able to retry", async () => {
  let fail = true;
  const { call, otp, data } = fixture(async () => { if (fail) throw new Error("injected cleanup failure"); });
  const email = "retry@example.invalid";
  const response = await call("/sign-in/email-otp", { email, otp: await otp(email) });
  const cookie = cookieOf(response);
  assert.equal((await call("/delete-user", {}, cookie)).status, 500);
  assert.equal(data.user.length, 1);
  assert.equal((await (await call("/get-session", null, cookie)).json()).user.email, email);
  fail = false;
  assert.equal((await call("/delete-user", {}, cookie)).status, 200);
  assert.equal(data.user.length, 0);
});
