/**
 * PocketBase SDK Layer — KiosThong / HKApp2
 * Thay thế toàn bộ @/api/entities và @/api/storage
 * Config IP tại: localStorage key "pb_url" hoặc default bên dưới
 */

const DEFAULT_PB_URL = "https://digiera.cameraddns.net";

export function getPbUrl() {
  try {
    return localStorage.getItem("pb_url") || DEFAULT_PB_URL;
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

    async filter(query = {}) {
      // Build PocketBase filter string from object
      const parts = Object.entries(query).map(([k, v]) => {
        if (typeof v === "string") return `${k}="${v}"`;
        if (typeof v === "boolean") return `${k}=${v}`;
        return `${k}=${v}`;
      });
      const filter = parts.join(" && ");
      return this.list({ filter });
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
export const AppSettings   = makeCollection("app_settings");

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
    console.error("PB response:", data);
    throw new Error("PocketBase không trả về tên file. Fields: " + Object.keys(data).join(", "));
  }
  return `${base}/api/files/media_files/${data.id}/${fileName}`;
}
// ── Realtime helper (SSE) ─────────────────────────────────
export function subscribeCollection(collectionName, callback) {
  const base = getPbUrl();
  const { token } = getAuth();
  const url = `${base}/api/realtime`;
  const es = new EventSource(`${url}?token=${token || ""}`);

  es.onopen = () => {
    // Subscribe after connect
    fetch(`${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token || "" },
      body: JSON.stringify({ clientId: es.clientId, subscriptions: [`${collectionName}/*`] }),
    });
  };

  es.addEventListener(collectionName, (e) => {
    try { callback(JSON.parse(e.data)); } catch {}
  });

  return () => es.close();
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
