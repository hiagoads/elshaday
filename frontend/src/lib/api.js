import axios from "axios";

export const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API_BASE, withCredentials: true });

let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config || {};
    const url = original.url || "";
    const skip = ["/auth/login", "/auth/register", "/auth/refresh"].some((p) => url.includes(p));
    if (error.response?.status === 401 && !original._retry && !skip) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post("/auth/refresh").finally(() => { refreshing = null; });
        await refreshing;
        return api(original);
      } catch {
        // sessão expirada
      }
    }
    return Promise.reject(error);
  }
);

export function formatApiError(e, fallback = "Algo deu errado. Tente novamente.") {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msg = detail.map((d) => (d && typeof d.msg === "string" ? d.msg : "")).filter(Boolean).join(" ");
    return msg || fallback;
  }
  return fallback;
}

export const youtubeThumb = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

export function waLink(whatsapp, message) {
  const digits = (whatsapp || "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

export function maskWhatsApp(value) {
  const d = (value || "").replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatWhatsApp(value) {
  return maskWhatsApp(value);
}
