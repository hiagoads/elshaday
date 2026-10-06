import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Lenis from "lenis";
import { motion, useScroll, useTransform } from "framer-motion";
import { Cake, ChevronDown, ListMusic, Lock, Menu, Music2, Play, UserPlus, X } from "lucide-react";
import { api, API_BASE, youtubeThumb } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { BrandMark, BrandWord } from "@/components/Brand";
import { Marquee } from "@/components/Marquee";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { Button } from "@/components/ui/button";

const HERO_IMG = "https://images.unsplash.com/photo-1765224747196-f4d8e34f5846?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODR8MHwxfHNlYXJjaHw0fHxhY291c3RpYyUyMGd1aXRhciUyMHNwb3RsaWdodCUyMGRhcmslMjBzdGFnZXxlbnwwfHx8fDE3OTA5NjI4NDF8MA&ixlib=rb-4.1.0&q=85";
const RAY_IMG = "https://images.unsplash.com/photo-1563726576073-eb2d255af648?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHx3b3JzaGlwJTIwY29uY2VydCUyMHN0YWdlJTIwbGlnaHRzJTIwaGFuZHMlMjByYWlzZWQlMjBnb3NwZWwlMjBiYW5kJTIwa2V5Ym9hcmQlMjBndWl0YXIlMjBkcmFtYXRpYyUyMGxpZ2h0aW5nfGVufDB8fHx8MTc5MDk2MjgzM3ww&ixlib=rb-4.1.0&q=85";
const HANDS_IMG = "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwxfHxwcmFpc2UlMjB3b3JzaGlwJTIwcmFpc2VkJTIwaGFuZHMlMjBjb25jZXJ0JTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3OTA5NjI4NDF8MA&ixlib=rb-4.1.0&q=85";
const MUSICIAN_IMG = "https://images.unsplash.com/photo-1597071692394-6661037e14ef?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHw0fHx3b3JzaGlwJTIwY29uY2VydCUyMHN0YWdlJTIwbGlnaHRzJTIwaGFuZHMlMjByYWlzZWQlMjBnb3NwZWwlMjBiYW5kJTIwa2V5Ym9hcmQlMjBndWl0YXIlMjBkcmFtYXRpYyUyMGxpZ2h0aW5nfGVufDB8fHx8MTc5MDk2MjgzM3ww&ixlib=rb-4.1.0&q=85";

const FALLBACK_SLIDES = [HERO_IMG, RAY_IMG, HANDS_IMG, MUSICIAN_IMG];

function MaskedLine({ children, delay = 0, className = "" }) {
  return (
    <div className="overflow-hidden">
      <motion.div
        initial={{ y: "115%" }}
        animate={{ y: 0 }}
        transition={{ duration: 1, delay, ease: [0.22, 1, 0.36, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  );
}

function Reveal({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const EMBERS = [
  { left: "12%", size: 6, delay: 0 }, { left: "28%", size: 4, delay: 1.4 },
  { left: "47%", size: 8, delay: 0.7 }, { left: "63%", size: 5, delay: 2 },
  { left: "78%", size: 4, delay: 0.3 }, { left: "90%", size: 7, delay: 1.1 },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const lenisRef = useRef(null);
  const heroRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlights, setHighlights] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [slides, setSlides] = useState(FALLBACK_SLIDES);
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenisRef.current = lenis;
    let raf;
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);

  useEffect(() => {
    api.get("/public/highlights").then((r) => setHighlights(r.data)).catch(() => {});
    api.get("/public/announcements").then((r) => setAnnouncements(r.data)).catch(() => {});
    api.get("/public/media").then((r) => {
      if (r.data?.length) {
        setSlides(r.data.map((m) => `${API_BASE}/public/media/${m.id}/file`));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  const scrollTo = (id) => {
    setMenuOpen(false);
    const el = document.querySelector(id);
    if (el && lenisRef.current) lenisRef.current.scrollTo(el, { offset: -70 });
  };

  const memberArea = () => navigate(user ? "/portal" : "/acesso");

  const navLinks = [
    { label: "Início", target: "#inicio" },
    { label: "O Portal", target: "#portal-sec" },
    { label: "Avisos", target: "#avisos" },
    { label: "Hinos", target: "#hinos" },
    { label: "Sobre", target: "#sobre" },
  ];

  return (
    <div className="min-h-screen bg-ink text-cream" id="inicio">
      <header className="glass-nav fixed inset-x-0 top-0 z-50 border-b border-gold/15">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3" data-testid="nav-brand">
            <BrandMark size={40} />
            <BrandWord />
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <button key={l.target} onClick={() => scrollTo(l.target)} data-testid={`nav-link-${l.label.toLowerCase().replace(/\s/g, "-")}`}
                className="text-sm font-medium text-cream/70 transition-colors hover:text-gold">
                {l.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button onClick={memberArea} data-testid="member-area-btn"
              className="rounded-full bg-gold px-5 font-semibold text-ink transition-colors hover:bg-gold-light">
              {user ? "Abrir Portal" : "Área do Membro"}
            </Button>
            <button className="p-2 text-cream/80 md:hidden" onClick={() => setMenuOpen(!menuOpen)} data-testid="mobile-menu-btn" aria-label="Menu">
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-gold/10 px-6 py-4 md:hidden" data-testid="mobile-menu">
            {navLinks.map((l) => (
              <button key={l.target} onClick={() => scrollTo(l.target)}
                className="block w-full py-2 text-left text-sm text-cream/80 hover:text-gold">
                {l.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <section ref={heroRef} className="relative flex min-h-[100svh] items-center overflow-hidden">
        <motion.div style={{ y: bgY, scale: bgScale }} className="absolute inset-0" data-testid="hero-slideshow">
          {slides.map((src, i) => (
            <motion.img
              key={src}
              src={src}
              alt=""
              initial={false}
              animate={{ opacity: i === slideIdx ? 0.45 : 0 }}
              transition={{ duration: 1.6, ease: "easeInOut" }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ))}
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/40 to-ink" />
        <div className="gold-beam absolute inset-0" />
        <div className="wine-beam absolute inset-0" />
        {EMBERS.map((e, i) => (
          <motion.span key={i} className="absolute bottom-0 rounded-full bg-gold/50 blur-[2px]"
            style={{ left: e.left, width: e.size, height: e.size }}
            animate={{ y: [0, -620], opacity: [0, 0.9, 0] }}
            transition={{ duration: 9 + i, delay: e.delay, repeat: Infinity, ease: "linear" }}
          />
        ))}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-24 sm:px-6">
          <MaskedLine delay={0.1}>
            <p className="mb-6 font-mono text-xs uppercase tracking-[0.45em] text-gold/80" data-testid="hero-overline">
              Ministério de Louvor &amp; Adoração
            </p>
          </MaskedLine>
          <MaskedLine delay={0.28}>
            <h1 className="font-display text-5xl font-black tracking-tight text-cream sm:text-7xl lg:text-8xl">
              BANDA
            </h1>
          </MaskedLine>
          <MaskedLine delay={0.44}>
            <span className="text-gold-gradient block font-script text-7xl leading-[1.1] sm:text-8xl lg:text-9xl" data-testid="hero-title">
              El Shaday
            </span>
          </MaskedLine>
          <MaskedLine delay={0.62}>
            <p className="mt-6 max-w-xl text-base text-cream/70 sm:text-lg">
              Som de adoração • Presença • Propósito. Um portal particular para os integrantes
              viverem os hinos da semana, a playlist completa e a comunhão da banda.
            </p>
          </MaskedLine>
          <MaskedLine delay={0.78}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button onClick={memberArea} data-testid="hero-cta-hymns"
                className="halo-gold rounded-full bg-wine px-8 py-6 font-display text-sm font-bold tracking-widest text-cream transition-transform hover:scale-[1.03] hover:bg-wine-dark">
                ACESSAR HINOS DA SEMANA
              </Button>
              <Button variant="ghost" onClick={() => scrollTo("#portal-sec")} data-testid="hero-cta-portal"
                className="rounded-full border border-gold/30 px-8 py-6 text-sm text-gold hover:bg-gold/10 hover:text-gold-light">
                Conhecer o portal
              </Button>
            </div>
          </MaskedLine>
        </div>
        {slides.length > 1 && (
          <div className="absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 gap-2" data-testid="hero-slide-dots">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setSlideIdx(i)} aria-label={`Foto ${i + 1}`}
                data-testid={`hero-dot-${i}`}
                className={`h-1.5 rounded-full transition-all duration-500 ${i === slideIdx ? "w-8 bg-gold" : "w-1.5 bg-cream/30 hover:bg-cream/60"}`} />
            ))}
          </div>
        )}
        <motion.div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-gold/60"
          animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <ChevronDown className="h-6 w-6" />
        </motion.div>
      </section>

      <Marquee items={["EL SHADAY", "LOUVOR", "ADORAÇÃO", "HINOS DA SEMANA", "COMUNHÃO", "SOM PROFÉTICO"]} />

      <section id="portal-sec" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <Reveal>
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.4em] text-gold/80">O Portal</p>
          <h2 className="max-w-2xl font-display text-2xl font-bold text-cream sm:text-3xl lg:text-4xl">
            Tudo o que a banda precisa, em um só lugar
          </h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Reveal delay={0.05} className="md:col-span-2 md:row-span-2">
            <div className="tracing-card group relative h-full min-h-[320px] overflow-hidden rounded-3xl" data-testid="bento-weekly">
              <img src={RAY_IMG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
              <div className="relative flex h-full flex-col justify-end p-8">
                <ListMusic className="mb-4 h-8 w-8 text-gold" />
                <h3 className="font-display text-xl font-bold text-cream sm:text-2xl">Hinos da Semana</h3>
                <p className="mt-2 max-w-sm text-sm text-cream/70">
                  A escala de louvores de cada culto, escolhida pela liderança, com vídeo, tom e letra para ensaiar em casa.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.12} className="md:col-span-2">
            <div className="tracing-card group relative h-full min-h-[180px] overflow-hidden rounded-3xl" data-testid="bento-playlist">
              <img src={HANDS_IMG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/60 to-transparent" />
              <div className="relative flex h-full flex-col justify-end p-8">
                <Music2 className="mb-3 h-7 w-7 text-gold" />
                <h3 className="font-display text-lg font-bold text-cream">Playlist de Hinos</h3>
                <p className="mt-1 text-sm text-cream/70">Repertório completo com YouTube e Spotify integrados.</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="tracing-card h-full rounded-3xl p-7" data-testid="bento-birthdays">
              <Cake className="mb-3 h-7 w-7 text-gold" />
              <h3 className="font-display text-lg font-bold text-cream">Aniversariantes</h3>
              <p className="mt-1 text-sm text-cream/70">Datas dos integrantes e parabéns direto no WhatsApp.</p>
            </div>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="tracing-card h-full rounded-3xl p-7" data-testid="bento-register">
              <UserPlus className="mb-3 h-7 w-7 text-gold" />
              <h3 className="font-display text-lg font-bold text-cream">Cadastro</h3>
              <p className="mt-1 text-sm text-cream/70">Nome completo, aniversário e WhatsApp. Simples assim.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {announcements.length > 0 && (
        <section id="avisos" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
          <Reveal>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.4em] text-gold/80">Fique por dentro</p>
            <h2 className="font-display text-2xl font-bold text-cream sm:text-3xl lg:text-4xl">Avisos &amp; agenda</h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3" data-testid="landing-announcements">
            {announcements.map((a, i) => <AnnouncementCard key={a.id} a={a} delay={i * 0.08} />)}
          </div>
        </section>
      )}

      <section id="hinos" className="border-t border-gold/10 bg-wine-deep/40 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.4em] text-gold/80">Destaques</p>
            <h2 className="font-display text-2xl font-bold text-cream sm:text-3xl lg:text-4xl">Hinos em destaque</h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((h, i) => (
              <Reveal key={h.id} delay={i * 0.08}>
                <div className="tracing-card group overflow-hidden rounded-2xl" data-testid={`highlight-${h.id}`}>
                  <div className="relative aspect-video overflow-hidden">
                    {h.youtube_id ? (
                      <img src={youtubeThumb(h.youtube_id)} alt={h.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-wine-deep to-surface">
                        <Music2 className="h-10 w-10 text-gold/40" />
                      </div>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/50">
                      <span className="grid h-12 w-12 place-items-center rounded-full border border-gold/60 bg-ink/80 text-gold">
                        <Play className="ml-0.5 h-5 w-5" />
                      </span>
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-base font-semibold text-cream">{h.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{h.artist}{h.tone ? ` • Tom ${h.tone}` : ""}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1}>
            <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-gold/20 bg-surface/60 p-10 text-center">
              <Lock className="h-8 w-8 text-gold" />
              <p className="max-w-md text-sm text-cream/70 sm:text-base">
                Os players completos, letras e a playlist fazem parte da área exclusiva dos integrantes.
              </p>
              <Button onClick={memberArea} data-testid="highlights-cta"
                className="rounded-full bg-gold px-8 font-semibold text-ink hover:bg-gold-light">
                Entrar como integrante
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="sobre" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative">
              <div className="absolute -inset-3 rounded-3xl border border-gold/25" />
              <img src={MUSICIAN_IMG} alt="Integrante da banda em adoração" className="relative w-full rounded-3xl object-cover shadow-2xl" />
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.4em] text-gold/80">Sobre a banda</p>
            <h2 className="font-display text-2xl font-bold text-cream sm:text-3xl lg:text-4xl">
              Um som que nasce do altar
            </h2>
            <p className="mt-6 leading-relaxed text-cream/70">
              A Banda El Shaday é um ministério de louvor dedicado a conduzir pessoas à presença de Deus
              através da música. Cada ensaio, cada culto e cada hino carrega um propósito: adorar em
              espírito e em verdade.
            </p>
            <blockquote className="mt-8 border-l-2 border-gold pl-6">
              <p className="text-gold-gradient font-script text-3xl leading-snug">
                "Tudo quanto tem fôlego louve ao Senhor."
              </p>
              <cite className="mt-2 block font-mono text-xs uppercase tracking-[0.3em] text-cream/50">Salmos 150:6</cite>
            </blockquote>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-gold/15 bg-wine-deep/60 py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 text-center sm:px-6">
          <BrandMark size={72} />
          <span className="text-gold-gradient block font-script text-6xl sm:text-7xl">El Shaday</span>
          <p className="max-w-md text-sm text-cream/60">
            Louvor • Adoração • Comunhão. Portal particular dos integrantes da Banda El Shaday.
          </p>
          <p className="font-mono text-xs tracking-[0.3em] text-cream/40">© 2026 BANDA EL SHADAY</p>
        </div>
      </footer>
    </div>
  );
}
