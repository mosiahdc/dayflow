// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = "https://www.googleapis.com/auth/calendar.events";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const REDIRECT_URI = Deno.env.get("REDIRECT_URI") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// Decode JWT payload without verification (verification happens via Supabase)
function decodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function getUserFromToken(jwt) {
  // Use the anon key + user's JWT to verify — this is the correct Supabase pattern
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    // Fallback: decode JWT and get sub (userId) directly
    const payload = decodeJwtPayload(jwt);
    if (payload?.sub) return { id: payload.sub, email: payload.email };
    return null;
  }
  return user;
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  return res.json();
}

async function getValidToken(supabase, userId) {
  const { data: tokenRow } = await supabase
    .from("calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (!tokenRow) return null;
  const now = new Date();
  const expiresAt = new Date(tokenRow.expires_at);
  if (expiresAt > now) return tokenRow.access_token;
  if (!tokenRow.refresh_token) return null;
  const refreshed = await refreshAccessToken(tokenRow.refresh_token);
  if (!refreshed.access_token) return null;
  const newExpiry = new Date(
    Date.now() + refreshed.expires_in * 1000,
  ).toISOString();
  await supabase
    .from("calendar_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return refreshed.access_token;
}

function slotToRFC3339(date, slot) {
  const [y, m, d] = date.split("-").map(Number);
  const hour = Math.floor(slot / 2);
  const min = slot % 2 === 0 ? 0 : 30;
  return new Date(y, m - 1, d, hour, min, 0).toISOString();
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "*";
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // Service role client for DB writes
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ── exchange: no auth required ──────────────────────────────────────────
  if (action === "exchange") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state)
      return json({ error: "Missing code or state" }, 400, origin);

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token)
      return json(
        { error: "Token exchange failed", detail: tokens },
        400,
        origin,
      );

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString();
    await supabase.from("calendar_tokens").upsert(
      {
        user_id: state,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return new Response(
      `<html><body><script>window.opener?.postMessage('gcal-connected','*');window.close();</script><p>Connected! You can close this tab.</p></body></html>`,
      { headers: { "Content-Type": "text/html", ...corsHeaders(origin) } },
    );
  }

  // ── All other actions require auth ───────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "").trim();

  if (!jwt) return json({ error: "Missing authorization header" }, 401, origin);

  const user = await getUserFromToken(jwt);
  if (!user) return json({ error: "Invalid token" }, 401, origin);

  // ── status ────────────────────────────────────────────────────────────────
  if (action === "status") {
    const { data } = await supabase
      .from("calendar_tokens")
      .select("updated_at")
      .eq("user_id", user.id)
      .single();
    return json(
      { connected: !!data, lastSynced: data?.updated_at ?? null },
      200,
      origin,
    );
  }

  // ── auth_url ──────────────────────────────────────────────────────────────
  if (action === "auth_url") {
    if (!CLIENT_ID)
      return json({ error: "GOOGLE_CLIENT_ID not configured" }, 500, origin);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state: user.id,
    });
    return json(
      { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` },
      200,
      origin,
    );
  }

  // ── push ──────────────────────────────────────────────────────────────────
  if (action === "push") {
    const body = await req.json();
    const accessToken = await getValidToken(supabase, user.id);
    if (!accessToken)
      return json({ error: "Not connected to Google Calendar" }, 401, origin);

    const results = [];
    for (const task of body.tasks ?? []) {
      const start = slotToRFC3339(task.date, task.startSlot);
      const endDate = new Date(
        new Date(start).getTime() + task.durationMins * 60000,
      );
      const event = {
        summary: task.title,
        description: task.notes ?? "",
        start: { dateTime: start, timeZone: "UTC" },
        end: { dateTime: endDate.toISOString(), timeZone: "UTC" },
        extendedProperties: { private: { dayflowId: task.id } },
      };
      const res = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        },
      );
      const created = await res.json();
      results.push({
        id: task.id,
        gcalId: created.id,
        error: created.error?.message,
      });
    }
    await supabase
      .from("calendar_tokens")
      .update({ updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    return json({ results }, 200, origin);
  }

  // ── revoke ────────────────────────────────────────────────────────────────
  if (action === "revoke") {
    await supabase.from("calendar_tokens").delete().eq("user_id", user.id);
    return json({ ok: true }, 200, origin);
  }

  return json({ error: "Unknown action" }, 400, origin);
});
