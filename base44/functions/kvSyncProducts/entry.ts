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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const token = await getToken();

    // Lấy tất cả sản phẩm (phân trang, tối đa 200)
    let allProducts = [];
    let currentItem = 0;
    const pageSize = 100;

    while (true) {
      const res = await fetch(`${MOCK_BASE}/kvProducts?pageSize=${pageSize}&currentItem=${currentItem}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      const items = data.data || [];
      allProducts = allProducts.concat(items);
      if (items.length < pageSize || allProducts.length >= 200) break;
      currentItem += pageSize;
    }

    // Đồng bộ vào SparePart entity
    const SparePart = base44.asServiceRole.entities.SparePart;
    let updated = 0;
    let created = 0;

    for (const p of allProducts) {
      const existing = await SparePart.filter({ kv_id: p.id });
      const partData = {
        kv_id: p.id,
        name: p.name,
        sku: p.code || "",
        price: p.sellPrice || 0,
        stock_qty: p.onHand || 0,
        category: p.categoryName || "Linh kiện",
        is_active: p.isActive !== false,
      };

      if (existing.length > 0) {
        await SparePart.update(existing[0].id, partData);
        updated++;
      } else {
        await SparePart.create(partData);
        created++;
      }
    }

    return Response.json({ success: true, total: allProducts.length, created, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});