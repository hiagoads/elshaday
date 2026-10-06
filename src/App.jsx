import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { BrandMark } from "@/components/Brand";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/AuthPage";
import AuthCallback from "@/pages/AuthCallback";
import Portal from "@/pages/Portal";

export function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink" data-testid="app-loading">
      <div className="flex animate-pulse flex-col items-center gap-4">
        <BrandMark size={72} />
        <span className="text-gold-gradient font-script text-3xl">El Shaday</span>
      </div>
    </div>
  );
}

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null) return <FullScreenLoader />;
  if (user === false) return <Navigate to="/acesso" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  // O retorno do Google OAuth chega com #session_id na URL — processar antes das rotas
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/acesso" element={<AuthPage />} />
      <Route path="/portal" element={<Protected><Portal /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster theme="dark" richColors position="top-center" />
    </AuthProvider>
  );
}
