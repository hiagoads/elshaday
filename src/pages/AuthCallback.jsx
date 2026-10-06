import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { FullScreenLoader } from "@/App";

export default function AuthCallback() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const sessionId = new URLSearchParams((location.hash || "").replace(/^#/, "")).get("session_id");
    api
      .post("/auth/google/session", { session_id: sessionId })
      .then((r) => {
        setUser(r.data);
        navigate("/portal", { replace: true, state: { user: r.data } });
      })
      .catch(() => navigate("/acesso", { replace: true }));
  }, [location, navigate, setUser]);

  return <FullScreenLoader />;
}
