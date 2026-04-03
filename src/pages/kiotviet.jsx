/**
 * KiotViet API Helper
 * Dùng chung cho toàn app — tìm khách, lấy tồn kho, tạo phiếu xuất
 * Mock server: https://kios-thong.base44.app
 */

import { AppSettings, Customer, SparePart } from "./pb.jsx";

// ─── Mock server config ────────────────────────────────────
// Đổi MOCK_MODE = false khi dùng KiotViet thật
const MOCK_MODE = true;
const MOCK_BASE = "https://kios-thong.base44.app/api/functions";
const KV_TOKEN_URL   = MOCK_MODE ? `${MOCK_BASE}/kvToken`    : "https://id.kiotviet.vn/connect/token";
const KV_API_BASE    = MOCK_MODE ? MOCK_BASE                  : "https://public.kiotapi.com";

// ─── Token cache ───────────────────────────────────────────
let _kvToken = null;
let _kvTokenExpiry = 0;

async function getKvConfig() {
  // Nếu mock mode — dùng credentials của KiosThong
  if (MOCK_MODE) {
    return {
      clientId:     "kv_bwxujxxg49ajmua5j7u66jv7",
      clientSecret: "kvsec_px14zd40raoywc9tqnabn3c3efu92tu4p6yqod0z",
      retailer:     "hkapp",
    };
  }
  try {
    const list = await AppSettings.list({ limit: 100 });
    const map = {};
    list.forEach(s => { map[s.key] = s.value; });
    return {
      clientId:     map["kv_client_id"]     || "",
      clientSecret: map["kv_client_secret"] || "",
      retailer:     map["kv_retailer"]      || "",
    };
  } catch { return { clientId:"", clientSecret:"", retailer:"" }; }
}

export async function getKvToken(forceRefresh = false) {
  if (!forceRefresh && _kvToken && Date.now() < _kvTokenExpiry) return _kvToken;
  const { clientId, clientSecret } = await getKvConfig();
  if (!clientId || !clientSecret) throw new Error("Chưa cấu hình KiotViet API");
  const res = await fetch(KV_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      scopes: "PublicApi.Access",
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Lấy token KiotViet thất bại");
  _kvToken = data.access_token;
  _kvTokenExpiry = Date.now() + (data.expires_in || 86400) * 1000 - 60000;
  return _kvToken;
}

async function kvGet(path, params = {}) {
  const { retailer } = await getKvConfig();
  const token = await getKvToken();
  // Map path KiotViet thật → KiosThong mock
  const mockPath = MOCK_MODE ? mapMockPath(path) : path;
  const baseUrl = MOCK_MODE ? `${KV_API_BASE}/${mockPath}` : `${KV_API_BASE}/${path}`;
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  const headers = { "Authorization": `Bearer ${token}` };
  if (!MOCK_MODE && retailer) headers["Retailer"] = retailer;
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    if (res.status === 401) {
      // Token hết hạn — refresh
      await getKvToken(true);
      return kvGet(path, params);
    }
    throw new Error(`KiotViet API lỗi ${res.status}`);
  }
  return res.json();
}

// Map path KiotViet thật → KiosThong mock endpoints
function mapMockPath(path) {
  if (path.startsWith("customers")) return "kvCustomers";
  if (path.startsWith("products"))  return "kvProducts";
  if (path.startsWith("invoices"))  return "kvInvoices";
  if (path.startsWith("transfers")) return "kvInvoices"; // fallback transfers → invoices
  return path;
}

async function kvPost(path, body) {
  const { retailer } = await getKvConfig();
  const token = await getKvToken();
  const mockPath = MOCK_MODE ? mapMockPath(path) : path;
  const postUrl = MOCK_MODE ? `${KV_API_BASE}/${mockPath}` : `${KV_API_BASE}/${path}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (!MOCK_MODE && retailer) headers["Retailer"] = retailer;
  const res = await fetch(postUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `KiotViet API lỗi ${res.status}`);
  }
  return res.json();
}

// ─── CUSTOMERS ────────────────────────────────────────────

/**
 * Tìm khách hàng từ KiotViet theo tên hoặc SĐT
 * Đồng thời sync kết quả vào PocketBase
 */
export async function searchKvCustomers(keyword) {
  if (!keyword || keyword.length < 2) return [];
  // KiosThong dùng name/phone, KiotViet thật dùng searchTerm
  const searchParam = MOCK_MODE
    ? (keyword.match(/^[0-9]+$/) ? { phone: keyword, pageSize: 20 } : { name: keyword, pageSize: 20 })
    : { searchTerm: keyword, pageSize: 20 };
  const data = await kvGet("customers", searchParam);
  const items = data.data || [];

  // Sync vào PocketBase (background, không block UI)
  syncCustomersToPb(items).catch(() => {});

  return items.map(c => ({
    id:          String(c.id),
    full_name:   c.name || c.contactNumber || c.phone || "",
    phone:       c.contactNumber || c.phone || "",
    address:     c.address || "",
    kiotviet_id: String(c.id),
    note:        c.comments || "",
  }));
}

async function syncCustomersToPb(kvCustomers) {
  for (const c of kvCustomers) {
    try {
      const existing = await Customer.filter({ kiotviet_id: String(c.id) });
      const data = {
        full_name:   c.name || "",
        phone:       c.contactNumber || c.phone || "",
        address:     c.address || "",
        kiotviet_id: String(c.id),
        note:        c.comments || "",
      };
      if (existing.length > 0) {
        await Customer.update(existing[0].id, data);
      } else {
        await Customer.create(data);
      }
    } catch {}
  }
}

// ─── SPARE PARTS / PRODUCTS ───────────────────────────────

/**
 * Lấy danh sách sản phẩm/linh kiện từ KiotViet kèm tồn kho
 * Đồng thời sync vào PocketBase
 */
export async function syncKvProducts(onProgress) {
  let page = 1;
  const pageSize = 100;
  let allItems = [];
  let total = 0;

  do {
    const data = await kvGet("products", {
      pageSize,
      currentItem: (page - 1) * pageSize,
      includeInventory: true,
    });
    const items = data.data || [];
    total = data.total || items.length;
    allItems = [...allItems, ...items];
    if (onProgress) onProgress(allItems.length, total);
    page++;
    if (items.length < pageSize) break;
  } while (allItems.length < total);

  // Sync vào PocketBase
  let synced = 0;
  for (const p of allItems) {
    try {
      // KiotViet thật: inventories[].onHand | KiosThong mock: onHand trực tiếp
      const stock = p.onHand !== undefined
        ? (p.onHand || 0)
        : (p.inventories || []).reduce((sum, inv) => sum + (inv.onHand || 0), 0);
      const existing = await SparePart.filter({ kiotviet_id: String(p.id) });
      const data = {
        name:        p.name || "",
        sku:         p.code || "",
        unit:        p.unit || "Cái",
        price:       p.basePrice || p.sellPrice || 0,
        stock_qty:   stock,
        kiotviet_id: String(p.id),
        is_active:   p.isActive !== false,
        category:    p.categoryName || "",
      };
      if (existing.length > 0) {
        await SparePart.update(existing[0].id, data);
      } else {
        await SparePart.create(data);
      }
      synced++;
    } catch {}
  }
  return { total: allItems.length, synced };
}

/**
 * Lấy nhanh tồn kho của 1 sản phẩm theo kiotviet_id
 */
export async function getKvProductStock(kvProductId) {
  const data = await kvGet(`products/${kvProductId}`);
  const stock = (data.inventories || []).reduce((sum, inv) => sum + (inv.onHand || 0), 0);
  return stock;
}

// ─── XUẤT KHO / ĐỀ NGHỊ XUẤT ─────────────────────────────

/**
 * Tạo phiếu xuất kho KiotViet (Invoice)
 * parts = [{ kvProductId, name, qty, price }]
 * orderCode = mã đơn sửa chữa (để ghi chú)
 */
export async function createKvDeliveryOrder({ orderCode, deviceModel, technicianName, parts }) {
  const orderDetails = parts.map(p => ({
    productId:   parseInt(p.kvProductId),
    productCode: p.sku || "",
    productName: p.name,
    quantity:    p.qty || 1,
    price:       p.price || 0,
    discount:    0,
  }));

  const body = {
    type:        "TRANSFER", // Xuất nội bộ
    description: `Xuất LK sửa chữa — Đơn ${orderCode} — ${deviceModel} — KTV: ${technicianName}`,
    details:     orderDetails,
  };

  // Thử tạo phiếu chuyển hàng nội bộ
  try {
    const result = await kvPost("transfers", body);
    return { success: true, transferId: result.id, transferCode: result.code };
  } catch (e) {
    // Fallback: tạo hóa đơn nội bộ giá 0đ
    try {
      const invBody = {
        branchId:     1,
        cashierId:    0,
        saleChannelId: 0,
        description:  `[XUẤT KHO NỘI BỘ] Đơn ${orderCode} — ${deviceModel} — KTV: ${technicianName}`,
        invoiceDetails: orderDetails.map(d => ({
          productId:   d.productId,
          productCode: d.productCode,
          productName: d.productName,
          quantity:    d.quantity,
          price:       0,
          discount:    0,
          note:        `Xuất cho đơn sửa chữa ${orderCode}`,
        })),
      };
      const inv = await kvPost("invoices", invBody);
      return { success: true, invoiceId: inv.id, invoiceCode: inv.code };
    } catch (e2) {
      throw new Error(e2.message || "Không tạo được phiếu xuất KiotViet");
    }
  }
}

export default { getKvToken, searchKvCustomers, syncKvProducts, getKvProductStock, createKvDeliveryOrder };
