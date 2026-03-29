import { useState, useEffect, useRef } from "react";
import { RepairOrder, Customer, RepairChat, Staff } from "@/api/entities";

const STATUSES = ["Mới Nhận","Đang Sửa","Chờ Linh Kiện","Hoàn Thành","Đã Giao"];
const STATUS_STYLE = {
  "Mới Nhận":      { bg:"#e0f2fe", color:"#0369a1", border:"#bae6fd" },
  "Đang Sửa":      { bg:"#fef9c3", color:"#92400e", border:"#fde68a" },
  "Chờ Linh Kiện": { bg:"#fed7aa", color:"#9a3412", border:"#fdba74" },
  "Hoàn Thành":    { bg:"#dcfce7", color:"#065f46", border:"#86efac" },
  "Đã Giao":       { bg:"#f3f4f6", color:"#374151", border:"#d1d5db" },
};
const ISSUES_LIST = ["Bể kính","Hư pin","Mất nguồn","Lỗi FaceID","Vô nước","Màn hình lỗi","Loa lỗi","Camera lỗi","Khác"];

function timeAgo(dt) {
  if (!dt) return "";
  const diff = (Date.now() - new Date(dt)) / 1000;
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff/60)}p`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}ng`;
}

// ── Order Card ──
function OrderCard({ order, onSelect }) {
  const sc = STATUS_STYLE[order.status] || STATUS_STYLE["Mới Nhận"];
  const isOverdue = order.estimated_done_date && new Date(order.estimated_done_date) < new Date() && !["Hoàn Thành","Đã Giao"].includes(order.status);
  return (
    <div onClick={() => onSelect(order)}
      style={{ background:"#fff", borderRadius:14, padding:14, cursor:"pointer", boxShadow:"0 2px 10px rgba(0,0,0,.07)", border: isOverdue?"2px solid #fca5a5":"1.5px solid #f1f5f9", marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <span style={{ fontSize:11, fontWeight:800, color:"#4f46e5", background:"#eef2ff", padding:"2px 8px", borderRadius:6 }}>
          {order.order_code || "#" + order.id?.slice(-6)}
        </span>
        {isOverdue && <span style={{ fontSize:10, color:"#dc2626", fontWeight:700, background:"#fef2f2", padding:"2px 7px", borderRadius:6 }}>⚠️ Trễ</span>}
      </div>
      <div style={{ fontWeight:800, fontSize:14, color:"#1e1b4b", marginBottom:2 }}>{order.customer_name || "Khách hàng"}</div>
      <div style={{ fontSize:13, color:"#4b5563", marginBottom:6 }}>📱 {order.device_model || order.device_name || "—"}</div>
      {order.issue_description && (
        <div style={{ fontSize:12, color:"#6b7280", background:"#f8fafc", borderRadius:8, padding:"4px 8px", marginBottom:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {order.issue_description}
        </div>
      )}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:11, color:"#9ca3af" }}>{timeAgo(order.created_date)}</span>
        {order.assigned_to_name && (
          <span style={{ fontSize:11, color:"#4f46e5", fontWeight:700, background:"#eef2ff", padding:"2px 7px", borderRadius:6 }}>
            🔧 {order.assigned_to_name}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Kanban Board ──
function KanbanBoard({ orders, onSelect }) {
  return (
    <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:16, alignItems:"flex-start" }}>
      {STATUSES.map(status => {
        const cols = orders.filter(o => o.status === status);
        const sc = STATUS_STYLE[status];
        return (
          <div key={status} style={{ minWidth:260, width:270, flexShrink:0 }}>
            <div style={{ background:sc.bg, border:`1.5px solid ${sc.border}`, borderRadius:12, padding:"8px 12px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ color:sc.color, fontWeight:800, fontSize:13 }}>{status}</span>
              <span style={{ background:sc.border, color:sc.color, borderRadius:20, fontSize:12, fontWeight:900, padding:"2px 10px" }}>{cols.length}</span>
            </div>
            {cols.length === 0
              ? <div style={{ textAlign:"center", padding:"20px 0", color:"#cbd5e1", fontSize:13 }}>Không có đơn</div>
              : cols.map(o => <OrderCard key={o.id} order={o} onSelect={onSelect} />)
            }
          </div>
        );
      })}
    </div>
  );
}

// ── List View ──
function ListView({ orders, onSelect }) {
  if (orders.length === 0) return (
    <div style={{ textAlign:"center", padding:60, color:"#9ca3af" }}>
      <div style={{ fontSize:40 }}>📋</div>
      <div style={{ marginTop:8 }}>Chưa có đơn hàng nào</div>
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {orders.map(o => {
        const sc = STATUS_STYLE[o.status] || STATUS_STYLE["Mới Nhận"];
        const isOverdue = o.estimated_done_date && new Date(o.estimated_done_date) < new Date() && !["Hoàn Thành","Đã Giao"].includes(o.status);
        return (
          <div key={o.id} onClick={() => onSelect(o)}
            style={{ background:"#fff", borderRadius:14, padding:16, cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,.06)", border:isOverdue?"2px solid #fca5a5":"1.5px solid #f1f5f9", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:180 }}>
              <div style={{ display:"flex", gap:8, marginBottom:4, flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ fontSize:12, fontWeight:800, color:"#4f46e5", background:"#eef2ff", padding:"2px 8px", borderRadius:6 }}>{o.order_code || "#"+o.id?.slice(-6)}</span>
                <span style={{ fontSize:11, fontWeight:700, background:sc.bg, color:sc.color, border:`1px solid ${sc.border}`, padding:"2px 8px", borderRadius:6 }}>{o.status}</span>
                {isOverdue && <span style={{ fontSize:11, color:"#dc2626", fontWeight:700 }}>⚠️ Trễ</span>}
              </div>
              <div style={{ fontWeight:800, fontSize:15, color:"#1e1b4b" }}>{o.customer_name} <span style={{ color:"#6b7280", fontWeight:400, fontSize:13 }}>{o.customer_phone ? `· ${o.customer_phone}` : ""}</span></div>
              <div style={{ fontSize:13, color:"#4b5563" }}>📱 {o.device_model || o.device_name}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              {o.assigned_to_name && <div style={{ fontSize:12, color:"#4f46e5", fontWeight:700 }}>🔧 {o.assigned_to_name}</div>}
              <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>{timeAgo(o.created_date)}</div>
              {o.final_cost ? <div style={{ fontSize:13, color:"#065f46", fontWeight:800 }}>{Number(o.final_cost).toLocaleString()}đ</div>
               : o.estimated_cost ? <div style={{ fontSize:12, color:"#92400e" }}>~{Number(o.estimated_cost).toLocaleString()}đ</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Order Detail Drawer ──
function OrderDrawer({ order, staff, onClose, onUpdate, onRefresh }) {
  const [chats, setChats] = useState([]);
  const [msg, setMsg]     = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab]     = useState("info");
  const chatEndRef        = useRef(null);

  useEffect(() => { loadChats(); }, [order.id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chats]);

  async function loadChats() {
    try {
      const c = await RepairChat.filter({ order_id: order.id });
      setChats(c.sort((a,b) => new Date(a.created_date)-new Date(b.created_date)));
    } catch {}
  }

  async function sendMsg() {
    if (!msg.trim() || sending) return;
    setSending(true);
    try {
      await RepairChat.create({ order_id:order.id, order_code:order.order_code, sender_id:staff.id, sender_name:staff.full_name, message:msg.trim(), message_type:"text" });
      setMsg("");
      loadChats();
    } catch {}
    setSending(false);
  }

  async function changeStatus(newStatus) {
    await RepairOrder.update(order.id, { status:newStatus, ...(newStatus==="Hoàn Thành"?{done_date:new Date().toISOString()}:{}) });
    onUpdate(order.id, { status:newStatus });
    await RepairChat.create({ order_id:order.id, order_code:order.order_code, sender_id:staff.id, sender_name:staff.full_name, message:`🔄 → ${newStatus}`, message_type:"system" }).catch(()=>{});
    loadChats();
  }

  const sc = STATUS_STYLE[order.status] || STATUS_STYLE["Mới Nhận"];
  const canChangeStatus = ["manager","receptionist"].includes(staff.role) || order.assigned_to === staff.id;
  const infoRows = [
    ["👤 Khách hàng", order.customer_name],
    ["📞 SĐT", order.customer_phone],
    ["📱 Thiết bị", order.device_model || order.device_name],
    ["🔢 IMEI", order.imei],
    ["🔧 Kỹ thuật viên", order.assigned_to_name],
    ["📝 Lỗi", order.issue_description],
    ["💰 Báo giá", order.estimated_cost ? Number(order.estimated_cost).toLocaleString()+"đ" : null],
    ["✅ Thành tiền", order.final_cost ? Number(order.final_cost).toLocaleString()+"đ" : null],
    ["💵 Đã cọc", order.deposit ? Number(order.deposit).toLocaleString()+"đ" : null],
    ["📅 Ngày nhận", order.received_date ? new Date(order.received_date).toLocaleDateString("vi-VN") : null],
    ["⏰ Hẹn trả", order.estimated_done_date ? new Date(order.estimated_done_date).toLocaleDateString("vi-VN") : null],
    ["🛡️ Bảo hành", order.warranty_days ? `${order.warranty_days} ngày` : null],
    ["📝 Ghi chú KTV", order.technician_note],
  ].filter(([,v]) => v);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500 }} onClick={onClose}>
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.5)" }} />
      <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"#fff", borderRadius:"20px 20px 0 0", maxHeight:"90vh", display:"flex", flexDirection:"column", maxWidth:640, margin:"0 auto", boxShadow:"0 -8px 40px rgba(0,0,0,.25)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:"16px 16px 0", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div>
              <div style={{ fontSize:11, color:"#4f46e5", fontWeight:800, background:"#eef2ff", display:"inline-block", padding:"2px 9px", borderRadius:6, marginBottom:4 }}>{order.order_code || "#"+order.id?.slice(-8)}</div>
              <div style={{ fontSize:16, fontWeight:900, color:"#1e1b4b" }}>{order.customer_name}</div>
              <div style={{ fontSize:13, color:"#6b7280" }}>📱 {order.device_model || order.device_name}</div>
            </div>
            <button onClick={onClose} style={{ background:"#f3f4f6", border:"none", width:34, height:34, borderRadius:"50%", cursor:"pointer", fontSize:16, flexShrink:0 }}>✕</button>
          </div>

          {canChangeStatus && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:"#6b7280", fontWeight:700, marginBottom:6 }}>Trạng thái:</div>
              <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
                {STATUSES.map(s => {
                  const c = STATUS_STYLE[s];
                  return (
                    <button key={s} onClick={() => changeStatus(s)}
                      style={{ padding:"6px 12px", borderRadius:20, border:`2px solid ${order.status===s?c.color:c.border}`, background:order.status===s?c.bg:"#fff", color:order.status===s?c.color:"#6b7280", fontWeight:order.status===s?800:600, fontSize:12, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display:"flex", borderBottom:"2px solid #f1f5f9" }}>
            {[{k:"info",l:"📋 Thông tin"},{k:"chat",l:"💬 Chat"}].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                style={{ flex:1, height:40, border:"none", background:"none", fontWeight:tab===t.k?800:600, color:tab===t.k?"#4f46e5":"#6b7280", fontSize:13, cursor:"pointer", borderBottom:tab===t.k?"3px solid #4f46e5":"3px solid transparent", marginBottom:-2 }}>
                {t.l}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto" }}>
          {tab === "info" && (
            <div style={{ padding:16 }}>
              {infoRows.map(([label, value]) => (
                <div key={label} style={{ display:"flex", gap:12, padding:"8px 0", borderBottom:"1px solid #f8fafc" }}>
                  <div style={{ fontSize:13, color:"#6b7280", minWidth:140, flexShrink:0 }}>{label}</div>
                  <div style={{ fontSize:13, color:"#1e1b4b", fontWeight:600 }}>{value}</div>
                </div>
              ))}
              {order.images && order.images.length > 0 && (
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:13, color:"#6b7280", marginBottom:8, fontWeight:700 }}>📸 Hình ảnh</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {order.images.map((img, i) => (
                      <img key={i} src={img} alt="" style={{ width:80, height:80, borderRadius:10, objectFit:"cover", cursor:"pointer" }} onClick={() => window.open(img,"_blank")} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === "chat" && (
            <div style={{ padding:16, display:"flex", flexDirection:"column", gap:8 }}>
              {chats.length === 0 && <div style={{ textAlign:"center", color:"#9ca3af", padding:20, fontSize:13 }}>Chưa có tin nhắn nào</div>}
              {chats.map(c => {
                const isMe = c.sender_id === staff.id;
                const isSys = c.message_type === "system";
                if (isSys) return (
                  <div key={c.id} style={{ textAlign:"center" }}>
                    <span style={{ background:"#f1f5f9", color:"#64748b", fontSize:12, padding:"4px 12px", borderRadius:20 }}>{c.message}</span>
                  </div>
                );
                return (
                  <div key={c.id} style={{ display:"flex", flexDirection:isMe?"row-reverse":"row", gap:8, alignItems:"flex-end" }}>
                    <div style={{ width:30, height:30, borderRadius:"50%", background:isMe?"#4f46e5":"#e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:isMe?"#fff":"#374151", flexShrink:0 }}>
                      {(c.sender_name||"?")[0]}
                    </div>
                    <div style={{ maxWidth:"70%" }}>
                      {!isMe && <div style={{ fontSize:11, color:"#9ca3af", marginBottom:2 }}>{c.sender_name}</div>}
                      <div style={{ background:isMe?"#4f46e5":"#f1f5f9", color:isMe?"#fff":"#1e1b4b", padding:"10px 14px", borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px", fontSize:14, lineHeight:1.4 }}>{c.message}</div>
                      <div style={{ fontSize:11, color:"#9ca3af", marginTop:2, textAlign:isMe?"right":"left" }}>{timeAgo(c.created_date)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {tab === "chat" && (
          <div style={{ padding:12, borderTop:"1px solid #f1f5f9", display:"flex", gap:8, flexShrink:0 }}>
            <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()}
              placeholder="Nhập tin nhắn..." style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e2e8f0", padding:"0 14px", fontSize:14, outline:"none" }} />
            <button onClick={sendMsg} disabled={!msg.trim()||sending}
              style={{ height:44, padding:"0 18px", borderRadius:12, border:"none", background:"#4f46e5", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", opacity:!msg.trim()||sending?0.5:1 }}>
              Gửi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── New Order Modal ──
function NewOrderModal({ staff, onClose, onCreated }) {
  const [form, setForm] = useState({ customer_name:"", customer_phone:"", device_model:"", imei:"", issue_description:"", status:"Mới Nhận", assigned_to:"", assigned_to_name:"", estimated_cost:"", deposit:"", received_date:new Date().toISOString().split("T")[0], estimated_done_date:"", warranty_days:"30" });
  const [techList, setTechList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [custSearch, setCustSearch] = useState("");
  const [issues, setIssues] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    Staff.filter({ is_active:true }).then(s => setTechList(s.filter(x=>["technician","manager"].includes(x.role)))).catch(()=>{});
  }, []);

  useEffect(() => {
    if (custSearch.length < 2) { setCustomers([]); return; }
    const t = setTimeout(() => {
      Customer.list("-created_date").then(all => {
        const q = custSearch.toLowerCase();
        setCustomers(all.filter(c => c.full_name?.toLowerCase().includes(q)||c.phone?.includes(q)).slice(0,5));
      }).catch(()=>{});
    }, 300);
    return () => clearTimeout(t);
  }, [custSearch]);

  function toggleIssue(issue) { setIssues(p => p.includes(issue)?p.filter(x=>x!==issue):[...p, issue]); }

  async function submit() {
    setErr("");
    if (!form.customer_name.trim()) { setErr("Cần nhập tên khách hàng."); return; }
    if (!form.customer_phone.trim()) { setErr("Cần nhập số điện thoại."); return; }
    if (!form.device_model.trim()) { setErr("Cần nhập tên thiết bị."); return; }
    setSaving(true);
    try {
      const orderCode = "SC" + Date.now().toString().slice(-8);
      const allIssues = [...issues];
      if (form.issue_description.trim()) allIssues.push(form.issue_description.trim());
      await RepairOrder.create({
        order_code: orderCode,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        device_name: form.device_model.trim(),
        device_model: form.device_model.trim(),
        imei: form.imei.trim(),
        issue_description: allIssues.join(", "),
        status: "Mới Nhận",
        assigned_to: form.assigned_to || null,
        assigned_to_name: form.assigned_to_name || null,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : 0,
        deposit: form.deposit ? Number(form.deposit) : 0,
        warranty_days: Number(form.warranty_days) || 30,
        received_date: new Date(form.received_date).toISOString(),
        estimated_done_date: form.estimated_done_date ? new Date(form.estimated_done_date).toISOString() : null,
        images: [],
      });
      const existing = await Customer.filter({ phone: form.customer_phone.trim() });
      if (!existing || existing.length === 0) {
        await Customer.create({ full_name:form.customer_name.trim(), phone:form.customer_phone.trim() }).catch(()=>{});
      }
      onCreated();
    } catch { setErr("Lỗi tạo đơn, thử lại nhé!"); }
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:600, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:560, maxHeight:"92vh", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"16px 16px 0", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ fontSize:17, fontWeight:900, color:"#1e1b4b" }}>➕ Tạo đơn sửa chữa</div>
            <button onClick={onClose} style={{ background:"#f3f4f6", border:"none", width:34, height:34, borderRadius:"50%", cursor:"pointer", fontSize:16 }}>✕</button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"0 16px 16px" }}>
          {/* Customer search */}
          <div style={{ marginBottom:12, position:"relative" }}>
            <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Tìm khách hàng (SĐT hoặc tên)</label>
            <input value={custSearch} onChange={e=>{setCustSearch(e.target.value);setForm(p=>({...p,customer_name:e.target.value}));}}
              placeholder="Nhập SĐT hoặc tên..." style={{ width:"100%", height:48, borderRadius:12, border:"1.5px solid #e2e8f0", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
            {customers.length > 0 && (
              <div style={{ position:"absolute", left:0, right:0, top:"100%", border:"1px solid #e2e8f0", borderRadius:12, background:"#fff", boxShadow:"0 4px 12px rgba(0,0,0,.1)", zIndex:10 }}>
                {customers.map(c => (
                  <div key={c.id} onClick={()=>{setForm(p=>({...p,customer_name:c.full_name,customer_phone:c.phone}));setCustSearch(c.full_name);setCustomers([]);}}
                    style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid #f1f5f9" }}>
                    <div style={{ fontWeight:700 }}>{c.full_name}</div>
                    <div style={{ fontSize:12, color:"#6b7280" }}>{c.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {[
            {label:"Tên khách hàng *", key:"customer_name", placeholder:"Nguyễn Văn A"},
            {label:"Số điện thoại *", key:"customer_phone", placeholder:"0901234567", type:"tel"},
            {label:"Tên thiết bị *", key:"device_model", placeholder:"iPhone 15 Pro Max"},
            {label:"IMEI / Serial", key:"imei", placeholder:"358001234567890"},
          ].map(f => (
            <div key={f.key} style={{ marginBottom:12 }}>
              <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>{f.label}</label>
              <input value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} type={f.type||"text"} placeholder={f.placeholder}
                style={{ width:"100%", height:48, borderRadius:12, border:"1.5px solid #e2e8f0", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
            </div>
          ))}

          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:8 }}>Lỗi thiết bị</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {ISSUES_LIST.map(issue => (
                <button key={issue} type="button" onClick={()=>toggleIssue(issue)}
                  style={{ padding:"8px 14px", borderRadius:20, border:`2px solid ${issues.includes(issue)?"#4f46e5":"#e2e8f0"}`, background:issues.includes(issue)?"#eef2ff":"#fff", color:issues.includes(issue)?"#4f46e5":"#6b7280", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                  {issue}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Mô tả thêm</label>
            <textarea value={form.issue_description} onChange={e=>setForm(p=>({...p,issue_description:e.target.value}))} placeholder="Mô tả chi tiết lỗi..."
              style={{ width:"100%", height:70, borderRadius:12, border:"1.5px solid #e2e8f0", padding:"10px 14px", fontSize:14, outline:"none", boxSizing:"border-box", resize:"vertical" }} />
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Phân công kỹ thuật viên</label>
            <select value={form.assigned_to} onChange={e=>{const s=techList.find(x=>x.id===e.target.value);setForm(p=>({...p,assigned_to:e.target.value,assigned_to_name:s?.full_name||""}));}}
              style={{ width:"100%", height:48, borderRadius:12, border:"1.5px solid #e2e8f0", padding:"0 14px", fontSize:15, background:"#fff", cursor:"pointer", outline:"none" }}>
              <option value="">-- Chưa phân công --</option>
              {techList.map(s=><option key={s.id} value={s.id}>{s.full_name} ({s.role==="manager"?"Quản lý":"KTV"})</option>)}
            </select>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Báo giá (đ)</label>
              <input value={form.estimated_cost} onChange={e=>setForm(p=>({...p,estimated_cost:e.target.value}))} type="number" placeholder="500000"
                style={{ width:"100%", height:48, borderRadius:12, border:"1.5px solid #e2e8f0", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Tiền cọc (đ)</label>
              <input value={form.deposit} onChange={e=>setForm(p=>({...p,deposit:e.target.value}))} type="number" placeholder="200000"
                style={{ width:"100%", height:48, borderRadius:12, border:"1.5px solid #e2e8f0", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Ngày nhận</label>
              <input value={form.received_date} onChange={e=>setForm(p=>({...p,received_date:e.target.value}))} type="date"
                style={{ width:"100%", height:48, borderRadius:12, border:"1.5px solid #e2e8f0", padding:"0 14px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Hẹn trả</label>
              <input value={form.estimated_done_date} onChange={e=>setForm(p=>({...p,estimated_done_date:e.target.value}))} type="date"
                style={{ width:"100%", height:48, borderRadius:12, border:"1.5px solid #e2e8f0", padding:"0 14px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>

          {err && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#dc2626", marginBottom:12, fontWeight:600 }}>⚠️ {err}</div>}
        </div>

        <div style={{ padding:16, flexShrink:0, borderTop:"1px solid #f1f5f9" }}>
          <button onClick={submit} disabled={saving}
            style={{ width:"100%", height:54, background:saving?"#9ca3af":"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", border:"none", borderRadius:16, fontSize:17, fontWeight:900, cursor:saving?"not-allowed":"pointer" }}>
            {saving?"⏳ Đang tạo...":"✅ Tạo đơn sửa chữa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Board Page ──
export default function MainBoard({ currentStaff }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState("kanban");
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { loadOrders(); }, []);
  useEffect(() => { const t = setInterval(loadOrders, 20000); return () => clearInterval(t); }, []);

  async function loadOrders() {
    try {
      let all = await RepairOrder.list("-created_date");
      if (currentStaff.role === "technician") all = all.filter(o => o.assigned_to === currentStaff.id);
      setOrders(all);
    } catch {}
    setLoading(false);
  }

  function updateOrder(id, patch) {
    setOrders(p => p.map(o => o.id===id?{...o,...patch}:o));
    setSelected(p => p&&p.id===id?{...p,...patch}:p);
  }

  const filtered = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.order_code||"").toLowerCase().includes(q)||(o.customer_name||"").toLowerCase().includes(q)||(o.customer_phone||"").toLowerCase().includes(q)||(o.device_model||"").toLowerCase().includes(q);
  });

  const canCreate = ["manager","receptionist"].includes(currentStaff.role);

  return (
    <div style={{ padding:"12px 12px 0", maxWidth:1400, margin:"0 auto", width:"100%", boxSizing:"border-box" }}>
      {/* Toolbar */}
      <div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Tìm mã đơn, khách hàng, thiết bị..."
          style={{ flex:1, minWidth:200, height:44, borderRadius:12, border:"1.5px solid #e2e8f0", padding:"0 14px", fontSize:14, outline:"none", background:"#fff" }} />
        <button onClick={()=>setView("kanban")} style={{ height:44, padding:"0 14px", borderRadius:12, border:`2px solid ${view==="kanban"?"#4f46e5":"#e2e8f0"}`, background:view==="kanban"?"#eef2ff":"#fff", color:view==="kanban"?"#4f46e5":"#6b7280", fontWeight:700, fontSize:13, cursor:"pointer" }}>📋 Kanban</button>
        <button onClick={()=>setView("list")} style={{ height:44, padding:"0 14px", borderRadius:12, border:`2px solid ${view==="list"?"#4f46e5":"#e2e8f0"}`, background:view==="list"?"#eef2ff":"#fff", color:view==="list"?"#4f46e5":"#6b7280", fontWeight:700, fontSize:13, cursor:"pointer" }}>📄 Danh sách</button>
        {canCreate && (
          <button onClick={()=>setShowNew(true)} style={{ height:44, padding:"0 18px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", whiteSpace:"nowrap" }}>＋ Tạo đơn</button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:8, marginBottom:12, overflowX:"auto", paddingBottom:4 }}>
        {STATUSES.map(s => {
          const cnt = orders.filter(o=>o.status===s).length;
          const sc = STATUS_STYLE[s];
          return <div key={s} style={{ background:sc.bg, border:`1.5px solid ${sc.border}`, borderRadius:10, padding:"6px 14px", whiteSpace:"nowrap", flexShrink:0 }}><span style={{ color:sc.color, fontWeight:800, fontSize:13 }}>{cnt}</span><span style={{ color:sc.color, fontSize:12, marginLeft:5 }}>{s}</span></div>;
        })}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:60, color:"#9ca3af" }}><div style={{ fontSize:40 }}>⏳</div><div style={{ marginTop:8 }}>Đang tải...</div></div>
      ) : view === "kanban" ? (
        <KanbanBoard orders={filtered} onSelect={setSelected} />
      ) : (
        <ListView orders={filtered} onSelect={setSelected} />
      )}

      {selected && <OrderDrawer order={selected} staff={currentStaff} onClose={()=>setSelected(null)} onUpdate={updateOrder} onRefresh={loadOrders} />}
      {showNew && <NewOrderModal staff={currentStaff} onClose={()=>setShowNew(false)} onCreated={()=>{setShowNew(false);loadOrders();}} />}
    </div>
  );
}
