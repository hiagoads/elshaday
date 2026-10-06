import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Cake, Gift, Loader2, MessageCircle, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { api, formatWhatsApp, waLink } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MemberFormDialog } from "@/components/portal/MemberFormDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function congratsMessage(name) {
  return `Feliz aniversário, ${name}! Que Deus derrame as mais ricas bênçãos sobre a sua vida. Com carinho, Banda El Shaday.`;
}

function CongratsButton({ member }) {
  const link = waLink(member.whatsapp, congratsMessage(member.full_name.split(" ")[0]));
  if (!link) return null;
  return (
    <Button size="sm" asChild className="rounded-full bg-gold text-ink hover:bg-gold-light">
      <a href={link} target="_blank" rel="noopener noreferrer" data-testid={`whatsapp-link-member-${member.id}`}>
        <MessageCircle className="mr-1.5 h-4 w-4" /> Parabéns
      </a>
    </Button>
  );
}

export function BirthdaysView() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [members, setMembers] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    api.get("/members/birthdays").then((r) => setMembers(r.data)).catch(() => setMembers([]));
    if (isAdmin) {
      api.get("/admin/members").then((r) => setAllMembers(r.data)).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (m) => { setEditing(m); setDialogOpen(true); };

  const removeMember = async (m) => {
    if (!window.confirm(`Remover o integrante "${m.full_name}"? Ele perderá o acesso ao portal.`)) return;
    try {
      await api.delete(`/admin/members/${m.id}`);
      toast.success("Integrante removido");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Não foi possível remover.");
    }
  };

  const { today, thisMonth, upcoming } = useMemo(() => {
    const list = members || [];
    return {
      today: list.filter((m) => m.is_today),
      thisMonth: list.filter((m) => m.is_this_month && !m.is_today),
      upcoming: list.filter((m) => !m.is_this_month),
    };
  }, [members]);

  if (members === null) {
    return (
      <div className="flex justify-center py-20" data-testid="birthdays-loading">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-10" data-testid="birthdays-view">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={openNew} data-testid="add-member-btn"
            className="rounded-full bg-gold font-semibold text-ink hover:bg-gold-light">
            <UserPlus className="mr-2 h-4 w-4" /> Adicionar integrante
          </Button>
        </div>
      )}

      {today.length > 0 && (
        <section data-testid="birthdays-today">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-gold">
            <Gift className="h-5 w-5" /> Aniversariantes de hoje
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {today.map((m) => (
              <motion.div key={m.id} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="halo-gold flex items-center justify-between rounded-2xl border border-gold/50 bg-gradient-to-br from-wine/60 to-surface p-6"
                data-testid={`birthday-today-${m.id}`}>
                <div>
                  <p className="font-display text-lg font-bold text-cream">{m.full_name}</p>
                  <p className="text-sm text-gold">Completa {m.turning_age} anos hoje!</p>
                </div>
                <CongratsButton member={m} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section data-testid="birthdays-month">
        <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-cream">
          <Cake className="h-5 w-5 text-gold" /> Aniversariantes do mês
        </h2>
        {thisMonth.length === 0 && today.length === 0 ? (
          <p className="rounded-2xl border border-gold/15 bg-surface/60 p-8 text-center text-sm text-cream/60">
            Nenhum integrante faz aniversário este mês.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {thisMonth.map((m) => (
              <div key={m.id} className="tracing-card flex items-center justify-between rounded-2xl p-5" data-testid={`birthday-month-${m.id}`}>
                <div>
                  <p className="font-semibold text-cream">{m.full_name}</p>
                  <p className="font-mono text-sm text-gold">
                    {String(m.day).padStart(2, "0")}/{String(m.month).padStart(2, "0")}
                    <span className="ml-2 text-cream/50">faz {m.turning_age} anos</span>
                  </p>
                </div>
                <CongratsButton member={m} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section data-testid="birthdays-upcoming">
        <h2 className="mb-4 font-display text-xl font-bold text-cream">Próximos aniversários</h2>
        <div className="divide-y divide-gold/10 overflow-hidden rounded-2xl border border-gold/15 bg-surface/60">
          {upcoming.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-5 py-4" data-testid={`birthday-upcoming-${m.id}`}>
              <div>
                <p className="font-medium text-cream">{m.full_name}</p>
                <p className="text-xs text-cream/50">
                  {String(m.day).padStart(2, "0")} de {m.month_name}
                </p>
              </div>
              <span className="font-mono text-xs text-gold/80">
                {m.days_until === 1 ? "amanhã" : `em ${m.days_until} dias`}
              </span>
            </div>
          ))}
          {upcoming.length === 0 && (
            <p className="p-8 text-center text-sm text-cream/60">Nenhum aniversário futuro cadastrado.</p>
          )}
        </div>
      </section>

      {isAdmin && (
        <section data-testid="manage-members">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-cream">
            <Users className="h-5 w-5 text-gold" /> Gerenciar integrantes ({allMembers.length})
          </h2>
          <div className="divide-y divide-gold/10 overflow-hidden rounded-2xl border border-gold/15 bg-surface/60" data-testid="manage-members-list">
            {allMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3.5" data-testid={`manage-member-row-${m.id}`}>
                <div className="min-w-0">
                  <p className="truncate font-medium text-cream">{m.full_name}</p>
                  <p className="text-xs text-cream/50">
                    {m.birth_date ? m.birth_date.split("-").reverse().join("/") : "—"}
                    {m.whatsapp ? ` • ${formatWhatsApp(m.whatsapp)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="outline" className={m.role === "admin" ? "border-gold/50 text-gold" : "border-cream/20 text-cream/60"}>
                    {m.role === "admin" ? "Admin" : "Integrante"}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="Editar integrante"
                    className="text-cream/50 hover:text-gold" data-testid={`member-edit-${m.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {m.role !== "admin" && (
                    <Button variant="ghost" size="icon" onClick={() => removeMember(m)} title="Remover integrante"
                      className="text-cream/50 hover:text-red-400" data-testid={`member-delete-${m.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin && (
        <MemberFormDialog open={dialogOpen} onOpenChange={setDialogOpen} member={editing} onSaved={load} />
      )}
    </div>
  );
}
