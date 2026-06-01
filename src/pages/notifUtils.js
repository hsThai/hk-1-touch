// notifUtils.js — tách getNotifSound ra file riêng
// tránh static import Settings mà Settings bị lazy load → gây lỗi Te/Oe
import { AppSettings } from "./pb.jsx";

export async function getNotifSound(type) {
  try {
    const list = await AppSettings.filter({ key: type });
    return list?.[0]?.value || "ding";
  } catch { return "ding"; }
}
