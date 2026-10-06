import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const EMPTY = { title: "", category: "Aviso", event_date: "", description: "", is_featured: false };

export function annPayload(a) {
  return {
    title: a.title, description: a.description || "", category: a.category || "Aviso",
    event_date: a.event_date || null, is_featured: !!a.is_featured,
  };
}

export function AnnouncementFormDialog({ open, onOpenChange, announcement, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(announcement
        ? { title: announcement.title, category: announcement.category || "Aviso",
            event_date: announcement.event_date || "", description: announcement.description || "",
            is_featured: !!announcement.is_featured }
        : EMPTY);
    }
  }, [open, announcement]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, event_date: form.event_date || null };
    try {
      if (announcement) await api.put(`/admin/announcements/${announcement.id}`, payload);
      else await api.post("/admin/announcements", payload);
      toast.success(announcement ? "Aviso atualizado" : "Aviso publicado");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err, "Não foi possível salvar o aviso."));
    } finally { setSaving(false); }
  };

  const inputCls = "border-gold/20 bg-ink/60 text-cream placeholder:text-cream/30";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gold/20 bg-surface" data-testid="ann-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-gold">{announcement ? "Editar aviso" : "Novo aviso"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-cream/80">Título *</Label>
            <Input value={form.title} onChange={set("title")} required placeholder="Ex: Congresso de Adoração" className={inputCls} data-testid="ann-form-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-cream/80">Categoria</Label>
              <select value={form.category} onChange={set("category")} data-testid="ann-form-category"
                className="flex h-9 w-full rounded-md border border-gold/20 bg-ink/60 px-3 text-sm text-cream">
                <option value="Aviso">Aviso</option>
                <option value="Agenda">Agenda</option>
                <option value="Congresso">Congresso</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-cream/80">Data (opcional)</Label>
              <Input type="date" value={form.event_date} onChange={set("event_date")} className={`${inputCls} [color-scheme:dark]`} data-testid="ann-form-date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-cream/80">Descrição</Label>
            <Textarea value={form.description} onChange={set("description")} rows={3} placeholder="Detalhes do aviso, horário, local..." className={inputCls} data-testid="ann-form-desc" />
          </div>
          <label className="flex items-center gap-2 text-sm text-cream/80">
            <Checkbox checked={form.is_featured} onCheckedChange={(v) => setForm((f) => ({ ...f, is_featured: !!v }))} data-testid="ann-form-featured" />
            Destacar como aviso importante
          </label>
          <Button type="submit" disabled={saving} data-testid="ann-form-submit"
            className="w-full rounded-full bg-gold font-semibold text-ink hover:bg-gold-light">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : announcement ? "Salvar alterações" : "Publicar aviso"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
