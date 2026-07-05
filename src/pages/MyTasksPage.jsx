/**
 * MyTasksPage.jsx — "Việc của tôi"
 * Unified task list per role — shows what needs attention NOW.
 * Replaces individual home pages (ktv_home, rec_home, role_home, dashboard).
 */
import React, { useState, useEffect, useMemo } from "react";
import { StockExportRequest, SparePart, StockImport, StockLedger, SaleOrder, DebtVoucher, RepairOrder } from "./pb.jsx";

const fmtTime = (d) => {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
};

const isOverdue = (d, thresholdMins = 60) => {
  if (!d) return false;
  return Date.now() - new Date(d).getTime() > thresholdMins * 60000;
};

// ─── Task card ────────────────────────────────────────────
function TaskCard({ icon, title, subtitle, badge, badgeColor, urgency, onClick, rightLabel }) {
  const urgencyStyle = {
    urgent:  { borderLeft: "4px solid #dc2626", bg: "#fef2f2" },
    today:   { borderLeft: "4px solid #d97706", bg: "#fffbeb" },
    waiting: { borderLeft: "4px solid #6b7280", bg: "#f9fafb" },
    done:    { borderLeft: "4px solid #059669", bg: "#f0fdf4" },
  }[urgency] || { borderLeft: "4px solid #e5e7eb", bg: "#fff" };

  return (
    <div onClick={onClick}
      style={{
        background: urgencyStyle.bg, borderRadius: 12, padding: "14px 16px",
        borderLeft: urgencyStyle.borderLeft, border: "1px solid #f3f4f6",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
        marginBottom: 8, transition: "transform .1s",
      }}
      onTouchStart={e => e.currentTarget.style.transform = "scale(0.98)"}
      onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <span className="material-icons" style={{
        fontFamily: "Material Icons", fontSize: 24, flexShrink: 0,
        color: urgencyStyle.borderLeft.includes("dc2626") ? "#dc2626"
             : urgencyStyle.borderLeft.includes("d97706") ? "#d97706"
             : urgencyStyle.borderLeft.includes("059669") ? "#059669"
             : "#6b7280",
      }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {rightLabel && <div style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{rightLabel}</div>}
      {badge && (
        <div style={{
          background: badgeColor || "#dc2626", color: "#fff", borderRadius: 99,
          padding: "3px 10px", fontSize: 12, fontWeight: 800, flexShrink: 0,
        }}>{badge}</div>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────
function SectionHeader({ icon, title, count, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 8px" }}>
      <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 18, color: color || "#374151" }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: 14, color: "#374151" }}>{title}</span>
      {count > 0 && <span style={{ background: (color||"#374151") + "22", color: color || "#374151", borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{count}</span>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────
export default function MyTasksPage({ user, orders = [], setPage, onNewOrder, onOpenCashier }) {
  const role = user?.role || "viewer";
  const [extraData, setExtraData] = useState({});
  const [loading, setLoading] = useState(true);

  // Load extra data based on role
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = {};
        if (["cashier", "accountant", "manager", "admin", "owner"].includes(role)) {
          data.saleOrders = await SaleOrder.list({ limit: 200, sort: "-id" }).catch(() => []);
        }
        if (["warehouse", "manager", "admin", "owner"].includes(role)) {
          const [exports, imports, ledgers] = await Promise.all([
            StockExportRequest.list({ limit: 200 }).catch(() => []),
            StockImport.list({ limit: 100, sort: "-id" }).catch(() => []),
            StockLedger.list({ limit: 500 }).catch(() => []),
          ]);
          data.stockExports = exports;
          data.stockImports = imports;
          data.lowStock = (ledgers || []).filter(l => (l.qty_on_hand || 0) <= (l.min_qty || 3)).length;
        }
        if (["accountant", "manager", "admin", "owner"].includes(role)) {
          data.debts = await DebtVoucher.list({ limit: 200, sort: "-id" }).catch(() => []);
        }
        if (!cancelled) { setExtraData(data); setLoading(false); }
      } catch (e) {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [role]);

  // ── Compute tasks per role ──────────────────────────────
  const tasks = useMemo(() => {
    const result = { urgent: [], today: [], waiting: [] };
    const today = new Date().toLocaleDateString("vi-VN");
    const myId = user?.id || user?._id || "";

    // ═══ KTV ═══
    if (role === "technician") {
      const myOrders = orders.filter(o => o.assigned_to === myId || o.assigned_to === user?._id);
      const choKtv = myOrders.filter(o => ["Chờ KTV", "Chờ KTV Sửa"].includes(o.status));
      const dangSua = myOrders.filter(o => o.status === "Đang Sửa");
      const choLinhKien = myOrders.filter(o => o.status === "Chờ Linh Kiện");
      const xongHomNay = myOrders.filter(o =>
        (o.status === "Hoàn Thành" || o.status === "Đã Giao") &&
        new Date(o.done_date || o.updated_date || 0).toLocaleDateString("vi-VN") === today
      );

      choKtv.forEach(o => result.urgent.push({
        icon: "schedule_send", title: o.device_name || "Đơn sửa chữa",
        subtitle: `${o.order_code} · ${o.customer_name || ""}`,
        badge: "Chờ nhận", badgeColor: "#dc2626", urgency: "urgent",
        rightLabel: fmtTime(o.received_date),
        onClick: () => setPage("tasks"),
      }));
      dangSua.forEach(o => result.today.push({
        icon: "build", title: o.device_name || "Đang sửa",
        subtitle: `${o.order_code} · ${o.customer_name || ""}`,
        badge: "Đang sửa", badgeColor: "#d97706", urgency: "today",
        onClick: () => setPage("tasks"),
      }));
      choLinhKien.forEach(o => result.waiting.push({
        icon: "inventory", title: o.device_name || "Chờ linh kiện",
        subtitle: `${o.order_code} · ${o.customer_name || ""}`,
        badge: "Chờ LK", badgeColor: "#ea580c", urgency: "waiting",
        onClick: () => setPage("tasks"),
      }));
      xongHomNay.forEach(o => result.waiting.push({
        icon: "check_circle", title: o.device_name || "Hoàn thành",
        subtitle: `${o.order_code} · ${o.customer_name || ""}`,
        badge: "Xong", badgeColor: "#059669", urgency: "done",
        onClick: () => setPage("tasks"),
      }));
    }

    // ═══ RECEPTIONIST ═══
    if (role === "receptionist") {
      const choKtv = orders.filter(o => o.status === "Chờ KTV" && !o.assigned_to);
      const choBaoGia = orders.filter(o => o.status === "Chờ Báo Giá");
      const choXacNhan = orders.filter(o => o.status === "Chờ Xác Nhận");
      const choBanGiao = orders.filter(o => o.status === "Hoàn Thành");
      const newToday = orders.filter(o => new Date(o.received_date || o.created_date || 0).toLocaleDateString("vi-VN") === today && !["Đã Giao", "Hủy"].includes(o.status));

      choKtv.forEach(o => result.urgent.push({
        icon: "person_add", title: o.device_name || "Chờ phân công KTV",
        subtitle: `${o.order_code} · ${o.customer_name || ""}`,
        badge: "Chờ KTV", badgeColor: "#dc2626", urgency: "urgent",
        rightLabel: fmtTime(o.received_date),
        onClick: () => setPage("tasks"),
      }));
      choBaoGia.forEach(o => result.today.push({
        icon: "request_quote", title: o.device_name || "Chờ báo giá",
        subtitle: `${o.order_code} · ${o.customer_name || ""}`,
        badge: "Báo giá", badgeColor: "#d97706", urgency: "today",
        onClick: () => setPage("tasks"),
      }));
      choXacNhan.forEach(o => result.today.push({
        icon: "pending_actions", title: o.device_name || "Chờ xác nhận KH",
        subtitle: `${o.order_code} · ${o.customer_name || ""}`,
        badge: "Xác nhận", badgeColor: "#db2777", urgency: "today",
        onClick: () => setPage("tasks"),
      }));
      choBanGiao.forEach(o => result.urgent.push({
        icon: "handshake", title: o.device_name || "Chờ bàn giao",
        subtitle: `${o.order_code} · ${o.customer_name || ""}`,
        badge: "Bàn giao", badgeColor: "#059669", urgency: "urgent",
        onClick: () => setPage("tasks"),
      }));
      newToday.forEach(o => result.waiting.push({
        icon: "add_circle", title: o.device_name || "Đã tiếp nhận",
        subtitle: `${o.order_code} · ${o.customer_name || ""}`,
        badge: "Hôm nay", badgeColor: "#4f46e5", urgency: "waiting",
        onClick: () => setPage("tasks"),
      }));
    }

    // ═══ CASHIER ═══
    if (role === "cashier") {
      const so = extraData.saleOrders || [];
      const pending = so.filter(o => o.status === "pending_payment");
      pending.forEach(o => result.urgent.push({
        icon: "pending_actions", title: `Đơn ${o.order_code || ""}`,
        subtitle: `${o.customer_name || "Khách lẻ"} · ${(o.total || 0).toLocaleString("vi-VN")}đ`,
        badge: "Chờ thu", badgeColor: "#dc2626", urgency: "urgent",
        onClick: () => onOpenCashier ? onOpenCashier() : setPage("cashier_home"),
      }));
      if (pending.length === 0) {
        result.waiting.push({
          icon: "check_circle", title: "Không có đơn chờ thu",
          subtitle: "Tất cả đơn đã được xác nhận",
          urgency: "done", onClick: () => onOpenCashier ? onOpenCashier() : setPage("cashier_home"),
        });
      }
    }

    // ═══ ACCOUNTANT ═══
    if (role === "accountant") {
      const so = extraData.saleOrders || [];
      const debts = extraData.debts || [];
      const unpaidSales = so.filter(o => o.status === "completed" && !o.journal_entry_id);
      const overdueDebts = debts.filter(d => d.status === "open" && d.remaining > 0 && d.due_date && new Date(d.due_date) < Date.now());

      unpaidSales.forEach(o => result.urgent.push({
        icon: "receipt_long", title: `Đơn ${o.order_code || ""} chưa ghi sổ`,
        subtitle: `${o.customer_name || "Khách lẻ"} · ${(o.total || 0).toLocaleString("vi-VN")}đ`,
        badge: "Ghi sổ", badgeColor: "#dc2626", urgency: "urgent",
        onClick: () => setPage("cash_journal"),
      }));
      overdueDebts.forEach(d => result.urgent.push({
        icon: "account_balance_wallet", title: `Công nợ ${d.party_name || ""} quá hạn`,
        subtitle: `Còn nợ ${(d.remaining || 0).toLocaleString("vi-VN")}đ · Đến hạn ${d.due_date ? new Date(d.due_date).toLocaleDateString("vi-VN") : ""}`,
        badge: "Quá hạn", badgeColor: "#dc2626", urgency: "urgent",
        onClick: () => setPage("debts"),
      }));
      if (unpaidSales.length === 0 && overdueDebts.length === 0) {
        result.waiting.push({
          icon: "check_circle", title: "Sổ quỹ đã cập nhật",
          subtitle: "Không có khoản nào quá hạn", urgency: "done",
          onClick: () => setPage("cash_journal"),
        });
      }
    }

    // ═══ WAREHOUSE ═══
    if (role === "warehouse") {
      const exports = extraData.stockExports || [];
      const imports = extraData.stockImports || [];
      const pendingExport = exports.filter(r => r.status === "pending");
      const overdueBorrow = exports.filter(r =>
        r.export_type === "borrow" && r.status === "ktv_confirmed" &&
        r.return_due_date && new Date(r.return_due_date) < Date.now()
      );
      const pendingImport = imports.filter(r => r.status === "pending");

      pendingExport.forEach(r => result.urgent.push({
        icon: "outbox", title: `Phiếu xuất ${r.request_code || ""}`,
        subtitle: `${r.order_code || ""} · ${r.items?.length || 0} linh kiện`,
        badge: "Chờ xuất", badgeColor: "#dc2626", urgency: "urgent",
        onClick: () => setPage("wh_export"),
      }));
      overdueBorrow.forEach(r => result.urgent.push({
        icon: "assignment_return", title: `Hàng mượn quá hạn ${r.request_code || ""}`,
        subtitle: `${r.order_code || ""} · Hạn trả: ${r.return_due_date ? new Date(r.return_due_date).toLocaleDateString("vi-VN") : ""}`,
        badge: "Quá hạn", badgeColor: "#dc2626", urgency: "urgent",
        onClick: () => setPage("wh_export"),
      }));
      pendingImport.forEach(r => result.today.push({
        icon: "move_to_inbox", title: `Phiếu nhập ${r.import_code || ""}`,
        subtitle: `${r.supplier_name || ""} · ${r.total_items || 0} mục`,
        badge: "Chờ nhập", badgeColor: "#d97706", urgency: "today",
        onClick: () => setPage("wh_import"),
      }));
      if (extraData.lowStock > 0) {
        result.today.push({
          icon: "warning", title: `${extraData.lowStock} linh kiện sắp hết`,
          subtitle: "Tồn kho ≤ mức tối thiểu",
          badge: "Tồn thấp", badgeColor: "#d97706", urgency: "today",
          onClick: () => setPage("wh_manager"),
        });
      }
      if (pendingExport.length === 0 && overdueBorrow.length === 0 && pendingImport.length === 0) {
        result.waiting.push({
          icon: "check_circle", title: "Kho ổn định",
          subtitle: "Không có phiếu chờ xử lý", urgency: "done",
          onClick: () => setPage("wh_home"),
        });
      }
    }

    // ═══ MANAGER / ADMIN / OWNER ═══
    if (["manager", "admin", "owner", "supervisor"].includes(role)) {
      const slaBreaches = orders.filter(o =>
        ["Chờ KTV", "Chờ KTV Sửa"].includes(o.status) &&
        isOverdue(o.received_date, 1300)
      );
      const choKtv = orders.filter(o => o.status === "Chờ KTV" && !o.assigned_to);
      const choBanGiao = orders.filter(o => o.status === "Hoàn Thành");
      const choBaoGia = orders.filter(o => o.status === "Chờ Báo Giá");
      const dangSua = orders.filter(o => o.status === "Đang Sửa");

      slaBreaches.forEach(o => result.urgent.push({
        icon: "dangerous", title: `SLA vượt quá ${o.order_code || ""}`,
        subtitle: `${o.device_name || ""} · ${o.customer_name || ""} · ${fmtTime(o.received_date)}`,
        badge: "SLA!", badgeColor: "#dc2626", urgency: "urgent",
        onClick: () => setPage("tasks"),
      }));
      choKtv.forEach(o => result.today.push({
        icon: "person_add", title: `Chờ phân KTV: ${o.order_code || ""}`,
        subtitle: `${o.device_name || ""} · ${o.customer_name || ""}`,
        badge: "Chờ KTV", badgeColor: "#d97706", urgency: "today",
        onClick: () => setPage("tasks"),
      }));
      choBanGiao.forEach(o => result.today.push({
        icon: "handshake", title: `Chờ bàn giao: ${o.order_code || ""}`,
        subtitle: `${o.device_name || ""} · ${o.customer_name || ""}`,
        badge: "Bàn giao", badgeColor: "#059669", urgency: "today",
        onClick: () => setPage("tasks"),
      }));
      if (extraData.saleOrders) {
        const pendingPay = extraData.saleOrders.filter(o => o.status === "pending_payment");
        pendingPay.forEach(o => result.today.push({
          icon: "pending_actions", title: `Đơn bán chờ thu: ${o.order_code || ""}`,
          subtitle: `${o.customer_name || "Khách lẻ"} · ${(o.total || 0).toLocaleString("vi-VN")}đ`,
          badge: "Chờ thu", badgeColor: "#d97706", urgency: "today",
          onClick: () => setPage("cashier_home"),
        }));
      }
      if (extraData.stockExports) {
        const pendingEx = extraData.stockExports.filter(r => r.status === "pending");
        pendingEx.forEach(r => result.waiting.push({
          icon: "outbox", title: `Phiếu xuất chờ: ${r.request_code || ""}`,
          subtitle: `${r.order_code || ""}`,
          badge: "Kho", badgeColor: "#6b7280", urgency: "waiting",
          onClick: () => setPage("wh_export"),
        }));
      }
      if (slaBreaches.length === 0 && choKtv.length === 0 && choBanGiao.length === 0) {
        result.waiting.push({
          icon: "check_circle", title: "Tất cả ổn",
          subtitle: "Không có đơn vượt SLA hay chờ xử lý khẩn", urgency: "done",
          onClick: () => setPage("dashboard"),
        });
      }
    }

    // ═══ SALES / TEAM_LEADER ═══
    if (["sales", "team_leader"].includes(role)) {
      const choBanGiao = orders.filter(o => o.status === "Hoàn Thành");
      const dangSua = orders.filter(o => o.status === "Đang Sửa");

      dangSua.forEach(o => result.today.push({
        icon: "build", title: `Đang sửa: ${o.device_name || ""}`,
        subtitle: `${o.order_code} · ${o.customer_name || ""}`,
        badge: "Đang sửa", badgeColor: "#d97706", urgency: "today",
        onClick: () => setPage("tasks"),
      }));
      choBanGiao.forEach(o => result.waiting.push({
        icon: "handshake", title: `Chờ bàn giao: ${o.device_name || ""}`,
        subtitle: `${o.order_code} · ${o.customer_name || ""}`,
        badge: "Xong", badgeColor: "#059669", urgency: "waiting",
        onClick: () => setPage("tasks"),
      }));
      result.urgent.push({
        icon: "point_of_sale", title: "Bán hàng",
        subtitle: "Mở màn hình bán hàng",
        badge: "POS", badgeColor: "#059669", urgency: "today",
        onClick: () => onOpenCashier ? onOpenCashier() : setPage("cashier_home"),
      });
    }

    // ═══ OTHER ROLES (hr, marketing, qa, support, delivery, it, viewer) ═══
    const roleLabels = {
      hr: "Nhân sự", marketing: "Marketing", qa: "QA", support: "Hỗ trợ",
      delivery: "Giao nhận", it: "IT", viewer: "Xem",
    };
    if (roleLabels[role]) {
      const active = orders.filter(o => !["Đã Giao", "Hủy"].includes(o.status));
      result.today.push({
        icon: "list_alt", title: `${active.length} đơn đang xử lý`,
        subtitle: "Tổng quan đơn sửa chữa",
        onClick: () => setPage("tasks"),
      });
    }

    return result;
  }, [role, orders, extraData, user, setPage, onOpenCashier]);

  // ── Greeting ────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const roleLabel = {
    technician: "Kỹ thuật viên", receptionist: "Tiếp tân", cashier: "Thu ngân",
    accountant: "Kế toán", warehouse: "Nhân viên kho", sales: "Bán hàng",
    team_leader: "Trưởng nhóm", manager: "Quản lý", admin: "Quản trị",
    owner: "Chủ cơ sở", supervisor: "Giám sát",
    hr: "Nhân sự", marketing: "Marketing", qa: "QA", support: "Hỗ trợ",
    delivery: "Giao nhận", it: "IT", viewer: "Chỉ xem",
  }[role] || role;

  const urgentCount = tasks.urgent.length;
  const todayCount = tasks.today.length;

  return (
    <div style={{ padding: "16px 14px 100px", maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg,#1e1b4b,#4f46e5)", borderRadius: 20,
        padding: "20px 22px", marginBottom: 16, color: "#fff",
      }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>
          {greeting}, {user?.name || user?.full_name || "bạn"}!
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 3 }}>
          {roleLabel} · {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" })}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <div style={{ background: "rgba(255,255,255,.15)", borderRadius: 12, padding: "8px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{urgentCount}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Khẩn cấp</div>
          </div>
          <div style={{ background: "rgba(255,255,255,.15)", borderRadius: 12, padding: "8px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{todayCount}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Hôm nay</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>⏳ Đang tải...</div>
      ) : (
        <>
          {/* Khẩn cấp */}
          {tasks.urgent.length > 0 && (
            <>
              <SectionHeader icon="priority_high" title="Khẩn cấp" count={tasks.urgent.length} color="#dc2626" />
              {tasks.urgent.slice(0, 20).map((t, i) => <TaskCard key={"u" + i} {...t} />)}
            </>
          )}

          {/* Cần xử lý hôm nay */}
          {tasks.today.length > 0 && (
            <>
              <SectionHeader icon="today" title="Cần xử lý" count={tasks.today.length} color="#d97706" />
              {tasks.today.slice(0, 20).map((t, i) => <TaskCard key={"t" + i} {...t} />)}
            </>
          )}

          {/* Đang chờ */}
          {tasks.waiting.length > 0 && (
            <>
              <SectionHeader icon="schedule" title="Đang chờ" count={tasks.waiting.length} color="#6b7280" />
              {tasks.waiting.slice(0, 10).map((t, i) => <TaskCard key={"w" + i} {...t} />)}
            </>
          )}

          {/* Empty */}
          {tasks.urgent.length === 0 && tasks.today.length === 0 && tasks.waiting.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Không có việc cần làm</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Tất cả đều đã xử lý!</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
