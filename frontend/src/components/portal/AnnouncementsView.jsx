import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { AnnouncementFormDialog, annPayload } from "@/components/portal/AnnouncementFormDialog";
import { Button } from "@/components/ui/button";

export function AnnouncementsView() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    api.get("/announcements").then((r) => setItems(r.data)).catch(() => setItems([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (a) => { setEditing(a); setDialogOpen(true); };

  const toggleFeatured = async (a) => {
    try {
      await api.put(`/admin/announcements/${a.id}`, { ...annPayload(a), is_featured: !a.is_featured });
      toast.success(a.is_featured ? "Destaque removido" : "Aviso marcado como destaque");
      load();
    } catch { toast.error("Não foi possível atualizar."); }
  };

  const remove = async (a) => {
    if (!window.confirm(`Remover o aviso "${a.title}"?`)) return;
    try {
      await api.delete(`/admin/announcements/${a.id}`);
      toast.success("Aviso removido");
      load();
    } catch { toast.error("Não foi possível remover."); }
  };

  if (items === null) {
    return (
      <div className="flex justify-center py-20" data-testid="announcements-loading">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div data-testid="announcements-view">
      {isAdmin && (
        <div className="mb-6 flex justify-end">
          <Button onClick={openNew} data-testid="add-announcement-btn"
            className="rounded-full bg-gold font-semibold text-ink hover:bg-gold-light">
            <Plus className="mr-2 h-4 w-4" /> Novo aviso
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-gold/15 bg-surface/60 p-12 text-center" data-testid="announcements-empty">
          <Megaphone className="mx-auto mb-4 h-10 w-10 text-gold/50" />
          <p className="text-cream/70">Nenhum aviso publicado no momento.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2" data-testid="announcements-list">
          {items.map((a, i) => (
            <div key={a.id} className="flex flex-col gap-2">
              <AnnouncementCard a={a} delay={i * 0.06} />
              {isAdmin && (
                <div className="flex items-center justify-end gap-1" data-testid={`ann-admin-actions-${a.id}`}>
                  <Button variant="ghost" size="sm" onClick={() => toggleFeatured(a)}
                    className={a.is_featured ? "text-gold" : "text-cream/50 hover:text-gold"} data-testid={`ann-featured-${a.id}`}>
                    <Star className="mr-1.5 h-4 w-4" fill={a.is_featured ? "currentColor" : "none"} />
                    {a.is_featured ? "Destacado" : "Destacar"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(a)}
                    className="text-cream/50 hover:text-gold" data-testid={`ann-edit-${a.id}`}>
                    <Pencil className="mr-1.5 h-4 w-4" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(a)}
                    className="text-cream/50 hover:text-red-400" data-testid={`ann-delete-${a.id}`}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Remover
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <AnnouncementFormDialog open={dialogOpen} onOpenChange={setDialogOpen} announcement={editing} onSaved={load} />
      )}
    </div>
  );
}

export function FeaturedBanner({ onOpen }) {
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    api.get("/announcements")
      .then((r) => setFeatured((r.data || []).find((x) => x.is_featured) || null))
      .catch(() => {});
  }, []);

  if (!featured) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="featured-announcement-banner"
      className="halo-gold mb-8 flex w-full items-center gap-4 rounded-2xl border border-gold/40 bg-gradient-to-r from-wine/60 to-surface p-5 text-left transition-colors hover:border-gold/70"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
        <Megaphone className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[0.65rem] uppercase tracking-[0.3em] text-gold">Aviso importante</span>
        <span className="block truncate font-display text-base font-bold text-cream">{featured.title}</span>
      </span>
      <span className="ml-auto hidden shrink-0 text-xs font-semibold text-gold/80 sm:block">Ver detalhes →</span>
    </button>
  );
}
