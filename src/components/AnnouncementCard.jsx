import { motion } from "framer-motion";
import { CalendarDays, Church, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ICONS = { Agenda: CalendarDays, Congresso: Church, Aviso: Megaphone };

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function formatEventDate(d) {
  if (!d) return null;
  const [y, m, day] = d.split("-").map(Number);
  return `${day} de ${MONTHS[m - 1]} de ${y}`;
}

export function AnnouncementCard({ a, delay = 0 }) {
  const Icon = ICONS[a.category] || Megaphone;
  const date = formatEventDate(a.event_date);
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`tracing-card h-full rounded-2xl p-6 ${a.is_featured ? "halo-gold border-gold/50 bg-gradient-to-br from-wine/40 to-surface" : ""}`}
      data-testid={`announcement-card-${a.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          {a.is_featured && <Badge className="bg-gold/20 text-gold">Destaque</Badge>}
          <Badge variant="secondary" className="bg-wine/40 text-cream/80">{a.category}</Badge>
        </div>
      </div>
      <h3 className="mt-4 font-display text-lg font-bold leading-snug text-cream">{a.title}</h3>
      {date && (
        <p className="mt-1.5 flex items-center gap-1.5 font-mono text-xs text-gold" data-testid={`announcement-date-${a.id}`}>
          <CalendarDays className="h-3.5 w-3.5" /> {date}
        </p>
      )}
      {a.description && (
        <p className="mt-3 text-sm leading-relaxed text-cream/70">{a.description}</p>
      )}
    </motion.article>
  );
}
