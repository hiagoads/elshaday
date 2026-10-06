import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, FileText, Music2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { youtubeThumb } from "@/lib/api";

export function LyricsButton({ hymn }) {
  if (!hymn.lyrics) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-gold hover:text-gold-light" data-testid={`lyrics-btn-${hymn.id}`}>
          <FileText className="mr-1.5 h-4 w-4" /> Letra
        </Button>
      </DialogTrigger>
      <DialogContent className="border-gold/20 bg-surface">
        <DialogHeader>
          <DialogTitle className="font-display text-gold">{hymn.title}</DialogTitle>
        </DialogHeader>
        <p className="whitespace-pre-line leading-relaxed text-cream/90">{hymn.lyrics}</p>
      </DialogContent>
    </Dialog>
  );
}

export function SpotifyLink({ hymn }) {
  if (!hymn.spotify_url) return null;
  return (
    <Button variant="ghost" size="sm" asChild className="text-cream/70 hover:text-gold">
      <a href={hymn.spotify_url} target="_blank" rel="noopener noreferrer" data-testid={`spotify-link-${hymn.id}`}>
        <ExternalLink className="mr-1.5 h-4 w-4" /> Spotify
      </a>
    </Button>
  );
}

export function ToneBadge({ tone }) {
  if (!tone) return null;
  return (
    <Badge variant="outline" className="border-gold/40 font-mono text-xs text-gold" data-testid="hymn-tone">
      Tom: {tone}
    </Badge>
  );
}

export function HymnCard({ hymn, adminActions = null }) {
  const [playing, setPlaying] = useState(false);
  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="tracing-card overflow-hidden rounded-2xl"
      data-testid={`hymn-card-${hymn.id}`}
    >
      {playing && hymn.youtube_id ? (
        <div className="aspect-video w-full">
          <iframe
            src={`https://www.youtube.com/embed/${hymn.youtube_id}?autoplay=1`}
            title={hymn.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (hymn.youtube_id ? setPlaying(true) : hymn.youtube_url && window.open(hymn.youtube_url, "_blank"))}
          className="group relative block aspect-video w-full overflow-hidden"
          data-testid={`play-hymn-${hymn.id}`}
        >
          {hymn.youtube_id ? (
            <img src={youtubeThumb(hymn.youtube_id)} alt={hymn.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-wine-deep to-surface">
              <Music2 className="h-10 w-10 text-gold/40" />
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-ink/40 transition-colors group-hover:bg-ink/20">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-gold/60 bg-ink/70 text-gold transition-transform group-hover:scale-110">
              <Play className="ml-0.5 h-5 w-5" />
            </span>
          </span>
        </button>
      )}
      <div className="space-y-3 p-4">
        <div>
          <h3 className="font-display text-base font-semibold leading-snug text-cream">{hymn.title}</h3>
          <p className="text-sm text-muted-foreground">{hymn.artist}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone={hymn.tone} />
          {(hymn.tags || []).map((t) => (
            <Badge key={t} variant="secondary" className="bg-wine/40 text-xs text-cream/80">{t}</Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <LyricsButton hymn={hymn} />
          <SpotifyLink hymn={hymn} />
          {adminActions}
        </div>
      </div>
    </motion.article>
  );
}
