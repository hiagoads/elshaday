import { useState } from "react";
import { motion } from "framer-motion";
import { Cake, Loader2, MessageCircle } from "lucide-react";
import { api, formatApiError, maskWhatsApp } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompleteProfile() {
  const { user, setUser } = useAuth();
  const [birthDate, setBirthDate] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.put("/auth/profile", {
        birth_date: birthDate,
        whatsapp: whatsapp.replace(/\D/g, ""),
      });
      setUser(data);
    } catch (err) {
      setError(formatApiError(err, "Não foi possível salvar seus dados."));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "border-gold/20 bg-ink/60 text-cream placeholder:text-cream/30 focus-visible:ring-gold/50";

  return (
    <div className="flex justify-center py-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="tracing-card w-full max-w-md rounded-3xl p-8"
        data-testid="complete-profile-card"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark size={56} />
          <h2 className="font-display text-xl font-bold text-cream">Complete seu cadastro</h2>
          <p className="text-sm text-cream/60">
            Shalom, {(user.full_name || "").split(" ")[0]}! Só faltam sua data de aniversário e seu
            WhatsApp para você aparecer na lista de aniversariantes da banda.
          </p>
        </div>
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" data-testid="profile-error">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-4" data-testid="complete-profile-form">
          <div className="space-y-2">
            <Label htmlFor="cp_birth" className="flex items-center gap-2 text-cream/80">
              <Cake className="h-4 w-4 text-gold" /> Data de aniversário
            </Label>
            <Input id="cp_birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
              required className={`${inputCls} [color-scheme:dark]`} data-testid="profile-birthdate-input" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp_wa" className="flex items-center gap-2 text-cream/80">
              <MessageCircle className="h-4 w-4 text-gold" /> WhatsApp
            </Label>
            <Input id="cp_wa" value={whatsapp} onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))}
              required placeholder="(11) 99999-0000" className={inputCls} data-testid="profile-whatsapp-input" />
          </div>
          <Button type="submit" disabled={loading} data-testid="profile-submit-btn"
            className="halo-gold w-full rounded-full bg-wine py-6 font-display text-sm font-bold tracking-widest text-cream hover:bg-wine-dark">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "CONCLUIR CADASTRO"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
