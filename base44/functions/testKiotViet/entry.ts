import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const MOCK_BASE = "https://kios-thong.base44.app/api/functions";
const CLIENT_ID = "kv_bwxujxxg49ajmua5j7u66jv7";
const CLIENT_SECRET = "kvsec_px14zd40raoywc9tqnabn3c3efu92tu4p6yqod0z";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const results = {};

    // Step 1: Lấy Access Token
    const tokenRes = await fetch(`${MOCK_BASE}/kvToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials"
      }),
    });
    const tokenData = await tokenRes.json().catch(() => null);
    results.token_step = { status: tokenRes.status, data: tokenData };

    const accessToken = tokenData?.access_token;
    if (!accessToken) {
      results.error = "Không lấy được access_token";
      return Response.json(results);
    }

    results.access_token = accessToken;

    // Step 2: Lấy danh sách sản phẩm
    const productsRes = await fetch(`${MOCK_BASE}/kvProducts?pageSize=5&currentItem=0`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const productsData = await productsRes.json().catch(() => null);
    results.products = { status: productsRes.status, data: productsData };

    // Step 3: Lấy danh sách khách hàng
    const customersRes = await fetch(`${MOCK_BASE}/kvCustomers?pageSize=5&currentItem=0`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const customersData = await customersRes.json().catch(() => null);
    results.customers = { status: customersRes.status, data: customersData };

    // Step 4: Lấy danh sách hóa đơn
    const invoicesRes = await fetch(`${MOCK_BASE}/kvInvoices?pageSize=5&currentItem=0`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const invoicesData = await invoicesRes.json().catch(() => null);
    results.invoices = { status: invoicesRes.status, data: invoicesData };

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});