import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// Các route công khai — không cần đăng nhập
const PUBLIC_ROUTES = ["/OrderPublic", "/order-public"];

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const isPublic = PUBLIC_ROUTES.some(r => path === r || path.startsWith(r + "?") || path.toLowerCase() === r.toLowerCase());
    if (isPublic) {
      // redirect lowercase → PascalCase kèm query string
      navigate("/OrderPublic" + location.search, { replace: true });
    } else {
      navigate("/MainApp", { replace: true });
    }
  }, []);

  return null;
}
