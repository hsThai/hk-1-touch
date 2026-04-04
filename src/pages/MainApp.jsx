/* v4-loginv2-real-db */
import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, Customer } from "./pb.jsx";
import { uploadFile } from "./pb.jsx";
import { getNotifSound } from "./Settings";
const SparePartModal = lazy(() => import("./SparePartModal").catch(() => ({ default: ({ onClose }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:"#fff",borderRadius:16,padding:32,textAlign:"center"}}>
      <div style={{fontSize:32}}> </div>
      <div style={{fontWeight:700,marginTop:8}}>Module không tải được</div>
      <button onClick={onClose} style={{marginTop:16,padding:"10px 24px",background:"#4f46e5",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>Đóng</button>
    </div>
  </div>
)})));
const StaffManagerPage = lazy(() => import("./StaffManager").catch(() => ({ default: () => (
  <div style={{padding:32,textAlign:"center"}}>
    <div style={{fontSize:32}}> </div>
    <div style={{fontWeight:700,marginTop:8}}>Module không tải được</div>
  </div>
)})));
const SettingsPage = lazy(() => import("./Settings").catch(() => ({ default: () => (
  <div style={{padding:32,textAlign:"center"}}>
    <div style={{fontSize:32}}> </div>
    <div style={{fontWeight:700,marginTop:8}}>Module không tải được</div>
  </div>
)})));


// Components loaded from OrderComponents
import { QRScanModal } from"./QRComponents";
import { MediaViewer, AcceptChecklistModal, AcceptTimer, timeAgo, genOrderId, getKpiTimerInfo, STATUS_PB, STATUS_DISPLAY, PRIORITY_PB, PRIORITY_DISPLAY, STATUS_COLS } from "./MediaViewer";
import { OrderDrawer } from "./OrderDrawer";
import { NewOrderModal, KPIPage, ProductHistoryModal } from "./OrderForms";
import LoginPage, { showSystemNotif, requestNotifPermission } from "./LoginV2";
import ChangePassword from "./ChangePassword";

const _BUILD_V4 = "loginv2-real-db";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight:"100vh", background:"#1e1b4b", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", padding:24 }}>
          <div style={{ fontSize:48, marginBottom:16 }}> </div>
          <div style={{ color:"#fff", fontWeight:800, fontSize:18, marginBottom:8 }}>Ứng dụng gặp lỗi</div>
          <div style={{ color:"#c7d2fe", fontSize:13, textAlign:"center", marginBottom:20, fontFamily:"monospace", background:"rgba(255,255,255,.1)", padding:12, borderRadius:10, maxWidth:400, wordBreak:"break-all" }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          <button onClick={() => { this.setState({error:null}); window.location.reload(); }}
            style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:12, padding:"12px 28px", fontSize:16, fontWeight:700, cursor:"pointer"}}>
              Tải lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainAppInner() {
  const [user, setUser] = useState(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [page, setPage] = useState("board");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Global: chặn chọn chữ toàn app ──────────────────────
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "hkapp-no-select";
    style.textContent = `
      * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }
      input, textarea, [contenteditable] { -webkit-user-select: text !important; user-select: text !important; }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("hkapp-no-select")?.remove(); };
  }, []);

  // ── Chặn nút Back + Android gesture back ─────────────────
  useEffect(() => {
    // Nhồi nhiều state vào history để gesture back phải "tiêu thụ" hết
    // trước khi thoát được app (Android cần ít nhất 2-3 state)
    const STACK = 5;
    for (let i = 0; i < STACK; i++) {
      window.history.pushState({ hkapp: i }, "");
    }

    const onPop = () => {
      // Luôn push lại ngay để duy trì stack
      window.history.pushState({ hkapp: true }, "");

      // Xử lý navigation nội bộ
      if (selectedOrder) { setSelectedOrder(null); return; }
      if (sidebarOpen)   { setSidebarOpen(false);  return; }
      if (page !== "board" && page !== "tasks") {
        setPage(user?.role === "technician" ? "tasks" : "board");
      }
    };

    // pageshow bắt được cả trường hợp Android bfcache restore
    const onPageShow = (e) => {
      if (e.persisted) {
        for (let i = 0; i < STACK; i++) window.history.pushState({ hkapp: i }, "");
      }
    };

    // visibilitychange: khi app quay lại foreground, refill stack
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        for (let i = 0; i < STACK; i++) window.history.pushState({ hkapp: i }, "");
      }
    };

    window.addEventListener("popstate", onPop);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [selectedOrder, sidebarOpen, page, user]);
  const [notifications, setNotifications] = useState([]);
  const [dbNotifications, setDbNotifications] = useState([]); // từ PocketBase
  const [showNotif, setShowNotif] = useState(false);

  // Poll DB notifications cho user hiện tại mỗi 15s
  // Ref lưu ID thông báo đã thấy, tránh show lại
  const seenNotifIds = useRef(new Set());

  useEffect(() => {
    if (!user?.id) return;
    // Xin quyền thông báo hệ thống
    requestNotifPermission().catch(() => {});

    const fetchNotifs = async () => {
      try {
        const list = await Notification.filter({ user_id: user.id, is_read: false });
        const sorted = list.sort((a,b) => new Date(b.created_date)-new Date(a.created_date));
        setDbNotifications(sorted);

        // Phát thông báo hệ thống HĐH cho các thông báo mới chưa thấy
        const master = await getNotifSound("notif_sound_master").catch(()=>"on");
        if (master !== "off") {
          for (const n of sorted) {
            if (!seenNotifIds.current.has(n.id)) {
              seenNotifIds.current.add(n.id);
              // Chỉ show system notif cho thông báo mới (dưới 5 phút)
              const age = Date.now() - new Date(n.created_date).getTime();
              if (age < 300000) {
                showSystemNotif(n.title || "HK One Touch", n.message || "", {
                  tag: n.id,
                  data: { order_id: n.order_id }
                });
                // Phát âm thanh app
                try {
                  const soundKey = await getNotifSound(
                    n.type === "mention" ? "notif_sound_chat" : "notif_sound_assign"
                  );
                  if (soundKey && soundKey !== "none") {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator(); const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(880, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
                    gain.gain.setValueAtTime(0.5, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                    osc.start(); osc.stop(ctx.currentTime + 0.5);
                  }
                } catch {}
              }
            }
          }
        }
      } catch {}
    };
    fetchNotifs();
    const iv = setInterval(fetchNotifs, 15000);
    return () => clearInterval(iv);
  }, [user?.id]);
  const [qrOrder, setQrOrder] = useState(null);
  const [showQRScan, setShowQRScan] = useState(false);
  const [newOrderProductQR, setNewOrderProductQR] = useState("");
  const [highlightId, setHighlightId] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null); // toast xác nhận tạo đơn
  const [productHistory, setProductHistory] = useState(null);

  // ── Load real data from entities ──────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        setDataLoading(true);
        // Staff lấy từ Base44 entities (nguồn chính)
        // RepairOrder lấy từ PocketBase local
        const [staffList, orderList] = await Promise.all([
          Staff.list().catch(async () => {
            // Fallback về PocketBase nếu B44 lỗi
            return [];
          }),
          RepairOrder.list({ sort: "-received_date", limit: 200 }).catch(() => []),
        ]);
        const mappedUsers = staffList.map(s => ({
          id: s.id,
          _id: s.id,
          name: s.full_name,
          full_name: s.full_name,
          username: s.username,
          password: s.password_hash,
          role: s.role,
          kpi: s.kpi_score || 0,
          phone: s.phone || "",
          note: s.note || "",
          is_active: s.is_active !== false,
          avatar_url: s.avatar_url || "",
          must_change_password: s.must_change_password || false,
        }));
        const mappedOrders = orderList.map(o => ({
          id: o.order_code || o.id,
          _id: o.id,             // PocketBase real ID để update/delete
          _pbSaved: true,
          customer_id: o.customer_name,
          device_model: o.device_model || o.device_name || "",
          imei_serial: o.imei || "",
          passcode: "",
          issues: o.issue_description
            ? o.issue_description.split(/[,;]/).map(s=>s.trim()).filter(Boolean)
            : [],
          status: STATUS_DISPLAY[o.status] || o.status || "Mới Nhận",
          notes: o.technician_note || "",
          assigned_to: o.assigned_to || "",
          assigned_to_name: o.assigned_to_name || "",
          assigned_at: o.received_date || o.created_date,
          accept_stage: (o.status==="Hoan Thanh"||o.status==="Da Giao"||o.status==="Hoàn Thành"||o.status==="Đã Giao") ? 3 : 0,
          created: o.received_date || o.created_date,
          images: o.images || [],
          videos: o.videos || [],
          qr_code: o.order_code || "",
          product_qr: o.product_qr || "",
          customer_name: o.customer_name || "",
          customer_phone: o.customer_phone || "",
          estimated_cost: o.estimated_cost || 0,
          final_cost: o.final_cost || 0,
          deposit: o.deposit || 0,
          warranty_days: o.warranty_days || 0,
          priority: PRIORITY_DISPLAY[o.priority] || o.priority || "Bình thường",
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
          if (["Hoàn Thành","Đã Giao","Hoan Thanh","Da Giao"].includes(o.status)) return o;
          const assignedAt = new Date(o.assigned_at).getTime();
          let patch = {};

          // Mốc 1: T=60' — chưa cập nhật lần 1, chưa bị trừ
          if ((o.accept_stage||0) === 0 && !o.kpi_stage1_penalized && now >= assignedAt + 60*60000) {
            patch.kpi_stage1_penalized = true;
            kpiChanges.push({ userId: o.assigned_to, delta: -1 });
            notifMsgs.push(`  Đơn ${o.id}: KTV quá 60 phút chưa Nhận máy → -1 KPI`);
            changed = true;
          }

          // Mốc 2: T=120' — chưa cập nhật lần 2, chưa bị trừ
          if ((o.accept_stage||0) < 2 && !o.kpi_stage2_penalized && now >= assignedAt + 120*60000) {
            patch.kpi_stage2_penalized = true;
            patch.needs_reassign = true;
            kpiChanges.push({ userId: o.assigned_to, delta: -3 });
            notifMsgs.push(`  Đơn ${o.id}: KTV quá 120 phút → -3 KPI. Quản lý cần xử lý!`);
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
      <div style={{ fontSize:56 }}> </div>
      <div style={{ color:"#fff", fontWeight:800, fontSize:20 }}>Đang tải hệ thống...</div>
      <div style={{ color:"#c7d2fe", fontSize:14 }}>⏳ Vui lòng chờ</div>
    </div>
  );
  const doLogout = () => {
    setUser(null);
    setLoggedOut(true);
    setSidebarOpen && setSidebarOpen(false);
  };
  if (!user) return <LoginPage onLogin={u => { setUser(u); setLoggedOut(false); setPage(u.role==="technician"?"tasks":u.role==="receptionist"?"new":"dashboard"); }} loggedOut={loggedOut} />;
  if (user.must_change_password) return <ChangePassword user={user} forceChange={true} onSuccess={() => setUser(u => ({...u, must_change_password: false}))} />;

  async function updateOrder(id, patch, kpiEvent) {
    setOrders(p => p.map(o => o.id===id ? {...o,...patch} : o));
    if (selectedOrder?.id===id) setSelectedOrder(p => ({...p,...patch}));
    if (kpiEvent) setUsers(p => p.map(u => u.id===kpiEvent.userId ? {...u, kpi:Math.max(0,u.kpi+kpiEvent.delta)} : u));

    // Lưu xuống PocketBase (dùng _id thật)
    try {
      const order = orders.find(o => o.id === id);
      const pbId = order?._id;
      if (!pbId) return; // đơn chưa lưu vào PB
      // Map patch field sang schema PocketBase
      const pbPatch = {};
      if (patch.status         !== undefined) pbPatch.status          = STATUS_PB[patch.status] || patch.status;
      if (patch.assigned_to    !== undefined) pbPatch.assigned_to     = patch.assigned_to;
      if (patch.notes          !== undefined) pbPatch.technician_note  = patch.notes;
      if (patch.technician_note!== undefined) pbPatch.technician_note  = patch.technician_note;
      if (patch.estimated_cost !== undefined) pbPatch.estimated_cost   = patch.estimated_cost;
      if (patch.final_cost     !== undefined) pbPatch.final_cost       = patch.final_cost;
      if (patch.priority       !== undefined) pbPatch.priority         = PRIORITY_PB[patch.priority] || patch.priority;
      if (patch.images         !== undefined) pbPatch.images           = patch.images;
      if (patch.accept_stage   !== undefined) pbPatch.status           = pbPatch.status || (patch.status ? STATUS_PB[patch.status] : null) || STATUS_PB[order?.status] || order?.status;
      if (Object.keys(pbPatch).length > 0) {
        await RepairOrder.update(pbId, pbPatch);
      }
      if (kpiEvent) {
        const staffRec = users.find(u => u.id === kpiEvent.userId);
        if (staffRec?._id) {
          await Staff.update(staffRec._id, { kpi_score: Math.max(0, (staffRec.kpi||0) + kpiEvent.delta) });
        }
      }
    } catch(e) {
      console.warn("updateOrder PB error:", e.message);
    }
  }
  async function createOrder(data) {
    // Lưu vào PocketBase
    try {
      const pbData = {
        order_code:       data.id,
        customer_name:    data.customer_name || "",
        customer_phone:   data.customer_phone || "",
        device_name:      data.device_model || "",
        device_model:     data.device_model || "",
        imei:             data.imei_serial || "",
        product_qr:       data.product_qr || "",
        issue_description: Array.isArray(data.issues) ? data.issues.join(", ") : (data.notes || ""),
        status:           STATUS_PB["Mới Nhận"],
        assigned_to:      data.assigned_to || null,
        received_date:    new Date().toISOString(),
        images:           data.images || [],
        technician_note:  data.notes || "",
        warranty_days:    0,
        priority:         PRIORITY_PB["Bình thường"],
      };
      const saved = await RepairOrder.create(pbData);
      // Gắn _id thật từ PocketBase vào data
      data._id = saved.id;
      data._pbSaved = true;
    } catch(e) {
      console.error("Lỗi lưu PocketBase:", e);
      alert("Không lưu được đơn vào database! Kiểm tra kết nối PocketBase.");
      return;
    }

    setOrders(p => [data, ...p]);
    if (data.assigned_to) {
      const ktv = users.find(u => u.id===data.assigned_to);
      setNotifications(n => [{ id:Math.random().toString(36), msg:`  Đơn ${data.id} giao cho ${ktv?.name}. Quy trình KPI đã bắt đầu!`, time:new Date().toISOString() }, ...n.slice(0,9)]);
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
    if (result.type === "product_history") {
      setProductHistory(result);
    } else if (result.type === "assign_qr") {
      // QR chưa có → gán cho đơn vừa quét (mở form tạo đơn với product_qr điền sẵn)
      setNewOrderProductQR(result.qr);
      setShowNewOrder(true);
    } else if (result.type === "order") {
      setSelectedOrder(result.data);
    }
  }

  const myOrders = user.role==="technician" ? orders.filter(o => o.assigned_to===user.id) : orders;
  const filtered = myOrders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase().trim();
    const nameMatch = (o.customer_name||"").toLowerCase().includes(q);
    const phoneMatch = (o.customer_phone||"").includes(q);
    const deviceMatch = (o.device_model||"").toLowerCase().includes(q);
    const idMatch = (o.id||"").toLowerCase().includes(q);
    const qrMatch = (o.qr_code||"").toLowerCase().includes(q);
    const imeiMatch = (o.imei_serial||"").includes(q);
    const noteMatch = (o.notes||"").toLowerCase().includes(q);
    return nameMatch || phoneMatch || deviceMatch || idMatch || qrMatch || imeiMatch || noteMatch;
  });
  const pendingAccepts = orders.filter(o => o.assigned_to===user.id && (o.accept_stage||0)<2 && o.assigned_at && !["Hoàn Thành","Đã Giao"].includes(o.status));

  const navItems = [
    ...(user.role==="manager"?[{key:"dashboard",icon:"bar_chart",label:"Tổng quan"}]:[]),
    ...(user.role!=="technician"?[{key:"board",icon:"assignment",label:"Bảng theo dõi"},{key:"new",icon:"add",label:"Tạo đơn mới"}]:[]),
    {key:"tasks",icon:"check_circle",label:"Danh sách đơn"},
    ...(user.role!=="receptionist"?[{key:"kpi",icon:"emoji_events",label:"KPI Kỹ thuật"}]:[]),
    ...(user.role!=="technician"?[{key:"customers",icon:"group",label:"Khách hàng"}]:[]),
    ...(user.role==="admin"||user.role==="manager"?[{key:"staff",icon:"person",label:"Nhân viên"},{key:"settings",icon:"settings",label:"Cài đặt"}]:[]),
  ];

  // ── Kanban Board ─────────────────────────────────────────
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
                {colOrders.map(o => <OrderCard key={o.id} order={o} highlight={highlightId===o.id} onClick={() => setSelectedOrder(o)} users={users} />)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function OrderCard({ order: o, highlight, onClick, users }) {
    const ktv = users.find(u => u.id===o.assigned_to);
    const timerInfo = ktv ? getKpiTimerInfo(o) : null;
    return (
      <div onClick={onClick} style={{ background:"#fff", borderRadius:12, padding:12, marginBottom:8, cursor:"pointer", boxShadow:highlight?"0 0 0 3px #f59e0b":"0 1px 4px rgba(0,0,0,.08)", border:highlight?"2px solid #f59e0b":"2px solid transparent", transition:"box-shadow .2s" }}>
        <div style={{ fontWeight:800, fontSize:13, color:"#1e1b4b", marginBottom:4 }}>{o.id}</div>
        <div style={{ fontSize:12, color:"#374151", marginBottom:2 }}>  {o.customer_name||"?"} · {o.customer_phone||""}</div>
        <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>  {o.device_model}</div>
        {o.issues?.length>0 && <div style={{ fontSize:11, color:"#7c3aed", marginBottom:4 }}>{o.issues.slice(0,2).join(" · ")}</div>}
        {ktv && <div style={{ fontSize:11, color:"#059669", marginBottom:timerInfo?4:0 }}>  {ktv.name}</div>}
        {timerInfo && (
          <div style={{ fontSize:11, color:timerInfo.urgent?"#dc2626":"#d97706", fontWeight:700 }}>
            ⏱ {timerInfo.label}: {timerInfo.timeStr}
          </div>
        )}
      </div>
    );
  }

  // ── Tasks list ───────────────────────────────────────────
  function TaskList() {
    const list = user.role==="technician" ? filtered : filtered.filter(o => !["Đã Giao"].includes(o.status));
    return (
      <div style={{ padding:"0 16px 80px" }}>
        {pendingAccepts.length > 0 && user.role==="technician" && (
          <div style={{ background:"#fef3c7", borderRadius:14, padding:14, marginBottom:12, border:"2px solid #fcd34d" }}>
            <div style={{ fontWeight:800, color:"#d97706" }}>⏰ Có {pendingAccepts.length} đơn cần xác nhận!</div>
            <div style={{ fontSize:12, color:"#92400e", marginTop:4 }}>Nhớ cập nhật trạng thái để tránh bị trừ KPI nhé!</div>
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
              <div style={{ fontSize:13, color:"#374151", marginBottom:2 }}>  {o.customer_name} ·   {o.device_model}</div>
              {ktv && <div style={{ fontSize:12, color:"#6b7280"}}>  {ktv.name}</div>}
              {timerInfo && <div style={{ fontSize:12, color:timerInfo.urgent?"#dc2626":"#d97706", fontWeight:700, marginTop:4 }}>⏱ {timerInfo.label}: {timerInfo.timeStr}</div>}
              {o.needs_reassign && <div style={{ fontSize:12, color:"#ef4444", fontWeight:700, marginTop:4 }}>  Cần chuyển KTV khác!</div>}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Customer List ─────────────────────────────────────────
  function CustomerList() {
    const custMap = {};
    orders.forEach(o => {
      if (o.customer_phone) {
        if (!custMap[o.customer_phone]) custMap[o.customer_phone] = { name:o.customer_name, phone:o.customer_phone, orders:0, lastOrder:o.created };
        custMap[o.customer_phone].orders++;
        if (o.created > custMap[o.customer_phone].lastOrder) custMap[o.customer_phone].lastOrder = o.created;
      }
    });
    const custs = Object.values(custMap).sort((a,b) => b.orders - a.orders);
    return (
      <div style={{ padding:"0 16px 80px" }}>

        {custs.length===0 && <div style={{ textAlign:"center", color:"#9ca3af", padding:40 }}>Chưa có khách hàng</div>}
        {custs.map(c => (
          <div key={c.phone} style={{ background:"#fff", borderRadius:14, padding:14, marginBottom:8, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
            <div style={{ fontWeight:800, fontSize:15 }}>{c.name}</div>
            <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>  {c.phone} · {c.orders} đơn</div>
          </div>
        ))}
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────
  function Dashboard() {
    const stats = {
      total: orders.length,
      active: orders.filter(o=>!["Hoàn Thành","Đã Giao"].includes(o.status)).length,
      done: orders.filter(o=>o.status==="Hoàn Thành"||o.status==="Đã Giao").length,
      needsReassign: orders.filter(o=>o.needs_reassign).length,
    };
    const cards = [
      { label:"Tổng đơn", value:stats.total, icon:"assignment", bg:"#eef2ff", color:"#4f46e5" },
      { label:"Đang xử lý", value:stats.active, icon:"settings", bg:"#fffbeb", color:"#d97706" },
      { label:"Hoàn thành", value:stats.done, icon:"check_circle", bg:"#f0fdf4", color:"#059669" },
      { label:"Cần xử lý", value:stats.needsReassign, icon:"notifications_active", bg:"#fef2f2", color:"#dc2626" },
    ];
    return (
      <div style={{ padding:"0 16px 80px" }}>
        <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b", marginBottom:16 }}>  Tổng quan hôm nay</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {cards.map(c => (
            <div key={c.label} style={{ background:c.bg, borderRadius:16, padding:16, textAlign:"center" }}>
              <span className="material-icons" style={{fontSize:32,fontFamily:"Material Icons",verticalAlign:"middle",lineHeight:1,color:c.color}}>{c.icon}</span>
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
        <button onClick={() => setSidebarOpen(v=>!v)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:4 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>menu</span></button>
        <div style={{ flex:1, fontWeight:800, fontSize:16, color:"#fff"}}>HK One Touch</div>
        <div style={{ position:"relative" }}>
          <button onClick={() => setShowNotif(v=>!v)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:4 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>notifications</span>
            {(notifications.length+dbNotifications.length)>0 && <span style={{ position:"absolute", top:-2, right:-2, background:"#ef4444", color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{notifications.length+dbNotifications.length}</span>}
          </button>
        </div>
        <button onClick={() => setShowQRScan(true)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:4 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>qr_code_scanner</span></button>

      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:200 }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.4)" }} onClick={() => setSidebarOpen(false)} />
          <div style={{ position:"absolute", left:0, top:0, bottom:0, width:260, background:"#fff", boxShadow:"4px 0 20px rgba(0,0,0,.15)", display:"flex", flexDirection:"column" }}>
            <div style={{ background:"#1e1b4b", padding:24, color:"#fff" }}>
              <div style={{ fontSize:40 }}>{user.avatar_url ? <img src={user.avatar_url} style={{width:48,height:48,borderRadius:"50%"}} alt="" /> : <span className="material-icons" style={{fontSize:48,fontFamily:"Material Icons",color:"#9ca3af"}}>person</span>}</div>
              <div style={{ fontWeight:800, fontSize:16, marginTop:8 }}>{user.name}</div>
              <div style={{ fontSize:12, color:"#c7d2fe", marginTop:2 }}>{user.role} · KPI: {user.kpi}</div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:8 }}>
              {navItems.map(n => (
                <button key={n.key} onClick={() => { setPage(n.key); setSidebarOpen(false); }}
                  style={{ width:"100%", textAlign:"left", padding:"14px 16px", borderRadius:12, border:"none", background:page===n.key?"#eef2ff":"transparent", color:page===n.key?"#4f46e5":"#374151", fontWeight:page===n.key?800:500, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", gap:10, marginBottom:2 }}>
                  <span className="material-icons" style={{fontSize:20,fontFamily:"Material Icons",verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>{n.icon}</span> {n.label}
                </button>
              ))}
            </div>
            <div style={{ padding:16, borderTop:"1px solid #f3f4f6", display:"flex", flexDirection:"column", gap:8 }}>
              <button onClick={doLogout} style={{ width:"100%", padding:14, background:"#fef2f2", border:"none", borderRadius:12, color:"#dc2626", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>logout</span> Đăng xuất</button>
              <button onClick={doLogout} style={{ width:"100%", padding:12, background:"#f1f5f9", border:"none", borderRadius:12, color:"#475569", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>power_settings_new</span> Thoát</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification panel */}
      {showNotif && (
        <div style={{ position:"fixed", inset:0, zIndex:300 }}>
          <div style={{ position:"absolute", inset:0 }} onClick={() => setShowNotif(false)} />
          <div style={{ position:"absolute", top:60, right:8, width:320, background:"#fff", borderRadius:16, boxShadow:"0 8px 32px rgba(0,0,0,.2)", overflow:"hidden" }}>
            <div style={{ padding:"14px 16px", fontWeight:800, borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle",lineHeight:1}}>notifications</span> Thông báo</span>
              {(notifications.length+dbNotifications.length)>0 && (
                <button onClick={() => {
                  setNotifications([]);
                  dbNotifications.forEach(n => Notification.update(n.id, { is_read: true }).catch(()=>{}));
                  setDbNotifications([]);
                  setShowNotif(false);
                }} style={{ fontSize:11, background:"#f3f4f6", border:"none", borderRadius:8, padding:"4px 10px", cursor:"pointer", color:"#6b7280", fontWeight:600 }}>Đọc tất cả</button>
              )}
            </div>
            <div style={{ maxHeight:400, overflowY:"auto" }}>
              {notifications.length===0 && dbNotifications.length===0 && (
                <div style={{ padding:24, textAlign:"center", color:"#9ca3af", fontSize:13 }}>Không có thông báo mới</div>
              )}
              {/* Local notifications (KPI, assign) */}
              {notifications.map(n => (
                <div key={n.id} style={{ padding:"12px 16px", borderBottom:"1px solid #f9fafb", fontSize:13, display:"flex", gap:10, alignItems:"flex-start", background:"#fffbeb" }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:"#d97706",marginTop:1,flexShrink:0}}>info</span>
                  <div style={{ flex:1 }}>
                    <div>{n.msg}</div>
                    <div style={{ color:"#9ca3af", fontSize:11, marginTop:2 }}>{timeAgo(n.time)}</div>
                  </div>
                  <button onClick={() => setNotifications(p => p.filter(x=>x.id!==n.id))}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", padding:2, flexShrink:0 }}>
                    <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16}}>close</span>
                  </button>
                </div>
              ))}
              {/* DB notifications (mention, status change) */}
              {dbNotifications.map(n => (
                <div key={n.id} style={{ padding:"12px 16px", borderBottom:"1px solid #f9fafb", fontSize:13, display:"flex", gap:10, alignItems:"flex-start", background: n.type==="mention"?"#eef2ff":"#fff" }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:n.type==="mention"?"#4f46e5":"#059669",marginTop:1,flexShrink:0}}>
                    {n.type==="mention"?"alternate_email":n.type==="status_change"?"update":"notifications"}
                  </span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:12, marginBottom:2 }}>{n.title}</div>
                    <div style={{ color:"#374151" }}>{n.message}</div>
                    <div style={{ color:"#9ca3af", fontSize:11, marginTop:2 }}>{timeAgo(n.created_date)}</div>
                  </div>
                  <button onClick={() => {
                    Notification.update(n.id, { is_read: true }).catch(()=>{});
                    setDbNotifications(p => p.filter(x=>x.id!==n.id));
                  }} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", padding:2, flexShrink:0 }} title="Đánh dấu đã đọc">
                    <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16}}>done</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search + Tạo đơn bar (chỉ hiện ở board/tasks) */}
      {(page==="board"||page==="tasks") && (
        <div style={{ padding:"10px 16px 6px", display:"flex", gap:8, alignItems:"center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm..."
            style={{ flex:1, height:38, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none" }} />
          {user.role!=="technician" && (
            <button onClick={() => setShowNewOrder(true)}
              style={{ height:38, padding:"0 16px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:12, fontWeight:700, fontSize:14, cursor:"pointer", flexShrink:0 }}>
                Tạo
            </button>
          )}
        </div>
      )}

      {/* Main content */}
      <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}>
        {page==="board" && <KanbanBoard />}
        {page==="tasks" && <TaskList />}
        {page==="new" && <div style={{padding:16}}><button onClick={() => setShowNewOrder(true)} style={{ width:"100%", height:56, background:"#4f46e5", color:"#fff", border:"none", borderRadius:16, fontWeight:800, fontSize:16, cursor:"pointer"}}>  Tạo Đơn Mới</button></div>}
        {page==="kpi" && <KPIPage users={users} orders={orders} />}
        {page==="customers" && <CustomerList />}
        {page==="dashboard" && <Dashboard />}
        {page==="staff" && <StaffManagerPage />}
        {page==="settings" && <SettingsPage user={user} />}
      </Suspense>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"1px solid #e5e7eb", display:"flex", zIndex:50, paddingBottom:"env(safe-area-inset-bottom)" }}>
        {navItems.slice(0,5).map(n => (
          <button key={n.key} onClick={() => setPage(n.key)}
            style={{ flex:1, padding:"10px 4px", background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <span className="material-icons" style={{fontSize:22,fontFamily:"Material Icons",lineHeight:1}}>{n.icon}</span>
            <span style={{ fontSize:10, color:page===n.key?"#4f46e5":"#9ca3af", fontWeight:page===n.key?800:500 }}>{n.label}</span>
          </button>
        ))}
      </div>

      {/* Modals */}
      {showNewOrder && <NewOrderModal onClose={() => { setShowNewOrder(false); setNewOrderProductQR(""); }} onCreate={createOrder} users={users} orders={orders} initialProductQR={newOrderProductQR} />}
      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(id, patch, kpiEvent) => { updateOrder(id, patch, kpiEvent); }}
          onAcceptStage={(id, stage) => updateOrder(id, { accept_stage:stage, assigned_at: stage===1 ? new Date().toISOString() : selectedOrder.assigned_at })}
          users={users}
          currentUser={user}
          onGoToPendingAccept={goToPendingAccept}
        />
      )}

      {showQRScan && <QRScanModal onClose={() => setShowQRScan(false)} onFound={handleGlobalQRScan} orders={orders} />}
      {productHistory && (
        <ProductHistoryModal
          qr={productHistory.qr}
          orders={productHistory.orders}
          onClose={() => setProductHistory(null)}
          onOpenOrder={o => { setProductHistory(null); setSelectedOrder(o); }}
        />
      )}

      {/* Created order toast */}
      {createdOrder && (
        <div style={{ position:"fixed", bottom:80, left:16, right:16, zIndex:400, background:"#059669", borderRadius:16, padding:"14px 18px", color:"#fff", boxShadow:"0 8px 24px rgba(0,0,0,.2)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>
            <div style={{ fontWeight:800 }}>  Đã tạo đơn {createdOrder.id}</div>
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

export default function MainApp() { return <ErrorBoundary><MainAppInner /></ErrorBoundary>; }
