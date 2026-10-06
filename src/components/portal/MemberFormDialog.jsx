import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError, maskWhatsApp } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY = { full_name: "", birth_date: "", whatsapp: "", password: "" };

export function MemberFormDialog({ open, onOpenChange, member, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(member
        ? { full_name: member.full_name, birth_date: member.birth_date || "",
            whatsapp: maskWhatsApp(member.whatsapp || ""), password: "" }
        : EMPTY);
    }
  }, [open, member]);

  const set = (k, transform) => (e) =>
    setForm((f) => ({ ...f, [k]: transform ? transform(e.target.value) : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      full_name: form.full_name,
      birth_date: form.birth_date,
      whatsapp: form.whatsapp.replace(/\D/g, ""),
    };
    if (form.password) payload.password = form.password;
    try {
      if (member) await api.put(`/admin/members/${member.id}`, payload);
      else await api.post("/admin/members", payload);
      toast.success(member ? "Integrante atualizado" : "Integrante cadastrado");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err, "Não foi possível salvar o integrante."));
    } finally { setSaving(false); }
  };

  const inputCls = "border-gold/20 bg-ink/60 text-cream placeholder:text-cream/30";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gold/20 bg-surface" data-testid="member-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-gold">{member ? "Editar integrante" : "Adicionar integrante"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-cream/80">Nome completo *</Label>
            <Input value={form.full_name} onChange={set("full_name")} required minLength={3}
              placeholder="Nome do integrante" className={inputCls} data-testid="member-form-name" />
          </div>
          <div className="space-y-2">
            <Label className="text-cream/80">Data de aniversário *</Label>
            <Input type="date" value={form.birth_date} onChange={set("birth_date")} required
              className={`${inputCls} [color-scheme:dark]`} data-testid="member-form-birthdate" />
          </div>
          <div className="space-y-2">
            <Label className="text-cream/80">WhatsApp *</Label>
            <Input value={form.whatsapp} onChange={set("whatsapp", maskWhatsApp)} required
              placeholder="(11) 99999-0000" className={inputCls} data-testid="member-form-whatsapp" />
          </div>
          <div className="space-y-2">
            <Label className="text-cream/80">{member ? "Nova senha (opcional)" : "Senha inicial *"}</Label>
            <Input type="password" value={form.password} onChange={set("password")} minLength={6}
              required={!member}
              placeholder={member ? "Deixe em branco para manter a atual" : "Mínimo 6 caracteres"}
              className={inputCls} data-testid="member-form-password" />
          </div>
          <Button type="submit" disabled={saving} data-testid="member-form-submit"
            className="w-full rounded-full bg-gold font-semibold text-ink hover:bg-gold-light">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : member ? "Salvar alterações" : "Cadastrar integrante"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
