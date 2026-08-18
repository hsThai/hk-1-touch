import React, { useState, useEffect } from "react";
import { getPbUrl, getAuth } from "./pb.jsx";

// Chuyển "YYYY-MM-DD" (ngày local của user, giờ VN) -> ISO UTC string khớp định dạng
// đang lưu trong created_date ("...T...Z"). new Date("YYYY-MM-DD") parse theo UTC nên
// phải tách y/m/d rồi dựng Date theo local timezone của browser mới ra đúng mốc giờ VN.
function localDateToUtcIso(dateStr, endOfDay = false) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  return dt.toISOString();
}

async function fetchLogs({ page, perPage, search, dateFrom, dateTo }) {
  const base = getPbUrl();
  const { token } = getAuth();
  const filters = [];
  if (search)   filters.push(`(staff_name~"${search}"||action~"${search}"||target_type~"${search}"||detail~"${search}")`);
  // created_date lưu dạng text ISO "YYYY-MM-DDTHH:MM:SS.sssZ" — PocketBase so sánh
  // filter theo string (lexicographic), nên PHẢI dùng đúng format "T...Z" khớp dữ liệu lưu,
  // nếu dùng dấu cách (" 00:00:00") thì so sánh string bị lệch và luôn trả về rỗng.
  // Đồng thời phải quy đổi ngày local (giờ VN) sang UTC để không bị lệch mốc giờ.
  if (dateFrom) filters.push(`created_date>="${localDateToUtcIso(dateFrom, false)}"`);
  if (dateTo)   filters.push(`created_date<="${localDateToUtcIso(dateTo, true)}"`);
  const params = new URLSearchParams({
    page, perPage,
    sort: "-id",
  });
  if (filters.length) params.set("filter", filters.join(" && "));
  const res = await fetch(
    `${base}/api/collections/action_logs/records?${params}`,
    { headers: token ? { Authorization: token } : {} }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { items, totalItems, totalPages }
}

function fmtDate(s) {
  if (!s) return "";
  const d = new Date(s);
  return (
    d.toLocaleDateString("vi-VN", { day:"2-digit", month:"2-digit" }) +
    " " +
    d.toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" })
  );
}

// ── Nhãn hành động dễ hiểu (tiếng Việt) ──────────────────────
const ACTION_LABEL = {
  create:              "Tạo mới",
  create_order:        "Tạo đơn sửa chữa",
  create_staff:        "Tạo nhân viên",
  create_sale:         "Tạo đơn bán hàng",
  create_return:       "Tạo đơn đổi trả",
  create_po:           "Tạo đơn mua hàng",
  create_customer:     "Tạo khách hàng",
  create_export:       "Tạo phiếu xuất",
  create_supplier:     "Tạo nhà cung cấp",
  create_role:         "Tạo vai trò",
  create_department:   "Tạo phòng ban",
  create_expense:      "Tạo chi phí",
  create_rma:          "Tạo phiếu RMA",
  update:              "Cập nhật",
  update_order:        "Cập nhật đơn sửa chữa",
  update_permission:   "Sửa phân quyền",
  update_price:        "Sửa giá",
  delete:              "Xóa",
  delete_order:        "Xóa đơn sửa chữa",
  delete_staff:        "Xóa nhân viên",
  delete_role:         "Xóa vai trò",
  delete_department:   "Xóa phòng ban",
  delete_supplier:     "Xóa nhà cung cấp",
  login:               "Đăng nhập",
  logout:              "Đăng xuất",
  complete_order:      "Hoàn tất đơn",
  export_stock:        "Xuất kho",
  import_stock:        "Nhập kho",
  transfer_stock:      "Chuyển kho",
  count_stock:         "Kiểm kho",
  pay_debt:            "Thanh toán nợ",
  add_expense:         "Thêm chi phí",
  handover:            "Bàn giao đơn",
  confirm_payment:     "Xác nhận thu tiền",
  confirm_export:      "Kho xác nhận xuất",
  receive_parts:       "KTV nhận linh kiện",
  return_parts:        "Trả linh kiện mượn",
  seed_permissions:    "Seed phân quyền",
  save_template:       "Lưu mẫu in",
  reset_template:      "Reset mẫu in",
  toggle_template:     "Bật/tắt mẫu in",
  update_settings:     "Cập nhật cài đặt",
  save_config:         "Lưu cấu hình",
};

// ── Nhãn đối tượng dễ hiểu (tiếng Việt) ──────────────────────
const TARGET_LABEL = {
  staff:              "Nhân viên",
  customer:           "Khách hàng",
  repair_order:       "Đơn sửa chữa",
  sale_order:         "Đơn bán hàng",
  return_order:       "Đơn đổi trả",
  expense:            "Chi phí",
  purchase_order:     "Đơn mua hàng (NCC)",
  stock_import:       "Phiếu nhập kho",
  stock_export:       "Phiếu xuất kho",
  stock_transfer:     "Phiếu chuyển kho",
  stock_count:        "Phiếu kiểm kho",
  debt_payment:       "Thanh toán công nợ",
  debt_voucher:       "Phiếu công nợ NCC",
  spare_part_usage:   "Linh kiện sử dụng",
  supplier:           "Nhà cung cấp",
  role:               "Vai trò",
  role_permission:    "Phân quyền",
  department:         "Phòng ban",
  auth:               "Phiên đăng nhập",
  cash_journal:       "Sổ quỹ",
  app_settings:       "Cài đặt ứng dụng",
  price_policy:       "Chính sách giá",
  product_mgr:        "Danh mục hàng hóa",
  print_template:     "Mẫu in",
  rma:                "Phiếu RMA",
  warehouse:         "Kho",
  warehouse_zone:    "Khu vực kho",
  warehouse_location:"Vị trí kệ",
};

const ACTION_COLOR = {
  create:         { bg:"#dcfce7", color:"#15803d" },
  create_order:   { bg:"#dcfce7", color:"#15803d" },
  create_staff:   { bg:"#dcfce7", color:"#15803d" },
  create_sale:    { bg:"#dcfce7", color:"#15803d" },
  create_return:  { bg:"#fef3c7", color:"#d97706" },
  update:         { bg:"#fef9c3", color:"#b45309" },
  update_order:   { bg:"#fef9c3", color:"#b45309" },
  delete:         { bg:"#fee2e2", color:"#dc2626" },
  delete_order:   { bg:"#fee2e2", color:"#dc2626" },
  login:          { bg:"#eff6ff", color:"#1d4ed8" },
  complete_order: { bg:"#dcfce7", color:"#15803d" },
  export_stock:   { bg:"#fef9c3", color:"#b45309" },
  import_stock:   { bg:"#dbeafe", color:"#1d4ed8" },
  transfer_stock: { bg:"#e9d5ff", color:"#7c3aed" },
  count_stock:    { bg:"#fef3c7", color:"#d97706" },
  pay_debt:       { bg:"#dcfce7", color:"#15803d" },
  add_expense:    { bg:"#fee2e2", color:"#dc2626" },
  create_po:      { bg:"#dbeafe", color:"#1d4ed8" },
  handover:           { bg:"#dcfce7", color:"#15803d" },
  confirm_payment:    { bg:"#dcfce7", color:"#15803d" },
  confirm_export:     { bg:"#dbeafe", color:"#1d4ed8" },
  receive_parts:      { bg:"#e0e7ff", color:"#4338ca" },
  return_parts:       { bg:"#f3e8ff", color:"#7c3aed" },
  seed_permissions:   { bg:"#fef3c7", color:"#d97706" },
  save_template:      { bg:"#dcfce7", color:"#15803d" },
  reset_template:     { bg:"#fee2e2", color:"#dc2626" },
  toggle_template:    { bg:"#fef9c3", color:"#b45309" },
  update_settings:    { bg:"#fef9c3", color:"#b45309" },
  save_config:        { bg:"#fef9c3", color:"#b45309" },
  update_permission:  { bg:"#fef3c7", color:"#d97706" },
  update_price:       { bg:"#fef9c3", color:"#b45309" },
  logout:             { bg:"#f3f4f6", color:"#6b7280" },
  create_customer:    { bg:"#dcfce7", color:"#15803d" },
  create_export:      { bg:"#dcfce7", color:"#15803d" },
  create_supplier:    { bg:"#dcfce7", color:"#15803d" },
  create_role:        { bg:"#dcfce7", color:"#15803d" },
  create_department:  { bg:"#dcfce7", color:"#15803d" },
  create_expense:     { bg:"#dcfce7", color:"#15803d" },
  create_rma:         { bg:"#dcfce7", color:"#15803d" },
  delete_staff:        { bg:"#fee2e2", color:"#dc2626" },
  delete_role:        { bg:"#fee2e2", color:"#dc2626" },
  delete_department:  { bg:"#fee2e2", color:"#dc2626" },
  delete_supplier:    { bg:"#fee2e2", color:"#dc2626" },
};

function actionLabel(key) {
  const k = (key||"").toLowerCase();
  return ACTION_LABEL[k] || key || "—";
}
function targetLabel(key) {
  const k = (key||"").toLowerCase();
  return TARGET_LABEL[k] || key || "";
}

export default function ActionLogPage({ user }) {

  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]   = useState("");
  const PER_PAGE = 50;

  useEffect(() => { load(); }, [page, search, dateFrom, dateTo]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLogs({ page, perPage: PER_PAGE, search, dateFrom, dateTo });
      setLogs(data.items || []);
      setTotal(data.totalItems || 0);
    } catch (e) {
      setLogs([]);
      setError("Chưa có dữ liệu hoặc collection chưa tồn tại");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div style={{ padding: isPC ? "24px 32px 40px" : "16px 14px 80px", maxWidth: isPC ? 1200 : "100%", margin:"0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <span className="material-icons"
          style={{ fontFamily:"Material Icons", fontSize:24, color:"#4f46e5" }}>history</span>
        <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#1e1b4b" }}>
          Nhật ký thao tác
        </h2>
        <span style={{ marginLeft:"auto", fontSize:12, color:"#9ca3af" }}>
          {total > 0 ? `${total} bản ghi` : ""}
        </span>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
        <div style={{ position:"relative", flex:1, minWidth:160 }}>
          <span className="material-icons" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:18, color:"#9ca3af" }}>search</span>
          <input
            placeholder="Tìm nhân viên, hành động, nội dung..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width:"100%", boxSizing:"border-box", padding:"8px 12px 8px 44px", borderRadius:8,
              border:"1px solid #e5e7eb", fontSize:14 }}
          />
        </div>
        <input type="date" value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); if(!dateTo) setDateTo(e.target.value); setPage(1); }}
          style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #e5e7eb", fontSize:13 }}
        />
        <span style={{ lineHeight:"34px", color:"#9ca3af", fontSize:13 }}>→</span>
        <input type="date" value={dateTo}
          onChange={e => { setDateTo(e.target.value); if(!dateFrom) setDateFrom(e.target.value); setPage(1); }}
          style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #e5e7eb", fontSize:13 }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : error || logs.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>
          <span className="material-icons"
            style={{ fontFamily:"Material Icons", fontSize:48, display:"block", marginBottom:10 }}>
            history
          </span>
          <div style={{ fontWeight:600, fontSize:15, color:"#374151", marginBottom:6 }}>
            Chưa có nhật ký nào
          </div>
          <div style={{ fontSize:13 }}>{error || "Thử thay đổi bộ lọc để xem kết quả"}</div>
        </div>
      ) : isPC ? (
        /* ═══ PC: bảng, cột Ghi chú rộng + không cắt chữ ═══ */
        <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e5e7eb" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["Thời gian","Nhân viên","Hành động","Đối tượng","Nội dung / Ghi chú"].map(h => (
                  <th key={h} style={{ padding:"10px 12px", textAlign:"left",
                    fontWeight:700, color:"#374151", borderBottom:"1px solid #e5e7eb",
                    whiteSpace:"nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const actionKey = (log.action||"").toLowerCase();
                const ac = ACTION_COLOR[actionKey] || { bg:"#eef2ff", color:"#4f46e5" };
                return (
                  <tr key={log.id || i}
                    style={{ background: i%2===0 ? "#fff" : "#f9fafb",
                      borderBottom:"1px solid #f3f4f6", verticalAlign:"top" }}>
                    <td style={{ padding:"10px 12px", color:"#6b7280", whiteSpace:"nowrap" }}>
                      {fmtDate(log.created_date)}
                    </td>
                    <td style={{ padding:"10px 12px", fontWeight:700, color:"#1f2937", whiteSpace:"nowrap" }}>
                      {log.staff_name || "—"}
                    </td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ background:ac.bg, color:ac.color,
                        borderRadius:6, padding:"2px 8px", fontSize:12, fontWeight:700,
                        whiteSpace:"nowrap" }}>
                        {actionLabel(log.action)}
                      </span>
                    </td>
                    <td style={{ padding:"10px 12px", color:"#374151", whiteSpace:"nowrap" }}>
                      {targetLabel(log.target_type) || "—"}
                    </td>
                    <td style={{ padding:"10px 12px", color:"#374151", minWidth:260, wordBreak:"break-word" }}>
                      {log.detail || <span style={{ color:"#9ca3af" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ═══ Mobile: dạng thẻ (card) dễ đọc, gộp Đối tượng + Nội dung ═══ */
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {logs.map((log, i) => {
            const actionKey = (log.action||"").toLowerCase();
            const ac = ACTION_COLOR[actionKey] || { bg:"#eef2ff", color:"#4f46e5" };
            const tLabel = targetLabel(log.target_type);
            return (
              <div key={log.id || i}
                style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, gap:8 }}>
                  <span style={{ fontWeight:800, fontSize:14, color:"#1f2937" }}>{log.staff_name || "—"}</span>
                  <span style={{ fontSize:12, color:"#9ca3af", whiteSpace:"nowrap" }}>{fmtDate(log.created_date)}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                  <span style={{ background:ac.bg, color:ac.color,
                    borderRadius:6, padding:"3px 10px", fontSize:12, fontWeight:700 }}>
                    {actionLabel(log.action)}
                  </span>
                  {tLabel && (
                    <span style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>
                      trên {tLabel}
                    </span>
                  )}
                </div>
                <div style={{ fontSize:13.5, color:"#374151", lineHeight:1.5 }}>
                  {log.detail || <span style={{ color:"#9ca3af" }}>Không có nội dung chi tiết</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center",
          gap:10, marginTop:16 }}>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
            style={{ padding:"6px 16px", borderRadius:8, border:"1px solid #e5e7eb",
              background: page===1 ? "#f3f4f6" : "#fff",
              cursor: page===1 ? "default" : "pointer",
              color: page===1 ? "#9ca3af" : "#374151", fontWeight:600 }}>
            ← Trước
          </button>
          <span style={{ fontSize:13, color:"#6b7280" }}>
            Trang {page}/{totalPages} · {total} bản ghi
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
            style={{ padding:"6px 16px", borderRadius:8, border:"1px solid #e5e7eb",
              background: page===totalPages ? "#f3f4f6" : "#fff",
              cursor: page===totalPages ? "default" : "pointer",
              color: page===totalPages ? "#9ca3af" : "#374151", fontWeight:600 }}>
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}
