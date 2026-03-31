/* v5-renamed-pages */
import React, { lazy, Suspense, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const Staff = base44.entities.Staff;
const RepairOrder = base44.entities.RepairOrder;

const StaffManagerPage = lazy(() => import("./Staff"));
const SettingsPage = lazy(() => import("./Config"));

import { QRScanModal } from "./QR";
import { MediaViewer, timeAgo, getKpiTimerInfo } from "./Viewer";
import { OrderDrawer } from "./Drawer";
import { NewOrderModal, KPIPage } from "./Forms";
import LoginPage from "./AuthV2";

export default function MainApp() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [page, setPage] = useState("board");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showQRScan, setShowQRScan] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setDataLoading(true);
        const [staffList, orderList] = await Promise.all([
          Staff.list(),
          RepairOrder.list("-created_date", 200).catch(() => []),
        ]);
        const mappedUsers = staffList.map(s => ({
          id: s.id,
          name: s.full_name,
          username: s.username,
          password: s.password_hash,
          role: s.role,
          kpi: s.kpi_score || 0,
          phone: s.phone || "",
          note: s.note || "",
          is_active: s.is_active !== false,
          avatar_url: s.avatar_url || "",
        }));
        const mappedOrders = orderList.map(o => ({
          id: o.order_code,
          _id: o.id,
          device_model: o.device_model || "",
          imei_serial: o.imei || "",
          passcode: o.passcode || "",
          issues: o.issue_description ? JSON.parse(o.issue_description).catch ? [o.issue_description] : (() => { try { return JSON.parse(o.issue_description); } catch { return [o.issue_description]; } })() : [],
          status: o.status || "Mới Nhận",
          notes: o.technician_note || "",
          assigned_to: o.assigned_to || "",
          assigned_to_name: o.assigned_to_name || "",
          assigned_at: o.assigned_at || o.received_date || o.created_date,
          accept_stage: o.accept_stage || 0,
          stage1_at: o.stage1_at || null,
          stage2_at: o.stage2_at || null,
          kpi_stage1_penalized: o.kpi_stage1_penalized || false,
          kpi_stage2_penalized: o.kpi_stage2_penalized || false,
          needs_reassign: o.needs_reassign || false,
          created: o.received_date || o.created_date,
          images: o.images || [],
          qr_code: o.qr_code || o.order_code || "",
          customer_name: o.customer_name || "",
          customer_phone: o.customer_phone || "",
          estimated_cost: o.estimated_cost || 0,
          final_cost: o.final_cost || 0,
          estimated_done: o.estimated_done || null,
          checklist_done: o.checklist_done || [],
        }));
        setUsers(mappedUsers);
        setOrders(mappedOrders);
      } catch(e) {
        console.error("Load data error:", e);
      } finally {
        setDataLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      let kpiChanges = [];
      let notifMsgs = [];

      setOrders(prev => {
        let changed = false;
        kpiChanges = [];
        notifMsgs = [];
        const next = prev.map(o => {
          if (!o.assigned_to || !o.assigned_at || o.accept_stage >= 3) return o;
          if (["Hoàn Thành","Đã Giao"].includes(o.status)) return o;
          const assignedAt = new Date(o.assigned_at).getTime();
          let patch = {};

          if ((o.accept_stage||0) === 0 && !o.kpi_stage1_penalized && now >= assignedAt + 60*60000) {
            patch.kpi_stage1_penalized = true;
            kpiChanges.push({ userId: o.assigned_to, delta: -1 });
            notifMsgs.push(`⚠️ Đơn ${o.id}: KTV quá 60 phút chưa Nhận máy → -1 KPI`);
            changed = true;
          }

          if ((o.accept_stage||0) < 2 && !o.kpi_stage2_penalized && now >= assignedAt + 120*60000) {
            patch.kpi_stage2_penalized = true;
            patch.needs_reassign = true;
            kpiChanges.push({ userId: o.assigned_to, delta: -3 });
            notifMsgs.push(`🚨 Đơn ${o.id}: KTV quá 120 phút → -3 KPI. Quản lý cần xử lý!`);
            changed = true;
          }

          if (Object.keys(patch).length > 0) { changed = true; return {...o, ...patch}; }
          return o;
        });
        return changed ? next : prev;
      });

      if (kpiChanges.length > 0) {
        setUsers(u => {
          let next = [...u];
          kpiChanges.forEach(({ userId, delta }) => {
            next = next.map(x => x.id===userId ? {...x, kpi:Math.max(0,x.kpi+delta)} : x);
          });
          return next;
        });
      }
      if (notifMsgs.length > 0) {
        setNotifications(n => [
          ...notifMsgs.map(msg => ({ id: Math.random().toString(36), msg, time: new Date().toISOString() })),
          ...n
        ].slice(0, 10));
      }
    }, 15000);
    return () => clearInterval(iv);
  }, []);

  if (dataLoading) return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:56 }}>🔧</div>
      <div style={{ color:"#fff", fontWeight:800, fontSize:20 }}>Đang tải hệ thống...</div>
      <div style={{ color:"#c7d2fe", fontSize:14 }}>⏳ Vui lòng chờ</div>
    </div>
  );
  if (!user) return <LoginPage onLogin={u => { setUser(u); setPage(u.role==="technician"?"tasks":u.role==="receptionist"?"new":"dashboard"); }} />;

  async function updateOrder(id, patch, kpiEvent) {
    setOrders(p => p.map(o => o.id===id ? {...o,...patch} : o));
    if (selectedOrder?.id===id) setSelectedOrder(p => ({...p,...patch}));
    if (kpiEvent) setUsers(p => p.map(u => u.id===kpiEvent.userId ? {...u, kpi:Math.max(0,u.kpi+kpiEvent.delta)} : u));
    // Persist to DB
    const order = orders.find(o => o.id===id);
    if (order?._id) {
      const dbPatch = {};
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.assigned_to !== undefined) { dbPatch.assigned_to = patch.assigned_to; dbPatch.assigned_to_name = users.find(u=>u.id===patch.assigned_to)?.name || ""; }
      if (patch.assigned_at !== undefined) dbPatch.assigned_at = patch.assigned_at;
      if (patch.accept_stage !== undefined) dbPatch.accept_stage = patch.accept_stage;
      if (patch.stage1_at !== undefined) dbPatch.stage1_at = patch.stage1_at;
      if (patch.stage2_at !== undefined) dbPatch.stage2_at = patch.stage2_at;
      if (patch.kpi_stage1_penalized !== undefined) dbPatch.kpi_stage1_penalized = patch.kpi_stage1_penalized;
      if (patch.kpi_stage2_penalized !== undefined) dbPatch.kpi_stage2_penalized = patch.kpi_stage2_penalized;
      if (patch.needs_reassign !== undefined) dbPatch.needs_reassign = patch.needs_reassign;
      if (patch.estimated_done !== undefined) dbPatch.estimated_done = patch.estimated_done;
      if (patch.final_cost !== undefined) dbPatch.final_cost = patch.final_cost;
      if (patch.technician_note !== undefined) dbPatch.technician_note = patch.technician_note;
      if (Object.keys(dbPatch).length > 0) {
        RepairOrder.update(order._id, dbPatch).catch(e => console.error("Update order DB error:", e));
      }
    }
  }

  async function createOrder(data) {
    // Lưu vào DB
    const assigneeName = users.find(u => u.id === data.assigned_to)?.name || "";
    const dbRecord = await RepairOrder.create({
      order_code: data.id,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      device_model: data.device_model,
      imei: data.imei_serial || "",
      passcode: data.passcode || "",
      qr_code: data.qr_code || "",
      issue_description: JSON.stringify(data.issues || []),
      technician_note: data.notes || "",
      status: "Mới Nhận",
      assigned_to: data.assigned_to || "",
      assigned_to_name: assigneeName,
      assigned_at: data.assigned_to ? new Date().toISOString() : "",
      received_date: new Date().toISOString(),
      images: data.images || [],
      accept_stage: 0,
    }).catch(e => { console.error("Create order DB error:", e); return null; });

    const orderWithDbId = { ...data, _id: dbRecord?.id || null, assigned_to_name: assigneeName };
    setOrders(p => [orderWithDbId, ...p]);
    if (data.assigned_to) {
      const ktv = users.find(u => u.id===data.assigned_to);
      setNotifications(n => [{ id:Math.random().toString(36), msg:`🔔 Đơn ${data.id} giao cho ${ktv?.name}. Quy trình KPI đã bắt đầu!`, time:new Date().toISOString() }, ...n.slice(0,9)]);
    }
    setCreatedOrder(orderWithDbId);
    setPage("board");
  }
  function goToPendingAccept() {
    setPage("tasks");
    const p = orders.find(o => o.assigned_to===user.id && (o.accept_stage||0)<2 && o.assigned_at);
    if (p) { setHighlightId(p.id); setTimeout(() => setHighlightId(null), 3000); }
  }
  function handleGlobalQRScan(result) {
    setShowQRScan(false);
    if (result.type === "order") setSelectedOrder(result.data);
  }

  const myOrders = user.role==="technician" ? orders.filter(o => o.assigned_to===user.id) : orders;
  const filtered = myOrders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase().trim();
    return (o.customer_name||"").toLowerCase().includes(q) ||
      (o.customer_phone||"").includes(q) ||
      (o.device_model||"").toLowerCase().includes(q) ||
      (o.id||"").toLowerCase().includes(q) ||
      (o.imei_serial||"").includes(q) ||
      (o.notes||"").toLowerCase().includes(q);
  });
  const pendingAccepts = orders.filter(o => o.assigned_to===user.id && (o.accept_stage||0)<2 && o.assigned_at && !["Hoàn Thành","Đã Giao"].includes(o.status));

  const navItems = [
    ...(user.role==="manager"?[{key:"dashboard",icon:"📊",label:"Tổng quan"}]:[]),
    ...(user.role!=="technician"?[{key:"board",icon:"📋",label:"Bảng theo dõi"},{key:"new",icon:"➕",label:"Tạo đơn mới"}]:[]),
    {key:"tasks",icon:"✅",label:user.role==="manager"?"Tất cả việc":"Việc của tôi"},
    ...(user.role!=="receptionist"?[{key:"kpi",icon:"🏆",label:"KPI Kỹ thuật"}]:[]),
    ...(user.role!=="technician"?[{key:"customers",icon:"👥",label:"Khách hàng"}]:[]),
    ...(user.role==="admin"||user.role==="manager"?[{key:"staff",icon:"👤",label:"Nhân viên"},{key:"settings",icon:"⚙️",label:"Cài đặt"}]:[]),
  ];

  const COLUMNS = ["Mới Nhận","Đang Kiểm Tra","Chờ Linh Kiện","Đang Sửa","Hoàn Thành","Đã Giao"];
  const colColors = { "Mới Nhận":"#dbeafe","Đang Kiểm Tra":"#fef3c7","Chờ Linh Kiện":"#fce7f3","Đang Sửa":"#ede9fe","Hoàn Thành":"#dcfce7","Đã Giao":"#f1f5f9" };
  const colBorder = { "Mới Nhận":"#93c5fd","Đang Kiểm Tra":"#fcd34d","Chờ Linh Kiện":"#f9a8d4","Đang Sửa":"#c4b5fd","Hoàn Thành":"#86efac","Đã Giao":"#cbd5e1" };

  function KanbanBoard() {
    return (
      <div style={{ overflowX:"auto", padding:"0 16px 80px" }}>
        <div style={{ display:"flex", gap:12, minWidth: COLUMNS.length * 240 }}>
          {COLUMNS.map(col => {
            const colOrders = filtered.filter(o => o.status===col);
            return (
              <div key={col} style={{ flex:"0 0 230px", background:colColors[col], borderRadius:16, border:`1.5px solid ${colBorder[col]}`, padding:12, minHeight:300 }}>
                <div style={{ fontWeight:800, fontSize:13, color:"#374151", marginBottom:10, display:"flex", justifyContent:"space-between" }}>
                  <span>{col}</span>
                  <span style={{ background:"#fff", borderRadius:99, padding:"2px 10px", fontSize:12 }}>{colOrders.length}</span>
                </div>
                {colOrders.map(o => {
                  const ktv = users.find(u => u.id===o.assigned_to);
                  const timerInfo = ktv ? getKpiTimerInfo(o) : null;
                  return (
                    <div key={o.id} onClick={() => setSelectedOrder(o)} style={{ background:"#fff", borderRadius:12, padding:12, marginBottom:8, cursor:"pointer", boxShadow:highlightId===o.id?"0 0 0 3px #f59e0b":"0 1px 4px rgba(0,0,0,.08)", border:highlightId===o.id?"2px solid #f59e0b":"2px solid transparent" }}>
                      <div style={{ fontWeight:800, fontSize:13, color:"#1e1b4b", marginBottom:4 }}>{o.id}</div>
                      <div style={{ fontSize:12, color:"#374151", marginBottom:2 }}>👤 {o.customer_name||"?"} · {o.customer_phone||""}</div>
                      <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>📱 {o.device_model}</div>
                      {(o.issues||[]).length>0 && <div style={{ fontSize:11, color:"#7c3aed", marginBottom:4 }}>{o.issues.slice(0,2).join(" · ")}</div>}
                      {ktv && <div style={{ fontSize:11, color:"#059669" }}>🔧 {ktv.name}</div>}
                      {timerInfo && <div style={{ fontSize:11, color:timerInfo.urgent?"#dc2626":"#d97706", fontWeight:700 }}>⏱ {timerInfo.timeStr}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function TaskList() {
    const list = user.role==="technician" ? filtered : filtered.filter(o => !["Đã Giao"].includes(o.status));
    return (
      <div style={{ padding:"0 16px 80px" }}>
        {pendingAccepts.length > 0 && user.role==="technician" && (
          <div style={{ background:"#fef3c7", borderRadius:14, padding:14, marginBottom:12, border:"2px solid #fcd34d" }}>
            <div style={{ fontWeight:800, color:"#d97706" }}>⏰ Có {pendingAccepts.length} đơn cần xác nhận!</div>
          </div>
        )}
        {list.length===0 && <div style={{ textAlign:"center", color:"#9ca3af", padding:40 }}>Không có đơn nào</div>}
        {list.map(o => {
          const ktv = users.find(u=>u.id===o.assigned_to);
          const timerInfo = getKpiTimerInfo(o);
          return (
            <div key={o.id} onClick={() => setSelectedOrder(o)}
              style={{ background:"#fff", borderRadius:14, padding:14, marginBottom:10, cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,.08)", border:`2px solid ${o.needs_reassign?"#ef4444":"#f3f4f6"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <div style={{ fontWeight:800, color:"#1e1b4b" }}>{o.id}</div>
                <div style={{ fontSize:12, padding:"3px 10px", borderRadius:99, background: o.status==="Hoàn Thành"?"#dcfce7":o.status==="Đang Sửa"?"#ede9fe":"#fef3c7", color:"#374151" }}>{o.status}</div>
              </div>
              <div style={{ fontSize:13, color:"#374151", marginBottom:2 }}>👤 {o.customer_name} · 📱 {o.device_model}</div>
              {ktv && <div style={{ fontSize:12, color:"#6b7280" }}>🔧 {ktv.name}</div>}
              {timerInfo && <div style={{ fontSize:12, color:timerInfo.urgent?"#dc2626":"#d97706", fontWeight:700, marginTop:4 }}>⏱ {timerInfo.timeStr}</div>}
              {o.needs_reassign && <div style={{ fontSize:12, color:"#ef4444", fontWeight:700, marginTop:4 }}>🚨 Cần chuyển KTV khác!</div>}
            </div>
          );
        })}
      </div>
    );
  }

  function CustomerList() {
    const [custSearch, setCustSearch] = useState("");
    const [editCust, setEditCust] = useState(null); // {name, phone, note} | null
    const [custForm, setCustForm] = useState({ name:"", phone:"", note:"" });
    const custMap = {};
    orders.forEach(o => {
      if (o.customer_phone) {
        if (!custMap[o.customer_phone]) custMap[o.customer_phone] = { name:o.customer_name, phone:o.customer_phone, orders:0, lastOrder:o.created, note:"" };
        custMap[o.customer_phone].orders++;
      }
    });
    const custs = Object.values(custMap).sort((a,b) => b.orders - a.orders)
      .filter(c => !custSearch || c.name?.toLowerCase().includes(custSearch.toLowerCase()) || c.phone?.includes(custSearch));

    function openEdit(c) { setCustForm({ name:c.name, phone:c.phone, note:c.note||"" }); setEditCust(c); }
    function saveEdit() {
      // update local state for orders with this phone
      setOrders(prev => prev.map(o => o.customer_phone === editCust.phone ? { ...o, customer_name: custForm.name, customer_phone: custForm.phone } : o));
      setEditCust(null);
    }

    return (
      <div style={{ padding:"0 16px 80px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b" }}>👥 Khách Hàng ({custs.length})</div>
          <div style={{ fontSize:11, color:"#6b7280", background:"#f0f9ff", padding:"4px 10px", borderRadius:20, border:"1px solid #bae6fd" }}>
            💡 Đồng bộ KiotViet trong Cài đặt
          </div>
        </div>
        <input value={custSearch} onChange={e=>setCustSearch(e.target.value)}
          placeholder="🔍 Tìm tên, số điện thoại..."
          style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", marginBottom:12, boxSizing:"border-box" }} />
        {custs.length===0 && <div style={{ textAlign:"center", color:"#9ca3af", padding:40 }}>Chưa có khách hàng</div>}
        {custs.map(c => (
          <div key={c.phone} style={{ background:"#fff", borderRadius:14, padding:14, marginBottom:8, boxShadow:"0 1px 4px rgba(0,0,0,.06)", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:"50%", background:"#eef2ff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>👤</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:15 }}>{c.name}</div>
              <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>📞 {c.phone} · {c.orders} đơn</div>
            </div>
            <button onClick={() => openEdit(c)}
              style={{ height:34, padding:"0 12px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontWeight:700, fontSize:12, cursor:"pointer" }}>
              ✏️ Sửa
            </button>
          </div>
        ))}
        {editCust && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
            onClick={e=>{ if(e.target===e.currentTarget) setEditCust(null); }}>
            <div style={{ background:"#fff", borderRadius:20, padding:28, width:"100%", maxWidth:420 }}>
              <div style={{ fontSize:17, fontWeight:900, color:"#1e1b4b", marginBottom:20 }}>✏️ Sửa thông tin khách</div>
              {[{label:"Họ tên *",key:"name",ph:"Nguyễn Văn A"},{label:"Số điện thoại *",key:"phone",ph:"0901234567"},{label:"Ghi chú",key:"note",ph:"VIP, hay trả chậm..."}].map(f=>(
                <div key={f.key} style={{ marginBottom:14 }}>
                  <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>{f.label}</label>
                  <input value={custForm[f.key]||""} onChange={e=>setCustForm(p=>({...p,[f.key]:e.target.value}))}
                    placeholder={f.ph} style={{ width:"100%", height:44, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
                </div>
              ))}
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={()=>setEditCust(null)} style={{ flex:1, height:46, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontWeight:700, cursor:"pointer" }}>Hủy</button>
                <button onClick={saveEdit} style={{ flex:2, height:46, borderRadius:12, border:"none", background:"#4f46e5", color:"#fff", fontWeight:800, cursor:"pointer" }}>Lưu</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function Dashboard() {
    const stats = {
      total: orders.length,
      active: orders.filter(o=>!["Hoàn Thành","Đã Giao"].includes(o.status)).length,
      done: orders.filter(o=>o.status==="Hoàn Thành"||o.status==="Đã Giao").length,
      needsReassign: orders.filter(o=>o.needs_reassign).length,
    };
    const cards = [
      { label:"Tổng đơn", value:stats.total, icon:"📋", bg:"#eef2ff", color:"#4f46e5" },
      { label:"Đang xử lý", value:stats.active, icon:"⚙️", bg:"#fffbeb", color:"#d97706" },
      { label:"Hoàn thành", value:stats.done, icon:"✅", bg:"#f0fdf4", color:"#059669" },
      { label:"Cần xử lý", value:stats.needsReassign, icon:"🚨", bg:"#fef2f2", color:"#dc2626" },
    ];
    return (
      <div style={{ padding:"0 16px 80px" }}>
        <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b", marginBottom:16 }}>📊 Tổng quan hôm nay</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {cards.map(c => (
            <div key={c.label} style={{ background:c.bg, borderRadius:16, padding:16, textAlign:"center" }}>
              <div style={{ fontSize:32 }}>{c.icon}</div>
              <div style={{ fontSize:32, fontWeight:900, color:c.color }}>{c.value}</div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{c.label}</div>
            </div>
          ))}
        </div>
        <KPIPage users={users} orders={orders} />
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:100, background:"#1e1b4b", padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setSidebarOpen(v=>!v)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:4 }}>☰</button>
        <div style={{ flex:1, fontWeight:800, fontSize:16, color:"#fff" }}>🔧 Quản Lý Sửa Chữa</div>
        <div style={{ position:"relative" }}>
          <button onClick={() => setShowNotif(v=>!v)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:4 }}>
            🔔
            {notifications.length>0 && <span style={{ position:"absolute", top:-2, right:-2, background:"#ef4444", color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{notifications.length}</span>}
          </button>
        </div>
        <button onClick={() => setShowQRScan(true)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:4 }}>📷</button>
        <button onClick={() => setUser(null)} style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff", borderRadius:10, padding:"6px 12px", fontSize:12, cursor:"pointer", fontWeight:700 }}>Thoát</button>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:200 }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.4)" }} onClick={() => setSidebarOpen(false)} />
          <div style={{ position:"absolute", left:0, top:0, bottom:0, width:260, background:"#fff", boxShadow:"4px 0 20px rgba(0,0,0,.15)", display:"flex", flexDirection:"column" }}>
            <div style={{ background:"#1e1b4b", padding:24, color:"#fff" }}>
              <div style={{ fontSize:40 }}>👤</div>
              <div style={{ fontWeight:800, fontSize:16, marginTop:8 }}>{user.name}</div>
              <div style={{ fontSize:12, color:"#c7d2fe", marginTop:2 }}>{user.role} · KPI: {user.kpi}</div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:8 }}>
              {navItems.map(n => (
                <button key={n.key} onClick={() => { setPage(n.key); setSidebarOpen(false); }}
                  style={{ width:"100%", textAlign:"left", padding:"14px 16px", borderRadius:12, border:"none", background:page===n.key?"#eef2ff":"transparent", color:page===n.key?"#4f46e5":"#374151", fontWeight:page===n.key?800:500, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", gap:10, marginBottom:2 }}>
                  <span style={{fontSize:20}}>{n.icon}</span> {n.label}
                </button>
              ))}
            </div>
            <div style={{ padding:16, borderTop:"1px solid #f3f4f6" }}>
              <button onClick={() => { setUser(null); setSidebarOpen(false); }} style={{ width:"100%", padding:14, background:"#fef2f2", border:"none", borderRadius:12, color:"#dc2626", fontWeight:700, cursor:"pointer" }}>🚪 Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification panel */}
      {showNotif && (
        <div style={{ position:"fixed", inset:0, zIndex:300 }}>
          <div style={{ position:"absolute", inset:0 }} onClick={() => setShowNotif(false)} />
          <div style={{ position:"absolute", top:60, right:8, width:320, background:"#fff", borderRadius:16, boxShadow:"0 8px 32px rgba(0,0,0,.2)", overflow:"hidden" }}>
            <div style={{ padding:"14px 16px", fontWeight:800, borderBottom:"1px solid #f3f4f6" }}>🔔 Thông báo</div>
            {notifications.length===0 ? <div style={{ padding:24, textAlign:"center", color:"#9ca3af" }}>Không có thông báo</div> : notifications.map(n => (
              <div key={n.id} style={{ padding:"12px 16px", borderBottom:"1px solid #f9fafb", fontSize:13 }}>
                <div>{n.msg}</div>
                <div style={{ color:"#9ca3af", fontSize:11, marginTop:2 }}>{timeAgo(n.time)}</div>
              </div>
            ))}
            <button onClick={() => { setNotifications([]); setShowNotif(false); }} style={{ width:"100%", padding:12, background:"#f9fafb", border:"none", cursor:"pointer", color:"#6b7280", fontWeight:600 }}>Xóa tất cả</button>
          </div>
        </div>
      )}

      {/* Page title bar */}
      <div style={{ padding:"14px 16px 8px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b" }}>
          {navItems.find(n=>n.key===page)?.icon} {navItems.find(n=>n.key===page)?.label || ""}
        </div>
        {(page==="board"||page==="tasks") && (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Tìm kiếm..."
              style={{ height:36, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:13, outline:"none", width:160 }} />
            {user.role!=="technician" && (
              <button onClick={() => setShowNewOrder(true)}
                style={{ height:36, padding:"0 14px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                ➕ Tạo đơn
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}>
        {page==="board" && <KanbanBoard />}
        {page==="tasks" && <TaskList />}
        {page==="new" && <div style={{padding:16}}><button onClick={() => setShowNewOrder(true)} style={{ width:"100%", height:56, background:"#4f46e5", color:"#fff", border:"none", borderRadius:16, fontWeight:800, fontSize:16, cursor:"pointer" }}>➕ Tạo Đơn Mới</button></div>}
        {page==="kpi" && <KPIPage users={users} orders={orders} />}
        {page==="customers" && <CustomerList />}
        {page==="dashboard" && <Dashboard />}
        {page==="staff" && <StaffManagerPage />}
        {page==="settings" && <SettingsPage />}
      </Suspense>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"1px solid #e5e7eb", display:"flex", zIndex:50, paddingBottom:"env(safe-area-inset-bottom)" }}>
        {navItems.slice(0,5).map(n => (
          <button key={n.key} onClick={() => setPage(n.key)}
            style={{ flex:1, padding:"10px 4px", background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <span style={{ fontSize:20 }}>{n.icon}</span>
            <span style={{ fontSize:10, color:page===n.key?"#4f46e5":"#9ca3af", fontWeight:page===n.key?800:500 }}>{n.label}</span>
          </button>
        ))}
      </div>

      {/* Modals */}
      {showNewOrder && <NewOrderModal onClose={() => setShowNewOrder(false)} onCreate={createOrder} users={users} orders={orders} />}
      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(id, patch, kpiEvent) => { updateOrder(id, patch, kpiEvent); }}
          users={users}
          currentUser={user}
        />
      )}
      {showQRScan && <QRScanModal onClose={() => setShowQRScan(false)} onFound={handleGlobalQRScan} orders={orders} />}

      {/* Created order toast */}
      {createdOrder && (
        <div style={{ position:"fixed", bottom:80, left:16, right:16, zIndex:400, background:"#059669", borderRadius:16, padding:"14px 18px", color:"#fff", boxShadow:"0 8px 24px rgba(0,0,0,.2)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontWeight:800 }}>✅ Đã tạo đơn {createdOrder.id}</div>
            <div style={{ fontSize:12, opacity:.9, marginTop:2 }}>{createdOrder.customer_name} · {createdOrder.device_model}</div>
          </div>
          <button onClick={() => setCreatedOrder(null)}
            style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontWeight:700, fontSize:13 }}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}