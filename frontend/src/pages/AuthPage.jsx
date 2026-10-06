import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Chrome, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError, maskWhatsApp } from "@/lib/api";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuthPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ identifier: "", password: "", full_name: "", birth_date: "", whatsapp: "" });

  useEffect(() => {
    if (user) navigate("/portal", { replace: true });
  }, [user, navigate]);

  const set = (k, transform) => (e) =>
    setForm((f) => ({ ...f, [k]: transform ? transform(e.target.value) : e.target.value }));

  const switchMode = (m) => { setMode(m); setError(""); };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/portal";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(form.identifier, form.password);
      navigate("/portal");
    } catch (err) {
      setError(formatApiError(err, "Não foi possível entrar."));
    } finally { setLoading(false); }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await register({
        full_name: form.full_name,
        birth_date: form.birth_date,
        whatsapp: form.whatsapp.replace(/\D/g, ""),
        password: form.password,
      });
      navigate("/portal");
    } catch (err) {
      setError(formatApiError(err, "Não foi possível concluir o cadastro."));
    } finally { setLoading(false); }
  };

  const inputCls = "border-gold/20 bg-ink/60 text-cream placeholder:text-cream/30 focus-visible:ring-gold/50";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 py-12">
      <div className="gold-beam absolute inset-0" />
      <div className="wine-beam absolute inset-0" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-cream/60 transition-colors hover:text-gold" data-testid="back-home-link">
          <ArrowLeft className="h-4 w-4" /> Voltar ao início
        </Link>
        <div className="tracing-card rounded-3xl p-8" data-testid="auth-card">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <BrandMark size={64} />
            <span className="text-gold-gradient font-script text-4xl">El Shaday</span>
            <p className="text-xs uppercase tracking-[0.35em] text-cream/50">Área exclusiva dos integrantes</p>
          </div>

          <Button type="button" onClick={googleLogin} data-testid="google-login-btn"
            className="w-full rounded-full border border-gold/40 bg-ink/70 py-6 font-semibold text-cream transition-colors hover:border-gold hover:bg-gold/10">
            <Chrome className="mr-2 h-5 w-5 text-gold" /> Continuar com Google
          </Button>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-gold/15" />
            <span className="text-xs uppercase tracking-[0.3em] text-cream/40">ou</span>
            <span className="h-px flex-1 bg-gold/15" />
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-full border border-gold/20 bg-ink/60 p-1">
            <button onClick={() => switchMode("login")} data-testid="auth-tab-login"
              className={`rounded-full py-2 text-sm font-semibold transition-colors ${mode === "login" ? "bg-wine text-cream" : "text-cream/60 hover:text-cream"}`}>
              Entrar
            </button>
            <button onClick={() => switchMode("register")} data-testid="auth-tab-register"
              className={`rounded-full py-2 text-sm font-semibold transition-colors ${mode === "register" ? "bg-wine text-cream" : "text-cream/60 hover:text-cream"}`}>
              Cadastrar
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" data-testid="auth-error">
              {error}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={submitLogin} className="space-y-4" data-testid="login-form">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-cream/80">WhatsApp ou e-mail</Label>
                <Input id="identifier" value={form.identifier} onChange={set("identifier")} required
                  placeholder="(11) 99999-0000" className={inputCls} data-testid="login-identifier-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-cream/80">Senha</Label>
                <Input id="password" type="password" value={form.password} onChange={set("password")} required
                  placeholder="Sua senha" className={inputCls} data-testid="login-password-input" />
              </div>
              <Button type="submit" disabled={loading} data-testid="login-submit-btn"
                className="halo-gold w-full rounded-full bg-wine py-6 font-display text-sm font-bold tracking-widest text-cream hover:bg-wine-dark">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "ENTRAR NO PORTAL"}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="space-y-4" data-testid="register-form">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-cream/80">Nome completo</Label>
                <Input id="full_name" value={form.full_name} onChange={set("full_name")} required minLength={3}
                  placeholder="Seu nome completo" className={inputCls} data-testid="register-name-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth_date" className="text-cream/80">Data de aniversário</Label>
                <Input id="birth_date" type="date" value={form.birth_date} onChange={set("birth_date")} required
                  className={`${inputCls} [color-scheme:dark]`} data-testid="register-birthdate-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="text-cream/80">WhatsApp</Label>
                <Input id="whatsapp" value={form.whatsapp} onChange={set("whatsapp", maskWhatsApp)} required
                  placeholder="(11) 99999-0000" className={inputCls} data-testid="register-whatsapp-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg_password" className="text-cream/80">Senha</Label>
                <Input id="reg_password" type="password" value={form.password} onChange={set("password")} required minLength={6}
                  placeholder="Mínimo 6 caracteres" className={inputCls} data-testid="register-password-input" />
              </div>
              <Button type="submit" disabled={loading} data-testid="register-submit-btn"
                className="halo-gold w-full rounded-full bg-wine py-6 font-display text-sm font-bold tracking-widest text-cream hover:bg-wine-dark">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "CRIAR MEU ACESSO"}
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
