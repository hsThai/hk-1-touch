import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const MOCK_BASE = "https://kios-thong.base44.app/api/functions";
const CLIENT_ID = "kv_bwxujxxg49ajmua5j7u66jv7";
const CLIENT_SECRET = "kvsec_px14zd40raoywc9tqnabn3c3efu92tu4p6yqod0z";

async function getToken() {
  const res = await fetch(`${MOCK_BASE}/kvToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "client_credentials" }),
  });
  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { name = "" } = body;

    const token = await getToken();

    const params = new URLSearchParams({ pageSize: "20", currentItem: "0" });
    if (name) params.set("name", name);

    const res = await fetch(`${MOCK_BASE}/kvProducts?${params}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await res.json();

    return Response.json({ products: data.data || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});