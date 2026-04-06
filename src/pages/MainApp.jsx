/* REBUILD_20260406_1408 */
/* v4-loginv2-real-db */
import React, { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, Customer, SparePart, StockExportRequest, StockImport, StockImportItem, getPbUrl, getAuth, subscribeCollection, logHistory } from "./pb.jsx";
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
import { QRScanModal, IMEIScanModal } from"./QRComponents";
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

// Helper: map raw PocketBase repair_orders record → app order object
function mapPbOrder(o, STATUS_DISPLAY, PRIORITY_DISPLAY) {
  const displayStatus = STATUS_DISPLAY[o.status] || o.status || "Chưa Nhận";
  return {
    // ── Identity ──
    id:              o.order_code || o.id,
    _id:             o.id,
    order_code:      o.order_code || "",
    _pbSaved:        true,
    // ── Customer / Device ──
    customer_id:     o.customer_id || o.customer_name || "",
    customer_name:   o.customer_name || "",
    customer_phone:  o.customer_phone || "",
    device_name:     o.device_name || "",
    device_model:    o.device_model || o.device_name || "",
    imei:            o.imei || "",
    imei_serial:     o.imei || "",
    passcode:        o.passcode || "",
    issue_description: o.issue_description || "",
    issues: o.issue_description
      ? o.issue_description.split(/[,;]/).map(s=>s.trim()).filter(Boolean)
      : [],
    // ── Status / Priority ──
    status:          displayStatus,
    priority:        PRIORITY_DISPLAY[o.priority] || o.priority || "Bình thường",
    // ── Assignment ──
    assigned_to:      o.assigned_to || "",
    assigned_to_name: o.assigned_to_name || "",
    assigned_at:      o.assigned_at || null,
    // Nếu PB chưa có accept_stage field, suy ra từ status
    accept_stage: o.accept_stage != null
      ? (o.accept_stage ?? 0)
      : (["Chua Nhan",""].includes(o.status||"") ? 0 : ["Moi Nhan"].includes(o.status||"") ? 1 : ["Dang Sua","Cho Linh Kien"].includes(o.status||"") ? 2 : ["Hoan Thanh","Da Giao"].includes(o.status||"") ? 3 : 0),
    stage1_at:        o.stage1_at || null,
    stage2_at:        o.stage2_at || null,
    checklist_done:   o.checklist_done || null,
    estimated_done:   o.estimated_done || null,
    estimated_done_date: o.estimated_done_date || null,
    needs_reassign:   o.needs_reassign || false,
    kpi_stage1_penalized: o.kpi_stage1_penalized || false,
    kpi_stage2_penalized: o.kpi_stage2_penalized || false,
    // ── Dates ──
    received_date:     o.received_date || o.created_date || "",
    done_date:         o.done_date || null,
    created:           o.received_date || o.created_date,
    created_date:      o.created_date || "",
    // ── Finance ──
    estimated_cost: o.estimated_cost || 0,
    final_cost:     o.final_cost || 0,
    deposit:        o.deposit || 0,
    warranty_days:  o.warranty_days || 0,
    // ── Notes ──
    notes:             o.technician_note || "",
    technician_note:   o.technician_note || "",
    // ── Media ──
    images:   o.images || [],
    videos:   o.videos || [],
    // ── QR ──
    qr_code:    o.order_code || "",
    product_qr: o.product_qr || "",
  };
}


// ── SwipeableNotif: vuốt trái để xóa thông báo ──────────────
function SwipeableNotif({ notif: n, onDelete, onClick }) {
  const [offsetX, setOffsetX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const startXRef = React.useRef(null);
  const startOffsetRef = React.useRef(0);
  const THRESHOLD = 80; // px cần vuốt để xóa

  const onTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    startOffsetRef.current = offsetX;
    setIsDragging(true);
  };
  const onTouchMove = (e) => {
    if (startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const newOffset = Math.min(0, startOffsetRef.current + dx); // chỉ vuốt trái
    setOffsetX(newOffset);
  };
  const onTouchEnd = () => {
    setIsDragging(false);
    if (offsetX < -THRESHOLD) {
      setOffsetX(-320); // bay ra ngoài
      setTimeout(onDelete, 200);
    } else {
      setOffsetX(0); // snap về
    }
    startXRef.current = null;
  };

  const bg = n.type === "mention" ? "#eef2ff" : "#fff";
  const iconName = n.type==="mention"?"chat":n.type==="status_change"?"update":"notifications";
  const iconColor = n.type==="mention"?"#4f46e5":"#059669";
  const deleteVisible = offsetX < -20;

  return (
    <div style={{ position:"relative", overflow:"hidden", borderBottom:"1px solid #f9fafb" }}>
      {/* Nền đỏ xóa phía sau */}
      <div style={{
        position:"absolute", inset:0, background:"#ef4444",
        display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:20,
        opacity: deleteVisible ? 1 : 0, transition:"opacity .15s"
      }}>
        <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,color:"#fff"}}>delete</span>
      </div>
      {/* Nội dung chính */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (Math.abs(offsetX) < 5) onClick(); }}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform .2s ease",
          padding:"12px 16px", fontSize:13, display:"flex", gap:10,
          alignItems:"flex-start", background: bg, cursor:"pointer",
          position:"relative", zIndex:1,
        }}
      >
        <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:iconColor,marginTop:1,flexShrink:0}}>{iconName}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:12, marginBottom:2 }}>{n.title}</div>
          <div style={{ color:"#374151" }}>{n.message}</div>
          <div style={{ color:"#9ca3af", fontSize:11, marginTop:2 }}>{timeAgo(n.created_at || n.created_date)}</div>
        </div>
        <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,color:"#9ca3af",marginTop:2,flexShrink:0}}>chevron_right</span>
      </div>
    </div>
  );
}

function MainAppInner() {
  const [user, setUser] = useState(null);
  const ordersRef = useRef([]); // luôn giữ latest orders snapshot
  const usersRef  = useRef([]); // luôn giữ latest users snapshot
  const kanbanScrollRef = useRef(null); // persist scroll qua re-render
  const kanbanScrollLeft = useRef(0);   // lưu vị trí scroll
  // ── Âm thanh thông báo ─────────────────────────
  const notifAudioRef = useRef(null);

  // ── Inject CSS animation vào document.head ──────────────
  useEffect(() => {
    // Remove old and re-inject to ensure latest version
    const old = document.getElementById("hk-pulse-red");
    if (old) old.remove();
    const el = document.createElement("style");
    el.id = "hk-pulse-red";
    el.textContent = `
      @keyframes pulseRed {
        0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.8), 0 2px 8px rgba(0,0,0,.1); border-color: #ef4444; }
        50%  { box-shadow: 0 0 0 10px rgba(239,68,68,0), 0 2px 8px rgba(0,0,0,.1); border-color: #fca5a5; }
        100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.8), 0 2px 8px rgba(0,0,0,.1); border-color: #ef4444; }
      }
    `;
    document.head.appendChild(el);
  }, []);

  // Tạo AudioContext lưu toàn cục, unlock sau gesture
  useEffect(() => {
    const unlock = () => {
      try {
        if (!window.__hk_actx) {
          window.__hk_actx = new (window.AudioContext || window.webkitAudioContext)();
        }
        window.__hk_actx.resume();
      } catch {}
    };
    ["touchstart","mousedown","keydown"].forEach(e =>
      window.addEventListener(e, unlock, { once: true })
    );
  }, []);

  const playNotifSound = () => {
    try {
      const ctx = window.__hk_actx || new (window.AudioContext || window.webkitAudioContext)();
      if (!window.__hk_actx) window.__hk_actx = ctx;
      const play = () => {
        // Nốt 1: 880Hz
        const o1 = ctx.createOscillator(), g1 = ctx.createGain();
        o1.connect(g1); g1.connect(ctx.destination);
        o1.type = "sine"; o1.frequency.value = 880;
        g1.gain.setValueAtTime(0.5, ctx.currentTime);
        g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        o1.start(ctx.currentTime); o1.stop(ctx.currentTime + 0.35);
        // Nốt 2: 1100Hz
        const o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.type = "sine"; o2.frequency.value = 1100;
        g2.gain.setValueAtTime(0, ctx.currentTime + 0.2);
        g2.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.3);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
        o2.start(ctx.currentTime + 0.2); o2.stop(ctx.currentTime + 0.65);
      };
      if (ctx.state === "suspended") { ctx.resume().then(play); } else { play(); }
    } catch(e) { console.warn("Sound:", e); }
  };
  const [loggedOut, setLoggedOut] = useState(false);
  const [orders, setOrders_raw] = useState([]);
  const setOrders = (fn_or_val) => {
    setOrders_raw(prev => {
      const next = typeof fn_or_val === "function" ? fn_or_val(prev) : fn_or_val;
      ordersRef.current = next;
      return next;
    });
  };
  const [users_raw, setUsers_raw] = useState([]);
  const setUsers = (fn_or_val) => {
    setUsers_raw(prev => {
      const next = typeof fn_or_val === "function" ? fn_or_val(prev) : fn_or_val;
      usersRef.current = next;
      return next;
    });
  };
  const users = users_raw;
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
        setPage(user?.role === "technician" ? "tasks" : user?.role === "warehouse" ? "wh_home" : "board");
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

  // Realtime notifications via PocketBase SSE + fallback poll
  const seenNotifIds = useRef(new Set());

  // Hàm xử lý notification mới — phát sound + show system notif
  const handleNewNotif = useCallback(async (n) => {
    if (!n?.id) return;
    if (seenNotifIds.current.has(n.id)) return;
    seenNotifIds.current.add(n.id);
    // Chỉ xử lý notif của user hiện tại
    if (n.user_id && n.user_id !== user?.id) return;
    // Chỉ notif mới (dưới 5 phút)
    const age = Date.now() - new Date(n.created_date || n.updated).getTime();
    if (age > 300000) return;
    // Cập nhật state
    setDbNotifications(p => {
      if (p.find(x => x.id === n.id)) return p;
      return [n, ...p].sort((a,b) => new Date(b.created_date)-new Date(a.created_date));
    });
    // Sound + system notif
    const master = await getNotifSound("notif_sound_master").catch(()=>"on");
    if (master !== "off") {
      showSystemNotif(n.title || "HK One Touch", n.message || "", { tag: n.id });
      try { playNotifSound(); } catch {}
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    requestNotifPermission().catch(() => {});

    // 1. Load tất cả notif chưa đọc ban đầu
    const fetchAll = async () => {
      try {
        const list = await Notification.filter({ user_id: user.id, is_read: false });
        const sorted = list.sort((a,b) => new Date(b.created_date)-new Date(a.created_date));
        // Đánh dấu seen để không phát sound cho notif cũ
        sorted.forEach(n => seenNotifIds.current.add(n.id));
        setDbNotifications(sorted);
      } catch {}
    };
    fetchAll();

    // 2. SSE Realtime: lắng nghe notification mới ngay lập tức
    let es = null;
    let retryTimer = null;
    const connectSSE = () => {
      try {
        const pbBase = getPbUrl();
        const authData = getAuth();
        const token = authData?.token || "";
        // PocketBase SSE realtime
        const sseUrl = `${pbBase}/api/realtime`;
        es = new EventSource(`${sseUrl}`);
        let clientId = null;

        // PocketBase SSE: kết nối → nhận clientId → subscribe
        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            // PocketBase gửi clientId qua message đầu tiên
            if (data.clientId && !clientId) {
              clientId = data.clientId;
              fetch(sseUrl, {
                method: "POST",
                headers: { "Content-Type":"application/json", ...(token?{Authorization:token}:{}) },
                body: JSON.stringify({ clientId, subscriptions: [`notifications/${user?.id}`] }),
              }).catch(() => {});
            }
          } catch {}
        };

        // PocketBase emit event với type = collection name
        es.addEventListener("notifications", (e) => {
          try {
            const evt = JSON.parse(e.data);
            const record = evt.record || evt;
            if (record && (evt.action === "create" || !evt.action)) {
              if (!record.is_read) handleNewNotif(record);
            }
          } catch {}
        });

        es.onerror = () => {
          es?.close();
          // Retry sau 5s
          retryTimer = setTimeout(connectSSE, 5000);
        };
      } catch(e) {
        console.warn("SSE connect fail:", e);
      }
    };
    connectSSE();

    // 3. Fallback poll mỗi 30s (backup nếu SSE miss)
    const iv = setInterval(async () => {
      try {
        const list = await Notification.filter({ user_id: user.id, is_read: false });
        const sorted = list.sort((a,b) => new Date(b.created_date)-new Date(a.created_date));
        setDbNotifications(sorted);
        // Chỉ phát sound cho notif thực sự mới
        for (const n of sorted) {
          if (!seenNotifIds.current.has(n.id)) {
            await handleNewNotif(n);
          }
        }
      } catch {}
    }, 10000);

    return () => {
      es?.close();
      clearTimeout(retryTimer);
      clearInterval(iv);
    };
  }, [user?.id, handleNewNotif]);
  const [qrOrder, setQrOrder] = useState(null);
  const [showQRScan, setShowQRScan] = useState(false);
  const [newOrderProductQR, setNewOrderProductQR] = useState("");
  const [highlightId, setHighlightId] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null); // toast xác nhận tạo đơn
  const [productHistory, setProductHistory] = useState(null);
  const [warehouseStockModal, setWarehouseStockModal] = useState(null);

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
        const mappedOrders = orderList.map(o => mapPbOrder(o, STATUS_DISPLAY, PRIORITY_DISPLAY));
        setUsers(mappedUsers);
        setOrders(mappedOrders);
      } catch(e) {
      } finally {
        setDataLoading(false);
      }
    }
    loadData();
  }, []);

  // ── Realtime subscribe repair_orders via SSE ──────────────
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeCollection("repair_orders", (evt) => {
      const action = evt.action || "update";
      const raw    = evt.record || evt;
      if (!raw?.id) return;
      const pbId   = raw.id; // PocketBase internal id (luôn có)
      const mapped = mapPbOrder(raw, STATUS_DISPLAY, PRIORITY_DISPLAY);
      if (action === "create") {
        setOrders(prev => {
          // Tránh duplicate: check cả _id lẫn order_code
          if (prev.find(o => o._id === pbId || o.id === mapped.id)) return prev;
          return [mapped, ...prev];
        });
      } else if (action === "update") {
        // So sánh bằng _id (PB internal) để chắc chắn đúng record
        setOrders(prev => prev.map(o =>
          (o._id === pbId || o.id === mapped.id) ? { ...o, ...mapped } : o
        ));
      } else if (action === "delete") {
        // Filter bằng _id (PB internal id) để chắc chắn xóa đúng 1 đơn
        setOrders(prev => prev.filter(o =>
          o._id !== pbId &&
          o.id !== mapped.id
        ));
      }
    });
    return () => unsub?.();
  }, [user?.id]);


  // ── In-app Export Deadline Reminder (thay thế Base44 automation) ─────────────
  // Chạy mỗi 5 phút, chỉ khi user là warehouse hoặc manager
  useEffect(() => {
    if (!user?.id) return;
    const isWHorMgr = ["warehouse","manager","admin"].includes(user.role);
    if (!isWHorMgr) return;

    async function checkExportDeadlines() {
      try {
        // Lấy tất cả phiếu pending chưa nhắc
        const pending = await StockExportRequest.filter({ status: "pending" });
        const now = Date.now();
        for (const req of pending) {
          if (!req.due_datetime || req.reminded_15min) continue;
          const dueMs = new Date(req.due_datetime).getTime();
          const remMs = dueMs - now;
          if (remMs > 0 && remMs <= 15 * 60 * 1000) {
            // Còn 15 phút → nhắc tất cả NV kho
            const remMins = Math.floor(remMs / 60000);
            // Lấy staff kho để gửi thông báo
            const staffList = await Staff.filter({ role: "warehouse", is_active: true }).catch(() => []);
            for (const ws of staffList) {
              await Notification.create({
                user_id: ws.id, user_name: ws.full_name,
                title: `⏰ Sắp hết hạn xuất — ${req.request_code}`,
                message: `Phiếu ${req.request_code} (${req.order_code}) còn ${remMins} phút! Vào Phiếu xuất kho để xử lý ngay.`,
                order_id: req.order_id, order_code: req.order_code,
                type: "export_deadline", is_read: false,
              }).catch(() => {});
            }
            // Đánh dấu đã nhắc
            await StockExportRequest.update(req.id, { reminded_15min: true }).catch(() => {});
          }
        }

        // Kiểm tra phiếu mượn quá hạn trả — chỉ nhắc 1 lần/ngày (dùng localStorage làm flag)
        const borrowing = await StockExportRequest.filter({ export_type: "borrow", status: "ktv_confirmed" }).catch(() => []);
        const today = new Date().toLocaleDateString("vi-VN");
        for (const req of borrowing) {
          if (!req.return_due_date) continue;
          const retMs = new Date(req.return_due_date).getTime();
          if (retMs < now) {
            // Kiểm tra đã nhắc hôm nay chưa
            const flagKey = `overdue_notif_${req.id}_${today}`;
            if (localStorage.getItem(flagKey)) continue;
            // Quá hạn — nhắc NV kho
            const staffList = await Staff.filter({ role: "warehouse", is_active: true }).catch(() => []);
            for (const ws of staffList) {
              await Notification.create({
                user_id: ws.id, user_name: ws.full_name,
                title: `🚨 Quá hạn trả linh kiện — ${req.request_code}`,
                message: `Phiếu ${req.request_code} đã quá hạn trả (${new Date(req.return_due_date).toLocaleDateString("vi-VN")}). Liên hệ KTV ${req.requested_by_name||"?"} để thu hồi.`,
                order_id: req.order_id, order_code: req.order_code,
                type: "export_overdue", is_read: false,
              }).catch(() => {});
            }
            // Đánh dấu đã nhắc hôm nay
            localStorage.setItem(flagKey, "1");
          }
        }
      } catch (e) {}
    }

    // Chạy ngay lần đầu sau 30 giây
    const firstRun = setTimeout(checkExportDeadlines, 30000);
    // Sau đó mỗi 5 phút
    const iv = setInterval(checkExportDeadlines, 5 * 60 * 1000);
    return () => { clearTimeout(firstRun); clearInterval(iv); };
  }, [user?.id, user?.role]);

  // ── Auto KPI deduction per timeline diagram ──────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      let kpiChanges   = [];
      let pbPatches    = []; // [{ orderId, pbId, patch }]
      let notifPayload = []; // thông báo đẩy vào PocketBase + state

      // Kiểm tra nhanh trước khi setOrders để tránh re-render không cần thiết
      const snapshot = ordersRef.current;
      const hasActive = snapshot.some(o =>
        o.assigned_to && o.assigned_at && (o.accept_stage||0) < 2 &&
        !["Hoàn Thành","Đã Giao","Hủy","Hoan Thanh","Da Giao","Huy"].includes(o.status)
      );
      if (!hasActive) return;

      setOrders(prev => {
        kpiChanges   = [];
        pbPatches    = [];
        notifPayload = [];
        let changed  = false;

        const next = prev.map(o => {
          if (!o.assigned_to || !o.assigned_at) return o;
          if ((o.accept_stage||0) >= 2) return o;
          if (["Hoàn Thành","Đã Giao","Hủy","Hoan Thanh","Da Giao","Huy"].includes(o.status)) return o;

          const assignedAt  = new Date(o.assigned_at).getTime();
          const stage1At    = o.stage1_at ? new Date(o.stage1_at).getTime() : null;
          const stage       = o.accept_stage || 0;
          let patch = {};

          // ══════════════════════════════════════════════════════════════
          // QUY TRÌNH KPI:
          //   Stage 0 (chưa nhận): KTV có 60p để bấm Nhận
          //     → Quá 60p: -1 KPI, tự chuyển stage 1 (đếm tiếp 60p)
          //     → Quá 120p (60p stage 1): -2 KPI thêm, báo quản lý
          //   Nếu KTV BẤM NHẬN BẤT KỲ LÚC NÀO (stage 0 hoặc 1):
          //     → accept_stage = 2 (đếm dừng, không KPI thêm), chờ bấm Sửa
          // ══════════════════════════════════════════════════════════════

          // ── STAGE 0: KTV chưa nhận → 60 phút đầu ─────────────────────────
          if (stage === 0) {
            const deadline0  = assignedAt + 60 * 60000;
            const remMs      = deadline0 - now;
            const remMins    = Math.floor(remMs / 60000);

            // Nhắc khi còn < 20 phút
            if (remMs > 0 && remMs <= 20 * 60000) {
              const urgentLevel = remMs < 5*60000 ? "🚨" : remMs < 10*60000 ? "⚠️" : "⏰";
              notifPayload.push({
                userId: o.assigned_to,
                title: `${urgentLevel} Nhận đơn ${o.order_code || o.id}`,
                message: `Còn ${remMins} phút để nhận đơn! Bấm vào đơn để nhận ngay.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "kpi_reminder", role: null,
              });
            }

            // Hết 60p chưa nhận → -1 KPI, tự chuyển sang giai đoạn chờ lần 2
            if (remMs <= 0 && !o.kpi_stage1_penalized) {
              patch.kpi_stage1_penalized = true;
              patch.accept_stage         = 1;
              // stage1_at = thời điểm hết hạn 60p đầu (không phải now, để tính đúng 60p tiếp)
              patch.stage1_at = new Date(assignedAt + 60 * 60000).toISOString();
              kpiChanges.push({ userId: o.assigned_to, delta: -1 });
              notifPayload.push({
                userId: o.assigned_to,
                title: `🔴 Quá 60 phút — Đơn ${o.order_code || o.id}`,
                message: `Chưa bấm Nhận Đơn → -1 KPI. Hệ thống tự chuyển sang đếm tiếp 60 phút lần 2.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "kpi_penalty", role: null,
              });
              notifPayload.push({
                userId: null,
                title: `⚠️ KTV chậm nhận — ${o.order_code || o.id}`,
                message: `KTV ${o.assigned_to_name || "?"} quá 60p không nhận đơn → -1 KPI. Đang đếm tiếp 60p.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "kpi_penalty", role: "manager",
              });
              changed = true;
            }
          }

          // ── STAGE 1 (tự động): 60p kế tiếp — vẫn chưa nhận ──────────────
          // Lưu ý: stage 1 TỰ ĐỘNG do hệ thống chuyển, KHÔNG phải KTV bấm nhận
          // Nếu KTV bấm nhận thủ công → accept_stage = 2, không vào đây nữa
          if (stage === 1 && o.stage1_at && !o.kpi_manually_accepted) {
            const stage1Start = new Date(o.stage1_at).getTime();
            const deadline1   = stage1Start + 60 * 60000;
            const remMs       = deadline1 - now;
            const remMins     = Math.floor(remMs / 60000);

            // Nhắc khi còn < 20 phút của giai đoạn 2
            if (remMs > 0 && remMs <= 20 * 60000) {
              const urgentLevel = remMs < 5*60000 ? "🚨" : "⚠️";
              notifPayload.push({
                userId: o.assigned_to,
                title: `${urgentLevel} KHẨN: Nhận đơn ${o.order_code || o.id}`,
                message: `Còn ${remMins} phút — nếu không nhận sẽ bị -2 KPI tiếp! Bấm Nhận ngay.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "kpi_reminder", role: null,
              });
            }

            // Hết 60p lần 2 → -2 KPI thêm, báo quản lý cần giao lại
            if (remMs <= 0 && !o.kpi_stage2_penalized) {
              patch.kpi_stage2_penalized = true;
              patch.needs_reassign       = true;
              kpiChanges.push({ userId: o.assigned_to, delta: -2 });
              notifPayload.push({
                userId: o.assigned_to,
                title: `🔴 Quá 120 phút — Đơn ${o.order_code || o.id}`,
                message: `Tổng 120 phút không nhận đơn → -2 KPI thêm. Ngừng nhận việc tạm thời.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "kpi_penalty", role: null,
              });
              notifPayload.push({
                userId: null,
                title: `📋 Cần Giao Lại — ${o.order_code || o.id}`,
                message: `KTV ${o.assigned_to_name||"?"} quá 120p không nhận → -2 KPI. Vui lòng giao KTV khác.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "needs_reassign", role: "manager",
              });
              changed = true;
            }
          }

          if (Object.keys(patch).length > 0) {
            changed = true;
            if (o._id) pbPatches.push({ orderId: o.id, pbId: o._id, patch });
            return { ...o, ...patch };
          }
          return o;
        });

        return changed ? next : prev;
      });

      // Apply KPI changes to users
      if (kpiChanges.length > 0) {
        setUsers(u => {
          let next = [...u];
          kpiChanges.forEach(({ userId, delta }) => {
            next = next.map(x => x.id===userId ? { ...x, kpi: Math.max(0, (x.kpi||0) + delta) } : x);
          });
          return next;
        });
        // Lưu KPI mới xuống PocketBase
        kpiChanges.forEach(async ({ userId, delta }) => {
          try {
            const staffRec = usersRef?.current?.find(u => u.id === userId) || [];
            if (staffRec?._id) {
              const newKpi = Math.max(0, (staffRec.kpi||0) + delta);
              await Staff.update(staffRec._id, { kpi_score: newKpi });
            }
          } catch(e) { console.warn("KPI PB update error:", e); }
        });
      }

      // Lưu các patch đơn xuống PocketBase
      pbPatches.forEach(async ({ pbId, patch }) => {
        try { await RepairOrder.update(pbId, patch); } catch(e) { console.warn("Order patch error:", e); }
      });

      // Gửi thông báo (chỉ lưu vào Notification entity — SSE sẽ push real-time)
      notifPayload.forEach(async (n) => {
        try {
          if (n.role === "manager") {
            // Broadcast cho tất cả manager
            const managers = usersRef?.current?.filter(u => u.role === "manager") || [];
            for (const m of managers) {
              await Notification.create({
                user_id: m.id, user_name: m.name || m.full_name || "",
                title: n.title, message: n.message,
                order_id: n.orderId, order_code: n.orderCode,
                type: n.type, is_read: false,
              });
            }
          } else if (n.userId) {
            await Notification.create({
              user_id: n.userId, user_name: "",
              title: n.title, message: n.message,
              order_id: n.orderId, order_code: n.orderCode,
              type: n.type, is_read: false,
            });
          }
        } catch(e) { console.warn("Notif push error:", e); }
      });

    }, 15 * 60 * 1000); // chạy mỗi 15 phút
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
  if (!user) return <LoginPage onLogin={u => { setUser(u); setLoggedOut(false); setPage(u.role==="technician"?"tasks":u.role==="receptionist"?"new":u.role==="warehouse"?"wh_home":"dashboard"); }} loggedOut={loggedOut} />;
  if (user.must_change_password) return <ChangePassword user={user} forceChange={true} onSuccess={() => setUser(u => ({...u, must_change_password: false}))} />;

  async function updateOrder(id, patch, kpiEvent, action) {
    // Xóa đơn khỏi state
    if (action === "delete" || patch === null) {
      setOrders(p => p.filter(o => o.id !== id && o.order_code !== id));
      if (selectedOrder?.id === id || selectedOrder?.order_code === id) setSelectedOrder(null);
      return;
    }
    // Auto-set assigned_at khi assign/reassign KTV (nếu patch chưa có)
    if (patch?.assigned_to && !patch.assigned_at) {
      const curOrder = ordersRef.current.find(o => o.id===id) || orders.find(o => o.id===id);
      if (!curOrder?.assigned_at || curOrder.assigned_to !== patch.assigned_to) {
        patch = { ...patch, assigned_at: new Date().toISOString() };
      }
    }
    setOrders(p => p.map(o => (o.id===id || o.order_code===id) ? {...o,...patch} : o));
    if (selectedOrder?.id===id || selectedOrder?.order_code===id) setSelectedOrder(p => ({...p,...patch}));
    if (kpiEvent) setUsers(p => p.map(u => u.id===kpiEvent.userId ? {...u, kpi:Math.max(0,u.kpi+kpiEvent.delta)} : u));

    // Lưu xuống PocketBase (dùng _id thật)
    try {
      const order = ordersRef.current.find(o => o.id === id) || orders.find(o => o.id === id);
      const pbId = order?._id;
      if (!pbId) return; // đơn chưa lưu vào PB
      // Map patch field sang schema PocketBase
      const pbPatch = {};
      // Fields trực tiếp (1-1 với PB schema)
      const directFields = [
        "customer_name","customer_phone","device_name","device_model","imei","passcode",
        "issue_description","technician_note","assigned_to","assigned_to_name",
        "estimated_cost","final_cost","deposit","warranty_days",
        "received_date","estimated_done_date","done_date","images","videos",
        "accept_stage","stage1_at","stage2_at","estimated_done","assigned_at",
        "checklist_done","kpi_stage1_penalized","kpi_stage2_penalized","needs_reassign",
      ];
      directFields.forEach(f => { if (patch[f] !== undefined) pbPatch[f] = patch[f]; });
      // Fields cần map enum
      if (patch.status    !== undefined) pbPatch.status   = STATUS_PB[patch.status]   || patch.status;
      if (patch.priority  !== undefined) pbPatch.priority = PRIORITY_PB[patch.priority]|| patch.priority;
      // Alias cũ
      if (patch.notes     !== undefined) pbPatch.technician_note = patch.notes;
      // accept_stage đã có trong directFields - không cần làm gì thêm
      if (Object.keys(pbPatch).length > 0) {
        const saved = await RepairOrder.update(pbId, pbPatch);
        // Sau khi PB lưu thành công → map lại từ PB để đảm bảo đồng bộ
        if (saved && saved.id) {
          const fresh = mapPbOrder(saved, STATUS_DISPLAY, PRIORITY_DISPLAY);
          // Chỉ sync nếu không có thêm patch đang pending
          setOrders(p => p.map(o => (o._id === saved.id) ? { ...fresh, ...patch } : o));
          if (selectedOrder?._id === saved.id) setSelectedOrder(p => ({ ...fresh, ...patch }));
        }
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
    // pbData khai báo ngoài try để catch có thể dùng lại
    const pbData = {
      order_code:       data.id,
      customer_name:    data.customer_name || "",
      customer_phone:   data.customer_phone || "",
      device_name:      data.device_model || "",
      device_model:     data.device_model || "",
      imei:             data.imei_serial || "",
      passcode:         data.passcode || "",
      product_qr:       data.product_qr || "",
      issue_description: Array.isArray(data.issues) ? data.issues.join(", ") : (data.notes || ""),
      status:           "Chua Nhan",
      assigned_to:      data.assigned_to || null,
      assigned_at:      data.assigned_to ? new Date().toISOString() : null,
      accept_stage:     0,
      received_date:    new Date().toISOString(),
      images:           data.images || [],
      technician_note:  data.notes || "",
      warranty_days:    0,
      priority:         PRIORITY_PB["Bình thường"] || "Thuong",
    };
    try {
      const saved = await RepairOrder.create(pbData);
      data._id = saved.id;
      data._pbSaved = true;
      logHistory({
        order_id:        saved.id,
        order_code:      data.id,
        action_type:     "created",
        action_label:    "Tạo đơn mới",
        changed_by_id:   user?.id || "",
        changed_by_name: user?.name || user?.full_name || "",
        changed_by_role: user?.role || "",
        new_value:       `${data.device_model || ""} — ${data.customer_name || ""}`,
      });
    } catch(e) {
      console.error("[createOrder] Lần 1 thất bại:", e?.message, e?.data || "");
      // Thử lại với status rỗng (PocketBase enum chưa có "Chua Nhan")
      try {
        const pbData2 = { ...pbData, status: "" };
        const saved2 = await RepairOrder.create(pbData2);
        data._id = saved2.id;
        data._pbSaved = true;
        logHistory({
          order_id:        saved2.id,
          order_code:      data.id,
          action_type:     "created",
          action_label:    "Tạo đơn mới",
          changed_by_id:   user?.id || "",
          changed_by_name: user?.name || user?.full_name || "",
          changed_by_role: user?.role || "",
          new_value:       `${data.device_model || ""} — ${data.customer_name || ""}`,
        });
      } catch(e2) {
        console.error("[createOrder] Lần 2 thất bại:", e2?.message, e2?.data || "");
        alert("Không lưu được đơn vào database!\n\nLỗi: " + (e2?.message || e?.message || "Kiểm tra kết nối PocketBase."));
        return;
      }
    }

    setOrders(p => [data, ...p]);
    // Gửi Notification vào DB để KTV + Manager + Receptionist nhận realtime
    const orderCode = data.id || data._id;
    const orderId   = data._id || data.id;

    if (data.assigned_to) {
      const ktv = users.find(u => u.id === data.assigned_to);
      // Thông báo cho KTV được giao
      Notification.create({
        user_id:    data.assigned_to,
        user_name:  ktv?.name || "",
        title:      `🔧 Đơn mới được giao: ${orderCode}`,
        message:    `${data.customer_name || ""} - ${data.device_model || ""}. Vui lòng xác nhận!`,
        order_id:   orderId,
        order_code: orderCode,
        type:       "assign",
        is_read:    false,
        created_at: new Date().toISOString(),
      }).catch(() => {});
    }

    // Thông báo cho tất cả Manager + Receptionist (trừ người tạo)
    const notifyStaff = users.filter(u =>
      ["manager", "admin", "receptionist"].includes(u.role) && u.id !== user?.id
    );
    notifyStaff.forEach(u => {
      Notification.create({
        user_id:    u.id,
        user_name:  u.name || "",
        title:      `📋 Đơn mới: ${orderCode}`,
        message:    `${data.customer_name || ""} - ${data.device_model || ""}`,
        order_id:   orderId,
        order_code: orderCode,
        type:       "new_order",
        is_read:    false,
        created_at: new Date().toISOString(),
      }).catch(() => {});
    });

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
    } else if (result.type === "warehouse_stock") {
      // Máy đang trong kho, chưa bán
      setWarehouseStockModal(result.data);
    } else if (result.type === "assign_qr") {
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

  const isWarehouse = user.role === "warehouse";
  const isManager   = user.role === "manager" || user.role === "admin";
  const isKtv       = user.role === "technician";
  const isReception = user.role === "receptionist";

  const navItems = isWarehouse ? [
    {key:"wh_home",    icon:"home",          label:"Trang chủ"},
    {key:"wh_export",  icon:"outbox",        label:"Phiếu xuất kho"},
    {key:"wh_import",  icon:"move_to_inbox", label:"Nhập hàng"},
    {key:"wh_stock",   icon:"inventory_2",   label:"Tồn kho"},
  ] : [
    ...(isManager?[{key:"dashboard",icon:"bar_chart",label:"Tổng quan"}]:[]),
    ...(!isKtv?[{key:"board",icon:"assignment",label:"Bảng theo dõi"},{key:"new",icon:"add",label:"Tạo đơn mới"}]:[]),
    {key:"tasks",icon:"check_circle",label:"Danh sách đơn"},
    ...(!isReception && !isWarehouse?[{key:"kpi",icon:"emoji_events",label:"KPI Kỹ thuật"}]:[]),
    ...(!isKtv?[{key:"customers",icon:"group",label:"Khách hàng"}]:[]),
    ...(isManager?[{key:"staff",icon:"person",label:"Nhân viên"},{key:"settings",icon:"settings",label:"Cài đặt"}]:[]),
  ];

  // ── Kanban Board ─────────────────────────────────────────
  const COLUMNS = ["Chưa Nhận","Mới Nhận","Chờ Linh Kiện","Đang Sửa","Hoàn Thành","Đã Giao"];
  const colColors = { "Chưa Nhận":"#f3f4f6","Mới Nhận":"#dbeafe","Chờ Linh Kiện":"#fce7f3","Đang Sửa":"#ede9fe","Hoàn Thành":"#dcfce7","Đã Giao":"#f1f5f9" };
  const colBorder = { "Chưa Nhận":"#d1d5db","Mới Nhận":"#93c5fd","Chờ Linh Kiện":"#f9a8d4","Đang Sửa":"#c4b5fd","Hoàn Thành":"#86efac","Đã Giao":"#cbd5e1" };

  function KanbanBoard() {
    // Dùng ref từ outer scope → không bị reset khi re-render
    useLayoutEffect(() => {
      const el = kanbanScrollRef.current;
      if (!el) return;
      el.scrollLeft = kanbanScrollLeft.current;
    }, []); // restore sau mount

    const handleScroll = (e) => {
      kanbanScrollLeft.current = e.currentTarget.scrollLeft;
    };

    return (
      <div
        ref={kanbanScrollRef}
        onScroll={handleScroll}
        style={{ overflowX:"auto", padding:"0 16px 80px", WebkitOverflowScrolling:"touch" }}
      >
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
    const isPending = o.status === "Chưa Nhận";
    return (
      <div onClick={onClick}
        style={{
          background: isPending && !highlight ? "#fff5f5" : "#fff",
          borderRadius:12, padding:12, marginBottom:8, cursor:"pointer",
          boxShadow: highlight ? "0 0 0 3px #f59e0b" : "0 1px 4px rgba(0,0,0,.08)",
          border: highlight ? "2px solid #f59e0b" : isPending ? "2px solid #ef4444" : "2px solid transparent",
          animation: isPending && !highlight ? "pulseRed 1.6s ease-in-out infinite" : "none",
          transition: isPending ? "none" : "box-shadow .2s"
        }}>
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
          const isChuaNhan = o.status === "Chưa Nhận";
          return (
            <div key={o.id} onClick={() => setSelectedOrder(o)}
              style={{
                background: isChuaNhan && !o.needs_reassign ? "#fff5f5" : "#fff",
                borderRadius:14, padding:14, marginBottom:10, cursor:"pointer",
                boxShadow:"0 2px 8px rgba(0,0,0,.08)",
                border:`2px solid ${o.needs_reassign?"#ef4444":isChuaNhan?"#ef4444":"#f3f4f6"}`,
                animation: isChuaNhan && !o.needs_reassign ? "pulseRed 1.6s ease-in-out infinite" : "none",
                transition: "none"
              }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <div style={{ fontWeight:800, color:"#1e1b4b" }}>{o.id}</div>
                <div style={{ fontSize:12, padding:"3px 10px", borderRadius:99, background: isChuaNhan?"#fee2e2":o.status==="Hoàn Thành"?"#dcfce7":o.status==="Đang Sửa"?"#ede9fe":"#fef3c7", color:isChuaNhan?"#dc2626":"#374151", fontWeight:isChuaNhan?800:600 }}>{o.status}</div>
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
              <div style={{ fontSize:12, color:"#c7d2fe", marginTop:2 }}>{user.role}{(user.role==="technician"||user.role==="manager")?" · KPI: "+user.kpi:""}</div>
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
              {/* Merge local + DB notifications, sort mới nhất lên trên */}
              {[
                ...notifications.map(n => ({ _type:"local", _time: new Date(n.time||0).getTime(), ...n })),
                ...dbNotifications.map(n => ({ _type:"db",    _time: new Date(n.created_date||n.updated_date||0).getTime(), ...n })),
              ].sort((a,b) => b._time - a._time).map(n => n._type === "local" ? (
                <div key={"loc_"+n.id} style={{ padding:"12px 16px", borderBottom:"1px solid #f9fafb", fontSize:13, display:"flex", gap:10, alignItems:"flex-start", background:"#fffbeb" }}>
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
              ) : (
                <SwipeableNotif key={"db_"+n.id} notif={n}
                  onDelete={() => {
                    Notification.update(n.id, { is_read: true }).catch(()=>{});
                    setDbNotifications(p => p.filter(x=>x.id!==n.id));
                  }}
                  onClick={async () => {
                    Notification.update(n.id, { is_read: true }).catch(()=>{});
                    setDbNotifications(p => p.filter(x=>x.id!==n.id));
                    setShowNotif(false);
                    const targetId   = n.order_id;
                    const targetCode = n.order_code;
                    if (targetId || targetCode) {
                      try {
                        let mapped = null;
                        if (targetId)   mapped = orders.find(o => o._id === targetId);
                        if (!mapped && targetCode) mapped = orders.find(o => o.id === targetCode || o.qr_code === targetCode);
                        if (!mapped && targetId) {
                          const raw = await RepairOrder.get(targetId);
                          if (raw) mapped = mapPbOrder(raw, STATUS_DISPLAY, PRIORITY_DISPLAY);
                        }
                        if (mapped) {
                          if (user?.role === "technician") setPage("tasks");
                          else setPage("board");
                          setTimeout(() => {
                            setSelectedOrder(mapped);
                            if (n.type === "mention") {
                              setTimeout(() => { window.__hk_open_chat = mapped._id || mapped.id; }, 100);
                            }
                          }, 150);
                        }
                      } catch {}
                    }
                  }}
                />
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
        {page==="new" && (
          <div style={{ padding:"0 0 80px" }}>
            {/* Nút tạo đơn sticky top */}
            <div style={{ padding:"12px 16px 8px", position:"sticky", top:0, zIndex:10, background:"#f8fafc", borderBottom:"1px solid #e5e7eb" }}>
              <button onClick={() => setShowNewOrder(true)}
                style={{ width:"100%", height:52, background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", border:"none", borderRadius:14, fontWeight:800, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 4px 14px rgba(79,70,229,.35)" }}>
                <span className="material-icons" style={{fontSize:22}}>add_circle</span>
                Tạo Đơn Mới
              </button>
            </div>
            {/* Danh sách đơn gần đây — tiếp tân tra cứu nhanh */}
            <div style={{ padding:"10px 16px 0" }}>
              <div style={{ fontWeight:800, fontSize:13, color:"#6b7280", marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>
                Đơn gần đây
              </div>
              {filtered.filter(o => !["Đã Giao"].includes(o.status)).slice(0,30).map(o => {
                const col2 = STATUS_COLS.find(s => s.key === o.status);
                return (
                  <div key={o.id} onClick={() => setSelectedOrder(o)}
                    style={{
                      background: o.status==="Chưa Nhận" ? "#fff5f5" : "#fff",
                      borderRadius:14, padding:"12px 14px", marginBottom:8, cursor:"pointer",
                      boxShadow:"0 1px 4px rgba(0,0,0,.07)",
                      border: o.status==="Chưa Nhận" ? "2px solid #ef4444" : "1.5px solid #f3f4f6",
                      animation: o.status==="Chưa Nhận" ? "pulseRed 1.6s ease-in-out infinite" : "none",
                      display:"flex", justifyContent:"space-between", alignItems:"center"
                    }}>
                    <div>
                      <div style={{ fontWeight:800, color:"#1e1b4b", fontSize:14 }}>{o.order_code || o.id}</div>
                      <div style={{ fontSize:12, color:"#374151", marginTop:2 }}>{o.customer_name} · {o.device_model}</div>
                      <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{o.customer_phone}</div>
                    </div>
                    <span style={{ background:col2?.bg||"#f3f4f6", color:col2?.color||"#374151", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:20, whiteSpace:"nowrap", flexShrink:0 }}>
                      {col2?.icon} {o.status}
                    </span>
                  </div>
                );
              })}
              {filtered.filter(o => !["Đã Giao"].includes(o.status)).length === 0 && (
                <div style={{ textAlign:"center", color:"#9ca3af", padding:40, fontSize:14 }}>Chưa có đơn nào</div>
              )}
            </div>
          </div>
        )}
        {page==="kpi" && <KPIPage users={users} orders={orders} />}
        {page==="customers" && <CustomerList />}
        {page==="dashboard" && <Dashboard />}
        {page==="staff" && <StaffManagerPage />}
        {page==="settings" && <SettingsPage user={user} />}
        {page==="wh_home"   && <WarehouseHome   user={user} setPage={setPage} />}
        {page==="wh_export" && <WarehouseExport user={user} />}
        {page==="wh_import" && <WarehouseImport user={user} />}
        {page==="wh_stock"  && <WarehouseStock  user={user} />}
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

      {/* Modal: Hàng trong kho - Chưa bán */}
      {warehouseStockModal && (
        <div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:380, overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ background:"linear-gradient(135deg,#0369a1,#0284c7)", padding:"20px 20px 16px", textAlign:"center" }}>
              <span className="material-icons" style={{fontSize:48,color:"#fff",display:"block",marginBottom:8}}>inventory_2</span>
              <div style={{ color:"#fff", fontWeight:900, fontSize:18 }}>Hàng trong kho</div>
              <div style={{ color:"#bae6fd", fontSize:13, marginTop:4 }}>Thiết bị này chưa được bán</div>
            </div>
            <div style={{ padding:"16px 20px 20px" }}>
              <div style={{ background:"#e0f2fe", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
                <div style={{ fontWeight:800, fontSize:16, color:"#0369a1", marginBottom:4 }}>{warehouseStockModal.name}</div>
                {warehouseStockModal.sku && <div style={{ fontSize:13, color:"#0369a1" }}>IMEI/Serial: {warehouseStockModal.sku}</div>}
                <div style={{ fontSize:13, color:"#0369a1", marginTop:4 }}>Tồn kho: {warehouseStockModal.stock_qty||0} cái</div>
                {warehouseStockModal.price>0 && <div style={{ fontSize:13, color:"#0369a1" }}>Giá: {(warehouseStockModal.price||0).toLocaleString("vi-VN")}đ</div>}
              </div>
              <div style={{ background:"#fef9c3", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#854d0e" }}>
                <span className="material-icons" style={{fontSize:16,verticalAlign:"middle",marginRight:4}}>info</span>
                Thiết bị này đang được lưu trong kho. Vui lòng liên hệ nhân viên kho nếu cần xuất máy.
              </div>
              <button onClick={()=>setWarehouseStockModal(null)}
                style={{ width:"100%", height:46, borderRadius:12, border:"none", background:"#0369a1", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer" }}>
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(id, patch, kpiEvent, action) => { updateOrder(id, patch, kpiEvent, action); }}
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



// ═══════════════════════════════════════════════════════════
// WAREHOUSE COMPONENTS
// ═══════════════════════════════════════════════════════════

function WarehouseHome({ user, setPage }) {
  const [stats, setStats] = React.useState({ pendingExport:0, overdueBorrow:0, lowStock:0, pendingImport:0 });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const [exports, parts, imports] = await Promise.all([
        StockExportRequest.filter({ status:"pending" }),
        SparePart.filter({ is_active:true }),
        StockImport.filter({ status:"draft" }),
      ]);
      const overdue = await StockExportRequest.filter({ export_type:"borrow", status:"ktv_confirmed" });
      const now = Date.now();
      const overdueCount = overdue.filter(r => r.return_due_date && new Date(r.return_due_date) < now).length;
      const lowStockCount = parts.filter(p => (p.stock_qty||0) <= 3).length;
      setStats({ pendingExport:exports.length, overdueBorrow:overdueCount, lowStock:lowStockCount, pendingImport:imports.length });
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  const cards = [
    { key:"wh_export",  icon:"outbox",         label:"Phiếu chờ xuất",  value:stats.pendingExport,  color:"#d97706", bg:"#fffbeb", border:"#fcd34d", urgent:stats.pendingExport>0 },
    { key:"wh_export",  icon:"assignment_late", label:"Mượn quá hạn",    value:stats.overdueBorrow,  color:"#dc2626", bg:"#fff1f2", border:"#fca5a5", urgent:stats.overdueBorrow>0 },
    { key:"wh_stock",   icon:"inventory_2",     label:"LK tồn thấp",     value:stats.lowStock,       color:"#0369a1", bg:"#e0f2fe", border:"#7dd3fc", urgent:stats.lowStock>0 },
    { key:"wh_import",  icon:"move_to_inbox",   label:"Phiếu nhập draft",value:stats.pendingImport,  color:"#7c3aed", bg:"#f5f3ff", border:"#c4b5fd", urgent:false },
  ];

  return (
    <div style={{ padding:"16px 14px 100px" }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:22, fontWeight:900, color:"#1e1b4b" }}>📦 Xin chào, {user.name}!</div>
        <div style={{ fontSize:14, color:"#6b7280", marginTop:4 }}>Nhân viên kho · {new Date().toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"})}</div>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {cards.map((c,i) => (
            <div key={i} onClick={() => setPage(c.key)}
              style={{ background:c.bg, borderRadius:16, padding:"16px 14px", border:`2px solid ${c.urgent?c.border:"#e5e7eb"}`, cursor:"pointer", boxShadow:c.urgent?"0 4px 12px rgba(0,0,0,.08)":"none" }}>
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
          { page:"wh_stock",  icon:"search",         label:"Tra cứu tồn kho",       sub:"Tìm linh kiện theo tên / SKU",  color:"#0369a1", bg:"#e0f2fe" },
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
      let data = [];
      if (filter === "all") {
        data = await StockExportRequest.list({ sort:"-created_date", limit:100 });
      } else {
        data = await StockExportRequest.filter({ status: filter });
      }
      setRequests(data.sort((a,b) => new Date(a.due_datetime||0)-new Date(b.due_datetime||0)));
    } catch(e){ console.error(e); }
    setLoading(false);
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
                    {req.export_type==="borrow"?"🔄 Mượn":"🔧 Xuất sửa"} · {req.order_code} · {(req.items?JSON.parse(req.items):[]).length} LK
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
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", width:"100%", maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
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
              {(viewReq.items?JSON.parse(viewReq.items):[]).map((item,i) => (
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
  const [note, setNote]                   = React.useState("");
  const [items, setItems]                 = React.useState([]);
  const [saving, setSaving]               = React.useState(false);

  React.useEffect(() => { loadImports(); }, []);

  // Dọn stream khi unmount
  React.useEffect(() => () => stopScan(), []);

  async function loadImports() {
    setLoading(true);
    try {
      const data = await StockImport.list({ sort:"-created_date", limit:50 });
      setImports(data);
    } catch(e){ console.error(e); }
    setLoading(false);
  }

  function showToast(msg){ setToast(msg); setTimeout(()=>setToast(""),3500); }

  function addItem() {
    setItems(prev=>[...prev, {
      id:Date.now(), name:"", sku:"", serial_imei:"", qr_code:"",
      qty:1, unit_price:0, condition:"new",
      photos:[], videos:[], note:"",
    }]);
  }

  function updateItem(id, field, val) {
    setItems(prev=>prev.map(it=>{
      if (it.id!==id) return it;
      const updated = {...it, [field]:val};
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
        status:"draft", note, created_by:user.id, created_by_name:user.name,
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
        });
        // Nếu máy móc có serial_imei → ghi vào SparePart để khi quét QR biết "Chưa bán"
        if (importType==="device" && it.serial_imei) {
          try {
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
          } catch {}
        }
      }
      showToast("✅ Đã tạo phiếu nhập "+code);
      setShowForm(false); setItems([]);
      setSupplier(""); setSupplierPhone(""); setNote("");
      setImportType("spare_part");
      loadImports();
    } catch(e){ showToast("Lỗi: "+e.message); }
    setSaving(false);
  }

  const STATUS_COLOR = {
    draft:     {bg:"#fef3c7",color:"#92400e",label:"📝 Nháp"},
    confirmed: {bg:"#dbeafe",color:"#1d4ed8",label:"✅ Xác nhận"},
    synced_kv: {bg:"#dcfce7",color:"#15803d",label:"🔗 KiotViet"},
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
            <div key={imp.id} style={{ background:"#f9fafb", borderRadius:14, padding:"12px 14px", marginBottom:10, border:"1.5px solid #e5e7eb" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:14 }}>{imp.import_code}</div>
                  <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>
                    {imp.import_type==="device"?"📱 Máy móc":"🔩 Linh kiện"} · {imp.supplier_name}
                  </div>
                  <div style={{ fontSize:12, color:"#6b7280" }}>
                    {imp.total_items} mặt hàng · {(imp.total_value||0).toLocaleString("vi-VN")}đ
                  </div>
                </div>
                <div style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{sc.label}</div>
              </div>
              <div style={{ fontSize:11, color:"#9ca3af", marginTop:6 }}>{new Date(imp.created_date).toLocaleString("vi-VN")}</div>
            </div>
          );
        })}
      </div>

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
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", width:"100%", maxHeight:"94vh", display:"flex", flexDirection:"column" }}>
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

              {/* NCC */}
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>Nhà cung cấp *</div>
                <input value={supplier} onChange={e=>setSupplier(e.target.value)} placeholder="Tên nhà cung cấp..."
                  style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }}/>
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>Số điện thoại</div>
                <input value={supplierPhone} onChange={e=>setSupplierPhone(e.target.value)} placeholder="SĐT nhà cung cấp..."
                  style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }}/>
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
                    <input value={it.name} onChange={e=>updateItem(it.id,"name",e.target.value)} placeholder="Tên hàng *"
                      style={{ width:"100%", height:38, borderRadius:8, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:13, outline:"none", marginBottom:8, boxSizing:"border-box" }}/>

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


// ─── Warehouse: Tồn kho ──────────────────────────────────
function WarehouseStock({ user }) {
  const [parts, setParts]   = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("all");

  React.useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await SparePart.filter({ is_active:true });
      setParts(data.sort((a,b)=>(a.name||"").localeCompare(b.name)));
    } catch(e){ console.error(e); }
    setLoading(false);
  }

  const filtered = parts.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search || (p.name||"").toLowerCase().includes(q) || (p.sku||"").toLowerCase().includes(q);
    const qty = p.stock_qty||0;
    const matchFilter = filter==="all" || (filter==="low"&&qty>0&&qty<=3) || (filter==="out"&&qty===0) || (filter==="ok"&&qty>3);
    return matchSearch && matchFilter;
  });

  function stockColor(qty) {
    if (qty===0) return {color:"#dc2626",bg:"#fff1f2",label:"Hết hàng"};
    if (qty<=3)  return {color:"#d97706",bg:"#fffbeb",label:"Tồn thấp"};
    return {color:"#059669",bg:"#f0fdf4",label:"Còn hàng"};
  }

  return (
    <div style={{ paddingBottom:100 }}>
      <div style={{ padding:"14px 14px 8px", position:"sticky", top:56, background:"#fff", zIndex:10, borderBottom:"1.5px solid #e5e7eb" }}>
        <div style={{ fontWeight:900, fontSize:17, color:"#1e1b4b", marginBottom:10 }}>🔍 Tồn kho linh kiện</div>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc SKU..."
          style={{ width:"100%", height:40, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none", marginBottom:10, boxSizing:"border-box" }}/>
        <div style={{ display:"flex", gap:6 }}>
          {[{k:"all",l:"Tất cả"},{k:"ok",l:"🟢 Đủ"},{k:"low",l:"🟡 Thấp"},{k:"out",l:"🔴 Hết"}].map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)}
              style={{ padding:"6px 12px", borderRadius:20, border:"none", background:filter===f.k?"#1e1b4b":"#f3f4f6", color:filter===f.k?"#fff":"#374151", fontWeight:700, fontSize:12, cursor:"pointer", flexShrink:0 }}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"10px 14px" }}>
        {loading ? <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>⏳ Đang tải...</div>
        : filtered.length===0 ? (
          <div style={{textAlign:"center",padding:"40px 20px",color:"#9ca3af"}}>
            <span className="material-icons" style={{fontSize:48,display:"block",marginBottom:8}}>inventory_2</span>
            Không tìm thấy linh kiện
          </div>
        ) : filtered.map(p => {
          const sc = stockColor(p.stock_qty||0);
          return (
            <div key={p.id} style={{ background:"#fff", borderRadius:14, padding:"12px 14px", marginBottom:8, border:"1.5px solid #e5e7eb", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                <div style={{ fontSize:12, color:"#6b7280", marginTop:2, display:"flex", gap:8 }}>
                  {p.sku && <span>SKU: {p.sku}</span>}
                  {p.category && <span>{p.category}</span>}
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:"#4f46e5", marginTop:2 }}>{(p.price||0).toLocaleString("vi-VN")}đ/{p.unit||"cái"}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0, marginLeft:10 }}>
                <div style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"4px 12px", fontWeight:900, fontSize:16 }}>{p.stock_qty||0}</div>
                <div style={{ fontSize:10, color:sc.color, fontWeight:700, marginTop:2 }}>{sc.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MainApp() { return <ErrorBoundary><MainAppInner /></ErrorBoundary>; }
