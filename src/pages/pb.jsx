/* REBUILD_20260406_1408 */
/**
 * PocketBase SDK Layer — KiosThong / HKApp2
 * Thay thế toàn bộ @/api/entities và @/api/storage
 * Config IP tại: localStorage key "pb_url" hoặc default bên dưới
 */

const DEFAULT_PB_URL = "https://digiera.cameraddns.net";

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
    try { const d = await res.json(); msg = d.message || msg; } catch {}
    throw new Error(msg);
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
      const { sort = "", limit = 200, filter = "", page = 1 } = options;
      const params = new URLSearchParams({ perPage: limit, page });
      if (sort) params.set("sort", sort);
      if (filter) params.set("filter", filter);
      const data = await pbFetch(`collections/${collectionName}/records?${params}`);
      return data.items || [];
    },

    async get(id) {
      return pbFetch(`collections/${collectionName}/records/${id}`);
    },

    async filter(query = {}, options = {}) {
      // Build PocketBase filter string from object
      const parts = Object.entries(query).map(([k, v]) => {
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
export const Notification  = makeCollection("notifications");
export const Customer      = makeCollection("customers");
export const SparePart     = makeCollection("spare_parts");
export const SparePartUsage= makeCollection("spare_part_usages");
export const AppSettings        = makeCollection("app_settings");
export const StockExportRequest = makeCollection("stock_export_requests");
export const StockImport        = makeCollection("stock_imports");
export const StockImportItem    = makeCollection("stock_import_items");
export const OrderHistory       = makeCollection("order_history");

// ── Helper: ghi log lịch sử đơn ──────────────────────────
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
    });
  } catch(e) {
    // silent — không block UI
  }
}

// ── File Upload ───────────────────────────────────────────
export async function uploadFile(file, orderId = "") {
  const base = getPbUrl();
  const { token } = getAuth();
  const authHeaders = token ? { Authorization: token } : {};
  const fileType = file.type || "";

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
  const { token } = getAuth();
  const realtimeUrl = `${base}/api/realtime`;
  // EventSource KHÔNG hỗ trợ header → truyền token qua query param
  const esUrl = token ? `${realtimeUrl}?token=${encodeURIComponent(token)}` : realtimeUrl;
  const fetchHeaders = { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) };

  let es = null;
  let clientId = null;
  let closed = false;

  function connect() {
    if (closed) return;
    es = new EventSource(esUrl);

    es.addEventListener("PB_CONNECT", async (e) => {
      try {
        const data = JSON.parse(e.data);
        clientId = data.clientId;
        await fetch(realtimeUrl, {
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify({ clientId, subscriptions: [`${collectionName}/*`] }),
        });
      } catch {}
    });

    // PB gửi event với tên = collectionName
    es.addEventListener(collectionName, (e) => {
      try { callback(JSON.parse(e.data)); } catch {}
    });

    es.onerror = () => {
      if (closed) return;
      es.close();
      // Reconnect sau 3 giây
      setTimeout(connect, 3000);
    };
  }

  connect();
  return () => { closed = true; es && es.close(); };
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
