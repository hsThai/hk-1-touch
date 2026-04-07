import React, { useRef, useState, useEffect } from "react";
import { RepairOrder, OrderHistory } from "./pb.jsx";

const CHECKLIST_ITEMS = [
  { key:"device_on",      label:"Máy mở lên được" },
  { key:"screen_ok",      label:"Màn hình không xước / vỡ" },
  { key:"camera_ok",      label:"Camera hoạt động" },
  { key:"charge_ok",      label:"Sạc pin bình thường" },
  { key:"speaker_ok",     label:"Loa / micro rõ" },
  { key:"has_charger",    label:"Có kèm sạc / cáp" },
  { key:"has_case",       label:"Có kèm bao da / ốp lưng" },
  { key:"has_earphone",   label:"Có kèm tai nghe" },
  { key:"has_accessories",label:"Đủ phụ kiện khác" },
  { key:"passcode_given", label:"Đã cung cấp mật khẩu máy" },
];

export default function HandoverModal({ order, currentUser, onClose, onDone }) {
  const [step, setStep]             = useState(1); // 1=Checklist, 2=Chữ ký, 3=Media, 4=Xác nhận
  const [checklist, setChecklist]   = useState({});
  const [note, setNote]             = useState("");
  const [finalCost, setFinalCost]   = useState(order.final_cost ?? "");
  const [signature, setSignature]   = useState(null); // base64
  const [media, setMedia]           = useState([]);   // [{url,type}]
  const [uploading, setUploading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef  = useRef(null);
  const drawing    = useRef(false);
  const fileRef    = useRef(null);

  const deposit    = Number(order.deposit || 0);
  const total      = Number(finalCost || order.final_cost || 0);
  const remaining  = Math.max(0, total - deposit);

  // ── Canvas chữ ký ──
  useEffect(() => {
    if (step !== 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1e1b4b";
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: (src.clientX - r.left) * (canvas.width / r.width), y: (src.clientY - r.top) * (canvas.height / r.height) };
    };

    const start = (e) => { e.preventDefault(); drawing.current = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    const move  = (e) => { e.preventDefault(); if (!drawing.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const end   = ()  => { drawing.current = false; setSignature(canvas.toDataURL("image/png")); };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup",   end);
    canvas.addEventListener("touchstart", start, { passive:false });
    canvas.addEventListener("touchmove",  move,  { passive:false });
    canvas.addEventListener("touchend",   end);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup",   end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove",  move);
      canvas.removeEventListener("touchend",   end);
    };
  }, [step]);

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  }

  async function handleMediaUpload(e) {
    const files = Array.from(e.target.files);
    setUploading(true);
    for (const file of files) {
      const reader = new FileReader();
      await new Promise(res => {
        reader.onload = ev => {
          setMedia(prev => [...prev, { url: ev.target.result, type: file.type.startsWith("video") ? "video" : "image", name: file.name }]);
          res();
        };
        reader.readAsDataURL(file);
      });
    }
    setUploading(false);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onDone({
        handover_at:  new Date().toISOString(),
        checklist,
        note,
        signature,
        media:        JSON.stringify(media.map(m => ({ url: m.url, type: m.type }))),
        final_cost:   Number(finalCost) || order.final_cost || 0,
      });
    } catch(e) { alert("Lỗi: " + e.message); }
    setSubmitting(false);
  }

  const MI = ({ name, style }) => <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:20, verticalAlign:"middle", lineHeight:1, userSelect:"none", ...style }}>{name}</span>;

  const STEPS = ["Kiểm tra", "Chữ ký", "Media", "Xác nhận"];

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.65)", display:"flex", alignItems:"flex-end" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width:"100%", maxHeight:"92vh", background:"#fff", borderRadius:"24px 24px 0 0", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#0369a1,#0891b2)", padding:"16px 18px", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ color:"#fff", fontWeight:900, fontSize:17, display:"flex", alignItems:"center", gap:8 }}>
              <MI name="handshake" style={{ fontSize:22, color:"#fff" }} />
              Bàn Giao Máy
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:32, height:32, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <MI name="close" style={{ fontSize:18, color:"#fff" }} />
            </button>
          </div>
          {/* Step indicator */}
          <div style={{ display:"flex", gap:4 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ flex:1, textAlign:"center" }}>
                <div style={{ height:4, borderRadius:4, background: i+1 <= step ? "#fff" : "rgba(255,255,255,.3)", marginBottom:4, transition:"background .3s" }} />
                <div style={{ fontSize:10, color: i+1 === step ? "#fff" : "rgba(255,255,255,.5)", fontWeight: i+1 === step ? 800 : 500 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 16px 0" }}>

          {/* ── STEP 1: Checklist ── */}
          {step === 1 && (
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:"#1e1b4b", marginBottom:12 }}>
                <MI name="checklist" style={{ fontSize:18, color:"#0369a1", marginRight:6 }} />
                Kiểm tra trước khi giao
              </div>

              {/* Thông tin đơn + thanh toán */}
              <div style={{ background:"#f0f9ff", border:"1.5px solid #bae6fd", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
                <div style={{ fontWeight:800, fontSize:14, color:"#0c4a6e", marginBottom:8 }}>
                  {order.order_code || order.id} · {order.customer_name}
                </div>
                <div style={{ fontSize:13, color:"#374151", marginBottom:4 }}>{order.device_name} {order.device_model}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:10 }}>
                  <div style={{ background:"#fff", borderRadius:10, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:11, color:"#6b7280", marginBottom:2 }}>Tổng tiền</div>
                    <input value={finalCost} onChange={e => setFinalCost(e.target.value)} type="number" inputMode="numeric"
                      style={{ width:"100%", border:"none", outline:"none", textAlign:"center", fontWeight:800, fontSize:14, color:"#059669", background:"transparent" }}
                      placeholder={order.final_cost||"0"} />
                  </div>
                  <div style={{ background:"#fff", borderRadius:10, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:11, color:"#6b7280", marginBottom:2 }}>Đã cọc</div>
                    <div style={{ fontWeight:800, fontSize:14, color:"#4f46e5" }}>{deposit.toLocaleString()}đ</div>
                  </div>
                  <div style={{ background: remaining > 0 ? "#fff1f2" : "#f0fdf4", borderRadius:10, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:11, color:"#6b7280", marginBottom:2 }}>Còn lại</div>
                    <div style={{ fontWeight:900, fontSize:14, color: remaining > 0 ? "#dc2626" : "#059669" }}>{remaining.toLocaleString()}đ</div>
                  </div>
                </div>
              </div>

              {/* Checklist items */}
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                {CHECKLIST_ITEMS.map(item => (
                  <label key={item.key} style={{ display:"flex", alignItems:"center", gap:12, background: checklist[item.key] ? "#f0fdf4" : "#f9fafb", borderRadius:12, padding:"12px 14px", border:`1.5px solid ${checklist[item.key] ? "#86efac" : "#e5e7eb"}`, cursor:"pointer", transition:"all .15s" }}>
                    <div style={{ width:24, height:24, borderRadius:6, border:`2px solid ${checklist[item.key] ? "#059669" : "#d1d5db"}`, background: checklist[item.key] ? "#059669" : "#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .15s" }}
                      onClick={() => setChecklist(p => ({ ...p, [item.key]: !p[item.key] }))}>
                      {checklist[item.key] && <MI name="check" style={{ fontSize:16, color:"#fff" }} />}
                    </div>
                    <span style={{ fontSize:14, fontWeight: checklist[item.key] ? 700 : 500, color: checklist[item.key] ? "#065f46" : "#374151" }}>{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Ghi chú */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>Ghi chú bàn giao</div>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                  placeholder="Tình trạng máy khi giao, lưu ý cho khách..."
                  style={{ width:"100%", borderRadius:12, border:"1.5px solid #e5e7eb", padding:"10px 12px", fontSize:13, resize:"none", boxSizing:"border-box", outline:"none" }} />
              </div>
            </div>
          )}

          {/* ── STEP 2: Chữ ký ── */}
          {step === 2 && (
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:"#1e1b4b", marginBottom:4 }}>
                <MI name="draw" style={{ fontSize:18, color:"#0369a1", marginRight:6 }} />
                Chữ ký xác nhận của khách
              </div>
              <div style={{ fontSize:12, color:"#6b7280", marginBottom:12 }}>Khách ký tay trực tiếp trên màn hình để xác nhận đã nhận máy</div>

              <div style={{ background:"#f8fafc", borderRadius:16, border:"2px dashed #cbd5e1", overflow:"hidden", marginBottom:12, position:"relative" }}>
                <canvas ref={canvasRef} width={480} height={200}
                  style={{ width:"100%", height:200, display:"block", cursor:"crosshair", touchAction:"none" }} />
                {!signature && (
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                    <div style={{ textAlign:"center", color:"#cbd5e1" }}>
                      <MI name="draw" style={{ fontSize:40, color:"#cbd5e1", display:"block", margin:"0 auto 8px" }} />
                      <div style={{ fontSize:13 }}>Ký tên tại đây</div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                <button onClick={clearSignature} style={{ flex:1, height:40, background:"#f3f4f6", border:"none", borderRadius:10, fontSize:13, fontWeight:700, color:"#6b7280", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  <MI name="clear" style={{ fontSize:16, color:"#6b7280" }} /> Xóa ký
                </button>
                <div style={{ flex:1, height:40, background: signature ? "#f0fdf4" : "#f9fafb", border:`1.5px solid ${signature ? "#86efac" : "#e5e7eb"}`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  <MI name={signature ? "check_circle" : "edit"} style={{ fontSize:16, color: signature ? "#059669" : "#9ca3af" }} />
                  <span style={{ fontSize:12, fontWeight:700, color: signature ? "#059669" : "#9ca3af" }}>{signature ? "Đã ký" : "Chưa ký"}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Media ── */}
          {step === 3 && (
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:"#1e1b4b", marginBottom:4 }}>
                <MI name="photo_camera" style={{ fontSize:18, color:"#0369a1", marginRight:6 }} />
                Chụp ảnh / Quay clip bàn giao
              </div>
              <div style={{ fontSize:12, color:"#6b7280", marginBottom:14 }}>Chụp hình trạng thái máy hoặc quay clip khi trao máy cho khách</div>

              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                <button onClick={() => { fileRef.current.accept = "image/*"; fileRef.current.capture = "environment"; fileRef.current.click(); }}
                  style={{ flex:1, height:52, background:"#eff6ff", border:"1.5px dashed #93c5fd", borderRadius:14, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, color:"#1d4ed8", fontWeight:700, fontSize:12 }}>
                  <MI name="photo_camera" style={{ fontSize:24, color:"#1d4ed8" }} /> Chụp ảnh
                </button>
                <button onClick={() => { fileRef.current.accept = "video/*"; fileRef.current.capture = "environment"; fileRef.current.click(); }}
                  style={{ flex:1, height:52, background:"#f5f3ff", border:"1.5px dashed #c4b5fd", borderRadius:14, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, color:"#6d28d9", fontWeight:700, fontSize:12 }}>
                  <MI name="videocam" style={{ fontSize:24, color:"#6d28d9" }} /> Quay clip
                </button>
                <button onClick={() => { fileRef.current.accept = "image/*,video/*"; fileRef.current.removeAttribute("capture"); fileRef.current.click(); }}
                  style={{ flex:1, height:52, background:"#f0fdf4", border:"1.5px dashed #86efac", borderRadius:14, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, color:"#059669", fontWeight:700, fontSize:12 }}>
                  <MI name="perm_media" style={{ fontSize:24, color:"#059669" }} /> Thư viện
                </button>
              </div>
              <input ref={fileRef} type="file" multiple style={{ display:"none" }} onChange={handleMediaUpload} />

              {uploading && <div style={{ textAlign:"center", color:"#6b7280", fontSize:13, marginBottom:10 }}>⏳ Đang xử lý...</div>}

              {media.length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
                  {media.map((m, i) => (
                    <div key={i} style={{ position:"relative", borderRadius:12, overflow:"hidden", aspectRatio:"1", background:"#f1f5f9" }}>
                      {m.type === "video"
                        ? <video src={m.url} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        : <img src={m.url} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                      }
                      <button onClick={() => setMedia(prev => prev.filter((_, j) => j !== i))}
                        style={{ position:"absolute", top:4, right:4, background:"rgba(0,0,0,.5)", border:"none", borderRadius:"50%", width:22, height:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <MI name="close" style={{ fontSize:14, color:"#fff" }} />
                      </button>
                      {m.type === "video" && (
                        <div style={{ position:"absolute", bottom:4, left:4, background:"rgba(0,0,0,.5)", borderRadius:6, padding:"2px 6px" }}>
                          <MI name="videocam" style={{ fontSize:12, color:"#fff" }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {media.length === 0 && (
                <div style={{ textAlign:"center", padding:"24px 0 16px", color:"#9ca3af" }}>
                  <MI name="add_photo_alternate" style={{ fontSize:48, color:"#d1d5db", display:"block", margin:"0 auto 8px" }} />
                  <div style={{ fontSize:13 }}>Chưa có ảnh/clip nào</div>
                  <div style={{ fontSize:11, marginTop:4 }}>(Bước này không bắt buộc)</div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: Xác nhận ── */}
          {step === 4 && (
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:"#1e1b4b", marginBottom:14 }}>
                <MI name="fact_check" style={{ fontSize:18, color:"#0369a1", marginRight:6 }} />
                Xác nhận bàn giao
              </div>

              {/* Tóm tắt */}
              <div style={{ background:"#f0f9ff", border:"1.5px solid #bae6fd", borderRadius:14, padding:"14px 16px", marginBottom:12 }}>
                <div style={{ fontWeight:800, fontSize:14, color:"#0c4a6e", marginBottom:10 }}>📋 Tóm tắt bàn giao</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                  <div><div style={{ fontSize:11, color:"#6b7280" }}>Khách hàng</div><div style={{ fontSize:13, fontWeight:700 }}>{order.customer_name}</div></div>
                  <div><div style={{ fontSize:11, color:"#6b7280" }}>Thiết bị</div><div style={{ fontSize:13, fontWeight:700 }}>{order.device_model}</div></div>
                  <div><div style={{ fontSize:11, color:"#6b7280" }}>Tổng tiền</div><div style={{ fontSize:13, fontWeight:800, color:"#059669" }}>{Number(finalCost||order.final_cost||0).toLocaleString()}đ</div></div>
                  <div><div style={{ fontSize:11, color:"#6b7280" }}>Còn thu</div><div style={{ fontSize:13, fontWeight:800, color: remaining > 0 ? "#dc2626" : "#059669" }}>{remaining.toLocaleString()}đ</div></div>
                </div>

                {/* Checklist summary */}
                <div style={{ fontSize:11, color:"#6b7280", marginBottom:6 }}>
                  ✅ {Object.values(checklist).filter(Boolean).length}/{CHECKLIST_ITEMS.length} mục đã kiểm tra
                </div>

                {/* Signature preview */}
                {signature && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, color:"#6b7280", marginBottom:4 }}>Chữ ký khách</div>
                    <img src={signature} style={{ width:120, height:50, objectFit:"contain", border:"1px solid #e5e7eb", borderRadius:8, background:"#fff" }} alt="Chữ ký" />
                  </div>
                )}

                {media.length > 0 && (
                  <div style={{ fontSize:11, color:"#059669", fontWeight:700 }}>📷 {media.length} ảnh/clip đính kèm</div>
                )}
                {note && <div style={{ fontSize:12, color:"#374151", marginTop:6, fontStyle:"italic" }}>"{note}"</div>}
              </div>

              <div style={{ background:"#fef3c7", border:"1.5px solid #fcd34d", borderRadius:12, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#92400e", display:"flex", gap:8, alignItems:"flex-start" }}>
                <MI name="info" style={{ fontSize:16, color:"#d97706", flexShrink:0 }} />
                <span>Sau khi xác nhận, trạng thái đơn chuyển sang <b>"Đã Giao"</b> và không thể hoàn tác.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div style={{ padding:"12px 16px 20px", background:"#fff", borderTop:"1px solid #f3f4f6", flexShrink:0, display:"flex", gap:10 }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s-1)} style={{ width:48, height:52, background:"#f3f4f6", border:"none", borderRadius:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <MI name="arrow_back" style={{ fontSize:20, color:"#374151" }} />
            </button>
          )}
          {step < 4 && (
            <button onClick={() => setStep(s => s+1)}
              style={{ flex:1, height:52, background:"linear-gradient(135deg,#0369a1,#0891b2)", border:"none", borderRadius:14, color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              Tiếp theo <MI name="arrow_forward" style={{ fontSize:20, color:"#fff" }} />
            </button>
          )}
          {step === 4 && (
            <button onClick={handleSubmit} disabled={submitting}
              style={{ flex:1, height:56, background: submitting ? "#9ca3af" : "linear-gradient(135deg,#059669,#047857)", border:"none", borderRadius:14, color:"#fff", fontWeight:900, fontSize:17, cursor: submitting ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:"0 4px 16px rgba(5,150,105,.35)" }}>
              <MI name="handshake" style={{ fontSize:22, color:"#fff" }} />
              {submitting ? "Đang lưu..." : "Xác nhận Bàn Giao"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
