// v3.0
import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, Customer } from "@/api/entities";
import { uploadFile } from "@/api/storage";
const SparePartModal = lazy(() => import("./SparePartModal").catch(() => ({ default: ({ onClose }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:"#fff",borderRadius:16,padding:32,textAlign:"center"}}>
      <div style={{fontSize:32}}>⚠️</div>
      <div style={{fontWeight:700,marginTop:8}}>Module không tải được</div>
      <button onClick={onClose} style={{marginTop:16,padding:"10px 24px",background:"#4f46e5",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>Đóng</button>
    </div>
  </div>
)})));
const StaffManagerPage = lazy(() => import("./StaffManager").catch(() => ({ default: () => (
  <div style={{padding:32,textAlign:"center"}}>
    <div style={{fontSize:32}}>⚠️</div>
    <div style={{fontWeight:700,marginTop:8}}>Module không tải được</div>
  </div>
)})));
const SettingsPage = lazy(() => import("./Settings").catch(() => ({ default: () => (
  <div style={{padding:32,textAlign:"center"}}>
    <div style={{fontSize:32}}>⚠️</div>
    <div style={{fontWeight:700,marginTop:8}}>Module không tải được</div>
  </div>
)})));


// Components loaded from OrderComponents
import { QRScanModal, QRPrintModal } from "./QRComponents";
import { MediaViewer, AcceptChecklistModal, AcceptTimer, timeAgo, genOrderId, getKpiTimerInfo } from "./MediaViewer";
import { OrderDrawer } from "./OrderDrawer";
import { NewOrderModal, KPIPage, LoginScreen } from "./OrderForms";
const LoginPage = LoginScreen;

export default function Home() {
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
  const [qrOrder, setQrOrder] = useState(null);
  const [showQRScan, setShowQRScan] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null); // toast xác nhận tạo đơn

  // ── Load real data from entities ──────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        setDataLoading(true);
        const [staffList, orderList] = await Promise.all([
          Staff.list(),
          RepairOrder.list({ sort: "-created_date", limit: 200 }),
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
          id: o.order_code || o.id,
          _id: o.id,
          customer_id: o.customer_name,
          device_model: o.device_model || o.device_name || "",
          imei_serial: o.imei || "",
          passcode: "",
          issues: o.issue_description ? [o.issue_description] : [],
          status: o.status || "Mới Nhận",
          notes: o.technician_note || "",
          assigned_to: o.assigned_to || "",
          assigned_at: o.received_date || o.created_date,
          accept_stage: o.status === "Hoàn Thành" || o.status === "Đã Giao" ? 3 : 0,
          created: o.received_date || o.created_date,
          images: o.images || [],
          qr_code: o.order_code || "",
          customer_name: o.customer_name || "",
          customer_phone: o.customer_phone || "",
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

  // ── Auto KPI deduction per timeline diagram ──────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      let kpiChanges = []; // { userId, delta }
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

          // Mốc 1: T=60' — chưa cập nhật lần 1, chưa bị trừ
          if ((o.accept_stage||0) === 0 && !o.kpi_stage1_penalized && now >= assignedAt + 60*60000) {
            patch.kpi_stage1_penalized = true;
            kpiChanges.push({ userId: o.assigned_to, delta: -1 });
            notifMsgs.push(`⚠️ Đơn ${o.id}: KTV quá 60 phút chưa Nhận máy → -1 KPI`);
            changed = true;
          }

          // Mốc 2: T=120' — chưa cập nhật lần 2, chưa bị trừ
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

      // Apply KPI changes after orders update
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
    }, 15000); // check mỗi 15 giây
    return () => clearInterval(iv);
  }, []);

  if (dataLoading) return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:56 }}>🔧</div>
      <div style={{ color:"#fff", fontWeight:800, fontSize:20 }}>Đang tải hệ thống...</div>
      <div style={{ color:"#c7d2fe", fontSize:14 }}>⏳ Vui lòng chờ</div>
    </div>
  );
  if (!user) return <LoginPage users={users} onLogin={u => { setUser(u); setPage(u.role==="technician"?"tasks":u.role==="receptionist"?"new":"dashboard"); }} />;

  function updateOrder(id, patch, kpiEvent) {
    setOrders(p => p.map(o => o.id===id ? {...o,...patch} : o));
    if (selectedOrder?.id===id) setSelectedOrder(p => ({...p,...patch}));
    if (kpiEvent) setUsers(p => p.map(u => u.id===kpiEvent.userId ? {...u, kpi:Math.max(0,u.kpi+kpiEvent.delta)} : u));
  }
  function createOrder(data) {
    setOrders(p => [data, ...p]);
    if (data.assigned_to) {
      const ktv = users.find(u => u.id===data.assigned_to);
      setNotifications(n => [{ id:Math.random().toString(36), msg:`🔔 Đơn ${data.id} giao cho ${ktv?.name}. Quy trình KPI đã bắt đầu!`, time:new Date().toISOString() }, ...n.slice(0,9)]);
    }
    setCreatedOrder(data);
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
    const nameMatch = (o.customer_name||"").toLowerCase().includes(q);
    const phoneMatch = (o.customer_phone||"").includes(q);
    const c = MOCK_CUSTOMERS.find(x => x.id===o.customer_id);
    const mockNameMatch = (c?.full_name||"").toLowerCase().includes(q);
    const mockPhoneMatch = (c?.phone||"").includes(q);
    const deviceMatch = (o.device_model||"").toLowerCase().includes(q);
    const idMatch = (o.id||"").toLowerCase().includes(q);
    const qrMatch = (o.qr_code||"").toLowerCase().includes(q);
    const imeiMatch = (o.imei_serial||"").includes(q);
    const noteMatch = (o.notes||"").toLowerCase().includes(q);
    return nameMatch || phoneMatch || mockNameMatch || mockPhoneMatch || deviceMatch || idMatch || qrMatch || imeiMatch || noteMatch;
  });
  const pendingAccepts = orders.filter(o => o.assigned_to===user.id && (o.accept_stage||0)<2 && o.assigned_at && !["Hoàn Thành","Đã Giao"].includes(o.status));

  const navItems = [
    ...(user.role==="manager"?[{key:"dashboard",icon:"📊",label:"Tổng quan"}]:[]),
    ...(user.role!=="technician"?[{key:"board",icon:"📋",label:"Bảng theo dõi"},{key:"new",icon:"➕",label:"Tạo đơn mới"}]:[]),
    {key:"tasks",icon:"✅",label:user.role==="manager"?"Tất cả việc":"Việc của tôi"},
    ...(user.role!=="receptionist"?[{key:"kpi",icon:"🏆",label:"KPI Kỹ thuật"}]:[]),
    ...(user.role!=="technician"?[{key:"customers",icon:"👥",label:"Khách hàng"}]:[]),
    ...(user.role==="manager"?[{key:"staff",icon:"👨‍💼",label:"Nhân viên"},{key:"settings",icon:"⚙️",label:"Cài đặt"}]:[]),
  ];

  const Sidebar = () => (
    <div style={{ width:220, background:"#1e1b4b", height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"20px 16px", borderBottom:"1px solid rgba(255,255,255,.1)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:28 }}>🔧</div>
          <div><div style={{ color:"#fff", fontWeight:800, fontSize:15 }}>Sửa Chữa</div><div style={{ color:"#a5b4fc", fontSize:11 }}>Quản lý đơn hàng</div></div>
        </div>
      </div>
      <div style={{ flex:1, padding:"12px 0", overflowY:"auto" }}>
        {navItems.map(item => (
          <div key={item.key} onClick={() => { setPage(item.key); setSidebarOpen(false); }}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 20px", cursor:"pointer", background:page===item.key?"rgba(255,255,255,.12)":"transparent", borderLeft:page===item.key?"3px solid #a5b4fc":"3px solid transparent" }}>
            <span style={{ fontSize:18 }}>{item.icon}</span>
            <span style={{ color:page===item.key?"#fff":"#c7d2fe", fontWeight:page===item.key?700:400, fontSize:14 }}>{item.label}</span>
            {item.key==="tasks" && pendingAccepts.length>0 && user.role==="technician" && (
              <span style={{ marginLeft:"auto", background:"#ef4444", color:"#fff", fontSize:11, fontWeight:800, padding:"1px 7px", borderRadius:20 }}>{pendingAccepts.length}</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding:16, borderTop:"1px solid rgba(255,255,255,.1)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"#4f46e5", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, color:"#fff" }}>{user.name[0]}</div>
          <div>
            <div style={{ color:"#fff", fontWeight:700, fontSize:13 }}>{user.name}</div>
            <div style={{ color:"#a5b4fc", fontSize:11 }}>{ROLE_LABELS[user.role]} · KPI {users.find(u=>u.id===user.id)?.kpi}</div>
          </div>
        </div>
        <button onClick={() => setUser(null)} style={{ width:"100%", height:36, borderRadius:10, background:"rgba(239,68,68,.2)", border:"1px solid rgba(239,68,68,.4)", color:"#fca5a5", fontWeight:700, cursor:"pointer", fontSize:13 }}>🚪 Đăng xuất</button>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{`@media(min-width:1024px){.lg-sb{display:flex!important;flex-shrink:0}.mob-h{display:none!important}}`}</style>
      <div style={{ display:"none" }} className="lg-sb"><Sidebar /></div>
      {sidebarOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:500, display:"flex" }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.5)" }} onClick={() => setSidebarOpen(false)} />
          <div style={{ position:"relative", width:240 }}><Sidebar /></div>
        </div>
      )}

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Mobile header */}
        <div className="mob-h" style={{ background:"#1e1b4b", padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer" }}>☰</button>
          <span style={{ color:"#fff", fontWeight:800, flex:1, fontSize:16 }}>🔧 Sửa Chữa</span>
          <div style={{ width:32, height:32, borderRadius:"50%", background:"#4f46e5", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700 }}>{user.name[0]}</div>
        </div>

        {/* Topbar */}
        <div style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", padding:"10px 16px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm khách, SĐT, mã đơn, mã QR..."
            style={{ flex:1, minWidth:150, height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none" }} />
          <button onClick={() => setShowQRScan(true)}
            style={{ height:42, padding:"0 14px", borderRadius:10, border:"1.5px solid #4f46e5", background:"#eef2ff", color:"#4f46e5", fontWeight:700, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>
            📷 Quét QR
          </button>
          {/* Notifications */}
          <div style={{ position:"relative" }}>
            <button onClick={() => setShowNotif(v => !v)}
              style={{ position:"relative", height:42, padding:"0 12px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#fff", cursor:"pointer", fontSize:18 }}>
              🔔{notifications.length>0 && <span style={{ position:"absolute", top:-4, right:-4, background:"#ef4444", color:"#fff", fontSize:10, fontWeight:800, padding:"1px 5px", borderRadius:20 }}>{notifications.length}</span>}
            </button>
            {showNotif && (
              <>
                {/* Overlay bấm ngoài → đóng */}
                <div style={{ position:"fixed", inset:0, zIndex:299 }} onClick={() => setShowNotif(false)} />
                <div style={{ position:"absolute", right:0, top:48, width:300, background:"#fff", borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,.18)", border:"1px solid #e5e7eb", zIndex:300, overflow:"hidden" }}>
                  <div style={{ padding:"12px 16px", fontWeight:800, borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span>🔔 Thông báo</span>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      {notifications.length>0 && <button onClick={() => setNotifications([])} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:12, fontWeight:700 }}>Xoá hết</button>}
                      <button onClick={() => setShowNotif(false)} style={{ background:"#f3f4f6", border:"none", width:26, height:26, borderRadius:"50%", cursor:"pointer", fontSize:13 }}>✕</button>
                    </div>
                  </div>
                  {notifications.length===0
                    ? <div style={{ padding:24, textAlign:"center", color:"#9ca3af", fontSize:13 }}>
                        <div style={{ fontSize:32, marginBottom:8 }}>🔕</div>Không có thông báo
                      </div>
                    : notifications.map(n => (
                      <div key={n.id} style={{ padding:"12px 16px", borderBottom:"1px solid #f9fafb", fontSize:13, display:"flex", gap:10, alignItems:"flex-start" }}>
                        <span style={{ fontSize:18, flexShrink:0 }}>🔔</span>
                        <div>
                          <div style={{ fontWeight:600, lineHeight:1.4 }}>{n.msg}</div>
                          <div style={{ color:"#9ca3af", fontSize:11, marginTop:2 }}>{timeAgo(n.time)}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
          {user.role !== "technician" && (
            <button onClick={() => setShowNewOrder(true)}
              style={{ height:42, padding:"0 16px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer", whiteSpace:"nowrap" }}>
              ＋ Tạo đơn
            </button>
          )}
        </div>

        {/* Pending alert */}
        {user.role==="technician" && pendingAccepts.length>0 && (
          <div style={{ background:"#fef2f2", borderBottom:"2px solid #fca5a5", padding:"10px 16px", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:18 }}>⚠️</span>
            <div style={{ flex:1 }}><span style={{ fontWeight:800, color:"#dc2626", fontSize:14 }}>Bạn có {pendingAccepts.length} đơn đang chờ bấm Nhận máy!</span></div>
            <button onClick={goToPendingAccept} style={{ background:"#dc2626", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontWeight:800, cursor:"pointer", fontSize:14 }}>Xem ngay →</button>
          </div>
        )}

        {/* ── CONTENT ── */}
        <div style={{ flex:1, overflowY:"auto", padding:16, background:"#f3f4f6" }}>

          {/* DASHBOARD */}
          {page==="dashboard" && (
            <div>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:16 }}>📊 Tổng Quan</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:12, marginBottom:20 }}>
                {[
                  {l:"Tổng đơn",v:orders.length,c:"#4f46e5"},
                  {l:"Đang xử lý",v:orders.filter(o=>["Mới Nhận","Đang Sửa","Chờ Linh Kiện"].includes(o.status)).length,c:"#d97706"},
                  {l:"Hoàn thành",v:orders.filter(o=>o.status==="Hoàn Thành").length,c:"#059669"},
                  {l:"Đã giao",v:orders.filter(o=>o.status==="Đã Giao").length,c:"#2563eb"},
                ].map(s => (
                  <div key={s.l} style={{ background:"#fff", borderRadius:14, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,.06)", borderTop:`3px solid ${s.c}` }}>
                    <div style={{ fontSize:12, color:"#6b7280", marginBottom:2 }}>{s.l}</div>
                    <div style={{ fontSize:30, fontWeight:900, color:s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:"#fff", borderRadius:16, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ fontWeight:700, marginBottom:12 }}>🕐 Đơn gần đây</div>
                {orders.slice(0,8).map(o => {
                  const c = MOCK_CUSTOMERS.find(x => x.id===o.customer_id) || (o.customer_name ? { full_name:o.customer_name, phone:o.customer_phone } : null);
                  const col = STATUS_COLS.find(s => s.key===o.status);
                  return (
                    <div key={o.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #f3f4f6", cursor:"pointer" }} onClick={() => setSelectedOrder(o)}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:14 }}>{c?.full_name} — {o.device_model}</div>
                        <div style={{ fontSize:12, color:"#818cf8" }}>{o.id}{o.qr_code ? ` · QR: ${o.qr_code}` : ""} · {timeAgo(o.created)}</div>
                      </div>
                      <span style={{ fontSize:11, background:col?.bg, color:col?.color, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>{col?.icon} {o.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* KPI */}
          {page==="kpi" && <KPIPage users={users} orders={orders} />}

          {/* BOARD */}
          {page==="board" && (
            <div>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:16 }}>📋 Bảng Theo Dõi</div>
              <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:12, alignItems:"flex-start" }}>
                {STATUS_COLS.map(col => {
                  const colOrders = filtered.filter(o => o.status===col.key);
                  return (
                    <div key={col.key} style={{ flexShrink:0, width:280 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        <span style={{ fontSize:18 }}>{col.icon}</span>
                        <span style={{ fontWeight:800, fontSize:14, color:"#374151", flex:1 }}>{col.key}</span>
                        <span style={{ background:"#fff", border:"1px solid #e5e7eb", fontSize:12, fontWeight:700, padding:"1px 8px", borderRadius:20, color:"#6b7280" }}>{colOrders.length}</span>
                      </div>
                      <div style={{ minHeight:60 }}>
                        {colOrders.map(o => {
                          const cust = MOCK_CUSTOMERS.find(c => c.id===o.customer_id) || (o.customer_name ? { full_name:o.customer_name, phone:o.customer_phone } : null);
                          const needsAction = o.assigned_to===user.id && (o.accept_stage||0)<2 && o.assigned_at;
                          return (
                            <div key={o.id} onClick={() => setSelectedOrder(o)}
                              style={{ background:"#fff", borderRadius:14, padding:14, border:`1.5px solid ${needsAction?"#fca5a5":"#f3f4f6"}`, marginBottom:10, cursor:"pointer", boxShadow:highlightId===o.id?"0 0 0 3px #4f46e5":"0 1px 4px rgba(0,0,0,.06)", transition:"box-shadow .4s" }}>
                              {needsAction && <div style={{ background:"#fef2f2", borderRadius:8, padding:"4px 8px", marginBottom:6, fontSize:12, color:"#dc2626", fontWeight:700 }}>⚠️ Cần nhận máy!</div>}
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                                <div>
                                  <div style={{ fontWeight:800, fontSize:14 }}>{cust?.full_name}</div>
                                  <div style={{ fontSize:11, color:"#818cf8" }}>{o.id}{o.qr_code ? ` · ${o.qr_code}` : ""}</div>
                                </div>
                              </div>
                              <div style={{ fontSize:13, fontWeight:600, color:"#374151", marginBottom:4 }}>📱 {o.device_model}</div>
                              {o.issues.length>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:4 }}>{o.issues.slice(0,2).map(i => <span key={i} style={{ fontSize:11, background:"#f3f4f6", padding:"2px 8px", borderRadius:20 }}>{i}</span>)}</div>}
                              <div style={{ fontSize:11, color:"#9ca3af" }}>{timeAgo(o.created)}</div>
                            </div>
                          );
                        })}
                        {colOrders.length===0 && <div style={{ border:"2px dashed #e5e7eb", borderRadius:14, padding:"20px 16px", textAlign:"center", color:"#d1d5db", fontSize:13 }}>Không có đơn</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NEW PAGE */}
          {page==="new" && user.role!=="technician" && (
            <div style={{ maxWidth:540, margin:"0 auto" }}>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:16 }}>➕ Tạo Đơn Mới</div>
              <div style={{ background:"#fff", borderRadius:20, padding:24, textAlign:"center" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
                <button onClick={() => setShowNewOrder(true)} style={{ width:"100%", height:56, background:"#4f46e5", color:"#fff", border:"none", borderRadius:14, fontSize:18, fontWeight:800, cursor:"pointer" }}>➕ Mở Form Tạo Đơn</button>
              </div>
            </div>
          )}

          {/* TASKS */}
          {page==="tasks" && (
            <div style={{ maxWidth:600, margin:"0 auto" }}>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
                {user.role==="manager" ? "📋 Tất cả việc" : "🔧 Việc của tôi"}
                <span style={{ background:"#4f46e5", color:"#fff", fontSize:13, padding:"2px 10px", borderRadius:20, fontWeight:700 }}>
                  {filtered.filter(o => o.status!=="Đã Giao").length}
                </span>
              </div>
              {pendingAccepts.length>0 && user.role==="technician" && (
                <div style={{ background:"#fef2f2", border:"2px solid #fca5a5", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                  <div style={{ fontWeight:800, color:"#dc2626", marginBottom:4 }}>⚠️ {pendingAccepts.length} đơn cần Nhận máy ngay!</div>
                </div>
              )}
              {filtered.map(order => {
                const cust = MOCK_CUSTOMERS.find(c => c.id===order.customer_id) || (order.customer_name ? { full_name:order.customer_name, phone:order.customer_phone } : null);
                const col = STATUS_COLS.find(s => s.key===order.status);
                const isHL = highlightId===order.id;
                const needAccept = order.assigned_to===user.id && (order.accept_stage||0)<2 && order.assigned_at;
                return (
                  <div key={order.id} onClick={() => setSelectedOrder(order)}
                    style={{ background:"#fff", borderRadius:14, padding:"14px 16px", marginBottom:10, cursor:"pointer", borderLeft:`4px solid ${col?.color}`, boxShadow:isHL?"0 0 0 3px #4f46e5,0 4px 24px rgba(79,70,229,.4)":"0 1px 4px rgba(0,0,0,.06)", transition:"box-shadow .4s" }}>
                    {needAccept && (
                      <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"6px 10px", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:16 }}>⚠️</span>
                        <span style={{ fontSize:13, color:"#dc2626", fontWeight:800 }}>Cần bấm nhận máy ngay!</span>
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:6 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:800, fontSize:15, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{cust?.full_name}</div>
                        <div style={{ fontSize:11, color:"#818cf8" }}>{order.id}{order.qr_code ? ` · ${order.qr_code}` : ""}</div>
                      </div>
                      <span style={{ fontSize:11, background:col?.bg, color:col?.color, padding:"3px 10px", borderRadius:20, fontWeight:700, flexShrink:0 }}>{col?.icon} {order.status}</span>
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, marginBottom:order.estimated_done?6:8, color:"#374151" }}>📱 {order.device_model}</div>
                    {order.estimated_done && <div style={{ fontSize:12, color:"#059669", fontWeight:600, marginBottom:8 }}>⏱️ Dự kiến: {new Date(order.estimated_done).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"})}</div>}
                    {/* KTV: chỉ hiện nút khi là đơn của mình, manager thấy hết */}
                    {(user.role === "manager") && (
                      <div onClick={e => e.stopPropagation()} style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {STATUS_COLS.filter(c => c.key!==order.status).map(c => (
                          <button key={c.key} onClick={() => updateOrder(order.id, {status:c.key}, c.key==="Hoàn Thành"?{userId:order.assigned_to,delta:2,note:"+2 KPI"}:null)}
                            style={{ padding:"8px 12px", borderRadius:9, border:`1.5px solid ${c.border}`, background:"#fff", color:c.color, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                            {c.icon} {c.key}
                          </button>
                        ))}
                      </div>
                    )}
                    {user.role === "technician" && (
                      <div style={{ fontSize:12, color:"#9ca3af", fontStyle:"italic" }}>👆 Bấm vào đơn để xem chi tiết và cập nhật</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* CUSTOMERS */}
          {page==="customers" && (
            <div>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:16 }}>👥 Quản Lý Khách Hàng</div>
              <div style={{ background:"#fff", borderRadius:16, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)", marginBottom:12 }}>
                <input placeholder="🔍 Tìm tên, SĐT khách hàng..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              </div>
              {MOCK_CUSTOMERS.filter(c =>
                c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
              ).map(cust => {
                const custOrders = orders.filter(o => o.customer_id === cust.id);
                return (
                  <div key={cust.id} style={{ background:"#fff", borderRadius:14, padding:"14px 16px", marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:16 }}>👤 {cust.full_name}</div>
                        <div style={{ fontSize:13, color:"#6b7280", marginTop:3 }}>📞 {cust.phone}</div>
                        {cust.address && <div style={{ fontSize:13, color:"#6b7280" }}>📍 {cust.address}</div>}
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ background:"#eef2ff", color:"#4f46e5", fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:20 }}>
                          {custOrders.length} đơn
                        </div>
                      </div>
                    </div>
                    {custOrders.length > 0 && (
                      <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #f3f4f6" }}>
                        <div style={{ fontSize:12, color:"#9ca3af", marginBottom:6 }}>Đơn gần đây:</div>
                        {custOrders.slice(0,3).map(o => {
                          const col = STATUS_COLS.find(s => s.key===o.status);
                          return (
                            <div key={o.id} onClick={() => setSelectedOrder(o)}
                              style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", cursor:"pointer", borderBottom:"1px solid #f9fafb" }}>
                              <div>
                                <div style={{ fontSize:13, fontWeight:700 }}>{o.device_model}</div>
                                <div style={{ fontSize:11, color:"#818cf8" }}>{o.id}</div>
                              </div>
                              <span style={{ fontSize:11, background:col?.bg, color:col?.color, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>{col?.icon} {o.status}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* STAFF MANAGEMENT */}
          {page==="staff" && user.role==="manager" && (
            <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#6b7280"}}>⏳ Đang tải...</div>}>
              <StaffManagerPage currentStaff={user} />
            </Suspense>
          )}

          {/* SETTINGS */}
          {page==="settings" && user.role==="manager" && (
            <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#6b7280"}}>⏳ Đang tải...</div>}>
              <SettingsPage />
            </Suspense>
          )}

        </div>
      </div>

      {/* Modals */}
      {selectedOrder && <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} currentUser={user} onUpdate={updateOrder} users={users} onShowQR={setQrOrder} />}
      {showNewOrder && <NewOrderModal onClose={() => setShowNewOrder(false)} onCreate={createOrder} users={users} orders={orders} />}
      {qrOrder && <QRPrintModal order={qrOrder} onClose={() => setQrOrder(null)} />}
      {showQRScan && <QRScanModal onClose={() => setShowQRScan(false)} onFound={handleGlobalQRScan} orders={orders} mode="search" />}
      {/* Toast xác nhận tạo đơn */}
      {createdOrder && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", zIndex:5000, background:"#1e1b4b", color:"#fff", borderRadius:20, padding:"16px 24px", boxShadow:"0 8px 32px rgba(0,0,0,.35)", display:"flex", flexDirection:"column", alignItems:"center", gap:6, minWidth:280, maxWidth:360, animation:"slideUp .3s ease" }}>
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          <div style={{ fontSize:36 }}>🎉</div>
          <div style={{ fontWeight:800, fontSize:17 }}>Tạo đơn thành công!</div>
          <div style={{ fontSize:14, color:"#a5b4fc", fontWeight:600 }}>{createdOrder.id}</div>
          <div style={{ fontSize:13, color:"#c7d2fe" }}>👤 {createdOrder.customer_name||""} · 📱 {createdOrder.device_model}</div>
          {createdOrder.assigned_to && (() => { const u = MOCK_USERS.find(x=>x.id===createdOrder.assigned_to); return <div style={{ fontSize:13, color:"#fcd34d" }}>⏰ Đã giao {u?.name} — Quy trình KPI đã bắt đầu!</div>; })()}
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button onClick={() => { setSelectedOrder(createdOrder); setCreatedOrder(null); }}
              style={{ padding:"8px 18px", borderRadius:10, background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 }}>
              Xem đơn
            </button>
            <button onClick={() => setCreatedOrder(null)}
              style={{ padding:"8px 18px", borderRadius:10, background:"#4f46e5", border:"none", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 }}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
