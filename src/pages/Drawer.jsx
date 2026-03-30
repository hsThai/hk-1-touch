/* v1774860462-5727 */
import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { base44 } from "@/api/base44Client";

const RepairChat = base44.entities.RepairChat;
const Notification = base44.entities.Notification;
const RepairOrder = base44.entities.RepairOrder;

import { QRScanModal } from "./QR";
import { timeAgo, getKpiTimerInfo, MediaViewer, AcceptChecklistModal, AcceptTimer } from "./Viewer";
import SparePartModal from "./Parts";

const STATUS_COLS = [
  { key:"Mới Nhận",        icon:"📥", bg:"#dbeafe", color:"#1d4ed8" },
  { key:"Đang Kiểm Tra",   icon:"🔍", bg:"#fef3c7", color:"#92400e" },
  { key:"Chờ Linh Kiện",   icon:"⏳", bg:"#fce7f3", color:"#9d174d" },
  { key:"Đang Sửa",        icon:"🔧", bg:"#ede9fe", color:"#5b21b6" },
  { key:"Hoàn Thành",      icon:"✅", bg:"#dcfce7", color:"#065f46" },
  { key:"Đã Giao",         icon:"📦", bg:"#f1f5f9", color:"#475569" },
];

function OrderDrawer({ order, onClose, currentUser, onUpdate, users, onShowQR }) {
  const [chatInput, setChatInput] = useState("");
  const [chats, setChats] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatUploading, setChatUploading] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [mentionCursor, setMentionCursor] = useState(0);
  const [mentionList, setMentionList] = useState([]);
  const [pendingMentions, setPendingMentions] = useState([]);
  const [tab, setTab] = useState("info");
  const chatInputRef = useRef();
  const [toast, setToast] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistTarget, setChecklistTarget] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showSparePart, setShowSparePart] = useState(false);
  const [mediaViewer, setMediaViewer] = useState(null);
  const chatRef = useRef();

  useEffect(() => {
    if (tab !== "chat") return;
    let cancelled = false;
    setChatLoading(true);
    RepairChat.filter({ order_id: order.id })
      .then(data => { if (!cancelled) { setChats(data.sort((a,b) => new Date(a.created_date)-new Date(b.created_date))); setChatLoading(false); } })
      .catch(() => { if (!cancelled) setChatLoading(false); });
    return () => { cancelled = true; };
  }, [order.id, tab]);

  // Nhắc nhận máy mỗi 15 phút nếu chưa nhận
  useEffect(() => {
    if ((order.accept_stage||0) >= 1) return;
    if (!order.assigned_to) return;
    if (["Hoàn Thành","Đã Giao"].includes(order.status)) return;
    const iv = setInterval(async () => {
      if ((order.accept_stage||0) >= 1) { clearInterval(iv); return; }
      try {
        await RepairChat.create({
          order_id: order.id,
          order_code: order.id,
          sender_id: "system",
          sender_name: "🤖 Hệ thống",
          message: `⏰ Nhắc nhở: KTV ${users.find(u=>u.id===order.assigned_to)?.name || ""} vui lòng bấm "Nhận máy" cho đơn ${order.id}!`,
          message_type: "system",
        });
        setChats(p => [...p, { id:"remind_"+Date.now(), sender_id:"system", sender_name:"🤖 Hệ thống", message:`⏰ Nhắc nhở: KTV vui lòng bấm "Nhận máy" cho đơn ${order.id}!`, message_type:"system", created_date:new Date().toISOString() }]);
      } catch {}
    }, 15 * 60 * 1000);
    return () => clearInterval(iv);
  }, [order.id, order.accept_stage, order.assigned_to, order.status]);

  useEffect(() => { setTimeout(() => chatRef.current?.scrollIntoView({ behavior:"smooth" }), 80); }, [chats, tab]);

  const getMentionCandidates = useCallback(() => {
    return users.filter(u => {
      if (u.id === currentUser.id) return false;
      if (["manager","receptionist","warehouse"].includes(u.role)) return true;
      if (u.id === order.assigned_to) return true;
      return false;
    });
  }, [users, currentUser.id, order.assigned_to]);

  function handleChatInputChange(e) {
    const val = e.target.value;
    setChatInput(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      const q = atMatch[1].toLowerCase();
      const filtered = getMentionCandidates().filter(u =>
        u.name.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
      );
      setMentionList(filtered);
      setMentionCursor(0);
      setShowMention(filtered.length > 0);
    } else {
      setShowMention(false);
    }
  }

  function pickMention(u) {
    const cursor = chatInputRef.current?.selectionStart || chatInput.length;
    const textBefore = chatInput.slice(0, cursor);
    const textAfter = chatInput.slice(cursor);
    const replaced = textBefore.replace(/@(\w*)$/, `@${u.name} `);
    setChatInput(replaced + textAfter);
    setShowMention(false);
    setPendingMentions(prev => prev.find(p => p.id===u.id) ? prev : [...prev, { id:u.id, name:u.name }]);
    setTimeout(() => chatInputRef.current?.focus(), 50);
  }

  async function sendChat(type="text", mediaUrl=null, mediaText=null) {
    const msgText = type==="text" ? chatInput.trim() : (mediaText||"");
    if (type==="text" && !msgText) return;
    const mentioned_ids = pendingMentions.map(m => m.id);
    const mentioned_names = pendingMentions.map(m => m.name);
    const newMsg = {
      order_id: order.id,
      order_code: order.id,
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      message: msgText,
      message_type: type,
      media_url: mediaUrl || "",
      mentioned_ids,
      mentioned_names,
    };
    const tempId = "tmp_" + Math.random().toString(36);
    setChats(p => [...p, { ...newMsg, id: tempId, created_date: new Date().toISOString() }]);
    if (type==="text") { setChatInput(""); setPendingMentions([]); }
    try {
      const saved = await RepairChat.create(newMsg);
      setChats(p => p.map(m => m.id===tempId ? saved : m));
      if (mentioned_ids.length > 0) {
        mentioned_ids.forEach((uid, i) => {
          Notification.create({
            user_id: uid,
            user_name: mentioned_names[i] || "",
            title: `💬 Bạn được nhắc đến trong ${order.id}`,
            message: `${currentUser.name}: ${msgText.slice(0,80)}`,
            order_id: order.id,
            type: "mention",
            is_read: false,
          }).catch(() => {});
        });
      }
    } catch(err) {
      setChats(p => p.filter(m => m.id!==tempId));
      alert("Gửi thất bại! Thử lại.");
    }
  }

  async function handleMediaUpload(file, type) {
    if (!file) return;
    setChatUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await sendChat(type, file_url, type==="image"?"📷 Ảnh":type==="video"?"🎥 Video":"🎤 Ghi âm");
    } catch(e) {
      alert("Upload thất bại!");
    } finally {
      setChatUploading(false);
    }
  }

  const [recording, setRecording] = useState(false);
  const mediaRecRef = useRef(null);
  const audioChunksRef = useRef([]);

  async function toggleRecording() {
    if (recording) {
      mediaRecRef.current?.stop();
      setRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mr.ondataavailable = e => audioChunksRef.current.push(e.data);
        mr.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(audioChunksRef.current, { type:"audio/webm" });
          const file = new File([blob], "voice_" + Date.now() + ".webm", { type:"audio/webm" });
          await handleMediaUpload(file, "audio");
        };
        mr.start();
        mediaRecRef.current = mr;
        setRecording(true);
      } catch(e) {
        alert("Không thể ghi âm. Kiểm tra quyền microphone!");
      }
    }
  }

  const cust = order.customer_name ? { full_name: order.customer_name, phone: order.customer_phone } : null;
  const assignee = users.find(u => u.id === order.assigned_to);
  const col = STATUS_COLS.find(s => s.key === order.status);
  const isKTV = currentUser.role === "technician";
  const isMyOrder = order.assigned_to === currentUser.id;

  function showToast(msg, type="success") { setToast({msg,type}); setTimeout(() => setToast(null), 3000); }

  function handleChecklistConfirm({ checklist, estMins, note: techNote }) {
    const ord = checklistTarget.ord;
    const stage = checklistTarget.stage;
    const k = `stage${stage}_at`;
    const estDate = new Date(Date.now() + estMins * 60000).toISOString();
    onUpdate(ord.id, {
      accept_stage: stage,
      [k]: new Date().toISOString(),
      status: "Đang Sửa",
      checklist_done: checklist,
      estimated_done: estDate,
      technician_note: techNote || ord.technician_note || "",
    }, null);
    setShowChecklist(false);
    showToast("✅ Đã nhận máy! Bắt đầu sửa chữa.");
  }

  function handleMarkDone() {
    onUpdate(order.id, { status:"Hoàn Thành", accept_stage:3 }, { userId:order.assigned_to, delta:2, note:"Sửa xong +2 KPI" });
    showToast("🎉 Hoàn thành! +2 KPI");
    setEditMode(false);
  }

  const qrContent = order.id;

  return (
    <>
    <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex" }}>
      <div style={{ flex:1, background:"rgba(0,0,0,.45)" }} onClick={onClose} />
      <div style={{ width:Math.min(520,window.innerWidth), height:"100%", background:"#fff", display:"flex", flexDirection:"column", boxShadow:"-8px 0 40px rgba(0,0,0,.2)", overflowX:"hidden", position:"relative" }}>
        {toast && (
          <div style={{ position:"absolute", top:70, left:"50%", transform:"translateX(-50%)", background:toast.type==="success"?"#059669":"#dc2626", color:"#fff", padding:"12px 24px", borderRadius:14, fontWeight:700, zIndex:99, whiteSpace:"nowrap", boxShadow:"0 4px 20px rgba(0,0,0,.2)" }}>
            {toast.msg}
          </div>
        )}
        <div style={{ padding:"14px 16px", background:"#3730a3", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:16 }}>📋 {order.id}</div>
            <span style={{ fontSize:11, background:col?.bg, color:col?.color, padding:"2px 10px", borderRadius:20, fontWeight:700 }}>{col?.icon} {order.status}</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setTab("qr")} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", height:34, padding:"0 12px", borderRadius:8, fontWeight:700, fontSize:12, cursor:"pointer" }}>🖨️ In</button>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", fontSize:17, cursor:"pointer" }}>✕</button>
          </div>
        </div>

        <div style={{ display:"flex", borderBottom:"1px solid #e5e7eb" }}>
          {[["info","📄 Thông tin"],["parts","🔩 Linh kiện"],["chat",`💬 Chat(${chats.length})`],["qr","🖨️ In"]].map(([t,lbl]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex:1, padding:"11px", border:"none", background:"none", fontWeight:700, fontSize:13, cursor:"pointer", borderBottom:tab===t?"3px solid #4f46e5":"3px solid transparent", color:tab===t?"#4f46e5":"#6b7280" }}>
              {lbl}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div style={{ flex:1, overflowY:"auto", padding:18 }}>
            <AcceptTimer order={order} currentUser={currentUser} onUpdate={onUpdate} />
            <div style={{ background:"#eef2ff", borderRadius:14, padding:14, marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>👤 {cust?.full_name}</div>
              <a href={`tel:${cust?.phone}`} style={{ color:"#4f46e5", fontWeight:700, fontSize:15 }}>📞 {cust?.phone}</a>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"📱 Thiết bị", val:order.device_model },
                { label:"👨‍🔧 KTV",    val:assignee?.name||"—" },
                { label:"IMEI",        val:order.imei_serial||"—", mono:true },
                { label:"🔑 Mã PIN",   val:order.passcode||"—", hi:!!order.passcode },
                ...(order.qr_code ? [{ label:"📲 Mã QR", val:order.qr_code, mono:true }] : []),
              ].map(f => (
                <div key={f.label} style={{ background:f.hi?"#fffbeb":"#f9fafb", borderRadius:12, padding:12 }}>
                  <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>{f.label}</div>
                  <div style={{ fontWeight:700, fontSize:13, fontFamily:f.mono?"monospace":"inherit", color:f.hi?"#b45309":"#111", wordBreak:"break-all" }}>{f.val}</div>
                </div>
              ))}
            </div>
            {(order.issues||[]).length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:"#9ca3af", marginBottom:6 }}>🛠️ Lỗi báo cáo:</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {order.issues.map(i => <span key={i} style={{ background:"#fee2e2", color:"#991b1b", fontSize:12, padding:"4px 10px", borderRadius:20, fontWeight:600 }}>{i}</span>)}
                </div>
              </div>
            )}
            {order.notes && <div style={{ background:"#fffbeb", borderRadius:12, padding:12, marginBottom:14, fontSize:14, color:"#92400e" }}>📝 {order.notes}</div>}
            {order.images?.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:"#9ca3af", marginBottom:6 }}>📸 Hình ảnh & video ({order.images.length}):</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {order.images.map((url,i) => (
                    <div key={i} onClick={() => setMediaViewer({ items:order.images, startIndex:i })}
                      style={{ width:84, height:84, borderRadius:12, overflow:"hidden", cursor:"pointer", border:"2px solid #e0e7ff", position:"relative", flexShrink:0, background:"#1f2937" }}>
                      {url.startsWith("video:")
                        ? <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
                            <span style={{ fontSize:28 }}>🎥</span>
                          </div>
                        : <img src={url} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order.needs_reassign && currentUser.role === "manager" && !["Hoàn Thành","Đã Giao"].includes(order.status) && (
              <div style={{ background:"#fef2f2", border:"2px solid #fca5a5", borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
                <div style={{ fontWeight:800, fontSize:15, color:"#dc2626", marginBottom:6 }}>🚨 Hệ thống chuyển việc cho Quản lý</div>
                <div style={{ fontSize:13, color:"#6b7280", marginBottom:12 }}>KTV đã quá 120 phút không Nhận máy. Cần phân công lại.</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {users.filter(u => u.role==="technician" && u.id !== order.assigned_to && u.is_active!==false).map(u => (
                    <button key={u.id} onClick={() => {
                      onUpdate(order.id, { assigned_to: u.id, assigned_at: new Date().toISOString(), accept_stage: 0, needs_reassign: false }, null);
                      showToast("Đã chuyển đơn cho " + u.name);
                    }}
                      style={{ padding:"10px 14px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", textAlign:"left" }}>
                      🔧 {u.name} <span style={{ color:"#6b7280", fontWeight:400, fontSize:12 }}>(KPI: {u.kpi})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!["Hoàn Thành","Đã Giao"].includes(order.status) && (currentUser.role==="manager" || isMyOrder) && (
              <div style={{ marginBottom:14 }}>
                {isKTV && !editMode && (
                  <button onClick={() => setEditMode(true)}
                    style={{ width:"100%", height:52, borderRadius:14, border:"2px solid #4f46e5", background:"#eef2ff", color:"#4f46e5", fontWeight:800, fontSize:16, cursor:"pointer", marginBottom:8 }}>
                    ✏️ Cập nhật trạng thái
                  </button>
                )}
                {(!isKTV || editMode) && (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#374151" }}>⚙️ Chọn trạng thái:</div>
                      {isKTV && <button onClick={() => setEditMode(false)} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:13, cursor:"pointer" }}>✕ Đóng</button>}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                      {STATUS_COLS.filter(c => c.key !== "Đã Giao").map(c => (
                        <button key={c.key} onClick={() => { if(c.key==="Hoàn Thành") handleMarkDone(); else { onUpdate(order.id,{status:c.key},null); setEditMode(false); } }}
                          style={{ padding:"12px 8px", borderRadius:12, border:`2px solid ${order.status===c.key?c.color:"#e5e7eb"}`, background:order.status===c.key?c.bg:"#fff", color:order.status===c.key?c.color:"#374151", fontWeight:700, fontSize:13, cursor:"pointer", textAlign:"center" }}>
                          <div style={{ fontSize:18 }}>{c.icon}</div>
                          <div style={{ fontSize:12, marginTop:2 }}>{c.key}</div>
                        </button>
                      ))}
                    </div>
                    <button onClick={handleMarkDone}
                      style={{ width:"100%", height:54, borderRadius:14, background:"#059669", color:"#fff", border:"none", fontWeight:800, fontSize:17, cursor:"pointer" }}>
                      ✅ Sửa Xong! (+2 KPI)
                    </button>
                  </>
                )}
              </div>
            )}
            {order.estimated_done && (
              <div style={{ background:"#f0fdf4", borderRadius:12, padding:"10px 14px", marginBottom:14, fontSize:13 }}>
                <span style={{ color:"#059669", fontWeight:700 }}>⏱️ Dự kiến xong: </span>
                <span style={{ fontWeight:600 }}>{new Date(order.estimated_done).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"})}</span>
              </div>
            )}
          </div>
        )}

        {tab === "chat" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, position:"relative" }}>
            <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10, background:"#f1f5f9" }}>
              {chatLoading && <div style={{ textAlign:"center", color:"#9ca3af", marginTop:32, fontSize:13 }}>⏳ Đang tải...</div>}
              {!chatLoading && chats.length===0 && <div style={{ textAlign:"center", color:"#9ca3af", marginTop:32, fontSize:13 }}>Chưa có tin nhắn nào</div>}
              {chats.map(msg => {
                const isMe = msg.sender_id === currentUser.id;
                const isSystem = msg.message_type === "system";
                if (isSystem) return (
                  <div key={msg.id} style={{ textAlign:"center", fontSize:12, color:"#9ca3af", padding:"4px 0" }}>
                    <span style={{ background:"#e5e7eb", padding:"3px 12px", borderRadius:12 }}>{msg.message}</span>
                  </div>
                );
                return (
                  <div key={msg.id} style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start", gap:8, alignItems:"flex-end" }}>
                    {!isMe && (
                      <div style={{ width:32, height:32, borderRadius:"50%", background:"#818cf8", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, flexShrink:0 }}>
                        {(msg.sender_name||"?")[0]}
                      </div>
                    )}
                    <div style={{ maxWidth:"78%" }}>
                      {!isMe && <div style={{ fontSize:11, color:"#4f46e5", fontWeight:700, marginBottom:3 }}>{msg.sender_name}</div>}
                      <div style={{ padding: msg.message_type==="text"?"10px 14px":"6px", borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px", background:isMe?"#4f46e5":"#fff", color:isMe?"#fff":"#111", fontSize:14, border:isMe?"none":"1px solid #e5e7eb" }}>
                        {msg.message_type === "image" && msg.media_url && (
                          <img src={msg.media_url} alt="ảnh" style={{ maxWidth:220, maxHeight:220, borderRadius:10, display:"block", cursor:"pointer" }} onClick={() => setMediaViewer({ items:[msg.media_url], startIndex:0 })} />
                        )}
                        {msg.message_type === "video" && msg.media_url && (
                          <video src={msg.media_url} controls style={{ maxWidth:220, borderRadius:10, display:"block" }} />
                        )}
                        {msg.message_type === "audio" && msg.media_url && (
                          <audio src={msg.media_url} controls style={{ maxWidth:220 }} />
                        )}
                        {(msg.message_type === "text" || !msg.media_url) && (
                          <span style={{ whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{msg.message}</span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:"#9ca3af", marginTop:2, textAlign:isMe?"right":"left" }}>{timeAgo(msg.created_date||msg.created)}</div>
                    </div>
                    {isMe && (
                      <div style={{ width:32, height:32, borderRadius:"50%", background:"#4f46e5", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, flexShrink:0 }}>
                        {(currentUser.name||"?")[0]}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatRef} />
            </div>

            {showMention && mentionList.length > 0 && (
              <div style={{ position:"absolute", bottom:70, left:14, right:14, background:"#fff", borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,.18)", border:"1.5px solid #e5e7eb", zIndex:100, overflow:"hidden", maxHeight:200 }}>
                {mentionList.map((u, idx) => (
                  <div key={u.id} onClick={() => pickMention(u)}
                    style={{ padding:"12px 14px", cursor:"pointer", background:idx===mentionCursor?"#eef2ff":"#fff", borderBottom:"1px solid #f9fafb", display:"flex", gap:10, alignItems:"center" }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:"#818cf8", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13 }}>{(u.name||"?")[0]}</div>
                    <span style={{ fontWeight:700, fontSize:14 }}>{u.name}</span>
                  </div>
                ))}
              </div>
            )}

            {pendingMentions.length > 0 && (
              <div style={{ padding:"6px 14px", background:"#eef2ff", display:"flex", flexWrap:"wrap", gap:6, borderTop:"1px solid #e5e7eb" }}>
                {pendingMentions.map(m => (
                  <span key={m.id} style={{ background:"#4f46e5", color:"#fff", borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:4 }}>
                    @{m.name}
                    <span onClick={() => setPendingMentions(p=>p.filter(x=>x.id!==m.id))} style={{ cursor:"pointer", opacity:.7, fontWeight:900 }}>✕</span>
                  </span>
                ))}
              </div>
            )}

            <div style={{ padding:"10px 12px", borderTop:"1px solid #e5e7eb", background:"#fff", display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
              <div style={{ display:"flex", gap:8 }}>
                <label style={{ flex:1, height:40, borderRadius:10, border:"1.5px solid #e5e7eb", background:"#f9fafb", display:"flex", alignItems:"center", justifyContent:"center", gap:6, cursor:"pointer", fontSize:13, fontWeight:600, color:"#374151" }}>
                  📷 Ảnh
                  <input type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={e => e.target.files[0] && handleMediaUpload(e.target.files[0], "image")} />
                </label>
                <label style={{ flex:1, height:40, borderRadius:10, border:"1.5px solid #e5e7eb", background:"#f9fafb", display:"flex", alignItems:"center", justifyContent:"center", gap:6, cursor:"pointer", fontSize:13, fontWeight:600, color:"#374151" }}>
                  🎥 Video
                  <input type="file" accept="video/*" capture="environment" style={{ display:"none" }} onChange={e => e.target.files[0] && handleMediaUpload(e.target.files[0], "video")} />
                </label>
                <button onClick={toggleRecording}
                  style={{ flex:1, height:40, borderRadius:10, border:`1.5px solid ${recording?"#dc2626":"#e5e7eb"}`, background:recording?"#fef2f2":"#f9fafb", color:recording?"#dc2626":"#374151", cursor:"pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  {recording ? "⏹ Dừng" : "🎤 Ghi âm"}
                </button>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", position:"relative" }}>
                {chatUploading && (
                  <div style={{ position:"absolute", inset:0, background:"rgba(255,255,255,.8)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", zIndex:10, fontSize:13, color:"#4f46e5", fontWeight:700 }}>⏳ Đang gửi...</div>
                )}
                <input
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={handleChatInputChange}
                  onKeyDown={e => {
                    if (showMention) {
                      if (e.key==="ArrowDown") { e.preventDefault(); setMentionCursor(c=>Math.min(c+1,mentionList.length-1)); }
                      else if (e.key==="ArrowUp") { e.preventDefault(); setMentionCursor(c=>Math.max(c-1,0)); }
                      else if (e.key==="Enter") { e.preventDefault(); if(mentionList[mentionCursor]) pickMention(mentionList[mentionCursor]); }
                      else if (e.key==="Escape") setShowMention(false);
                    } else if (e.key==="Enter" && !e.shiftKey) {
                      e.preventDefault(); sendChat();
                    }
                  }}
                  placeholder="Nhắn tin... (@ để nhắc người)"
                  style={{ flex:1, height:46, borderRadius:24, border:"1.5px solid #e5e7eb", padding:"0 16px", fontSize:14, outline:"none" }}
                />
                <button onClick={() => sendChat()}
                  style={{ width:46, height:46, borderRadius:"50%", background:"#4f46e5", border:"none", color:"#fff", fontSize:20, cursor:"pointer", flexShrink:0 }}>➤</button>
              </div>
            </div>
          </div>
        )}

        {tab === "parts" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔩</div>
            <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b", marginBottom:6 }}>Quản lý linh kiện</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:20, textAlign:"center" }}>Chọn linh kiện, auto chat kho,<br/>trả linh kiện và bấm Sửa Xong.</div>
            <button onClick={() => setShowSparePart(true)}
              style={{ height:52, padding:"0 32px", background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", border:"none", borderRadius:16, fontWeight:800, fontSize:16, cursor:"pointer" }}>
              🔩 Mở màn hình linh kiện
            </button>
          </div>
        )}

        {showSparePart && (
          <SparePartModal
            order={order}
            currentStaff={currentUser}
            onClose={() => setShowSparePart(false)}
            onDone={() => { setShowSparePart(false); onUpdate(order.id, { status:"Hoàn Thành" }, { userId:order.assigned_to, delta:2, note:"Sửa xong +2 KPI" }); onClose(); }}
          />
        )}

        {tab === "qr" && (
          <div style={{ flex:1, overflowY:"auto", padding:20 }}>
            <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>📋 Chi tiết phiếu sửa</div>
            <div style={{ color:"#6b7280", fontSize:13, marginBottom:16 }}>In phiếu để giao cho khách hoặc lưu hồ sơ</div>
            {/* Phiếu in */}
            <div id="print-receipt" style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:20, marginBottom:16 }}>
              <div style={{ textAlign:"center", marginBottom:16, borderBottom:"1px dashed #e5e7eb", paddingBottom:12 }}>
                <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b" }}>🔧 PHIẾU SỬA CHỮA</div>
                <div style={{ fontWeight:800, fontSize:22, color:"#4f46e5", marginTop:4 }}>{order.id}</div>
                {order.qr_code && <div style={{ fontSize:12, color:"#6b7280", fontFamily:"monospace" }}>QR máy: {order.qr_code}</div>}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                {[
                  { label:"Khách hàng", val: cust?.full_name || "—" },
                  { label:"Số điện thoại", val: cust?.phone || "—" },
                  { label:"Thiết bị", val: order.device_model || "—" },
                  { label:"IMEI", val: order.imei_serial || "—" },
                  { label:"Trạng thái", val: order.status },
                  { label:"KTV phụ trách", val: assignee?.name || "Chưa giao" },
                ].map(f => (
                  <div key={f.label} style={{ background:"#f9fafb", borderRadius:10, padding:10 }}>
                    <div style={{ fontSize:10, color:"#9ca3af", marginBottom:2 }}>{f.label}</div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{f.val}</div>
                  </div>
                ))}
              </div>
              {(order.issues||[]).length > 0 && (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>🛠️ Lỗi:</div>
                  <div style={{ fontSize:13, color:"#991b1b", fontWeight:600 }}>{(order.issues||[]).join(", ")}</div>
                </div>
              )}
              {order.notes && (
                <div style={{ background:"#fffbeb", borderRadius:10, padding:"8px 12px", fontSize:13, color:"#92400e" }}>
                  📝 {order.notes}
                </div>
              )}
              {order.estimated_done && (
                <div style={{ marginTop:10, fontSize:13, color:"#059669", fontWeight:600 }}>
                  ⏱️ Dự kiến xong: {new Date(order.estimated_done).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"})}
                </div>
              )}
              <div style={{ marginTop:14, paddingTop:12, borderTop:"1px dashed #e5e7eb", fontSize:11, color:"#9ca3af", textAlign:"center" }}>
                Ngày tiếp nhận: {order.created ? new Date(order.created).toLocaleDateString("vi-VN") : "—"}
              </div>
            </div>
            <button onClick={() => window.print()}
              style={{ width:"100%", height:52, borderRadius:14, background:"#1e1b4b", color:"#fff", border:"none", fontWeight:800, fontSize:16, cursor:"pointer" }}>
              🖨️ In phiếu
            </button>
          </div>
        )}
      </div>
    </div>
    {showChecklist && checklistTarget && (
      <AcceptChecklistModal
        order={checklistTarget.ord}
        onConfirm={handleChecklistConfirm}
        onClose={() => setShowChecklist(false)}
      />
    )}
    {mediaViewer && (
      <MediaViewer
        items={mediaViewer.items}
        startIndex={mediaViewer.startIndex}
        onClose={() => setMediaViewer(null)}
      />
    )}
    </>
  );
}

export { OrderDrawer };