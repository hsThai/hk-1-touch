/**
 * WarehouseApp.jsx
 * Các component cho role warehouse, technician, receptionist
 * Tách từ MainApp.jsx để giảm kích thước file
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  RepairChat, Notification, Staff, RepairOrder, Customer,
  SparePart, StockExportRequest, StockImport, StockImportItem,
  StockLedger, ActionLog, CashJournal, DebtVoucher, Supplier,
  PurchaseOrder, PurchaseOrderItem,
  getPbUrl, getAuth, logHistory, getLocalDate } from "./pb.jsx";
import { uploadFile } from "./pb.jsx";
import {
  timeAgo, genOrderId, getKpiTimerInfo,
  MediaViewer, AcceptChecklistModal, AcceptTimer,
  STATUS_PB, STATUS_DISPLAY, PRIORITY_PB, PRIORITY_DISPLAY, STATUS_COLS
} from "./MediaViewer";
import { IMEIScanModal } from "./QRComponents";
import { NewOrderModal } from "./OrderForms";

// ── 7 FUNCTIONS tách từ MainApp.jsx ──────────────────────────

function WarehouseOrders({ user, users, setSelectedOrder }) {
  const [orders, setOrders] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [unreadMap, setUnreadMap] = React.useState({});

  React.useEffect(() => {
    (async () => {
      try {
        // Lấy đơn đang hoạt động (chưa giao)
        const data = await RepairOrder.list({ sort:"-received_date", limit:100 });
        const active = data.filter(o => !["Đã Giao","Hủy"].includes(o.status));
        setOrders(active);

        // Đếm tin nhắn chưa đọc (có mention kho hoặc hệ thống)
        try {
          const notifs = await Notification.filter({ user_id: user.id, is_read: false });
          const map = {};
          notifs.forEach(n => {
            if (n.order_id) map[n.order_id] = (map[n.order_id]||0) + 1;
          });
          setUnreadMap(map);
        } catch{}
      } catch(e){ console.error(e); }
      setLoading(false);
    })();
  }, []);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    return !q || (o.order_code||"").toLowerCase().includes(q)
      || (o.customer_name||"").toLowerCase().includes(q)
      || (o.device_name||"").toLowerCase().includes(q)
      || (o.assigned_to_name||"").toLowerCase().includes(q);
  });

  const STATUS_COLOR = {
    "Chờ KTV":"#fef2f2","KTV Đang Kiểm":"#e0f2fe","Chờ Báo Giá":"#fffbeb","Chờ Xác Nhận":"#fdf2f8","Chờ KTV Sửa":"#f5f3ff","Chờ Linh Kiện":"#fce7f3",
    "Đang Sửa":"#ede9fe","Hoàn Thành":"#dcfce7","Đã Giao":"#f1f5f9"
  };
  const STATUS_TEXT = {
    "Chờ KTV":"#dc2626","KTV Đang Kiểm":"#0369a1","Chờ Báo Giá":"#d97706","Chờ Xác Nhận":"#db2777","Chờ KTV Sửa":"#7c3aed","Chờ Linh Kiện":"#be185d",
    "Đang Sửa":"#5b21b6","Hoàn Thành":"#065f46","Đã Giao":"#475569"
  };

  return (
    <div style={{ paddingBottom:100 }}>
      <div style={{ padding:"14px 14px 8px", position:"sticky", top:56, background:"#fff", zIndex:10, borderBottom:"1.5px solid #e5e7eb" }}>
        <div style={{ fontWeight:900, fontSize:17, color:"#1e1b4b", marginBottom:10 }}>💬 Chat theo đơn</div>
        <div style={{ position:"relative" }}>
          <span className="material-icons" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:18, color:"#9ca3af", fontFamily:"Material Icons" }}>search</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Tìm đơn, khách hàng, thiết bị..."
            style={{ width:"100%", height:38, borderRadius:10, border:"1.5px solid #e5e7eb", paddingLeft:34, paddingRight:10, fontSize:14, boxSizing:"border-box", outline:"none" }} />
        </div>
      </div>

      <div style={{ padding:"10px 14px" }}>
        {loading ? (
          <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>⏳ Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div style={{textAlign:"center",padding:"40px 20px",color:"#9ca3af"}}>
            <span className="material-icons" style={{fontSize:48,display:"block",marginBottom:8}}>chat_bubble_outline</span>
            Không có đơn nào
          </div>
        ) : filtered.map(o => {
          const unread = unreadMap[o._id||o.id] || 0;
          const statusBg = STATUS_COLOR[o.status] || "#f3f4f6";
          const statusTxt = STATUS_TEXT[o.status] || "#374151";
          return (
            <div key={o.id||o._id} onClick={() => {
                setSelectedOrder({...o, _openTab:"chat"});
              }}
              style={{ background:"#fff", borderRadius:14, padding:"12px 14px", marginBottom:10, border:"1.5px solid #e5e7eb", cursor:"pointer", boxShadow:"0 1px 4px rgba(0,0,0,.05)", display:"flex", alignItems:"center", gap:12, position:"relative" }}>
              {/* Unread badge */}
              {unread > 0 && (
                <div style={{ position:"absolute", top:8, right:10, background:"#ef4444", color:"#fff", borderRadius:20, minWidth:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, padding:"0 5px" }}>{unread}</div>
              )}
              <span className="material-icons" style={{ fontSize:28, color:"#4f46e5", flexShrink:0, fontFamily:"Material Icons" }}>chat</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                  <span style={{ fontWeight:800, fontSize:14, color:"#1e1b4b" }}>{o.order_code||o.id}</span>
                  <span style={{ background:statusBg, color:statusTxt, borderRadius:8, padding:"1px 8px", fontSize:11, fontWeight:700 }}>{o.status}</span>
                </div>
                <div style={{ fontSize:13, color:"#374151", fontWeight:600 }}>{o.customer_name||"—"}</div>
                <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{o.device_name||""}{o.assigned_to_name ? ` · KTV: ${o.assigned_to_name}` : ""}</div>
              </div>
              <span className="material-icons" style={{ fontSize:20, color:"#d1d5db", fontFamily:"Material Icons" }}>chevron_right</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── Technician Home ───────────────────────────────────────
function TechnicianHome({ user, orders, setPage }) {
  const myOrders = React.useMemo(() => orders.filter(o => o.assigned_to === user.id || o.assigned_to === user._id), [orders, user]);
  const today = new Date().toLocaleDateString("vi-VN");
  const stats = {
    pending:    myOrders.filter(o => ["Chờ KTV","Chờ KTV Sửa"].includes(o.status)).length,
    inProgress: myOrders.filter(o => o.status === "Đang Sửa").length,
    doneToday:  myOrders.filter(o => (o.status === "Hoàn Thành" || o.status === "Đã Giao") && new Date(o.done_date||o.updated_date||0).toLocaleDateString("vi-VN") === today).length,
    total:      myOrders.filter(o => !["Hoàn Thành","Đã Giao"].includes(o.status)).length,
  };
  const cards = [
    { label:"Chờ nhận",    value:stats.pending,    icon:"inbox",         color:"#dc2626", bg:"#fff1f2", border:"#fca5a5", urgent:stats.pending>0,    page:"tasks" },
    { label:"Đang sửa",    value:stats.inProgress, icon:"build",         color:"#d97706", bg:"#fffbeb", border:"#fcd34d", urgent:stats.inProgress>0, page:"tasks" },
    { label:"Xong hôm nay",value:stats.doneToday,  icon:"check_circle",  color:"#059669", bg:"#f0fdf4", border:"#86efac", urgent:false,              page:"tasks" },
    { label:"Tổng đang xử lý", value:stats.total,  icon:"assignment",    color:"#4f46e5", bg:"#eef2ff", border:"#c7d2fe", urgent:false,              page:"tasks" },
  ];
  const roleLabel = { technician:"Kỹ thuật viên" }[user.role] || user.role;
  return (
    <div style={{ padding:"16px 14px 100px" }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:22, fontWeight:900, color:"#1e1b4b" }}>🔧 Xin chào, {user.name}!</div>
        <div style={{ fontSize:14, color:"#6b7280", marginTop:4 }}>
          {roleLabel} · KPI: <b style={{color:"#4f46e5"}}>{user.kpi ?? 0}</b> · {new Date().toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"})}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
        {cards.map((c,i) => (
          <div key={i} onClick={() => setPage(c.page)}
            style={{ background:c.bg, borderRadius:16, padding:"16px 14px", border:`2px solid ${c.urgent?c.border:"#e5e7eb"}`, cursor:"pointer", boxShadow:c.urgent?"0 4px 12px rgba(0,0,0,.08)":"none" }}>
            <span className="material-icons" style={{ fontSize:28, color:c.color, display:"block", marginBottom:8 }}>{c.icon}</span>
            <div style={{ fontSize:32, fontWeight:900, color:c.urgent?c.color:"#1e1b4b", lineHeight:1 }}>{c.value}</div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:6, fontWeight:600 }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontWeight:800, fontSize:15, color:"#374151", marginBottom:12 }}>Thao tác nhanh</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {[
          { page:"tasks", icon:"check_circle", label:"Danh sách đơn của tôi", sub:"Xem và xử lý các đơn được phân công", color:"#4f46e5", bg:"#eef2ff" },
          { page:"kpi",   icon:"emoji_events", label:"KPI của tôi",           sub:"Xem điểm và lịch sử KPI",              color:"#d97706", bg:"#fffbeb" },
        ].map(item => (
          <div key={item.page} onClick={() => setPage(item.page)}
            style={{ background:item.bg, borderRadius:14, padding:"14px 16px", border:`1.5px solid ${item.bg}`, cursor:"pointer", display:"flex", alignItems:"center", gap:14, boxShadow:"0 2px 8px rgba(0,0,0,.05)" }}>
            <span className="material-icons" style={{ fontSize:26, color:item.color, flexShrink:0 }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight:800, fontSize:14, color:"#1e1b4b" }}>{item.label}</div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{item.sub}</div>
            </div>
            <span className="material-icons" style={{ fontSize:20, color:"#d1d5db", marginLeft:"auto" }}>chevron_right</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Receptionist Home ────────────────────────────────────────
function ReceptionHome({ user, orders, setPage }) {
  const today = new Date().toLocaleDateString("vi-VN");
  const stats = {
    newToday:    orders.filter(o => new Date(o.received_date||o.created_date||0).toLocaleDateString("vi-VN") === today).length,
    waitingAssign: orders.filter(o => !o.assigned_to && !["Hoàn Thành","Đã Giao"].includes(o.status)).length,
    inProgress:  orders.filter(o => o.status === "Đang Sửa").length,
    doneToday:   orders.filter(o => (o.status === "Hoàn Thành"||o.status === "Đã Giao") && new Date(o.done_date||o.updated_date||0).toLocaleDateString("vi-VN") === today).length,
  };
  const waitHandover = orders.filter(o => o.status === "Hoàn Thành").length;
  const waitBaoGia   = orders.filter(o => o.status === "Chờ Báo Giá").length;
  const inPreCheck   = orders.filter(o => ["Chờ Xác Nhận","Chờ Báo Giá"].includes(o.status)).length;
  const cards = [
    { label:"Tiếp nhận hôm nay", value:stats.newToday,       icon:"add_circle",         color:"#4f46e5", bg:"#eef2ff", border:"#c7d2fe", urgent:false,                  page:"new"   },
    { label:"Chờ phân công KTV", value:stats.waitingAssign,  icon:"person_add",          color:"#dc2626", bg:"#fff1f2", border:"#fca5a5", urgent:stats.waitingAssign>0,  page:"tasks" },
    { label:"Chờ bàn giao",      value:waitHandover,          icon:"handshake",           color:"#059669", bg:"#f0fdf4", border:"#86efac", urgent:waitHandover>0,         page:"tasks" },
    { label:"Chờ báo giá KH",    value:waitBaoGia,            icon:"request_quote",       color:"#d97706", bg:"#fffbeb", border:"#fcd34d", urgent:waitBaoGia>0,            page:"tasks" },
  ];
  return (
    <div style={{ padding:"16px 14px 100px" }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:22, fontWeight:900, color:"#1e1b4b" }}>🎧 Xin chào, {user.name}!</div>
        <div style={{ fontSize:14, color:"#6b7280", marginTop:4 }}>
          Tiếp tân · {new Date().toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"})}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
        {cards.map((c,i) => (
          <div key={i} onClick={() => setPage(c.page)}
            style={{ background:c.bg, borderRadius:16, padding:"16px 14px", border:`2px solid ${c.urgent?c.border:"#e5e7eb"}`, cursor:"pointer", boxShadow:c.urgent?"0 4px 12px rgba(0,0,0,.08)":"none" }}>
            <span className="material-icons" style={{ fontSize:28, color:c.color, display:"block", marginBottom:8 }}>{c.icon}</span>
            <div style={{ fontSize:32, fontWeight:900, color:c.urgent?c.color:"#1e1b4b", lineHeight:1 }}>{c.value}</div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:6, fontWeight:600 }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontWeight:800, fontSize:15, color:"#374151", marginBottom:12 }}>Thao tác nhanh</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {[
          { page:"new",       icon:"add_circle",  label:"Tạo đơn mới",        sub:"Tiếp nhận máy từ khách hàng",       color:"#4f46e5", bg:"#eef2ff" },
          { page:"tasks",     icon:"list_alt",    label:"Danh sách đơn",      sub:"Tra cứu và theo dõi tiến độ",       color:"#0369a1", bg:"#e0f2fe" },
          { page:"tasks",     icon:"handshake",   label:"Chờ bàn giao",       sub:"Đơn Hoàn Thành chờ trả máy",        color:"#059669", bg:"#f0fdf4",
            highlight: orders.filter(o => o.status === "Hoàn Thành").length },
          { page:"customers", icon:"group",       label:"Khách hàng",         sub:"Tra cứu lịch sử sửa chữa",          color:"#7c3aed", bg:"#f5f3ff" },
        ].map(item => (
          <div key={item.page} onClick={() => setPage(item.page)}
            style={{ background:item.bg, borderRadius:14, padding:"14px 16px", border:`1.5px solid ${item.bg}`, cursor:"pointer", display:"flex", alignItems:"center", gap:14, boxShadow:"0 2px 8px rgba(0,0,0,.05)" }}>
            <span className="material-icons" style={{ fontSize:26, color:item.color, flexShrink:0 }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight:800, fontSize:14, color:"#1e1b4b" }}>{item.label}</div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{item.sub}</div>
            </div>
            <span className="material-icons" style={{ fontSize:20, color:"#d1d5db", marginLeft:"auto" }}>chevron_right</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WarehouseHome({ user, setPage }) {
  const [stats, setStats] = React.useState({ pendingExport:0, waitingKtv:0, overdueBorrow:0, lowStock:0, pendingImport:0 });
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    loadStats();
    // Polling 10s để cập nhật stats tự động
    const timer = setInterval(() => loadStats(true), 10000);
    return () => clearInterval(timer);
  }, []);

  async function loadStats(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      // Dùng list + lọc client-side để tránh lỗi filter trên PocketBase
      const [allExports, parts, imports, allLedgers] = await Promise.all([
        StockExportRequest.list({ limit:500 }).catch(() => []),
        SparePart.list({ limit:500 }).catch(() => []),
        StockImport.list({ limit:200, sort:"-id" }).catch(() => []),
        StockLedger.list({ limit:2000 }).catch(() => []),
      ]);
      const pendingExports = allExports.filter(r => r.status === "pending");
      const overdue = allExports.filter(r =>
        r.export_type === "borrow" && r.status === "ktv_confirmed" &&
        r.return_due_date && new Date(r.return_due_date) < Date.now()
      );
      // Tính tồn kho thực từ stock_ledgers
      const partTotals = {};
      (allLedgers||[]).forEach(l => {
        const k = l.part_id || l.part_name;
        partTotals[k] = (partTotals[k]||0) + (l.qty_on_hand||0);
      });
      const lowStockCount = Object.values(partTotals).filter(qty => qty <= 3).length;
      const draftImports = imports.filter(r => r.status === "draft");
      const waitingKtv = allExports.filter(r => r.status === "warehouse_confirmed");
      setStats({
        pendingExport: pendingExports.length,
        waitingKtv: waitingKtv.length,
        overdueBorrow: overdue.length,
        lowStock: lowStockCount,
        pendingImport: draftImports.length
      });
    } catch(e) { console.error("WarehouseHome loadStats error:", e); }
    setLoading(false);
    setRefreshing(false);
  }

  const cards = [
    { key:"wh_export",  icon:"outbox",         label:"Phiếu chờ xuất",  value:stats.pendingExport,  color:"#d97706", bg:"#fffbeb", border:"#fcd34d", urgent:stats.pendingExport>0 },
    { key:"wh_export",  icon:"pending_actions", label:"Chờ KTV nhận",    value:stats.waitingKtv,     color:"#0891b2", bg:"#ecfeff", border:"#67e8f9", urgent:stats.waitingKtv>0 },
    { key:"wh_export",  icon:"assignment_late", label:"Mượn quá hạn",    value:stats.overdueBorrow,  color:"#dc2626", bg:"#fff1f2", border:"#fca5a5", urgent:stats.overdueBorrow>0 },
    { key:"wh_import",  icon:"move_to_inbox",   label:"Phiếu nhập draft",value:stats.pendingImport,  color:"#7c3aed", bg:"#f5f3ff", border:"#c4b5fd", urgent:false },
  ];

  return (
    <div style={{ padding:"16px 14px 100px" }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:22, fontWeight:900, color:"#1e1b4b" }}>📦 Xin chào, {user.name}!</div>
        <div style={{ fontSize:14, color:"#6b7280", marginTop:4, display:"flex", alignItems:"center", gap:6 }}>
          Nhân viên kho · {new Date().toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"})}
          {refreshing && <span style={{fontSize:11,color:"#4f46e5",fontWeight:700}}>🔄 Đang cập nhật...</span>}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {cards.map((c,i) => (
            <div key={i} onClick={() => setPage(c.key)}
              style={{ background:c.bg, borderRadius:16, padding:"16px 14px", border:`2px solid ${c.urgent?c.border:"#e5e7eb"}`, cursor:"pointer", boxShadow:c.urgent?"0 4px 12px rgba(0,0,0,.08)":"none", gridColumn: (cards.length % 2 !== 0 && i === cards.length-1) ? "1 / -1" : undefined }}>
              <span className="material-icons" style={{ fontSize:28, color:c.color, display:"block", marginBottom:8 }}>{c.icon}</span>
              <div style={{ fontSize:32, fontWeight:900, color:c.urgent?c.color:"#1e1b4b", lineHeight:1 }}>{c.value}</div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:6, fontWeight:600 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontWeight:800, fontSize:15, color:"#374151", marginBottom:12 }}>Thao tác nhanh</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {[
          { page:"wh_export", icon:"outbox",         label:"Xử lý phiếu xuất kho", sub:"Xác nhận xuất cho KTV",        color:"#d97706", bg:"#fffbeb" },
          { page:"wh_import", icon:"move_to_inbox",  label:"Tạo phiếu nhập hàng",  sub:"Máy móc & linh kiện",           color:"#7c3aed", bg:"#f5f3ff" },
        ].map(item => (
          <div key={item.page+item.label} onClick={() => setPage(item.page)}
            style={{ background:item.bg, borderRadius:14, padding:"14px 16px", border:`1.5px solid ${item.highlight > 0 ? item.color : item.bg}`, cursor:"pointer", display:"flex", alignItems:"center", gap:14, boxShadow:"0 2px 8px rgba(0,0,0,.05)" }}>
            <span className="material-icons" style={{ fontSize:26, color:item.color, flexShrink:0 }}>{item.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:14, color:"#1e1b4b" }}>{item.label}</div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{item.sub}</div>
            </div>
            {item.highlight > 0 && <span style={{ background:item.color, color:"#fff", borderRadius:20, minWidth:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, padding:"0 6px" }}>{item.highlight}</span>}
            <span className="material-icons" style={{ fontSize:20, color:"#d1d5db" }}>chevron_right</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Warehouse: Phiếu xuất kho ───────────────────────────
function WarehouseExport({ user }) {
  const [requests, setRequests]   = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [filter, setFilter]       = React.useState("pending");
  const [viewReq, setViewReq]     = React.useState(null);
  const [confirmNote, setConfirmNote] = React.useState("");
  const [confirmMedia, setConfirmMedia] = React.useState([]);
  const [confirming, setConfirming] = React.useState(false);
  const [toast, setToast]         = React.useState("");
  const fileRef = React.useRef(null);

  React.useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      // Luôn lấy all rồi filter client-side để tránh lỗi query PocketBase
      const all = await StockExportRequest.list({ sort:"due_datetime", limit:200 });
      const data = filter === "all" ? all : all.filter(r => r.status === filter);
      setRequests(data.sort((a,b) => new Date(a.due_datetime||0)-new Date(b.due_datetime||0)));
    } catch(e){ console.error(e); }
    setLoading(false);
  }

  async function openDetail(imp) {
    setViewDetail(imp);
    setLoadingDetail(true);
    try {
      const its = await StockImportItem.list({ filter:`import_id="${imp.id}"`, sort:"-id", limit:200 });
      setDetailItems(its||[]);
    } catch { setDetailItems([]); }
    setLoadingDetail(false);
  }

  function showToast(msg){ setToast(msg); setTimeout(()=>setToast(""),3500); }

  async function doConfirmExport() {
    if (!viewReq) return;
    setConfirming(true);
    try {
      const mediaStr = confirmMedia.map(m=>m.url).join(",");
      await StockExportRequest.update(viewReq.id, {
        status:"warehouse_confirmed",
        warehouse_confirmed_by: user.id,
        warehouse_confirmed_by_name: user.name,
        warehouse_confirmed_at: new Date().toISOString(),
        warehouse_note: confirmNote,
        warehouse_media: mediaStr,
      });
      await Notification.create({
        user_id: viewReq.requested_by, user_name: viewReq.requested_by_name,
        title:"📦 Kho đã xuất — Xác nhận nhận!",
        message:`Phiếu ${viewReq.request_code}`,
        order_id: viewReq.order_id, order_code: viewReq.order_code,
        type:"export_ready", is_read:false,
      });
      setRequests(p=>p.filter(r=>r.id!==viewReq.id));
      setViewReq(null); setConfirmNote(""); setConfirmMedia([]);
      showToast("✅ Đã xác nhận xuất kho!");
    } catch(e){ showToast("Lỗi: "+e.message); }
    setConfirming(false);
  }

  async function handleMediaUpload(e) {
    for (const file of Array.from(e.target.files)) {
      const reader = new FileReader();
      reader.onload = ev => setConfirmMedia(prev=>[...prev,{name:file.name,url:ev.target.result,type:file.type}]);
      reader.readAsDataURL(file);
    }
  }

  const ST_CFG = {
    pending:             {label:"⏳ Chờ xuất",    color:"#d97706",bg:"#fffbeb"},
    warehouse_confirmed: {label:"📦 Đã xuất",     color:"#2563eb",bg:"#eff6ff"},
    ktv_confirmed:       {label:"✅ KTV nhận",    color:"#059669",bg:"#f0fdf4"},
    returned:            {label:"↩ Đã trả",       color:"#6b7280",bg:"#f9fafb"},
    expired:             {label:"⌛ Hết hạn",     color:"#dc2626",bg:"#fff1f2"},
    cancelled:           {label:"✖ Hủy",          color:"#9ca3af",bg:"#f3f4f6"},
  };

  return (
    <div style={{ paddingBottom:100 }}>
      <div style={{ padding:"14px 14px 8px", position:"sticky", top:56, background:"#fff", zIndex:10, borderBottom:"1.5px solid #e5e7eb" }}>
        <div style={{ fontWeight:900, fontSize:17, color:"#1e1b4b", marginBottom:10 }}>📋 Phiếu xuất kho</div>
        <div style={{ display:"flex", gap:6, overflowX:"auto" }}>
          {[
            {k:"pending",label:"Chờ xuất"},
            {k:"warehouse_confirmed",label:"Chờ KTV nhận"},
            {k:"ktv_confirmed",label:"Đang mượn"},
            {k:"all",label:"Tất cả"},
          ].map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)}
              style={{ padding:"7px 14px", borderRadius:20, border:"none", background:filter===f.k?"#1e1b4b":"#f3f4f6", color:filter===f.k?"#fff":"#374151", fontWeight:700, fontSize:12, cursor:"pointer", flexShrink:0 }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"10px 14px" }}>
        {loading ? (
          <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>⏳ Đang tải...</div>
        ) : requests.length===0 ? (
          <div style={{textAlign:"center",padding:"40px 20px",color:"#9ca3af"}}>
            <span className="material-icons" style={{fontSize:48,display:"block",marginBottom:8}}>check_circle</span>
            Không có phiếu nào
          </div>
        ) : requests.map(req => {
          const st = ST_CFG[req.status]||ST_CFG.pending;
          const mins = Math.floor((new Date(req.due_datetime||0)-Date.now())/60000);
          const urgent = mins>0 && mins<=15 && req.status==="pending";
          const overdue = mins<=0 && req.status==="pending";
          return (
            <div key={req.id} onClick={()=>setViewReq(req)}
              style={{ background:overdue?"#fff1f2":urgent?"#fff7ed":"#f9fafb", borderRadius:14, padding:"13px 14px", marginBottom:10, border:`1.5px solid ${overdue?"#fca5a5":urgent?"#fb923c":"#e5e7eb"}`, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:14 }}>{req.request_code}</div>
                  <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>
                    {req.export_type==="borrow"?"🔄 Mượn":"🔧 Xuất sửa"} · {req.order_code} · {(Array.isArray(req.items)?req.items:req.items?JSON.parse(req.items):[]).length} LK
                  </div>
                  <div style={{ fontSize:12, color:"#374151", fontWeight:600 }}>👤 KTV: {req.requested_by_name}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0, marginLeft:8 }}>
                  <div style={{ background:st.bg, color:st.color, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{st.label}</div>
                  {req.status==="pending" && (
                    <div style={{ fontSize:11, color:overdue?"#dc2626":urgent?"#d97706":"#6b7280", fontWeight:700, marginTop:4 }}>
                      {overdue?"⌛ Hết hạn":urgent?`⚠️ còn ${mins}p`:`⏰ còn ${mins}p`}
                    </div>
                  )}
                  {req.export_type==="borrow" && req.return_due_date && req.status==="ktv_confirmed" && (
                    <div style={{ fontSize:11, color:"#7c3aed", fontWeight:700, marginTop:4 }}>
                      Trả: {new Date(req.return_due_date).toLocaleDateString("vi-VN")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail bottom sheet */}
      {viewReq && (
        <div style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"flex-end" }}
          onClick={e=>{if(e.target===e.currentTarget){setViewReq(null);setConfirmNote("");setConfirmMedia([]);}}}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", width:"100%", maxHeight:"70vh", display:"flex", flexDirection:"column" }}>
            <div style={{ background:"linear-gradient(135deg,#1e1b4b,#4f46e5)", padding:"16px 18px", borderRadius:"24px 24px 0 0", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ color:"#fff", fontWeight:900, fontSize:16 }}>📋 {viewReq.request_code}</div>
                <div style={{ color:"#a5b4fc", fontSize:12, marginTop:2 }}>{viewReq.export_type==="borrow"?"🔄 Mượn tạm":"🔧 Xuất sửa"} · KTV: {viewReq.requested_by_name}</div>
              </div>
              <button onClick={()=>{setViewReq(null);setConfirmNote("");setConfirmMedia([]);}}
                style={{ background:"rgba(255,255,255,.2)", border:"1.5px solid rgba(255,255,255,.35)", color:"#fff", width:36, height:36, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span className="material-icons" style={{fontSize:20}}>close</span>
              </button>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"14px 16px 24px" }}>
              <div style={{ background:"#f9fafb", borderRadius:12, padding:12, marginBottom:12, fontSize:13 }}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#6b7280"}}>Đơn sửa</span><span style={{fontWeight:700}}>{viewReq.order_code}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#6b7280"}}>Hạn xuất</span><span style={{fontWeight:700,color:(new Date(viewReq.due_datetime)<Date.now())?"#dc2626":"#111"}}>{new Date(viewReq.due_datetime).toLocaleString("vi-VN")}</span></div>
                {viewReq.export_type==="borrow" && <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#6b7280"}}>Hạn trả</span><span style={{fontWeight:700,color:"#7c3aed"}}>{viewReq.return_due_date?new Date(viewReq.return_due_date).toLocaleDateString("vi-VN"):"—"}</span></div>}
                <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#6b7280"}}>Tổng giá trị</span><span style={{fontWeight:900,color:"#4f46e5"}}>{(viewReq.total_value||0).toLocaleString("vi-VN")}đ</span></div>
              </div>

              <div style={{ fontWeight:800, fontSize:14, color:"#1e1b4b", marginBottom:8 }}>Danh sách linh kiện</div>
              {(Array.isArray(viewReq.items)?viewReq.items:viewReq.items?JSON.parse(viewReq.items):[]).map((item,i) => (
                <div key={i} style={{ background:"#f3f4f6", borderRadius:10, padding:"8px 12px", marginBottom:6, display:"flex", justifyContent:"space-between", fontSize:13 }}>
                  <div><div style={{fontWeight:700}}>{item.part_name}</div>{item.sku&&<div style={{color:"#6b7280",fontSize:12}}>SKU: {item.sku}</div>}</div>
                  <div style={{textAlign:"right"}}><div style={{fontWeight:800,color:"#4f46e5"}}>{(item.total_price||0).toLocaleString("vi-VN")}đ</div><div style={{color:"#6b7280",fontSize:12}}>×{item.qty}</div></div>
                </div>
              ))}

              {viewReq.status==="pending" && (
                <div style={{ marginTop:16 }}>
                  <div style={{ fontWeight:800, fontSize:14, color:"#065f46", marginBottom:10 }}>📦 Xác nhận xuất kho</div>
                  <textarea value={confirmNote} onChange={e=>setConfirmNote(e.target.value)}
                    placeholder="Ghi chú (tuỳ chọn)..."
                    style={{ width:"100%", minHeight:56, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"8px 12px", fontSize:13, outline:"none", resize:"vertical", boxSizing:"border-box", marginBottom:10 }}/>
                  <div style={{ marginBottom:12 }}>
                    <button onClick={()=>fileRef.current?.click()}
                      style={{ height:38, padding:"0 14px", borderRadius:10, border:"1.5px solid #6ee7b7", background:"#fff", color:"#059669", fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                      <span className="material-icons" style={{fontSize:16}}>add_a_photo</span>Chụp ảnh / Quay video
                    </button>
                    <input ref={fileRef} type="file" accept="image/*,video/*" multiple capture="environment" style={{display:"none"}} onChange={handleMediaUpload}/>
                    {confirmMedia.length>0 && (
                      <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                        {confirmMedia.map((m,i)=>(
                          <div key={i} style={{position:"relative"}}>
                            {m.type?.startsWith("video")?<video src={m.url} style={{width:60,height:60,borderRadius:8,objectFit:"cover"}}/>:<img src={m.url} style={{width:60,height:60,borderRadius:8,objectFit:"cover"}} alt=""/>}
                            <button onClick={()=>setConfirmMedia(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#ef4444",border:"none",color:"#fff",fontSize:10,cursor:"pointer"}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={doConfirmExport} disabled={confirming}
                    style={{ width:"100%", height:50, borderRadius:14, border:"none", background:"linear-gradient(135deg,#059669,#047857)", color:"#fff", fontWeight:900, fontSize:16, cursor:confirming?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                    <span className="material-icons" style={{fontSize:22}}>inventory</span>
                    {confirming?"Đang xử lý...":"✅ Xác nhận đã xuất kho"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,.85)",color:"#fff",padding:"10px 20px",borderRadius:16,fontSize:14,fontWeight:700,zIndex:9999}}>{toast}</div>}
    </div>
  );
}

// ─── PartNameInput — Autocomplete tên hàng ──────────────────────────────────
function PartNameInput({ value, onChange, parts=[], placeholder="Tên hàng...", style={} }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState(value||"");

  React.useEffect(() => { setQ(value||""); }, [value]);

  const filtered = (parts||[]).filter(p =>
    !q || p.name?.toLowerCase().includes(q.toLowerCase()) || (p.sku||"").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 15);

  return (
    <div style={{ position:"relative" }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value, null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder}
        autoComplete="off"
        style={{ width:"100%", height:38, borderRadius:8, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:13, outline:"none", boxSizing:"border-box", ...style }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position:"absolute", top:"100%", left:0, right:0, zIndex:10000,
          background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10,
          boxShadow:"0 8px 24px rgba(0,0,0,.12)", maxHeight:220, overflowY:"auto", marginTop:2,
        }}>
          {filtered.map((p,i) => (
            <div key={i}
              onMouseDown={() => { setQ(p.name); onChange(p.name, p); setOpen(false); }}
              style={{ padding:"9px 14px", cursor:"pointer", borderBottom:"1px solid #f3f4f6" }}
              onMouseEnter={e=>e.currentTarget.style.background="#f5f3ff"}
              onMouseLeave={e=>e.currentTarget.style.background="#fff"}
            >
              <div style={{ fontWeight:600, fontSize:13 }}>{p.name}</div>
              <div style={{ fontSize:11, color:"#9ca3af" }}>
                {p.sku ? `SKU: ${p.sku}` : ""}
                {p.cost_price ? `  •  ${(p.cost_price||0).toLocaleString("vi")}đ` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Warehouse: Nhập hàng ────────────────────────────────
function WarehouseImport({ user }) {
  const [imports, setImports]         = React.useState([]);
  const [loading, setLoading]         = React.useState(true);
  const [showForm, setShowForm]       = React.useState(false);
  const [toast, setToast]             = React.useState("");
  const [scanningFor, setScanningFor] = React.useState(null); // item id đang quét QR
  const [imeiScanFor, setImeiScanFor] = React.useState(null);  // item id đang quét IMEI (dùng IMEIScanModal)
  const scanVideoRef = React.useRef(null);
  const scanStreamRef = React.useRef(null);
  const scanIntervalRef = React.useRef(null);
  const scanFieldRef = React.useRef("serial_imei");

  // Form state
  const [importType, setImportType]       = React.useState("spare_part");
  const [supplier, setSupplier]           = React.useState("");
  const [supplierPhone, setSupplierPhone] = React.useState("");
  const [impPaidAmt,  setImpPaidAmt]      = React.useState(0);
  const [impPayMethod,setImpPayMethod]    = React.useState("cash");
  const [note, setNote]                   = React.useState("");
  const [items, setItems]                 = React.useState([]);
  const [saving, setSaving]               = React.useState(false);
  const [allParts, setAllParts]           = React.useState([]);
  const [confirmDelete, setConfirmDelete] = React.useState(null); // imp object cần xóa
  const [viewDetail, setViewDetail]       = React.useState(null); // imp object đang xem chi tiết
  const [detailItems, setDetailItems]     = React.useState([]);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [supplierSugg, setSupplierSugg]   = React.useState([]);
  const [showSupplierDrop, setShowSupplierDrop] = React.useState(false);
  const supplierInputRef = React.useRef(null);
  const [pendingPOs, setPendingPOs]       = React.useState([]);
  const [selectedPO, setSelectedPO]       = React.useState(null);
  const [showPOPicker, setShowPOPicker]   = React.useState(false);
  const [poRemaining, setPoRemaining]     = React.useState({}); // { po_id: số items chưa nhận đủ }

  React.useEffect(() => { loadImports(); }, []);

  // Load catalog khi mở form nhập kho
  React.useEffect(() => {
    if (showForm) {
      SparePart.list({ limit:1000 }).then(r=>setAllParts(
        (r||[]).map(p=>({ name:p.name, sku:p.sku||"", cost_price:p.price||0, id:p.id }))
      )).catch(()=>{});
      // Load PO đang chờ nhận hàng
      PurchaseOrder.list({ filter:'(status = "confirmed" || status = "partial")', sort:"-id", limit:50 })
        .then(async r => {
          const pos = (r||[]).filter(po => po.status === "confirmed" || po.status === "partial");
          setPendingPOs(pos);
          // Tính số items còn chờ nhận cho từng PO
          const remainMap = {};
          for (const po of pos) {
            try {
              const its = await PurchaseOrderItem.list({ filter:`po_id="${po.id}"`, sort:"-id", limit:200 });
              const pendingCount = (its||[]).filter(it => {
                const ordered = Number(it.qty_ordered)||1;
                const received = Number(it.qty_received)||0;
                return received < ordered;
              }).length;
              remainMap[po.id] = pendingCount;
            } catch {}
          }
          setPoRemaining(remainMap);
        })
        .catch(()=>{});
    } else {
      setSelectedPO(null);
    }
  }, [showForm]);

  // Autocomplete NCC
  React.useEffect(() => {
    const q = supplier.trim();
    if (q.length < 1) { setSupplierSugg([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await Supplier.list({ limit:200 });
        setSupplierSugg((res||[]).filter(s =>
          s.name?.toLowerCase().includes(q.toLowerCase()) || s.phone?.includes(q)
        ).slice(0,6));
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [supplier]);

  // Chọn PO → điền form (chỉ load hàng chưa nhận đủ)
  async function applyPO(po) {
    setSelectedPO(po);
    setSupplier(po.supplier_name||"");
    setSupplierPhone(po.supplier_phone||"");
    setShowPOPicker(false);
    try {
      const its = await PurchaseOrderItem.list({ filter:`po_id="${po.id}"`, sort:"-id", limit:200 });
      // Lọc chỉ lấy hàng chưa nhận đủ: qty_received < qty_ordered
      const pending = (its||[]).filter(it => {
        const ordered = Number(it.qty_ordered)||1;
        const received = Number(it.qty_received)||0;
        return received < ordered;
      }).map(it => {
        const ordered = Number(it.qty_ordered)||1;
        const received = Number(it.qty_received)||0;
        const remaining = ordered - received;
        return {
          id: Date.now()+"_"+it.id,
          po_item_id: it.id,
          name: it.part_name||"", sku: it.sku||"",
          serial_imei:"", qr_code:"",
          qty: remaining,
          unit_price: it.unit_price||0,
          total_price: remaining * (it.unit_price||0),
          condition:"new", photos:[], videos:[], note:""
        };
      });
      if (pending.length === 0) {
        showToast("✅ PO này đã nhập đủ hàng!");
        setSelectedPO(null);
        return;
      }
      setItems(pending);
      showToast(`Đã load ${pending.length} mặt hàng chưa nhận`);
    } catch { showToast("Lỗi tải danh sách hàng PO"); }
  }

  // Dọn stream khi unmount
  React.useEffect(() => () => stopScan(), []);

  async function loadImports() {
    setLoading(true);
    try {
      const data = await StockImport.list({ sort:"-id", limit:50 });
      setImports(data);
    } catch(e){ console.error(e); }
    setLoading(false);
  }

  async function handleDeleteImport(imp) {
    try {
      // Xóa items trước
      const its = await StockImportItem.list({ filter:`import_id="${imp.id}"`, limit:200 });
      for (const it of (its||[])) await StockImportItem.delete(it.id).catch(()=>{});
      await StockImport.delete(imp.id);
      setConfirmDelete(null);
      showToast("✅ Đã xóa phiếu nhập "+imp.import_code);
      loadImports();
    } catch(e) { showToast("Lỗi xóa: "+e.message); }
  }

  function showToast(msg){ setToast(msg); setTimeout(()=>setToast(""),3500); }

  function addItem() {
    setItems(prev=>[...prev, {
      id:Date.now(), name:"", sku:"", serial_imei:"", qr_code:"",
      qty:1, unit_price:0, condition:"new",
      photos:[], videos:[], note:"",
    }]);
  }

  function updateItem(id, field, val, part=null) {
    setItems(prev=>prev.map(it=>{
      if (it.id!==id) return it;
      const updated = {...it, [field]:val};
      if (part) { updated.sku = part.sku||it.sku; }
      if (field==="qty"||field==="unit_price")
        updated.total_price = updated.qty * updated.unit_price;
      return updated;
    }));
  }

  function removeItem(id) { setItems(prev=>prev.filter(it=>it.id!==id)); }

  // ── QR Scanner ──────────────────────────────── 
  // field: "serial_imei" | "qr_code" (mặc định serial_imei)
  async function startScan(itemId, field="serial_imei") {
    setScanningFor(itemId);
    // Lưu field đang scan vào ref để dùng trong interval
    scanFieldRef.current = field;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" } });
      scanStreamRef.current = stream;
      setTimeout(() => {
        if (scanVideoRef.current) {
          scanVideoRef.current.srcObject = stream;
          scanVideoRef.current.play();
        }
      }, 100);
      // Poll mỗi 500ms dùng BarcodeDetector nếu có
      if ("BarcodeDetector" in window) {
        const bd = new BarcodeDetector({ formats:["qr_code","code_128","ean_13","ean_8","code_39","itf","pdf417","aztec","data_matrix"] });
        scanIntervalRef.current = setInterval(async () => {
          if (!scanVideoRef.current || scanVideoRef.current.readyState < 2) return;
          try {
            const codes = await bd.detect(scanVideoRef.current);
            if (codes.length > 0) {
              const val = codes[0].rawValue;
              const f = scanFieldRef.current || "serial_imei";
              stopScan();
              updateItem(itemId, f, val);
              showToast(`✅ Quét ${f==="qr_code"?"QR Code":"IMEI/Serial"}: ${val}`);
            }
          } catch {}
        }, 500);
      }
    } catch(e) {
      showToast("Không mở được camera: " + e.message);
      setScanningFor(null);
    }
  }

  function stopScan() {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current=null; }
    if (scanStreamRef.current) { scanStreamRef.current.getTracks().forEach(t=>t.stop()); scanStreamRef.current=null; }
    setScanningFor(null);
  }

  // ── Media upload cho từng item ────────────────
  function handleItemMedia(itemId, files) {
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = ev => {
        const field = file.type.startsWith("video") ? "videos" : "photos";
        setItems(prev=>prev.map(it=>
          it.id===itemId ? {...it, [field]:[...it[field], { name:file.name, url:ev.target.result, type:file.type }]} : it
        ));
      };
      reader.readAsDataURL(file);
    }
  }

  function removeMedia(itemId, field, idx) {
    setItems(prev=>prev.map(it=>
      it.id===itemId ? {...it, [field]:it[field].filter((_,i)=>i!==idx)} : it
    ));
  }

  // ── Save ──────────────────────────────────────
  async function handleSave() {
    if (!supplier.trim()){ showToast("Nhập tên nhà cung cấp!"); return; }
    if (items.length===0){ showToast("Thêm ít nhất 1 mặt hàng!"); return; }
    if (items.some(it=>!it.name.trim())){ showToast("Mặt hàng chưa nhập tên!"); return; }
    const preTotal = items.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.unit_price)||0),0);
    if (impPaidAmt > preTotal) { showToast("Tiền thanh toán không được vượt quá tổng giá trị!"); return; }
    setSaving(true);
    try {
      const code = "PN"+new Date().getFullYear().toString().slice(2)
        +String(new Date().getMonth()+1).padStart(2,"0")
        +String(new Date().getDate()).padStart(2,"0")
        +"-"+Math.floor(Math.random()*9000+1000);
      const totalValue = items.reduce((s,i)=>s+(i.qty*(i.unit_price||0)),0);
      const imp = await StockImport.create({
        import_code:code, import_type:importType,
        supplier_name:supplier, supplier_phone:supplierPhone,
        total_items:items.length, total_value:totalValue,
        status:"confirmed", note, created_by:user.id, created_by_name:user.name,
        confirmed_by: user.id, confirmed_by_name: user.name||"",
        confirmed_at: new Date().toISOString().slice(0,10),
      });
      for (const it of items) {
        await StockImportItem.create({
          import_id:imp.id, import_code:code, item_type:importType,
          name:it.name, sku:it.sku||"", serial_imei:it.serial_imei||"", qr_code:it.qr_code||"",
          qty:it.qty, unit_price:it.unit_price||0, total_price:it.qty*(it.unit_price||0),
          condition:it.condition,
          photos:JSON.stringify((it.photos||[]).map(p=>p.url)),
          videos:JSON.stringify((it.videos||[]).map(v=>v.url)),
          note:it.note||"",
          po_item_id: it.po_item_id || "",
        });
        // Cập nhật tồn kho SparePart
        try {
          if (importType==="device" && it.serial_imei) {
            // Máy móc có IMEI → tạo record riêng (1 IMEI = 1 record)
            const existing = await SparePart.filter({ sku: it.serial_imei });
            if (!existing || existing.length===0) {
              await SparePart.create({
                name: it.name, sku: it.serial_imei,
                category:"device_stock", unit:"cái",
                price: it.unit_price||0, stock_qty:it.qty,
                is_active:true,
                note:"📦 Hàng trong kho - Chưa bán | Nhập: "+code,
              });
            }
          } else if (importType==="spare_part") {
            // Linh kiện → tìm theo tên + sku, nếu có thì cộng stock_qty, không thì tạo mới
            const matchSku = it.sku ? await SparePart.filter({ sku: it.sku }) : [];
            const matchName = await SparePart.filter({ name: it.name });
            const existing = matchSku.length > 0 ? matchSku[0] : (matchName.length > 0 ? matchName[0] : null);
            if (existing) {
              await SparePart.update(existing.id, {
                stock_qty: (Number(existing.stock_qty)||0) + Number(it.qty||0),
                price: it.unit_price || existing.price,
              });
            } else {
              await SparePart.create({
                name: it.name, sku: it.sku||"",
                category:"spare_part", unit:"cái",
                price: it.unit_price||0, stock_qty:it.qty,
                is_active:true,
                note:"📦 Nhập: "+code,
              });
            }
          }
        } catch(e) { console.error("SparePart update error:", e); }
      }
      // Cập nhật qty_received trong PO Item nếu nhập theo PO
      if (selectedPO) {
        try {
          const poItems = await PurchaseOrderItem.list({ filter:`po_id="${selectedPO.id}"`, sort:"-id", limit:200 });
          for (const it of items) {
            if (it.po_item_id) {
              const poi = poItems.find(p => p.id === it.po_item_id);
              if (poi) {
                const newReceived = (Number(poi.qty_received)||0) + (Number(it.qty)||0);
                await PurchaseOrderItem.update(poi.id, { qty_received: newReceived });
              }
            }
          }
          const refreshed = await PurchaseOrderItem.list({ filter:`po_id="${selectedPO.id}"`, sort:"-id", limit:200 });
          const allDone = (refreshed||[]).every(pi => (Number(pi.qty_received)||0) >= (Number(pi.qty_ordered)||1));
          const anyReceived = (refreshed||[]).some(pi => Number(pi.qty_received||0) > 0);
          const newPOStatus = allDone ? "completed" : anyReceived ? "partial" : "confirmed";
          await PurchaseOrder.update(selectedPO.id, { status: newPOStatus });
        } catch(e) { console.error("PO update error:", e); }
      }
      // KT-2: ghi debt_voucher + cash_journal nếu có nợ NCC
      const __totalVal = items.reduce((s,i)=>s+(i.qty*(i.unit_price||0)),0);
      try {
        if (impPaidAmt > 0 && impPayMethod === "cash") {
          await CashJournal.create({
            journal_date:    getLocalDate(),
            entry_type:      "payment", amount: impPaidAmt,
            ref_type:        "stock_import", ref_id: imp.id, ref_code: code,
            description:     "Nhập hàng: " + (supplier || "NCC"),
            payment_method:  "cash",
            created_by_id:   user.id, created_by_name: user.name || "",
          });
        }
        const __remaining = Math.max(0, __totalVal - impPaidAmt);
        if (__remaining > 0) {
          await DebtVoucher.create({
            voucher_code:  "PP-" + String(Date.now()).slice(-6),
            voucher_type:  "payable", party_type: "supplier",
            party_name:    supplier || "Nhà cung cấp",
            origin_type:   "stock_import", origin_id: imp.id, origin_code: code,
            total_amount:  __totalVal, paid_amount: impPaidAmt,
            remaining:     __remaining,
            status:        impPaidAmt > 0 ? "partial" : "open",
            created_by_id: user.id, created_by_name: user.name || "",
          });
        }
      } catch(e) { console.error("KT-2 debt/cash error:", e); }
      showToast("✅ Đã tạo phiếu nhập "+code);
      setShowForm(false); setItems([]);
      setSupplier(""); setSupplierPhone(""); setNote("");
      setImportType("spare_part"); setImpPaidAmt(0); setImpPayMethod("cash");
      setSelectedPO(null); setShowPOPicker(false);
      loadImports();
    } catch(e){ showToast("Lỗi: "+e.message); }
    setSaving(false);
  }

  const STATUS_COLOR = {
    draft:     {bg:"#fef3c7",color:"#92400e",  label:"📝 Nháp"},
    confirmed: {bg:"#dcfce7",color:"#15803d",  label:"✅ Đã nhập"},
  };

  return (
    <div style={{ paddingBottom:100 }}>
      {/* Header */}
      <div style={{ padding:"14px 14px 10px", borderBottom:"1.5px solid #e5e7eb", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontWeight:900, fontSize:17, color:"#1e1b4b" }}>📥 Nhập hàng</div>
        <button onClick={()=>setShowForm(true)}
          style={{ height:38, padding:"0 16px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:12, fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          <span className="material-icons" style={{fontSize:18}}>add</span>Tạo phiếu
        </button>
      </div>

      {/* List */}
      <div style={{ padding:"10px 14px" }}>
        {loading ? <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>⏳ Đang tải...</div>
        : imports.length===0 ? (
          <div style={{textAlign:"center",padding:"40px 20px",color:"#9ca3af"}}>
            <span className="material-icons" style={{fontSize:48,display:"block",marginBottom:8}}>move_to_inbox</span>
            Chưa có phiếu nhập nào
          </div>
        ) : imports.map(imp => {
          const sc = STATUS_COLOR[imp.status]||STATUS_COLOR.draft;
          return (
            <div key={imp.id}
              onClick={()=>openDetail(imp)}
              style={{ background:"#f9fafb", borderRadius:14, padding:"12px 14px", marginBottom:10, border:"1.5px solid #e5e7eb", cursor:"pointer", transition:"box-shadow .15s" }}
              onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(79,70,229,.12)"}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:14 }}>{imp.import_code}</div>
                  <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>
                    {imp.import_type==="device"?"📱 Máy móc":"🔩 Linh kiện"} · {imp.supplier_name}
                  </div>
                  <div style={{ fontSize:12, color:"#6b7280" }}>
                    {imp.total_items} mặt hàng · {(imp.total_value||0).toLocaleString("vi-VN")}đ
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                  <div style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{sc.label}</div>
                  <button
                    onClick={e=>{e.stopPropagation();setConfirmDelete(imp);}}
                    style={{ background:"#fef2f2", border:"none", color:"#dc2626", borderRadius:8, padding:"4px 8px", fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:3 }}>
                    <span className="material-icons" style={{fontSize:13}}>delete</span>Xóa
                  </button>
                </div>
              </div>
              <div style={{ fontSize:11, color:"#9ca3af", marginTop:6 }}>
                {imp.created_date && !isNaN(new Date(imp.created_date))
                  ? new Date(imp.created_date).toLocaleString("vi-VN")
                  : imp.confirmed_at ? new Date(imp.confirmed_at).toLocaleString("vi-VN") : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal Chi Tiết Phiếu Nhập ─────────────────────── */}
      {viewDetail && (
        <div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"flex-end" }}
          onClick={e=>{ if(e.target===e.currentTarget) setViewDetail(null); }}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", width:"100%", maxHeight:"88vh", display:"flex", flexDirection:"column" }}>

            {/* Header gradient */}
            <div style={{ background:"linear-gradient(135deg,#6d28d9,#4f46e5)", padding:"16px 18px", borderRadius:"24px 24px 0 0", flexShrink:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ color:"#fff", fontWeight:900, fontSize:16 }}>📥 {viewDetail.import_code}</div>
                  <div style={{ color:"rgba(255,255,255,.75)", fontSize:12, marginTop:2 }}>
                    {viewDetail.import_type==="device"?"📱 Máy móc":"🔩 Linh kiện"} · {viewDetail.supplier_name}
                  </div>
                </div>
                <button onClick={()=>setViewDetail(null)}
                  style={{ background:"rgba(255,255,255,.2)", border:"1.5px solid rgba(255,255,255,.35)", color:"#fff", width:36, height:36, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span className="material-icons" style={{fontSize:20}}>close</span>
                </button>
              </div>
            </div>

            {/* Body scroll */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 16px 32px" }}>

              {/* Thông tin chung */}
              <div style={{ background:"#f8f9ff", borderRadius:12, padding:"12px 14px", marginBottom:14, border:"1px solid #e0e7ff" }}>
                <div style={{ fontWeight:800, fontSize:13, color:"#4f46e5", marginBottom:8 }}>📋 Thông tin phiếu</div>
                {[
                  ["Mã phiếu",        viewDetail.import_code],
                  ["Loại hàng",       viewDetail.import_type==="device"?"📱 Máy móc":"🔩 Linh kiện"],
                  ["Nhà cung cấp",    viewDetail.supplier_name||"—"],
                  ["SĐT NCC",         viewDetail.supplier_phone||"—"],
                  ["Tổng mặt hàng",   `${viewDetail.total_items} SKU`],
                  ["Tổng giá trị",    `${(viewDetail.total_value||0).toLocaleString("vi-VN")}đ`],
                  ["Người tạo",       viewDetail.created_by_name||"—"],
                  ["Ngày nhập",       viewDetail.confirmed_at ? new Date(viewDetail.confirmed_at).toLocaleString("vi-VN") : "—"],
                  ["Ghi chú",         viewDetail.note||"—"],
                ].map(([label, val],i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0",
                    borderBottom: i<8?"1px solid #e0e7ff":"none", fontSize:13 }}>
                    <span style={{ color:"#6b7280" }}>{label}</span>
                    <span style={{ fontWeight:600, color:"#1f2937", textAlign:"right", maxWidth:"55%" }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Danh sách mặt hàng */}
              <div style={{ fontWeight:800, fontSize:13, color:"#374151", marginBottom:10 }}>
                📦 Danh sách mặt hàng ({detailItems.length})
              </div>

              {loadingDetail ? (
                <div style={{ textAlign:"center", padding:24, color:"#9ca3af" }}>⏳ Đang tải...</div>
              ) : detailItems.length === 0 ? (
                <div style={{ textAlign:"center", padding:24, color:"#9ca3af", fontSize:13 }}>Không có dữ liệu</div>
              ) : detailItems.map((it,i) => (
                <div key={it.id||i} style={{ background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800, fontSize:13, color:"#1f2937" }}>{it.name}</div>
                      {it.sku ? <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>SKU: {it.sku}</div> : null}
                      {it.serial_imei ? <div style={{ fontSize:11, color:"#4f46e5", marginTop:1 }}>IMEI/SN: {it.serial_imei}</div> : null}
                      {it.qr_code ? <div style={{ fontSize:11, color:"#0891b2", marginTop:1 }}>QR: {it.qr_code}</div> : null}
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontWeight:800, fontSize:13, color:"#059669" }}>
                        {(it.total_price||0).toLocaleString("vi-VN")}đ
                      </div>
                      <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>
                        {it.qty} × {(it.unit_price||0).toLocaleString("vi-VN")}đ
                      </div>
                    </div>
                  </div>
                  {/* Tags */}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
                    <span style={{ background:"#f3f4f6", color:"#374151", borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:600 }}>
                      {it.condition==="new"?"✨ Mới":"♻️ Đã dùng"}
                    </span>
                    {it.note ? <span style={{ background:"#fef3c7", color:"#92400e", borderRadius:20, padding:"2px 10px", fontSize:11 }}>📝 {it.note}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm xóa phiếu nhập */}
      {confirmDelete && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.5)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#fff", borderRadius:16, padding:24, maxWidth:320, width:"100%",
            boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#dc2626", marginBottom:8 }}>🗑️ Xóa phiếu nhập?</div>
            <div style={{ fontSize:13, color:"#374151", marginBottom:4 }}>
              <strong>{confirmDelete.import_code}</strong>
            </div>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:20 }}>
              {confirmDelete.supplier_name} · {confirmDelete.total_items} mặt hàng · {(confirmDelete.total_value||0).toLocaleString("vi-VN")}đ
            </div>
            <div style={{ fontSize:12, color:"#ef4444", background:"#fef2f2", borderRadius:8, padding:"8px 12px", marginBottom:20 }}>
              ⚠️ Hành động này không thể hoàn tác. Toàn bộ dữ liệu phiếu nhập sẽ bị xóa.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setConfirmDelete(null)}
                style={{ flex:1, padding:"10px", borderRadius:10, border:"1.5px solid #e5e7eb",
                  background:"#f9fafb", fontWeight:700, cursor:"pointer", fontSize:14 }}>
                Huỷ
              </button>
              <button onClick={()=>handleDeleteImport(confirmDelete)}
                style={{ flex:1, padding:"10px", borderRadius:10, border:"none",
                  background:"#dc2626", color:"#fff", fontWeight:800, cursor:"pointer", fontSize:14 }}>
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMEI Barcode Scanner Modal (dùng cho IMEI/Serial) */}
      {imeiScanFor && (
        <IMEIScanModal
          onClose={() => setImeiScanFor(null)}
          onFound={val => { updateItem(imeiScanFor, "serial_imei", val); setImeiScanFor(null); }}
        />
      )}

      {/* QR Scanner overlay (chỉ dùng cho QR Code field) */}
      {scanningFor && (
        <div style={{ position:"fixed", inset:0, zIndex:800, background:"#000", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ color:"#fff", fontWeight:800, fontSize:16, marginBottom:16 }}>📷 Quét mã QR / Barcode</div>
          <div style={{ position:"relative", width:"min(90vw,380px)", height:"min(90vw,380px)" }}>
            <video ref={scanVideoRef} style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:16 }} muted playsInline />
            {/* Crosshair */}
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
              <div style={{ width:200, height:200, border:"3px solid #4f46e5", borderRadius:12, boxShadow:"0 0 0 1000px rgba(0,0,0,.4)" }}/>
            </div>
          </div>
          <div style={{ color:"#9ca3af", fontSize:13, marginTop:16, textAlign:"center" }}>Đưa mã vào khung để quét tự động</div>
          <button onClick={stopScan}
            style={{ marginTop:20, padding:"12px 32px", background:"#ef4444", color:"#fff", border:"none", borderRadius:14, fontWeight:800, fontSize:15, cursor:"pointer" }}>
            Huỷ
          </button>
        </div>
      )}

      {/* Form tạo phiếu */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"flex-end" }}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", width:"100%", maxHeight:"80vh", display:"flex", flexDirection:"column" }}>
            {/* Header */}
            <div style={{ background:"linear-gradient(135deg,#7c3aed,#6d28d9)", padding:"16px 18px", borderRadius:"24px 24px 0 0", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ color:"#fff", fontWeight:900, fontSize:16 }}>📥 Tạo phiếu nhập hàng</div>
              <button onClick={()=>setShowForm(false)}
                style={{ background:"rgba(255,255,255,.2)", border:"1.5px solid rgba(255,255,255,.35)", color:"#fff", width:36, height:36, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span className="material-icons" style={{fontSize:20}}>close</span>
              </button>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"14px 16px 24px" }}>
              {/* Loại hàng */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>Loại hàng nhập</div>
                <div style={{ display:"flex", gap:8 }}>
                  {[{v:"spare_part",l:"🔩 Linh kiện"},{v:"device",l:"📱 Máy móc"}].map(opt=>(
                    <button key={opt.v} onClick={()=>setImportType(opt.v)}
                      style={{ flex:1, padding:"10px 8px", borderRadius:12, border:`2px solid ${importType===opt.v?"#7c3aed":"#e5e7eb"}`, background:importType===opt.v?"#f5f3ff":"#fff", fontWeight:700, fontSize:13, cursor:"pointer", color:importType===opt.v?"#7c3aed":"#374151" }}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chọn PO đặt hàng */}
              {pendingPOs.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <button
                    onClick={()=>setShowPOPicker(v=>!v)}
                    style={{ width:"100%", padding:"10px 14px", borderRadius:10,
                      border:"1.5px dashed #7c3aed", background: selectedPO ? "#f5f3ff" : "#faf5ff",
                      color:"#7c3aed", fontSize:13, fontWeight:700, cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span>
                      📋 {selectedPO ? `Đặt hàng: ${selectedPO.po_code}` : "Nhập theo phiếu đặt hàng (PO)"}
                    </span>
                    <span className="material-icons" style={{fontSize:18}}>
                      {showPOPicker?"expand_less":"expand_more"}
                    </span>
                  </button>
                  {selectedPO && (
                    <div style={{ marginTop:6, padding:"8px 12px", background:"#f0fdf4", borderRadius:8,
                      border:"1px solid #bbf7d0", fontSize:12, color:"#059669", display:"flex", justifyContent:"space-between" }}>
                      <span>✅ Đã load {selectedPO.total_items} mặt hàng từ PO</span>
                      <button onClick={()=>{ setSelectedPO(null); setItems([]); setSupplier(""); setSupplierPhone(""); }}
                        style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                        Bỏ chọn
                      </button>
                    </div>
                  )}
                  {showPOPicker && (
                    <div style={{ marginTop:6, background:"#fff", border:"1.5px solid #e5e7eb",
                      borderRadius:10, boxShadow:"0 4px 20px rgba(0,0,0,.1)", maxHeight:240, overflowY:"auto" }}>
                      {pendingPOs.map(po=>{
                        const remain = poRemaining[po.id];
                        const done = remain !== undefined && remain === 0;
                        return (
                          <div key={po.id} onClick={()=>!done && applyPO(po)}
                            style={{ padding:"10px 14px", cursor: done?"not-allowed":"pointer",
                              borderBottom:"1px solid #f3f4f6", opacity: done?0.5:1 }}
                            onMouseEnter={e=>{ if(!done) e.currentTarget.style.background="#f5f3ff"; }}
                            onMouseLeave={e=>e.currentTarget.style.background=""}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <div>
                                <div style={{ fontWeight:700, fontSize:13, color:"#1e1b4b" }}>{po.po_code}</div>
                                <div style={{ fontSize:12, color:"#6b7280" }}>
                                  {po.supplier_name} · {po.total_items} mặt hàng
                                  {remain !== undefined && !done && <span style={{color:"#d97706",fontWeight:700}}> · còn {remain} chưa nhận</span>}
                                  {done && <span style={{color:"#059669",fontWeight:700}}> · đã nhận đủ</span>}
                                </div>
                              </div>
                              <div style={{ fontSize:11, color: done?"#059669": po.status==="partial"?"#d97706":"#2563eb",
                                fontWeight:700, padding:"2px 8px", borderRadius:8,
                                background: done?"#f0fdf4": po.status==="partial"?"#fffbeb":"#eff6ff" }}>
                                {done?"✅ Đủ": po.status==="partial"?"Nhận một phần":"Chờ nhận"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* NCC */}
              <div style={{ marginBottom:12, position:"relative" }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>Nhà cung cấp *</div>
                <input
                  ref={supplierInputRef}
                  value={supplier}
                  onChange={e=>{ setSupplier(e.target.value); setShowSupplierDrop(true); }}
                  onFocus={()=>setShowSupplierDrop(true)}
                  onBlur={()=>setTimeout(()=>setShowSupplierDrop(false),180)}
                  placeholder="Tên nhà cung cấp..."
                  style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }}
                />
                {showSupplierDrop && supplierSugg.length > 0 && (() => {
                  const el = supplierInputRef.current;
                  if (!el) return null;
                  const r = el.getBoundingClientRect();
                  return (
                    <div style={{
                      position:"fixed", top:r.bottom+4, left:r.left, width:r.width,
                      background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10,
                      zIndex:99999, maxHeight:220, overflowY:"auto",
                      boxShadow:"0 8px 30px rgba(0,0,0,.18)"
                    }}>
                      {supplierSugg.map(s=>(
                        <div key={s.id}
                          onMouseDown={()=>{
                            setSupplier(s.name||"");
                            setSupplierPhone(s.phone||"");
                            setSupplierSugg([]);
                            setShowSupplierDrop(false);
                          }}
                          style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid #f3f4f6",
                            display:"flex", justifyContent:"space-between", alignItems:"center" }}
                          onMouseEnter={e=>e.currentTarget.style.background="#f5f3ff"}
                          onMouseLeave={e=>e.currentTarget.style.background=""}>
                          <div style={{fontWeight:700,fontSize:13,color:"#1e1b4b"}}>{s.name}</div>
                          {s.phone&&<div style={{fontSize:12,color:"#6b7280"}}>{s.phone}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>Số điện thoại</div>
                <input value={supplierPhone} onChange={e=>setSupplierPhone(e.target.value)} placeholder="SĐT nhà cung cấp..."
                  style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }}/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>💵 Đã trả ngay (đ)</div>
                  <input type="number" min={0} value={impPaidAmt} onChange={e=>setImpPaidAmt(Number(e.target.value)||0)}
                    placeholder="0"
                    style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }}/>
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>Hình thức</div>
                  <select value={impPayMethod} onChange={e=>setImpPayMethod(e.target.value)}
                    style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box", background:"#fff" }}>
                    <option value="cash">💵 Tiền mặt</option>
                    <option value="transfer">🏦 Chuyển khoản</option>
                  </select>
                </div>
              </div>

              {/* Danh sách mặt hàng */}
              <div style={{ fontWeight:800, fontSize:14, color:"#1e1b4b", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span>Danh sách mặt hàng</span>
                <button onClick={addItem}
                  style={{ height:32, padding:"0 12px", background:"#7c3aed", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                  <span className="material-icons" style={{fontSize:16}}>add</span>Thêm
                </button>
              </div>

              {items.length===0 && (
                <div style={{ textAlign:"center", padding:"20px", color:"#9ca3af", background:"#f9fafb", borderRadius:12, marginBottom:12 }}>
                  Nhấn "+ Thêm" để thêm mặt hàng
                </div>
              )}

              {items.map((it,idx) => (
                  <div key={it.id} style={{ background:"#f9fafb", borderRadius:14, padding:"12px 14px", marginBottom:12, border:"1.5px solid #e5e7eb" }}>
                    {/* Header item */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <div style={{ fontWeight:800, fontSize:13, color:"#374151" }}>Mặt hàng #{idx+1}</div>
                      <button onClick={()=>removeItem(it.id)}
                        style={{ background:"#fff1f2", border:"none", color:"#dc2626", width:28, height:28, borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span className="material-icons" style={{fontSize:16}}>delete</span>
                      </button>
                    </div>

                    {/* Tên hàng */}
                    <PartNameInput
                      value={it.name}
                      parts={allParts}
                      placeholder="Tên hàng *"
                      onChange={(name, part) => updateItem(it.id, "name", name, part)}
                      style={{ marginBottom:8 }}
                    />

                    {/* SKU + Serial/IMEI với nút quét */}
                    <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                      <input value={it.sku} onChange={e=>updateItem(it.id,"sku",e.target.value)} placeholder="SKU / Mã SP"
                        style={{ flex:1, height:38, borderRadius:8, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:13, outline:"none", boxSizing:"border-box" }}/>
                    </div>

                    {/* IMEI / Serial */}
                    {importType==="device" && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:11, color:"#6b7280", marginBottom:4 }}>IMEI / Serial *</div>
                        <div style={{ display:"flex", gap:6 }}>
                          <input value={it.serial_imei} onChange={e=>updateItem(it.id,"serial_imei",e.target.value)}
                            placeholder="Nhập hoặc quét IMEI..."
                            style={{ flex:1, height:38, borderRadius:8, border:"1.5px solid #c4b5fd", padding:"0 10px", fontSize:13, outline:"none", boxSizing:"border-box" }}/>
                          <button onClick={()=>setImeiScanFor(it.id)}
                            style={{ width:42, height:38, borderRadius:8, border:"1.5px solid #7c3aed", background:"#f5f3ff", color:"#7c3aed", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <span className="material-icons" style={{fontSize:20}}>qr_code_scanner</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {importType!=="device" && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:11, color:"#6b7280", marginBottom:4 }}>IMEI / Serial (tuỳ chọn)</div>
                        <input value={it.serial_imei} onChange={e=>updateItem(it.id,"serial_imei",e.target.value)}
                          placeholder="Nhập mã serial nếu có..."
                          style={{ width:"100%", height:38, borderRadius:8, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:13, outline:"none", boxSizing:"border-box" }}/>
                      </div>
                    )}

                    {/* QR Code — mục riêng, có nút scan */}
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:11, color:"#6b7280", marginBottom:4 }}>
                        <span className="material-icons" style={{fontSize:12,verticalAlign:"middle",marginRight:3}}>qr_code_2</span>
                        Mã QR Code (tuỳ chọn)
                      </div>
                      <div style={{ display:"flex", gap:6 }}>
                        <input value={it.qr_code} onChange={e=>updateItem(it.id,"qr_code",e.target.value)}
                          placeholder="Nhập hoặc quét QR Code sản phẩm..."
                          style={{ flex:1, height:38, borderRadius:8, border:"1.5px solid #a7f3d0", padding:"0 10px", fontSize:13, outline:"none", boxSizing:"border-box" }}/>
                        <button onClick={()=>startScan(it.id, "qr_code")}
                          style={{ width:42, height:38, borderRadius:8, border:"1.5px solid #059669", background:"#f0fdf4", color:"#059669", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <span className="material-icons" style={{fontSize:20}}>qr_code_scanner</span>
                        </button>
                      </div>
                    </div>

                    {/* Số lượng + Giá */}
                    <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, color:"#6b7280", marginBottom:4 }}>Số lượng</div>
                        <input type="number" min="1" value={it.qty} onChange={e=>updateItem(it.id,"qty",+e.target.value)}
                          style={{ width:"100%", height:38, borderRadius:8, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:13, outline:"none", boxSizing:"border-box" }}/>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, color:"#6b7280", marginBottom:4 }}>Giá nhập (đ)</div>
                        <input type="number" min="0" value={it.unit_price} onChange={e=>updateItem(it.id,"unit_price",+e.target.value)}
                          style={{ width:"100%", height:38, borderRadius:8, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:13, outline:"none", boxSizing:"border-box" }}/>
                      </div>
                    </div>

                    {/* Tình trạng */}
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, color:"#6b7280", marginBottom:4 }}>Tình trạng</div>
                      <div style={{ display:"flex", gap:6 }}>
                        {[{v:"new",l:"Mới"},{v:"refurb",l:"Tân trang"},{v:"used",l:"Đã qua SD"}].map(c=>(
                          <button key={c.v} onClick={()=>updateItem(it.id,"condition",c.v)}
                            style={{ flex:1, padding:"6px 4px", borderRadius:8, border:`1.5px solid ${it.condition===c.v?"#7c3aed":"#e5e7eb"}`, background:it.condition===c.v?"#f5f3ff":"#fff", fontWeight:700, fontSize:11, cursor:"pointer", color:it.condition===c.v?"#7c3aed":"#6b7280" }}>
                            {c.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ảnh / Video — cho TẤT CẢ loại hàng */}
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:11, color:"#6b7280", marginBottom:6 }}>📸 Ảnh / Video xác nhận hàng</div>
                      <input id={"media-"+it.id} type="file" accept="image/*,video/*" multiple capture="environment"
                        style={{display:"none"}} onChange={e=>{ handleItemMedia(it.id, e.target.files); e.target.value=""; }}/>
                      <button onClick={()=>document.getElementById("media-"+it.id)?.click()}
                        style={{ height:36, padding:"0 12px", borderRadius:8, border:"1.5px solid #6ee7b7", background:"#fff", color:"#059669", fontWeight:700, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                        <span className="material-icons" style={{fontSize:16}}>add_a_photo</span>Chụp ảnh / Quay video
                      </button>
                      {/* Preview media */}
                      {(it.photos.length>0 || it.videos.length>0) && (
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          {it.photos.map((m,i)=>(
                            <div key={"p"+i} style={{position:"relative"}}>
                              <img src={m.url} style={{width:56,height:56,borderRadius:8,objectFit:"cover",border:"1.5px solid #6ee7b7"}} alt=""/>
                              <button onClick={()=>removeMedia(it.id,"photos",i)}
                                style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#ef4444",border:"none",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                            </div>
                          ))}
                          {it.videos.map((m,i)=>(
                            <div key={"v"+i} style={{position:"relative"}}>
                              <video src={m.url} style={{width:56,height:56,borderRadius:8,objectFit:"cover",border:"1.5px solid #a78bfa"}}/>
                              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.3)",borderRadius:8}}>
                                <span className="material-icons" style={{fontSize:20,color:"#fff"}}>play_circle</span>
                              </div>
                              <button onClick={()=>removeMedia(it.id,"videos",i)}
                                style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#ef4444",border:"none",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ghi chú riêng từng item */}
                    <input value={it.note||""} onChange={e=>updateItem(it.id,"note",e.target.value)}
                      placeholder="Ghi chú mặt hàng (tuỳ chọn)..."
                      style={{ width:"100%", height:34, borderRadius:8, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:12, outline:"none", boxSizing:"border-box" }}/>

                    {/* Hint cho máy móc */}
                    {importType==="device" && it.serial_imei && (
                      <div style={{ marginTop:8, fontSize:11, color:"#059669", background:"#f0fdf4", borderRadius:8, padding:"6px 10px", display:"flex", alignItems:"center", gap:6 }}>
                        <span className="material-icons" style={{fontSize:14}}>inventory_2</span>
                        Máy này sẽ được đánh dấu "Hàng trong kho - Chưa bán"
                      </div>
                    )}
                  </div>
              ))}

              {/* Ghi chú phiếu */}
              <textarea value={note} onChange={e=>setNote(e.target.value)}
                placeholder="Ghi chú phiếu nhập (tuỳ chọn)..."
                style={{ width:"100%", minHeight:60, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"8px 12px", fontSize:13, outline:"none", resize:"vertical", boxSizing:"border-box", marginTop:8 }}/>
            </div>

            {/* Save button */}
            <div style={{ padding:"12px 16px 24px", borderTop:"1.5px solid #e5e7eb", flexShrink:0 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ width:"100%", height:50, borderRadius:14, border:"none", background:saving?"#9ca3af":"linear-gradient(135deg,#7c3aed,#6d28d9)", color:"#fff", fontWeight:900, fontSize:16, cursor:saving?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <span className="material-icons" style={{fontSize:22}}>save</span>
                {saving?"Đang lưu...":"Lưu phiếu nhập"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,.85)",color:"#fff",padding:"10px 20px",borderRadius:16,fontSize:14,fontWeight:700,zIndex:9999,whiteSpace:"nowrap"}}>{toast}</div>}
    </div>
  );
}

export {
  WarehouseOrders,
  TechnicianHome,
  ReceptionHome,
  WarehouseHome,
  WarehouseExport,
  PartNameInput,
  WarehouseImport,
};