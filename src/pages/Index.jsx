import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SPLASH = "https://base44.app/api/apps/69bf5d0a924e0a8766577274/files/mp/public/69bf5d0a924e0a8766577274/cd197582b_robot_splash.webp";

export default function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    // Preload ảnh ngay
    const img = new Image(); img.src = SPLASH;
    const t = setTimeout(() => navigate("/MainApp", { replace: true }), 50);
    return () => clearTimeout(t);
  }, []);
  // Hiện splash ngay thay vì màn trắng
  return (
    <div style={{ minHeight:"100vh", background:"#fff", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
      <img src={SPLASH} alt="HK" style={{ width:220, objectFit:"contain" }} />
      <div style={{ fontWeight:900, fontSize:28, color:"#1e1b4b", marginTop:16 }}>HK One Touch</div>
      <div style={{ color:"#4f46e5", fontSize:14, marginTop:6, fontStyle:"italic" }}>Quản lý với một chạm !</div>
    </div>
  );
}
