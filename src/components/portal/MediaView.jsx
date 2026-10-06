import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Film, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const mediaUrl = (m) => `${API_BASE}/media/${m.id}/file`;

export function MediaView() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    api.get("/media").then((r) => setItems(r.data)).catch(() => setItems([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      await api.post("/admin/media", fd);
      toast.success("Mídia enviada com sucesso");
      setUploadOpen(false);
      setTitle("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (err) {
      toast.error(formatApiError(err, "Não foi possível enviar o arquivo."));
    } finally { setUploading(false); }
  };

  const remove = async (m) => {
    if (!window.confirm(`Remover "${m.title}"?`)) return;
    try {
      await api.delete(`/admin/media/${m.id}`);
      toast.success("Mídia removida");
      load();
    } catch { toast.error("Não foi possível remover."); }
  };

  const filtered = (items || []).filter((m) => !filter || m.media_type === filter);

  if (items === null) {
    return (
      <div className="flex justify-center py-20" data-testid="media-loading">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div data-testid="media-view">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" data-testid="media-filters">
          {[["", "Todas"], ["foto", "Fotos"], ["video", "Vídeos"]].map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)} data-testid={`media-filter-${v || "todas"}`}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${filter === v ? "border-gold bg-gold/15 text-gold" : "border-gold/20 text-cream/60 hover:text-cream"}`}>
              {label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Button onClick={() => setUploadOpen(true)} data-testid="add-media-btn"
            className="rounded-full bg-gold font-semibold text-ink hover:bg-gold-light">
            <Upload className="mr-2 h-4 w-4" /> Enviar mídia
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gold/15 bg-surface/60 p-12 text-center" data-testid="media-empty">
          <ImageIcon className="mx-auto mb-4 h-10 w-10 text-gold/50" />
          <p className="text-cream/70">Nenhuma foto ou vídeo enviado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" data-testid="media-grid">
          {filtered.map((m, i) => (
            <motion.figure
              key={m.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="tracing-card group relative overflow-hidden rounded-2xl"
              data-testid={`media-card-${m.id}`}
            >
              {m.media_type === "foto" ? (
                <button type="button" onClick={() => setViewing(m)} className="block w-full" data-testid={`media-open-${m.id}`}>
                  <img src={mediaUrl(m)} alt={m.title} loading="lazy"
                    className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </button>
              ) : (
                <video src={mediaUrl(m)} controls preload="metadata" className="aspect-square w-full bg-ink object-cover" data-testid={`media-video-${m.id}`} />
              )}
              <figcaption className="flex items-center justify-between gap-2 p-3">
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-cream/70">
                  {m.media_type === "foto" ? <ImageIcon className="h-3.5 w-3.5 shrink-0 text-gold" /> : <Film className="h-3.5 w-3.5 shrink-0 text-gold" />}
                  <span className="truncate">{m.title}</span>
                </span>
                {isAdmin && (
                  <button onClick={() => remove(m)} title="Remover mídia"
                    className="shrink-0 text-cream/40 transition-colors hover:text-red-400" data-testid={`media-delete-${m.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-3xl border-gold/20 bg-ink p-2" data-testid="media-lightbox">
          {viewing && (
            <>
              <DialogHeader className="p-4 pb-2">
                <DialogTitle className="font-display text-gold">{viewing.title}</DialogTitle>
              </DialogHeader>
              <img src={mediaUrl(viewing)} alt={viewing.title} className="max-h-[75vh] w-full rounded-xl object-contain" />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="border-gold/20 bg-surface" data-testid="media-upload-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-gold">Enviar foto ou vídeo</DialogTitle>
          </DialogHeader>
          <form onSubmit={upload} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-cream/80">Arquivo *</Label>
              <Input ref={fileRef} type="file" accept="image/*,video/*" required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="border-gold/20 bg-ink/60 text-cream file:mr-3 file:rounded-full file:border-0 file:bg-gold/15 file:px-4 file:py-1 file:text-xs file:text-gold"
                data-testid="media-file-input" />
              <p className="text-xs text-cream/40">Fotos (JPG, PNG, WebP) ou vídeos (MP4, WebM) até 100 MB.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-cream/80">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Congresso 2026 — passagem de som"
                className="border-gold/20 bg-ink/60 text-cream placeholder:text-cream/30"
                data-testid="media-title-input" />
            </div>
            <Button type="submit" disabled={uploading || !file} data-testid="media-upload-submit"
              className="w-full rounded-full bg-gold font-semibold text-ink hover:bg-gold-light">
              {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Enviar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
