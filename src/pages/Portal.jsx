import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BrandMark } from "@/components/Brand";
import { Marquee } from "@/components/Marquee";
import { WeeklyHymns } from "@/components/portal/WeeklyHymns";
import { PlaylistView } from "@/components/portal/PlaylistView";
import { BirthdaysView } from "@/components/portal/BirthdaysView";
import { MediaView } from "@/components/portal/MediaView";
import { CompleteProfile } from "@/components/portal/CompleteProfile";
import { AnnouncementsView, FeaturedBanner } from "@/components/portal/AnnouncementsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Portal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("semana");
  const firstName = (user?.full_name || "").split(" ")[0];
  const isAdmin = user?.role === "admin";
  const profileComplete = isAdmin || (user?.birth_date && user?.whatsapp);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-ink text-cream" data-testid="member-portal">
      <header className="glass-nav sticky top-0 z-40 border-b border-gold/15">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark size={38} />
            <div className="leading-tight">
              <p className="text-sm text-cream/60">Shalom,</p>
              <p className="font-display text-sm font-bold text-cream" data-testid="portal-user-name">{firstName}</p>
            </div>
            {isAdmin && <Badge className="bg-gold/20 text-gold" data-testid="admin-badge">Admin</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="logout-btn"
            className="text-cream/70 hover:text-gold">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <Marquee items={["EL SHADAY", "HINOS DA SEMANA", "PLAYLIST DE LOUVORES", "AVISOS & AGENDA", "MÍDIA DA BANDA", "ANIVERSARIANTES", "COMUNHÃO"]} />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {profileComplete ? (
          <>
            <FeaturedBanner onOpen={() => setTab("avisos")} />
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-8 flex h-auto w-full flex-wrap justify-start gap-1 border border-gold/15 bg-surface/80 p-1">
                <TabsTrigger value="semana" data-testid="tab-hinos-semana"
                  className="data-[state=active]:bg-wine data-[state=active]:text-cream">Hinos da Semana</TabsTrigger>
                <TabsTrigger value="playlist" data-testid="tab-playlist"
                  className="data-[state=active]:bg-wine data-[state=active]:text-cream">Playlist</TabsTrigger>
                <TabsTrigger value="avisos" data-testid="tab-avisos"
                  className="data-[state=active]:bg-wine data-[state=active]:text-cream">Avisos</TabsTrigger>
                <TabsTrigger value="midia" data-testid="tab-midia"
                  className="data-[state=active]:bg-wine data-[state=active]:text-cream">Mídia</TabsTrigger>
                <TabsTrigger value="aniversariantes" data-testid="tab-aniversariantes"
                  className="data-[state=active]:bg-wine data-[state=active]:text-cream">Aniversariantes</TabsTrigger>
              </TabsList>
              <TabsContent value="semana"><WeeklyHymns /></TabsContent>
              <TabsContent value="playlist"><PlaylistView /></TabsContent>
              <TabsContent value="avisos"><AnnouncementsView /></TabsContent>
              <TabsContent value="midia"><MediaView /></TabsContent>
              <TabsContent value="aniversariantes"><BirthdaysView /></TabsContent>
            </Tabs>
          </>
        ) : (
          <CompleteProfile />
        )}
      </main>
    </div>
  );
}
