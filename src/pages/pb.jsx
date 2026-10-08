/* REBUILD_20260406_1408 */
/**
 * PocketBase SDK Layer — KiosThong / HKApp2
 * Thay thế toàn bộ @/api/entities và @/api/storage
 * Config IP tại: localStorage key "pb_url" hoặc default bên dưới
 */

const DEFAULT_PB_URL = "https://pb.hk1touch.online";

// Helper: lấy ngày theo timezone local (tránh UTC offset bug)
export function getLocalDate(d) {
  const dt = d ? new Date(d) : new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,"0");
  const day = String(dt.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

export function getPbUrl() {
  try {
    const stored = localStorage.getItem("pb_url");
    if (!stored) return DEFAULT_PB_URL;
    // Nếu URL là địa chỉ LAN (192.168.x.x hoặc http://) → dùng DDNS thay thế
    // Để tránh lỗi khi dùng app ngoài mạng LAN
    if (stored.includes("192.168.") || stored.startsWith("http://")) {
      return DEFAULT_PB_URL;
    }
    return stored;
  } catch {
    return DEFAULT_PB_URL;
  }
}

// Chuẩn hóa URL media về domain PocketBase hiện tại
// (rút kinh nghiệm: các URL cũ lưu domain digiera/LAN → ảnh hiển thị lỗi dù file còn)
export function normalizePbUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (!url.startsWith("http")) return url; // relative path hoặc tên file → giữ nguyên
  let out = url;
  const NEW = DEFAULT_PB_URL;
  try {
    const u = new URL(url);
    const cur = new URL(NEW);
    if (u.origin !== cur.origin && u.pathname.startsWith("/api/files/")) {
      out = NEW + u.pathname + u.search;
    }
  } catch { return url; }
  return out;
}

export function setPbUrl(url) {
  localStorage.setItem("pb_url", url.replace(/\/$/, ""));
}

// ── Auth token management ─────────────────────────────────
let _token = null;
let _userId = null;

export function setAuth(token, userId) {
  _token = token;
  _userId = userId;
  try { localStorage.setItem("pb_token", token); localStorage.setItem("pb_uid", userId); } catch {}
}

export function getAuth() {
  if (_token) return { token: _token, userId: _userId };
  try {
    const t = localStorage.getItem("pb_token");
    const u = localStorage.getItem("pb_uid");
    if (t) { _token = t; _userId = u; return { token: t, userId: u }; }
  } catch {}
  return { token: null, userId: null };
}

export function clearAuth() {
  _token = null; _userId = null;
  try { localStorage.removeItem("pb_token"); localStorage.removeItem("pb_uid"); } catch {}
}

// ── Base fetch helper ─────────────────────────────────────
async function pbFetch(path, options = {}) {
  const base = getPbUrl();
  const { token } = getAuth();
  const url = `${base}/api/${path}`;
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}), ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    let errData = {};
    try { const d = await res.json(); msg = d.message || msg; errData = d.data || d; } catch {}
    const err = new Error(msg);
    err.data = errData;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Auth API ──────────────────────────────────────────────
export const pbAuth = {
  async loginWithPassword(collection, username, password) {
    const data = await pbFetch(`collections/${collection}/auth-with-password`, {
      method: "POST",
      body: JSON.stringify({ identity: username, password }),
    });
    setAuth(data.token, data.record?.id);
    return data;
  },
  async loginStaff(username, password) {
    return pbAuth.loginWithPassword("staff", username, password);
  },
  logout() { clearAuth(); },
};

// ── Collection CRUD helper ────────────────────────────────
function makeCollection(collectionName) {
  return {
    async list(options = {}) {
      const { sort = "", limit = 200, filter = "", page = 1, fields = "" } = options;
      const params = new URLSearchParams({ perPage: limit, page });
      if (sort)   params.set("sort", sort);
      if (filter) params.set("filter", filter);
      if (fields) params.set("fields", fields);
      const data = await pbFetch(`collections/${collectionName}/records?${params}`);
      return data.items || [];
    },

    async get(id) {
      return pbFetch(`collections/${collectionName}/records/${id}`);
    },

    // Lấy TOÀN BỘ bản ghi (tự phân trang 500/lần, trần an toàn 30 trang = 15.000 bản ghi).
    // Dùng cho các danh sách cần hiển thị đầy đủ — KHÔNG dùng cho bảng 13k+ rows
    // render trực tiếp, lúc đó nên tìm server-side (filter `~`) + phân trang UI.
    async listAll(options = {}) {
      const { sort = "", filter = "", fields = "" } = options;
      const PER = 500, MAX_PAGES = 30;
      const out = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const data = await this.list({ sort, filter, fields, limit: PER, page });
        out.push(...(data || []));
        if ((data || []).length < PER) break;
      }
      return out;
    },

    async filter(query = {}, options = {}) {
      // Build PocketBase filter string
      // Hỗ trợ suffix: _gt, _gte, _lt, _lte, _like, _neq
      const parts = Object.entries(query).map(([k, v]) => {
        if (k.endsWith("_gt"))   return `${k.slice(0,-3)}>"${v}"`;
        if (k.endsWith("_gte"))  return `${k.slice(0,-4)}>="${v}"`;
        if (k.endsWith("_lt"))   return `${k.slice(0,-3)}<"${v}"`;
        if (k.endsWith("_lte"))  return `${k.slice(0,-4)}<="${v}"`;
        if (k.endsWith("_neq"))  return `${k.slice(0,-4)}!="${v}"`;
        if (k.endsWith("_like")) return `${k.slice(0,-5)}~"${v}"`;
        if (typeof v === "string") return `${k}="${v}"`;
        if (typeof v === "boolean") return `${k}=${v}`;
        return `${k}=${v}`;
      });
      const filter = parts.join(" && ");
      return this.list({ filter, ...options });
    },

    async create(data) {
      return pbFetch(`collections/${collectionName}/records`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    async update(id, data) {
      return pbFetch(`collections/${collectionName}/records/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },

    async delete(id) {
      return pbFetch(`collections/${collectionName}/records/${id}`, {
        method: "DELETE",
      });
    },

    // ── Realtime SSE subscribe ─────────────────────────────
    // callback(event, record) — event = "create"|"update"|"delete"
    // returns unsubscribe function
    subscribe(callback, recordId = "*") {
      const base = getPbUrl();
      const { token } = getAuth();
      const sseUrl = `${base}/api/realtime`;
      let es = null;
      let clientId = null;
      let retryTimer = null;
      let dead = false;

      const connect = () => {
        if (dead) return;
        try {
          es = new EventSource(sseUrl);

          es.onmessage = (e) => {
            try {
              const data = JSON.parse(e.data);
              if (data.clientId && !clientId) {
                clientId = data.clientId;
                const sub = `${collectionName}/${recordId}`;
                fetch(sseUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: token } : {}),
                  },
                  body: JSON.stringify({ clientId, subscriptions: [sub] }),
                }).catch(() => {});
              }
            } catch {}
          };

          es.addEventListener(collectionName, (e) => {
            try {
              const evt = JSON.parse(e.data);
              const action = evt.action || "update";
              const record = evt.record || evt;
              callback(action, record);
            } catch {}
          });

          es.onerror = () => {
            es?.close();
            if (!dead) retryTimer = setTimeout(connect, 5000);
          };
        } catch {}
      };

      connect();

      return () => {
        dead = true;
        clearTimeout(retryTimer);
        es?.close();
      };
    },
  };
}

// ── Collections ───────────────────────────────────────────
export const Staff         = makeCollection("staff");
export const RepairOrder   = makeCollection("repair_orders");
export const RepairChat    = makeCollection("repair_chats");
const _NotifBase = makeCollection("notifications");
// Luôn gắn created_at (trước đây 327/676 thông báo thiếu mốc thời gian -> bộ nhận bỏ sót / hiển thị sai giờ)
export const Notification  = {
  ..._NotifBase,
  create: (data = {}) => _NotifBase.create({ is_read:false, ...data, created_at: data.created_at || new Date().toISOString() }),
};

// Gửi thông báo tới tất cả nhân viên đang hoạt động thuộc các role chỉ định (loại trừ người thao tác)
export async function notifyRoles(roles, { title, message, order, type = "assign", excludeId = "" }) {
  try {
    const staff = await Staff.filter({ is_active: true });
    const targets = (staff || []).filter(s => roles.includes(s.role) && s.id !== excludeId);
    await Promise.all(targets.map(st => Notification.create({
      user_id: st.id, user_name: st.full_name || "",
      title, message: message || "",
      order_id: order?.id || "", order_code: order?.order_code || "",
      type, is_read: false,
    }).catch(() => {})));
    return targets.length;
  } catch (e) { console.warn("[notifyRoles]", e.message); return 0; }
}
export const Customer      = makeCollection("customers");
export const SparePart     = makeCollection("product_catalog");
export const SparePartUsage= makeCollection("spare_part_usages");
export const AppSettings        = makeCollection("app_settings");
export const StockExportRequest = makeCollection("stock_export_requests");
export const StockImport        = makeCollection("stock_imports");
export const StockImportItem    = makeCollection("stock_import_items");
export const OrderHistory       = makeCollection("order_history");
export const Warehouse          = makeCollection("warehouses");
export const WarehouseZone      = makeCollection("warehouse_zones");
export const WarehouseLocation  = makeCollection("warehouse_locations");
export const StockLedger        = makeCollection("stock_ledgers");
export const StockMovement      = makeCollection("stock_movements");
export const StockTransfer      = makeCollection("stock_transfers");
export const StockCount         = makeCollection("stock_counts");
export const StockCountItem     = makeCollection("stock_count_items");
export const SaleOrder          = makeCollection("sale_orders");
export const SaleOrderItem      = makeCollection("sale_order_items");
export const Expense            = makeCollection("expenses");
export const Role               = makeCollection("roles");
export const RolePermission     = makeCollection("role_permissions");
export const MediaPost          = makeCollection("media_posts");
export const ActionLog          = makeCollection("action_logs");
export const Department         = makeCollection("departments");
export const DebtVoucher        = makeCollection("debt_vouchers");
export const DebtPayment        = makeCollection("debt_payments");
export const CashJournal        = makeCollection("cash_journal");
export const Supplier           = makeCollection("suppliers");
export const ShiftReconcile    = makeCollection("shift_reconciles");
export const KpiRecord          = makeCollection("kpi_records");
export const ProductCategory    = makeCollection("product_categories");

// ── Helper: đảm bảo part có sổ kho (stock_ledgers) ở kho đang hoạt động ─────
// Tránh lỗi "không có trong kho này" khi xuất linh kiện: hàng tạo tay / nhập
// Excel trước đây chỉ ghi stock_qty trên product_catalog mà không ghi sổ kho.
// Nếu part chưa có ledger ở kho active nào và tồn > 0 → tự ghi vào Kho 1.
export async function ensureStockLedgerForPart(part, warehouseId) {
  try {
    const qty = Number(part?.stock_qty) || 0;
    if (!part?.id || qty <= 0) return null;
    const whs = (await Warehouse.filter({ is_active: true }).catch(() => [])) || [];
    const liveIds = whs.map(w => w.id);
    const ledgers = (await StockLedger.filter({ part_id: part.id }).catch(() => [])) || [];
    const live = ledgers.filter(l => liveIds.includes(l.warehouse_id));
    if (live.length > 0) return null; // đã có sổ kho hợp lệ — không đụng vào
    // Ưu tiên kho được chỉ định (phải đang hoạt động), mặc định Kho16 (kho chính)
    const kho = (warehouseId && liveIds.includes(warehouseId) ? whs.find(w => w.id === warehouseId) : null)
      || whs.find(w => (w.code || "").toUpperCase() === "KHO16") || whs[0];
    if (!kho) return null;
    return await StockLedger.create({
      warehouse_id: kho.id, warehouse_name: kho.name,
      part_id: part.id, part_name: part.name || "", sku: part.sku || "",
      category: part.category || "", unit: part.unit || "Cái",
      qty_on_hand: qty, qty_reserved: 0, qty_available: qty, min_qty: 0,
      note: "Tự động ghi sổ " + kho.name + " khi tạo/cập nhật hàng hóa",
    });
  } catch (e) { console.error("ensureStockLedgerForPart:", e); return null; }
}

// ── Helper: ghi log lịch sử đơn (OrderHistory) ──────────────
export async function logHistory({ order_id, order_code, action_type, action_label, changed_by_id, changed_by_name, changed_by_role, old_value, new_value, note }) {
  try {
    await OrderHistory.create({
      order_id:        order_id || "",
      order_code:      order_code || "",
      action_type:     action_type || "other",
      action_label:    action_label || "",
      changed_by_id:   changed_by_id || "",
      changed_by_name: changed_by_name || "",
      changed_by_role: changed_by_role || "",
      old_value:       old_value || "",
      new_value:       new_value || "",
      note:            note || "",
      created_date:    new Date().toISOString(),
    });
  } catch(e) {
    console.warn("[logHistory]", e.message);
  }
}

// ── Helper: ghi log thao tác hệ thống (ActionLog) ───────────
export async function logAction(user, action, target_type, target_id = "", detail = "") {
  try {
    await ActionLog.create({
      staff_id:    user?.id || "",
      staff_name:  user?.name || user?.full_name || "",
      staff_role:  user?.role || "",
      action:      action || "",
      target_type: target_type || "",
      target_id:   target_id || "",
      detail:      detail || "",
      created_date: new Date().toISOString(),
    });
  } catch(e) {
    console.warn("[logAction]", e.message);
  }
}

// ── File Upload ───────────────────────────────────────────
// Nén ảnh về tối đa maxDim px (mặc định FullHD 1920) trước khi upload.
// Ảnh nhỏ hơn hoặc nén không lợi thì giữ nguyên file gốc.
export async function compressImageToMaxDim(file, maxDim = 1920, quality = 0.85) {
  if (!(file.type || "").startsWith("image") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) { bitmap.close?.(); return file; } // đã nhỏ hơn giới hạn
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    const name = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch (e) { return file; } // lỗi nén thì upload bản gốc, không chặn nghiệp vụ
}

// Đọc thời lượng video (giây). Trả về null nếu không đọc được metadata.
export function getVideoDuration(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration || null); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    v.src = url;
  });
}

export const MAX_VIDEO_SECONDS = 15;

export async function uploadFile(file, orderId = "") {
  const base = getPbUrl();
  const { token } = getAuth();
  const authHeaders = token ? { Authorization: token } : {};
  const fileType = file.type || "";

  // Giới hạn ảnh tối đa FullHD 1920px trước khi upload
  file = await compressImageToMaxDim(file);

  const formData = new FormData();
  // Đặt tên field "file" — PocketBase sẽ nhận bất kỳ tên file nào
  formData.append("file", file, file.name || "upload");
  formData.append("name", file.name || "upload");
  // PocketBase chỉ accept type: image | video
  formData.append("type", fileType.startsWith("image") ? "image" : "video");
  if (orderId) formData.append("order_id", orderId);

  const res = await fetch(`${base}/api/collections/media_files/records`, {
    method: "POST",
    headers: authHeaders,
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => String(res.status));
    throw new Error(`Upload thất bại (${res.status}): ${errText}`);
  }
  const data = await res.json();
  // Tìm field chứa tên file trong response
  const fileName = data.file || data.image || data.video || data.audio
    || Object.entries(data).find(([k,v]) => typeof v === "string" && v.match(/\.(jpg|jpeg|png|gif|webp|webm|mp4|ogg|mp3|wav|m4a)$/i))?.[1];
  if (!fileName) {
    throw new Error("PocketBase không trả về tên file. Fields: " + Object.keys(data).join(", "));
  }
  return `${base}/api/files/media_files/${data.id}/${fileName}`;
}
// ── Realtime helper (SSE) ─────────────────────────────────
// PB Realtime protocol:
//   1. GET /api/realtime  → SSE stream, đầu tiên nhận event "PB_CONNECT" chứa clientId
//   2. POST /api/realtime { clientId, subscriptions: ["collection/*"] }  → đăng ký
//   3. Mỗi record change → SSE event tên "collectionName" với data JSON
export function subscribeCollection(collectionName, callback) {
  const base = getPbUrl();
  const realtimeUrl = `${base}/api/realtime`;

  let es = null;
  let clientId = null;
  let closed = false;
  let retryTimer = null;

  function connect() {
    if (closed) return;
    // Lấy token FRESH mỗi lần connect
    const { token } = getAuth();
    const fetchHeaders = { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) };

    // PocketBase SSE không cần token trong URL nếu collection là public
    es = new EventSource(realtimeUrl);

    // PocketBase gửi PB_CONNECT qua onmessage (plain message), KHÔNG phải named event
    es.onmessage = async (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.clientId && !clientId) {
          clientId = data.clientId;
          await fetch(realtimeUrl, {
            method: "POST",
            headers: fetchHeaders,
            body: JSON.stringify({ clientId, subscriptions: [`${collectionName}/*`] }),
          });
        }
      } catch {}
    };

    // PB gửi record changes dưới dạng named event với tên = collectionName
    es.addEventListener(collectionName, (e) => {
      try { callback(JSON.parse(e.data)); } catch {}
    });

    es.onerror = () => {
      if (closed) return;
      es.close();
      es = null;
      clientId = null;
      // Reconnect sau 3 giây
      retryTimer = setTimeout(connect, 3000);
    };
  }

  connect();
  return () => {
    closed = true;
    clearTimeout(retryTimer);
    es && es.close();
  };
}

// ── Settings helper ───────────────────────────────────────
export const pbSettings = {
  async get(key) {
    try {
      const items = await AppSettings.filter({ key });
      return items[0]?.value || null;
    } catch { return null; }
  },
  async set(key, value, label = "", group = "") {
    try {
      const items = await AppSettings.filter({ key });
      if (items[0]) {
        await AppSettings.update(items[0].id, { value });
      } else {
        await AppSettings.create({ key, value, label, group });
      }
    } catch {}
  },
};

// ── Connection test ───────────────────────────────────────
export async function testConnection(url) {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
}

export default {};

// ── Base44 Staff API (service role — bypass RLS) ──────────
// Dùng Base44 REST API với service token để đọc/ghi Staff entity
// mà không cần user đăng nhập Base44.
const B44_APP_ID  = "69bf5d0a924e0a8766577274";
const B44_API_URL = `https://app.base44.com/api/apps/${B44_APP_ID}/entities/Staff`;
const B44_TOKEN   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MmYzZWM5Mi05OTQ1LTQ1MWUtODdjOC1kYTU4N2FlZDVkZDEiLCJjbGllbnRfaWQiOiI2MmYzZWM5Mi05OTQ1LTQ1MWUtODdjOC1kYTU4N2FlZDVkZDEiLCJhcHBfaWQiOiI2OWJmNWQwYTkyNGUwYTg3NjY1NzcyNzQiLCJhdWQiOiJiYXNlNDRfYXBpIiwic2NvcGUiOiJhcHAuYWNjZXNzIiwiZXhwIjoxNzc1MjE5MDQxLCJpYXQiOjE3NzUyMTU0NDF9.WWM1pG-FAE48Vp9RloJ7ncWJNFAjDqTzDP8XV8fPzgM";

async function b44Fetch(path, options = {}) {
  const url = `${B44_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${B44_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const d = await res.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const B44Staff = {
  async list() {
    const data = await b44Fetch("");
    // Base44 trả về array trực tiếp hoặc {records:[...]}
    return Array.isArray(data) ? data : (data.records || data.items || []);
  },
  async create(record) {
    return b44Fetch("", { method: "POST", body: JSON.stringify(record) });
  },
  async update(id, record) {
    return b44Fetch(`/${id}`, { method: "PUT", body: JSON.stringify(record) });
  },
  async delete(id) {
    return b44Fetch(`/${id}`, { method: "DELETE" });
  },
};
export const PurchaseOrder     = makeCollection("purchase_orders");
export const PurchaseOrderItem = makeCollection("purchase_order_items");
