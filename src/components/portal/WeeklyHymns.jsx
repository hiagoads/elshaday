import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Loader2, Music2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LyricsButton, SpotifyLink, ToneBadge } from "@/components/HymnCard";
import { HymnFormDialog, hymnPayload } from "@/components/portal/HymnFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function WeeklyHymns() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [hymns, setHymns] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    api.get("/hymns/week").then((r) => setHymns(r.data)).catch(() => setHymns([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (h) => { setEditing(h); setDialogOpen(true); };

  const toggleWeekly = async (h) => {
    try {
      await api.put(`/admin/hymns/${h.id}`, { ...hymnPayload(h), is_weekly: !h.is_weekly });
      toast.success(h.is_weekly ? "Removido dos hinos da semana" : "Adicionado aos hinos da semana");
      load();
    } catch { toast.error("Não foi possível atualizar."); }
  };

  const remove = async (h) => {
    if (!window.confirm(`Remover o hino "${h.title}"?`)) return;
    try {
      await api.delete(`/admin/hymns/${h.id}`);
      toast.success("Hino removido");
      load();
    } catch { toast.error("Não foi possível remover."); }
  };

  if (hymns === null) {
    return (
      <div className="flex justify-center py-20" data-testid="weekly-loading">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="weekly-hymns-list">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={openNew} data-testid="weekly-add-hymn-btn"
            className="rounded-full bg-gold font-semibold text-ink hover:bg-gold-light">
            <Plus className="mr-2 h-4 w-4" /> Adicionar hino
          </Button>
        </div>
      )}

      {hymns.length === 0 && (
        <div className="rounded-2xl border border-gold/15 bg-surface/60 p-12 text-center" data-testid="weekly-empty">
          <Music2 className="mx-auto mb-4 h-10 w-10 text-gold/50" />
          <p className="text-cream/70">Os hinos desta semana ainda não foram definidos pela liderança.</p>
        </div>
      )}

      {hymns.map((h, i) => (
        <motion.article
          key={h.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="tracing-card grid gap-6 rounded-2xl p-6 md:grid-cols-[70px_1fr_340px]"
          data-testid={`weekly-hymn-${h.id}`}
        >
          <span className="font-display text-5xl font-black text-gold/30">{String(i + 1).padStart(2, "0")}</span>
          <div className="flex flex-col justify-center">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-bold text-cream">{h.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{h.artist}</p>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 items-center gap-1" data-testid={`weekly-admin-actions-${h.id}`}>
                  <Button variant="ghost" size="icon" onClick={() => toggleWeekly(h)} title="Alternar hino da semana"
                    className={h.is_weekly ? "text-gold" : "text-cream/50 hover:text-gold"} data-testid={`weekly-toggle-${h.id}`}>
                    <Star className="h-4 w-4" fill={h.is_weekly ? "currentColor" : "none"} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(h)} title="Editar hino"
                    className="text-cream/50 hover:text-gold" data-testid={`weekly-edit-${h.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(h)} title="Remover hino"
                    className="text-cream/50 hover:text-red-400" data-testid={`weekly-delete-${h.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ToneBadge tone={h.tone} />
              {(h.tags || []).map((t) => (
                <Badge key={t} variant="secondary" className="bg-wine/40 text-xs text-cream/80">{t}</Badge>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1">
              <LyricsButton hymn={h} />
              <SpotifyLink hymn={h} />
              {!h.youtube_id && h.youtube_url && (
                <Button variant="ghost" size="sm" asChild className="text-cream/70 hover:text-gold">
                  <a href={h.youtube_url} target="_blank" rel="noopener noreferrer" data-testid={`youtube-link-${h.id}`}>
                    <ExternalLink className="mr-1.5 h-4 w-4" /> YouTube
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="aspect-video self-center overflow-hidden rounded-xl border border-gold/10 bg-ink">
            {h.youtube_id ? (
              <iframe
                src={`https://www.youtube.com/embed/${h.youtube_id}`}
                title={h.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Music2 className="h-8 w-8 text-gold/40" />
              </div>
            )}
          </div>
        </motion.article>
      ))}

      {isAdmin && (
        <HymnFormDialog open={dialogOpen} onOpenChange={setDialogOpen} hymn={editing} onSaved={load} />
      )}
    </div>
  );
}
