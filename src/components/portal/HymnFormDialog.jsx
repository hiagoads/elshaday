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

const EMPTY = { title: "", artist: "", tone: "", tags: "", youtube_url: "", spotify_url: "", lyrics: "", is_weekly: false, week_order: 0 };

export function hymnPayload(h) {
  return {
    title: h.title, artist: h.artist || "", tone: h.tone || "", tags: h.tags || [],
    youtube_url: h.youtube_url || null, spotify_url: h.spotify_url || null,
    lyrics: h.lyrics || null, is_weekly: !!h.is_weekly, week_order: h.week_order || 0,
  };
}

export function HymnFormDialog({ open, onOpenChange, hymn, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(hymn
        ? { title: hymn.title, artist: hymn.artist || "", tone: hymn.tone || "",
            tags: (hymn.tags || []).join(", "), youtube_url: hymn.youtube_url || "",
            spotify_url: hymn.spotify_url || "", lyrics: hymn.lyrics || "",
            is_weekly: !!hymn.is_weekly, week_order: hymn.week_order || 0 }
        : EMPTY);
    }
  }, [open, hymn]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      week_order: Number(form.week_order) || 0,
    };
    try {
      if (hymn) await api.put(`/admin/hymns/${hymn.id}`, payload);
      else await api.post("/admin/hymns", payload);
      toast.success(hymn ? "Hino atualizado" : "Hino cadastrado");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err, "Não foi possível salvar o hino."));
    } finally { setSaving(false); }
  };

  const inputCls = "border-gold/20 bg-ink/60 text-cream placeholder:text-cream/30";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gold/20 bg-surface" data-testid="hymn-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-gold">{hymn ? "Editar hino" : "Novo hino"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-cream/80">Título *</Label>
            <Input value={form.title} onChange={set("title")} required className={inputCls} data-testid="hymn-form-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-cream/80">Artista</Label>
              <Input value={form.artist} onChange={set("artist")} className={inputCls} data-testid="hymn-form-artist" />
            </div>
            <div className="space-y-2">
              <Label className="text-cream/80">Tom</Label>
              <Input value={form.tone} onChange={set("tone")} placeholder="Ex: G" className={inputCls} data-testid="hymn-form-tone" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-cream/80">Tags (separadas por vírgula)</Label>
            <Input value={form.tags} onChange={set("tags")} placeholder="Adoração, Ceia" className={inputCls} data-testid="hymn-form-tags" />
          </div>
          <div className="space-y-2">
            <Label className="text-cream/80">Link do YouTube</Label>
            <Input value={form.youtube_url} onChange={set("youtube_url")} placeholder="https://www.youtube.com/watch?v=..." className={inputCls} data-testid="hymn-form-youtube" />
          </div>
          <div className="space-y-2">
            <Label className="text-cream/80">Link do Spotify</Label>
            <Input value={form.spotify_url} onChange={set("spotify_url")} placeholder="https://open.spotify.com/track/..." className={inputCls} data-testid="hymn-form-spotify" />
          </div>
          <div className="space-y-2">
            <Label className="text-cream/80">Letra (trecho)</Label>
            <Textarea value={form.lyrics} onChange={set("lyrics")} rows={3} className={inputCls} data-testid="hymn-form-lyrics" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-cream/80">
              <Checkbox checked={form.is_weekly} onCheckedChange={(v) => setForm((f) => ({ ...f, is_weekly: !!v }))} data-testid="hymn-form-weekly" />
              Hino da semana
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-cream/80">Ordem</Label>
              <Input type="number" min={0} value={form.week_order} onChange={set("week_order")} className={`${inputCls} w-20`} data-testid="hymn-form-order" />
            </div>
          </div>
          <Button type="submit" disabled={saving} data-testid="hymn-form-submit"
            className="w-full rounded-full bg-gold font-semibold text-ink hover:bg-gold-light">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : hymn ? "Salvar alterações" : "Adicionar hino"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
