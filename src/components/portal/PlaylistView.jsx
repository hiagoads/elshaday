import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Music2, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { HymnCard } from "@/components/HymnCard";
import { HymnFormDialog, hymnPayload } from "@/components/portal/HymnFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TAGS = ["Adoração", "Jubilo", "Ceia", "Abertura"];

export function PlaylistView() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [hymns, setHymns] = useState(null);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    api.get("/hymns").then((r) => setHymns(r.data)).catch(() => setHymns([]));
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

  const filtered = useMemo(() => {
    if (!hymns) return [];
    const q = search.trim().toLowerCase();
    return hymns.filter((h) => {
      const matchSearch = !q || h.title.toLowerCase().includes(q) || (h.artist || "").toLowerCase().includes(q);
      const matchTag = !tag || (h.tags || []).includes(tag);
      return matchSearch && matchTag;
    });
  }, [hymns, search, tag]);

  if (hymns === null) {
    return (
      <div className="flex justify-center py-20" data-testid="playlist-loading">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const adminActionsFor = (h) => (
    <span className="ml-auto flex items-center gap-0.5" data-testid={`playlist-admin-actions-${h.id}`}>
      <Button variant="ghost" size="icon" onClick={() => toggleWeekly(h)} title="Alternar hino da semana"
        className={`h-8 w-8 ${h.is_weekly ? "text-gold" : "text-cream/50 hover:text-gold"}`} data-testid={`playlist-weekly-${h.id}`}>
        <Star className="h-4 w-4" fill={h.is_weekly ? "currentColor" : "none"} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => openEdit(h)} title="Editar hino"
        className="h-8 w-8 text-cream/50 hover:text-gold" data-testid={`playlist-edit-${h.id}`}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => remove(h)} title="Remover hino"
        className="h-8 w-8 text-cream/50 hover:text-red-400" data-testid={`playlist-delete-${h.id}`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </span>
  );

  return (
    <div data-testid="playlist-view">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar hino ou artista..."
            className="border-gold/20 bg-ink/60 pl-10 text-cream placeholder:text-cream/30"
            data-testid="playlist-search-input"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" data-testid="playlist-tag-filters">
            <button onClick={() => setTag("")} data-testid="tag-filter-all"
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${!tag ? "border-gold bg-gold/15 text-gold" : "border-gold/20 text-cream/60 hover:text-cream"}`}>
              Todos
            </button>
            {TAGS.map((t) => (
              <button key={t} onClick={() => setTag(tag === t ? "" : t)} data-testid={`tag-filter-${t.toLowerCase()}`}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${tag === t ? "border-gold bg-gold/15 text-gold" : "border-gold/20 text-cream/60 hover:text-cream"}`}>
                {t}
              </button>
            ))}
          </div>
          {isAdmin && (
            <Button onClick={openNew} size="sm" data-testid="playlist-add-hymn-btn"
              className="rounded-full bg-gold font-semibold text-ink hover:bg-gold-light">
              <Plus className="mr-1.5 h-4 w-4" /> Adicionar hino
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gold/15 bg-surface/60 p-12 text-center" data-testid="playlist-empty">
          <Music2 className="mx-auto mb-4 h-10 w-10 text-gold/50" />
          <p className="text-cream/70">Nenhum hino encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="playlist-grid">
          {filtered.map((h) => (
            <HymnCard key={h.id} hymn={h} adminActions={isAdmin ? adminActionsFor(h) : null} />
          ))}
        </div>
      )}

      {isAdmin && (
        <HymnFormDialog open={dialogOpen} onOpenChange={setDialogOpen} hymn={editing} onSaved={load} />
      )}
    </div>
  );
}
