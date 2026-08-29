/**
 * seedRoles.js — Seed 16 roles + toàn bộ ma trận quyền vào PocketBase
 *
 * Cách chạy: paste vào browser console khi đang ở app (đã login)
 * hoặc import và gọi seedAll() từ Settings.jsx (nút "Seed Roles")
 *
 * Collections cần tồn tại trước:
 *   - roles        : key(text), label(text), color(text), bg(text), icon(text), description(text), sort_order(number)
 *   - role_permissions : role_key(text), resource(text), can_view(bool), can_create(bool),
 *                        can_edit(bool), can_delete(bool), can_approve(bool), can_export(bool)
 *   - media_posts  : title(text), content(text), media_urls(json), type(text),
 *                    status(text), created_by_id(text), created_by_name(text),
 *                    pinned(bool), views(number), target_roles(json)
 */

import { getPbUrl, getAuth } from "./pb.jsx";

async function pbFetchRaw(collection, path = "", opts = {}) {
  const base  = getPbUrl();
  const { token } = getAuth();
  const res = await fetch(`${base}/api/collections/${collection}/records${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function pbPost(collection, data) {
  return pbFetchRaw(collection, "", { method: "POST", body: JSON.stringify(data) });
}

async function pbPatch(collection, id, data) {
  return pbFetchRaw(collection, `/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

// Lấy TOÀN BỘ record của 1 collection (tự phân trang), tránh giới hạn perPage
async function pbListAll(collection, perPage = 200) {
  const all = [];
  let page = 1;
  while (true) {
    const data = await pbFetchRaw(collection, `?perPage=${perPage}&page=${page}`);
    all.push(...(data.items || []));
    if (page >= (data.totalPages || 1)) break;
    page++;
  }
  return all;
}

// ── 16 Roles ──────────────────────────────────────────────
export const ROLE_DEFINITIONS = [
  { key:"owner",        label:"Chủ cơ sở",        color:"#1e1b4b", bg:"#ede9fe", icon:"🏢", sort_order:1,  description:"Toàn quyền hệ thống" },
  { key:"admin",        label:"Quản trị viên",     color:"#4f46e5", bg:"#eef2ff", icon:"⚙️", sort_order:2,  description:"Quản trị toàn bộ, trừ một vài cài đặt nhạy cảm" },
  { key:"manager",      label:"Quản lý",           color:"#7c3aed", bg:"#f5f3ff", icon:"👑", sort_order:3,  description:"Quản lý tổng thể hoạt động hàng ngày" },
  { key:"supervisor",   label:"Giám sát",          color:"#0369a1", bg:"#e0f2fe", icon:"🔭", sort_order:4,  description:"Giám sát và phê duyệt quy trình" },
  { key:"receptionist", label:"Giao dịch viên",     color:"#1d4ed8", bg:"#dbeafe", icon:"💁", sort_order:5,  description:"Tiếp nhận, tạo đơn, chăm sóc khách" },
  { key:"technician",   label:"KTV điện thoại",      color:"#065f46", bg:"#dcfce7", icon:"📱", sort_order:6,  description:"Sửa chữa điện thoại" },
  { key:"mm_tech",      label:"KTV Máy Móc",        color:"#0369a1", bg:"#e0f2fe", icon:"⚙️", sort_order:7,  description:"Kỹ thuật viên vận hành máy móc sửa chữa" },
  { key:"warehouse",    label:"Thủ kho",           color:"#92400e", bg:"#fef3c7", icon:"📦", sort_order:8,  description:"Quản lý xuất nhập tồn kho" },
  { key:"cashier",      label:"Thu ngân",          color:"#dc2626", bg:"#fee2e2", icon:"💰", sort_order:8,  description:"Thu tiền, bán hàng lẻ" },
  { key:"accountant",   label:"Kế toán",           color:"#2563eb", bg:"#dbeafe", icon:"📊", sort_order:10, description:"Kế toán, báo cáo tài chính" },
  { key:"marketing",    label:"Marketing",         color:"#db2777", bg:"#fce7f3", icon:"📣", sort_order:12, description:"Quản lý media, chăm sóc khách hàng" },
  { key:"sales_rep",    label:"NV bán hàng",        color:"#059669", bg:"#d1fae5", icon:"🧑‍💼", sort_order:11, description:"Bán hàng, phát triển khách hàng" },
  { key:"packer",       label:"NV soạn đóng hàng", color:"#7c3aed", bg:"#ede9fe", icon:"📦", sort_order:13, description:"Soạn đóng hàng, đóng gói, vận chuyển nội bộ" },
  { key:"support",      label:"Hỗ trợ KT",         color:"#0891b2", bg:"#e0f9fe", icon:"🎧", sort_order:14, description:"Hỗ trợ kỹ thuật cấp 1" },
  { key:"delivery",     label:"Giao nhận",         color:"#6b7280", bg:"#f3f4f6", icon:"🚚", sort_order:15, description:"Giao nhận thiết bị" },
  { key:"it",           label:"IT / Dev",          color:"#374151", bg:"#f9fafb", icon:"💻", sort_order:16, description:"Quản trị hệ thống nội bộ" },
  { key:"viewer",       label:"Chỉ xem",           color:"#9ca3af", bg:"#f3f4f6", icon:"👁️", sort_order:17, description:"Xem báo cáo, không thao tác" },
  { key:"guest",        label:"Khách",             color:"#d1d5db", bg:"#f9fafb", icon:"🙋", sort_order:18, description:"Khách tra cứu đơn" },
];

// ── Ma trận quyền (mirror STATIC_MATRIX từ PermissionContext) ──
const RESOURCES = [
  "repair_order","repair_order_price","spare_part","stock_export",
  "stock_import","stock_transfer","stock_count","stock_ledger",
  "customer","sale_order","expense","revenue_report","staff","kpi",
  "settings","media_post","notification","warehouse_mgr",
  "supplier","debt","cash_journal","department",
];

const p = (view=0,create=0,edit=0,del=0,approve=0,exp=0) =>
  ({ can_view:!!view, can_create:!!create, can_edit:!!edit,
     can_delete:!!del, can_approve:!!approve, can_export:!!exp });

// Toàn bộ ma trận — mỗi entry: { role_key, resource, can_* }
export function buildPermissionRows() {
  const MATRIX = {
    owner:        { repair_order:p(1,1,1,1,1,1), repair_order_price:p(1,1,1,1,1,1), spare_part:p(1,1,1,1,1,1), stock_export:p(1,1,1,1,1,1), stock_import:p(1,1,1,1,1,1), stock_transfer:p(1,1,1,1,1,1), stock_count:p(1,1,1,1,1,1), stock_ledger:p(1,1,1,1,1,1), customer:p(1,1,1,1,1,1), sale_order:p(1,1,1,1,1,1), expense:p(1,1,1,1,1,1), revenue_report:p(1,0,0,0,0,1), staff:p(1,1,1,1,1,0), kpi:p(1,0,1,0,1,0), settings:p(1,0,1,0,0,0), media_post:p(1,1,1,1,1,1), notification:p(1,1,0,1,0,0), warehouse_mgr:p(1,1,1,1,1,0), supplier:p(1,1,1,1,1,1), debt:p(1,1,1,1,1,1), cash_journal:p(1,1,1,1,1,1), department:p(1,1,1,1,1,0) },
    admin:        { repair_order:p(1,1,1,1,1,1), repair_order_price:p(1,1,1,1,1,1), spare_part:p(1,1,1,1,1,1), stock_export:p(1,1,1,1,1,1), stock_import:p(1,1,1,1,1,1), stock_transfer:p(1,1,1,1,1,1), stock_count:p(1,1,1,1,1,1), stock_ledger:p(1,1,1,1,1,1), customer:p(1,1,1,1,1,1), sale_order:p(1,1,1,1,1,1), expense:p(1,1,1,1,1,1), revenue_report:p(1,0,0,0,0,1), staff:p(1,1,1,0,1,0), kpi:p(1,0,1,0,1,0), settings:p(1,0,1,0,0,0), media_post:p(1,1,1,1,0,1), notification:p(1,1,0,1,0,0), warehouse_mgr:p(1,1,1,1,1,0), supplier:p(1,1,1,1,1,1), debt:p(1,1,1,1,1,1), cash_journal:p(1,1,1,1,1,1), department:p(1,1,1,1,1,0) },
    manager:      { repair_order:p(1,1,1,1,1,1), repair_order_price:p(1,1,1,0,1,0), spare_part:p(1,1,1,0,1,1), stock_export:p(1,1,1,0,1,1), stock_import:p(1,1,0,0,1,1), stock_transfer:p(1,1,1,0,1,0), stock_count:p(1,1,1,0,1,0), stock_ledger:p(1,0,0,0,0,1), customer:p(1,1,1,0,0,1), sale_order:p(1,1,1,0,1,1), expense:p(1,1,1,0,1,1), revenue_report:p(1,0,0,0,0,1), staff:p(1,1,1,0,0,0), kpi:p(1,0,1,0,0,0), settings:p(1,0,0,0,0,0), media_post:p(1,1,1,0,0,1), notification:p(1,1,0,0,0,0), warehouse_mgr:p(1,1,1,0,0,0), supplier:p(1,1,1,0,1,1), debt:p(1,1,1,0,1,1), cash_journal:p(1,1,0,0,1,1), department:p(1,1,1,0,0,0) },
    supervisor:   { repair_order:p(1,0,1,0,1,1), repair_order_price:p(1,0,0,0,1,0), spare_part:p(1,0,0,0,0,1), stock_export:p(1,0,1,0,1,1), stock_import:p(1,0,0,0,1,1), stock_transfer:p(1,0,0,0,1,0), stock_count:p(1,0,1,0,1,0), stock_ledger:p(1,0,0,0,0,1), customer:p(1,0,1,0,0,1), sale_order:p(1,0,0,0,1,1), expense:p(1,0,0,0,0,1), revenue_report:p(1,0,0,0,0,1), staff:p(1,0,0,0,0,0), kpi:p(1,0,1,0,1,0), settings:p(1,0,0,0,0,0), media_post:p(1,0,0,0,0,1), notification:p(1,1,0,0,0,0), warehouse_mgr:p(1,0,0,0,0,0), supplier:p(1,0,0,0,0,1), debt:p(1,0,0,0,1,1), cash_journal:p(1,0,0,0,0,1), department:p(1,0,0,0,0,0) },
    receptionist: { repair_order:p(1,1,1,0,0,1), repair_order_price:p(1,1,0,0,0,0), spare_part:p(1,0,0,0,0,0), stock_export:p(1,1,0,0,0,0), stock_import:p(0,0,0,0,0,0), stock_transfer:p(0,0,0,0,0,0), stock_count:p(0,0,0,0,0,0), stock_ledger:p(1,0,0,0,0,0), customer:p(1,1,1,0,0,1), sale_order:p(1,1,0,0,0,1), expense:p(0,0,0,0,0,0), revenue_report:p(0,0,0,0,0,0), staff:p(0,0,0,0,0,0), kpi:p(0,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(1,0,0,0,0,0), notification:p(1,0,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(0,0,0,0,0,0), debt:p(0,0,0,0,0,0), cash_journal:p(0,0,0,0,0,0), department:p(0,0,0,0,0,0) },
    technician:   { repair_order:p(1,0,1,0,0,0), repair_order_price:p(1,1,0,0,0,0), spare_part:p(1,0,0,0,0,0), stock_export:p(1,1,0,0,0,0), stock_import:p(0,0,0,0,0,0), stock_transfer:p(0,0,0,0,0,0), stock_count:p(1,0,1,0,0,0), stock_ledger:p(1,0,0,0,0,0), customer:p(1,0,0,0,0,0), sale_order:p(0,0,0,0,0,0), expense:p(0,0,0,0,0,0), revenue_report:p(0,0,0,0,0,0), staff:p(0,0,0,0,0,0), kpi:p(1,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(1,0,0,0,0,0), notification:p(1,0,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(0,0,0,0,0,0), debt:p(0,0,0,0,0,0), cash_journal:p(0,0,0,0,0,0), department:p(0,0,0,0,0,0) },
    mm_tech:      { repair_order:p(1,0,1,0,0,0), repair_order_price:p(1,1,0,0,0,0), spare_part:p(1,0,0,0,0,0), stock_export:p(1,1,0,0,0,0), stock_import:p(0,0,0,0,0,0), stock_transfer:p(0,0,0,0,0,0), stock_count:p(1,0,1,0,0,0), stock_ledger:p(1,0,0,0,0,0), customer:p(1,0,0,0,0,0), sale_order:p(0,0,0,0,0,0), expense:p(0,0,0,0,0,0), revenue_report:p(0,0,0,0,0,0), staff:p(0,0,0,0,0,0), kpi:p(1,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(1,0,0,0,0,0), notification:p(1,0,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(0,0,0,0,0,0), debt:p(0,0,0,0,0,0), cash_journal:p(0,0,0,0,0,0), department:p(0,0,0,0,0,0) },
    warehouse:    { repair_order:p(1,0,0,0,0,0), repair_order_price:p(0,0,0,0,0,0), spare_part:p(1,1,1,0,0,1), stock_export:p(1,0,1,0,1,1), stock_import:p(1,1,1,0,1,1), stock_transfer:p(1,1,1,0,1,0), stock_count:p(1,1,1,0,0,0), stock_ledger:p(1,1,0,0,0,1), customer:p(0,0,0,0,0,0), sale_order:p(0,0,0,0,0,0), expense:p(0,0,0,0,0,0), revenue_report:p(0,0,0,0,0,0), staff:p(0,0,0,0,0,0), kpi:p(1,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(1,0,0,0,0,0), notification:p(1,0,0,0,0,0), warehouse_mgr:p(1,0,0,0,0,0), supplier:p(1,1,1,0,0,1), debt:p(0,0,0,0,0,0), cash_journal:p(0,0,0,0,0,0), department:p(0,0,0,0,0,0) },
    cashier:      { repair_order:p(1,0,0,0,0,1), repair_order_price:p(1,0,0,0,0,0), spare_part:p(1,0,0,0,0,0), stock_export:p(0,0,0,0,0,0), stock_import:p(0,0,0,0,0,0), stock_transfer:p(0,0,0,0,0,0), stock_count:p(0,0,0,0,0,0), stock_ledger:p(1,0,0,0,0,0), customer:p(1,1,0,0,0,1), sale_order:p(1,1,1,0,0,1), expense:p(1,1,0,0,0,0), revenue_report:p(1,0,0,0,0,1), staff:p(0,0,0,0,0,0), kpi:p(0,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(1,0,0,0,0,0), notification:p(1,0,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(0,0,0,0,0,0), debt:p(1,1,1,0,0,1), cash_journal:p(1,0,0,0,0,1), department:p(0,0,0,0,0,0) },
    accountant:   { repair_order:p(1,0,0,0,0,1), repair_order_price:p(1,0,0,0,0,0), spare_part:p(1,0,0,0,0,1), stock_export:p(1,0,0,0,0,1), stock_import:p(1,0,0,0,0,1), stock_transfer:p(0,0,0,0,0,0), stock_count:p(1,0,0,0,0,1), stock_ledger:p(1,0,0,0,0,1), customer:p(1,0,0,0,0,1), sale_order:p(1,1,1,0,0,1), expense:p(1,1,1,1,0,1), revenue_report:p(1,0,0,0,0,1), staff:p(1,0,0,0,0,0), kpi:p(1,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(1,0,0,0,0,0), notification:p(1,0,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(1,1,1,0,0,1), debt:p(1,1,1,0,1,1), cash_journal:p(1,1,0,0,0,1), department:p(0,0,0,0,0,0) },
    marketing:    { repair_order:p(1,0,0,0,0,1), repair_order_price:p(0,0,0,0,0,0), spare_part:p(1,0,0,0,0,0), stock_export:p(0,0,0,0,0,0), stock_import:p(0,0,0,0,0,0), stock_transfer:p(0,0,0,0,0,0), stock_count:p(0,0,0,0,0,0), stock_ledger:p(0,0,0,0,0,0), customer:p(1,1,1,0,0,1), sale_order:p(1,0,0,0,0,1), expense:p(0,0,0,0,0,0), revenue_report:p(1,0,0,0,0,1), staff:p(0,0,0,0,0,0), kpi:p(0,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(1,1,1,1,0,1), notification:p(1,1,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(0,0,0,0,0,0), debt:p(0,0,0,0,0,0), cash_journal:p(0,0,0,0,0,0), department:p(0,0,0,0,0,0) },
    sales_rep:    { repair_order:p(1,1,0,0,0,1), repair_order_price:p(1,1,0,0,0,0), spare_part:p(1,0,0,0,0,0), stock_export:p(1,0,0,0,0,0), stock_import:p(0,0,0,0,0,0), stock_transfer:p(0,0,0,0,0,0), stock_count:p(0,0,0,0,0,0), stock_ledger:p(1,0,0,0,0,0), customer:p(1,1,1,0,0,1), sale_order:p(1,1,1,0,0,1), expense:p(0,0,0,0,0,0), revenue_report:p(1,0,0,0,0,1), staff:p(0,0,0,0,0,0), kpi:p(0,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(1,0,0,0,0,0), notification:p(1,0,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(0,0,0,0,0,0), debt:p(0,0,0,0,0,0), cash_journal:p(0,0,0,0,0,0), department:p(0,0,0,0,0,0) },
    packer:       { repair_order:p(1,0,0,0,0,0), repair_order_price:p(0,0,0,0,0,0), spare_part:p(1,0,0,0,0,0), stock_export:p(1,1,0,0,0,0), stock_import:p(0,0,0,0,0,0), stock_transfer:p(1,0,0,0,0,0), stock_count:p(0,0,0,0,0,0), stock_ledger:p(1,0,0,0,0,0), customer:p(0,0,0,0,0,0), sale_order:p(1,0,0,0,0,0), expense:p(0,0,0,0,0,0), revenue_report:p(0,0,0,0,0,0), staff:p(0,0,0,0,0,0), kpi:p(0,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(0,0,0,0,0,0), notification:p(1,0,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(0,0,0,0,0,0), debt:p(0,0,0,0,0,0), cash_journal:p(0,0,0,0,0,0), department:p(0,0,0,0,0,0) },
    support:      { repair_order:p(1,1,1,0,0,0), repair_order_price:p(1,0,0,0,0,0), spare_part:p(1,0,0,0,0,0), stock_export:p(1,1,0,0,0,0), stock_import:p(0,0,0,0,0,0), stock_transfer:p(0,0,0,0,0,0), stock_count:p(0,0,0,0,0,0), stock_ledger:p(1,0,0,0,0,0), customer:p(1,1,0,0,0,0), sale_order:p(1,0,0,0,0,0), expense:p(0,0,0,0,0,0), revenue_report:p(0,0,0,0,0,0), staff:p(0,0,0,0,0,0), kpi:p(1,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(1,1,0,0,0,0), notification:p(1,0,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(0,0,0,0,0,0), debt:p(0,0,0,0,0,0), cash_journal:p(0,0,0,0,0,0), department:p(0,0,0,0,0,0) },
    delivery:     { repair_order:p(1,0,1,0,0,0), repair_order_price:p(0,0,0,0,0,0), spare_part:p(0,0,0,0,0,0), stock_export:p(1,0,0,0,0,0), stock_import:p(0,0,0,0,0,0), stock_transfer:p(0,0,0,0,0,0), stock_count:p(0,0,0,0,0,0), stock_ledger:p(0,0,0,0,0,0), customer:p(1,0,0,0,0,0), sale_order:p(0,0,0,0,0,0), expense:p(0,0,0,0,0,0), revenue_report:p(0,0,0,0,0,0), staff:p(0,0,0,0,0,0), kpi:p(0,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(0,0,0,0,0,0), notification:p(1,0,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(0,0,0,0,0,0), debt:p(0,0,0,0,0,0), cash_journal:p(0,0,0,0,0,0), department:p(0,0,0,0,0,0) },
    it:           { repair_order:p(1,0,0,0,0,1), repair_order_price:p(1,0,0,0,0,0), spare_part:p(1,1,1,1,0,1), stock_export:p(1,0,0,0,0,0), stock_import:p(1,0,0,0,0,0), stock_transfer:p(0,0,0,0,0,0), stock_count:p(0,0,0,0,0,0), stock_ledger:p(1,0,0,0,0,1), customer:p(1,0,0,0,0,0), sale_order:p(1,0,0,0,0,0), expense:p(0,0,0,0,0,0), revenue_report:p(1,0,0,0,0,1), staff:p(1,1,1,0,0,0), kpi:p(1,0,0,0,0,0), settings:p(1,0,1,0,0,0), media_post:p(1,1,1,0,0,0), notification:p(1,1,0,0,0,0), warehouse_mgr:p(1,1,1,0,0,0), supplier:p(1,0,0,0,0,0), debt:p(1,0,0,0,0,0), cash_journal:p(1,0,0,0,0,0), department:p(1,0,0,0,0,0) },
    viewer:       { repair_order:p(1,0,0,0,0,0), repair_order_price:p(1,0,0,0,0,0), spare_part:p(1,0,0,0,0,0), stock_export:p(1,0,0,0,0,0), stock_import:p(1,0,0,0,0,0), stock_transfer:p(1,0,0,0,0,0), stock_count:p(1,0,0,0,0,0), stock_ledger:p(1,0,0,0,0,0), customer:p(1,0,0,0,0,0), sale_order:p(1,0,0,0,0,0), expense:p(0,0,0,0,0,0), revenue_report:p(1,0,0,0,0,0), staff:p(0,0,0,0,0,0), kpi:p(0,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(1,0,0,0,0,0), notification:p(0,0,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(1,0,0,0,0,0), debt:p(1,0,0,0,0,0), cash_journal:p(1,0,0,0,0,0), department:p(1,0,0,0,0,0) },
    guest:        { repair_order:p(1,0,0,0,0,0), repair_order_price:p(0,0,0,0,0,0), spare_part:p(0,0,0,0,0,0), stock_export:p(0,0,0,0,0,0), stock_import:p(0,0,0,0,0,0), stock_transfer:p(0,0,0,0,0,0), stock_count:p(0,0,0,0,0,0), stock_ledger:p(0,0,0,0,0,0), customer:p(0,0,0,0,0,0), sale_order:p(0,0,0,0,0,0), expense:p(0,0,0,0,0,0), revenue_report:p(0,0,0,0,0,0), staff:p(0,0,0,0,0,0), kpi:p(0,0,0,0,0,0), settings:p(0,0,0,0,0,0), media_post:p(1,0,0,0,0,0), notification:p(0,0,0,0,0,0), warehouse_mgr:p(0,0,0,0,0,0), supplier:p(0,0,0,0,0,0), debt:p(0,0,0,0,0,0), cash_journal:p(0,0,0,0,0,0), department:p(0,0,0,0,0,0) },
  };

  const rows = [];
  for (const [role_key, resources] of Object.entries(MATRIX)) {
    for (const [resource, perms] of Object.entries(resources)) {
      rows.push({ role_key, resource, ...perms });
    }
  }
  return rows;
}

// ── Seed All (UPSERT — an toàn khi bấm nhiều lần, không tạo trùng) ──
export async function seedAll(onProgress) {
  const log = onProgress || console.log;
  let created = 0, updated = 0, fail = 0;

  log("🚀 Bắt đầu seed roles (upsert)...");

  // 1. Upsert roles — map theo `key`, giữ record đầu tiên nếu có nhiều bản trùng
  const existingRoles = await pbListAll("roles");
  const roleByKey = {};
  for (const r of existingRoles) {
    if (!roleByKey[r.key]) roleByKey[r.key] = r; // giữ bản đầu tiên gặp
  }

  for (const role of ROLE_DEFINITIONS) {
    try {
      const existing = roleByKey[role.key];
      if (existing) {
        await pbPatch("roles", existing.id, role);
        updated++;
        log(`🔄 Role: ${role.key} (đã cập nhật)`);
      } else {
        await pbPost("roles", role);
        created++;
        log(`✅ Role: ${role.key} (mới)`);
      }
    } catch (e) {
      fail++;
      log(`❌ Role ${role.key}: ${e.message}`);
    }
  }

  // 2. Upsert permissions — map theo `role_key + resource`
  const rows = buildPermissionRows();
  log(`\n🔐 Upsert ${rows.length} permission rows...`);

  const existingPerms = await pbListAll("role_permissions");
  const permByKey = {};
  for (const p of existingPerms) {
    const k = `${p.role_key}::${p.resource}`;
    if (!permByKey[k]) permByKey[k] = p; // giữ bản đầu tiên gặp
  }

  const BATCH = 10;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await Promise.all(batch.map(async (row) => {
      const k = `${row.role_key}::${row.resource}`;
      const existing = permByKey[k];
      try {
        if (existing) {
          await pbPatch("role_permissions", existing.id, row);
          updated++;
        } else {
          await pbPost("role_permissions", row);
          created++;
        }
      } catch (e) {
        fail++;
        log(`❌ Perm ${row.role_key}/${row.resource}: ${e.message}`);
      }
    }));
    log(`  Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  log(`\n✅ Seed xong! Mới=${created}, Cập nhật=${updated}, Lỗi=${fail}`);
  return { ok: created + updated, created, updated, fail };
}

// Cho chạy từ browser console: window.seedHKRoles()
if (typeof window !== "undefined") {
  window.seedHKRoles = () => seedAll(console.log);
}
