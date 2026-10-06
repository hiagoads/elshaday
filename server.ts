import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "el_shaday_jwt_secret_dev_key_2026";
const JWT_ALGORITHM = "HS256";

const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

function extractYoutubeId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return m[1];
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

// In-memory data collections
interface User {
  id: string;
  full_name: string;
  birth_date?: string;
  whatsapp?: string;
  email?: string;
  picture?: string;
  user_id?: string;
  role: "member" | "admin";
  auth_provider?: string;
  password_hash?: string;
  created_at: string;
}

interface Hymn {
  id: string;
  title: string;
  artist: string;
  tone: string;
  tags: string[];
  youtube_id?: string | null;
  youtube_url?: string | null;
  spotify_url?: string | null;
  lyrics?: string | null;
  is_weekly: boolean;
  week_order: number;
  created_at: string;
}

interface Announcement {
  id: string;
  title: string;
  description: string;
  category: "Agenda" | "Congresso" | "Aviso";
  event_date?: string | null;
  is_featured: boolean;
  created_at: string;
}

interface MediaItem {
  id: string;
  title: string;
  media_type: "foto" | "video";
  storage_path: string;
  original_filename: string;
  content_type: string;
  size: number;
  buffer?: Buffer;
  is_deleted: boolean;
  created_at: string;
}

interface UserSession {
  user_id: string;
  session_token: string;
  expires_at: Date;
  created_at: Date;
}

let nextId = 1000;
const genId = () => `${Date.now()}_${++nextId}`;

const users: Map<string, User> = new Map();
const hymns: Map<string, Hymn> = new Map();
const announcements: Map<string, Announcement> = new Map();
const media: Map<string, MediaItem> = new Map();
const sessions: Map<string, UserSession> = new Map();
const loginAttempts: Map<string, { count: number; last_attempt: Date }> = new Map();

// Helper to sanitize user output
function userOut(user: User) {
  const { password_hash, ...rest } = user;
  return rest;
}

// Token generators
function createAccessToken(userId: string, identifier: string): string {
  return jwt.sign(
    { sub: userId, idt: identifier, type: "access" },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: "15m" }
  );
}

function createRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: "refresh" },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: "7d" }
  );
}

function setAuthCookies(res: Response, userId: string, identifier: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("access_token", createAccessToken(userId, identifier), {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 15 * 60 * 1000,
    path: "/",
  });
  res.cookie("refresh_token", createRefreshToken(userId), {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

// Authentication middleware
interface AuthenticatedRequest extends Request {
  user?: User;
}

function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;

  const sessionToken = req.cookies.session_token || bearer;
  if (sessionToken) {
    const session = Array.from(sessions.values()).find(
      (s) => s.session_token === sessionToken
    );
    if (session) {
      if (new Date() > session.expires_at) {
        return res.status(401).json({ detail: "Sessão expirada" });
      }
      const user = Array.from(users.values()).find(
        (u) => u.user_id === session.user_id || u.id === session.user_id
      );
      if (user) {
        req.user = user;
        return next();
      }
    }
  }

  const token = req.cookies.access_token || bearer;
  if (!token) {
    return res.status(401).json({ detail: "Não autenticado" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as any;
    if (payload.type !== "access") {
      return res.status(401).json({ detail: "Token inválido" });
    }
    const user = users.get(payload.sub);
    if (!user) {
      return res.status(401).json({ detail: "Usuário não encontrado" });
    }
    req.user = user;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ detail: "Sessão expirada" });
    }
    return res.status(401).json({ detail: "Token inválido" });
  }
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ detail: "Acesso restrito ao administrador" });
  }
  next();
}

// Seeding Initial Data
function seedInitialData() {
  const now = new Date();
  const today = new Date();

  // Admin user
  const adminId = "admin_1";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@elshaday.com";
  users.set(adminId, {
    id: adminId,
    full_name: "Administrador da Banda",
    email: adminEmail,
    whatsapp: "11999999999",
    birth_date: "1990-05-15",
    role: "admin",
    password_hash: bcrypt.hashSync(adminPassword, 10),
    created_at: now.toISOString(),
  });

  // Sample band members with realistic birthdays
  const sampleMembers = [
    {
      name: "Lucas Oliveira",
      whatsapp: "11988887777",
      birth_date: `${today.getFullYear() - 24}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
    },
    {
      name: "Mariana Santos",
      whatsapp: "11977776666",
      birth_date: "1998-11-20",
    },
    {
      name: "Davi Silva",
      whatsapp: "11966665555",
      birth_date: "1995-12-05",
    },
    {
      name: "Sarah Ferreira",
      whatsapp: "11955554444",
      birth_date: "2001-08-14",
    },
    {
      name: "Gabriel Souza",
      whatsapp: "11944443333",
      birth_date: "1997-03-22",
    },
  ];

  sampleMembers.forEach((m, idx) => {
    const memId = `member_${idx + 1}`;
    users.set(memId, {
      id: memId,
      full_name: m.name,
      whatsapp: m.whatsapp,
      birth_date: m.birth_date,
      role: "member",
      password_hash: bcrypt.hashSync("123456", 10),
      created_at: now.toISOString(),
    });
  });

  // Seed Hymns
  const SEED_HYMNS = [
    {
      title: "A Ele a Glória / Porque Ele Vive",
      artist: "Gabriela Rocha",
      tone: "E",
      tags: ["Adoração", "Abertura"],
      youtube_url: "https://www.youtube.com/watch?v=zawIqlbwFqI",
      spotify_url: "https://open.spotify.com/search/A%20Ele%20a%20Gl%C3%B3ria%20Gabriela%20Rocha",
      is_weekly: true,
      week_order: 1,
      lyrics: "A Ele a glória\nA Ele o louvor\nA Ele o domínio\nEle é o meu Senhor",
    },
    {
      title: "Lugar Secreto / Pai Nosso",
      artist: "Gabriela Rocha",
      tone: "G",
      tags: ["Adoração", "Ceia"],
      youtube_url: "https://www.youtube.com/watch?v=cffSMjavggA",
      spotify_url: "https://open.spotify.com/search/Lugar%20Secreto%20Gabriela%20Rocha",
      is_weekly: true,
      week_order: 2,
      lyrics: "Quero comungar contigo\nNo lugar secreto\nTe adorar em espírito\nEm espírito e em verdade",
    },
    {
      title: "Caminho no Deserto (Way Maker)",
      artist: "Leeland / Sinach",
      tone: "B",
      tags: ["Adoração"],
      youtube_url: "https://www.youtube.com/watch?v=iJCV_2H9xD0",
      spotify_url: "https://open.spotify.com/search/Way%20Maker%20Leeland",
      is_weekly: true,
      week_order: 3,
      lyrics: "Caminho no deserto\nLuz na escuridão\nMeu Deus, é quem Tu és",
    },
    {
      title: "O Amor Tem Nome (Reckless Love)",
      artist: "Bethel Music",
      tone: "D",
      tags: ["Adoração"],
      youtube_url: "https://www.youtube.com/watch?v=Sc6SSHuZvQE",
      spotify_url: "https://open.spotify.com/search/Reckless%20Love%20Bethel%20Music",
      is_weekly: false,
      week_order: 0,
      lyrics: "Antes de eu falar\nTu cantaste sobre mim\nTu tens sido tão bom\nTão bom para mim",
    },
    {
      title: "Oceanos (Onde Meus Pés Podem Falhar)",
      artist: "Hillsong UNITED",
      tone: "Bm",
      tags: ["Adoração", "Ceia"],
      youtube_url: "https://www.youtube.com/watch?v=dy9nwe9_xzw",
      spotify_url: "https://open.spotify.com/search/Oceans%20Hillsong%20UNITED",
      is_weekly: false,
      week_order: 0,
      lyrics: "Tu me chamas sobre as águas\nAo desconhecido, para Te buscar\nE aí estou eu, aos Teus pés",
    },
    {
      title: "Raridade",
      artist: "Anderson Freire",
      tone: "C",
      tags: ["Adoração"],
      youtube_url: "https://www.youtube.com/results?search_query=Raridade+Anderson+Freire",
      spotify_url: "https://open.spotify.com/search/Raridade%20Anderson%20Freire",
      is_weekly: false,
      week_order: 0,
      lyrics: "",
    },
    {
      title: "Grandes Coisas",
      artist: "Fernandinho",
      tone: "A",
      tags: ["Jubilo", "Abertura"],
      youtube_url: "https://www.youtube.com/results?search_query=Grandes+Coisas+Fernandinho",
      spotify_url: "https://open.spotify.com/search/Grandes%20Coisas%20Fernandinho",
      is_weekly: false,
      week_order: 0,
      lyrics: "",
    },
    {
      title: "Ninguém Explica Deus",
      artist: "Preto no Branco",
      tone: "F",
      tags: ["Ceia", "Adoração"],
      youtube_url: "https://www.youtube.com/results?search_query=Ningu%C3%A9m+Explica+Deus+Preto+no+Branco",
      spotify_url: "https://open.spotify.com/search/Ningu%C3%A9m%20Explica%20Deus%20Preto%20no%20Branco",
      is_weekly: false,
      week_order: 0,
      lyrics: "",
    },
  ];

  SEED_HYMNS.forEach((h, idx) => {
    const hId = `hymn_${idx + 1}`;
    hymns.set(hId, {
      id: hId,
      title: h.title,
      artist: h.artist,
      tone: h.tone,
      tags: h.tags,
      youtube_id: extractYoutubeId(h.youtube_url),
      youtube_url: h.youtube_url,
      spotify_url: h.spotify_url,
      lyrics: h.lyrics,
      is_weekly: h.is_weekly,
      week_order: h.week_order,
      created_at: now.toISOString(),
    });
  });

  // Seed Announcements
  const SEED_ANNOUNCEMENTS = [
    {
      title: "Congresso de Adoração 2026",
      category: "Congresso" as const,
      event_date: "2026-11-21",
      description: "A Banda El Shaday ministrará no Congresso de Adoração. Guardem a data: um fim de semana inteiro de louvor, palavra e comunhão. Escala e horários serão confirmados no grupo da banda.",
      is_featured: true,
    },
    {
      title: "Ensaio geral — sábados às 16h",
      category: "Agenda" as const,
      event_date: null,
      description: "Ensaio semanal de toda a banda no salão principal. Cheguem 15 minutos antes para afinação e passagem de som.",
      is_featured: false,
    },
    {
      title: "Culto de Santa Ceia — escala especial",
      category: "Agenda" as const,
      event_date: "2026-11-02",
      description: "No culto de ceia os hinos da semana serão ministrados em tom mais suave. Confirmem presença com a liderança até sexta-feira.",
      is_featured: false,
    },
  ];

  SEED_ANNOUNCEMENTS.forEach((a, idx) => {
    const aId = `ann_${idx + 1}`;
    announcements.set(aId, {
      id: aId,
      title: a.title,
      description: a.description,
      category: a.category,
      event_date: a.event_date,
      is_featured: a.is_featured,
      created_at: now.toISOString(),
    });
  });
}

seedInitialData();

// Router
const apiRouter = express.Router();

apiRouter.get("/", (req, res) => {
  res.json({ message: "Banda El Shaday API" });
});

// AUTH ROUTES
apiRouter.post("/auth/register", (req, res) => {
  const { full_name, birth_date, whatsapp, password } = req.body || {};
  if (!full_name || full_name.trim().length < 3) {
    return res.status(400).json({ detail: "Nome deve ter pelo menos 3 caracteres" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ detail: "Senha deve ter pelo menos 6 caracteres" });
  }
  const cleanWhatsapp = (whatsapp || "").replace(/\D/g, "");
  if (cleanWhatsapp.length < 10) {
    return res.status(400).json({ detail: "WhatsApp inválido (use DDD + número)" });
  }

  const existing = Array.from(users.values()).find((u) => u.whatsapp === cleanWhatsapp);
  if (existing) {
    return res.status(400).json({ detail: "Este WhatsApp já está cadastrado" });
  }

  const id = genId();
  const newUser: User = {
    id,
    full_name: full_name.trim(),
    birth_date: birth_date || "",
    whatsapp: cleanWhatsapp,
    role: "member",
    password_hash: bcrypt.hashSync(password, 10),
    created_at: new Date().toISOString(),
  };
  users.set(id, newUser);
  setAuthCookies(res, id, cleanWhatsapp);
  return res.json(userOut(newUser));
});

apiRouter.post("/auth/login", (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ detail: "Informe identificador e senha" });
  }
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");
  const cleanId = isEmail ? trimmed.toLowerCase() : trimmed.replace(/\D/g, "");

  const user = Array.from(users.values()).find((u) => {
    if (isEmail) return u.email?.toLowerCase() === cleanId;
    return u.whatsapp === cleanId;
  });

  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ detail: "Credenciais inválidas" });
  }

  setAuthCookies(res, user.id, trimmed);
  return res.json(userOut(user));
});

apiRouter.post("/auth/google/session", (req, res) => {
  const { session_id } = req.body || {};
  if (!session_id) {
    return res.status(400).json({ detail: "Sessão inválida" });
  }
  // Stub/Mock session exchange or fallback to demo account
  let user = Array.from(users.values()).find((u) => u.role === "admin");
  if (!user) {
    const id = genId();
    user = {
      id,
      full_name: "Integrante Google",
      email: "google_user@elshaday.com",
      role: "member",
      auth_provider: "google",
      created_at: new Date().toISOString(),
    };
    users.set(id, user);
  }
  const sessionToken = session_id || `sess_${genId()}`;
  sessions.set(sessionToken, {
    user_id: user.id,
    session_token: sessionToken,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    created_at: new Date(),
  });
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("session_token", sessionToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  return res.json(userOut(user));
});

apiRouter.put("/auth/profile", authenticate, (req: AuthenticatedRequest, res) => {
  const { birth_date, whatsapp } = req.body || {};
  const cleanWhatsapp = (whatsapp || "").replace(/\D/g, "");
  if (cleanWhatsapp.length < 10) {
    return res.status(400).json({ detail: "WhatsApp inválido (use DDD + número)" });
  }
  const conflict = Array.from(users.values()).find(
    (u) => u.whatsapp === cleanWhatsapp && u.id !== req.user!.id
  );
  if (conflict) {
    return res.status(400).json({ detail: "Este WhatsApp já está cadastrado em outra conta" });
  }

  const user = users.get(req.user!.id)!;
  user.birth_date = birth_date;
  user.whatsapp = cleanWhatsapp;
  users.set(user.id, user);
  return res.json(userOut(user));
});

apiRouter.post("/auth/logout", (req, res) => {
  const sessionToken = req.cookies.session_token;
  if (sessionToken) {
    sessions.delete(sessionToken);
  }
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
  res.clearCookie("session_token", { path: "/" });
  res.json({ ok: true });
});

apiRouter.get("/auth/me", authenticate, (req: AuthenticatedRequest, res) => {
  res.json(userOut(req.user!));
});

apiRouter.post("/auth/refresh", (req, res) => {
  const token = req.cookies.refresh_token;
  if (!token) {
    return res.status(401).json({ detail: "Sem sessão" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as any;
    if (payload.type !== "refresh") {
      return res.status(401).json({ detail: "Token inválido" });
    }
    const user = users.get(payload.sub);
    if (!user) {
      return res.status(401).json({ detail: "Usuário não encontrado" });
    }
    setAuthCookies(res, user.id, user.email || user.whatsapp || "");
    return res.json({ ok: true });
  } catch {
    return res.status(401).json({ detail: "Sessão expirada" });
  }
});

// PUBLIC ENDPOINTS
apiRouter.get("/public/highlights", (req, res) => {
  const weekly = Array.from(hymns.values())
    .filter((h) => h.is_weekly)
    .sort((a, b) => a.week_order - b.week_order)
    .slice(0, 4)
    .map((h) => ({
      id: h.id,
      title: h.title,
      artist: h.artist || "",
      tone: h.tone || "",
      tags: h.tags || [],
      youtube_id: h.youtube_id,
    }));
  res.json(weekly);
});

apiRouter.get("/public/announcements", (req, res) => {
  const list = Array.from(announcements.values())
    .sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 3);
  res.json(list);
});

apiRouter.get("/public/media", (req, res) => {
  const photos = Array.from(media.values())
    .filter((m) => !m.is_deleted && m.media_type === "foto")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)
    .map((m) => ({ id: m.id, title: m.title || "" }));
  res.json(photos);
});

apiRouter.get("/public/media/:media_id/file", (req, res) => {
  const item = media.get(req.params.media_id);
  if (!item || item.is_deleted) {
    return res.status(404).json({ detail: "Arquivo não encontrado" });
  }
  if (item.buffer) {
    res.setHeader("Content-Type", item.content_type);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(item.buffer);
  }
  return res.status(404).json({ detail: "Arquivo indisponível" });
});

// ANNOUNCEMENTS
apiRouter.get("/announcements", authenticate, (req, res) => {
  const list = Array.from(announcements.values()).sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  res.json(list);
});

apiRouter.post("/admin/announcements", authenticate, requireAdmin, (req, res) => {
  const { title, description, category, event_date, is_featured } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ detail: "Título é obrigatório" });
  }
  const id = genId();
  const ann: Announcement = {
    id,
    title: title.trim(),
    description: description || "",
    category: ["Agenda", "Congresso", "Aviso"].includes(category) ? category : "Aviso",
    event_date: event_date || null,
    is_featured: !!is_featured,
    created_at: new Date().toISOString(),
  };
  announcements.set(id, ann);
  res.json(ann);
});

apiRouter.put("/admin/announcements/:id", authenticate, requireAdmin, (req, res) => {
  const item = announcements.get(req.params.id);
  if (!item) {
    return res.status(404).json({ detail: "Aviso não encontrado" });
  }
  const { title, description, category, event_date, is_featured } = req.body || {};
  if (title) item.title = title.trim();
  if (description !== undefined) item.description = description;
  if (category) item.category = ["Agenda", "Congresso", "Aviso"].includes(category) ? category : item.category;
  if (event_date !== undefined) item.event_date = event_date || null;
  if (is_featured !== undefined) item.is_featured = !!is_featured;
  announcements.set(item.id, item);
  res.json(item);
});

apiRouter.delete("/admin/announcements/:id", authenticate, requireAdmin, (req, res) => {
  if (!announcements.has(req.params.id)) {
    return res.status(404).json({ detail: "Aviso não encontrado" });
  }
  announcements.delete(req.params.id);
  res.json({ ok: true });
});

// HYMNS
apiRouter.get("/hymns/week", authenticate, (req, res) => {
  const list = Array.from(hymns.values())
    .filter((h) => h.is_weekly)
    .sort((a, b) => a.week_order - b.week_order);
  res.json(list);
});

apiRouter.get("/hymns", authenticate, (req, res) => {
  const search = (req.query.search as string || "").toLowerCase();
  const tag = (req.query.tag as string || "").toLowerCase();

  let list = Array.from(hymns.values());
  if (search) {
    list = list.filter(
      (h) => h.title.toLowerCase().includes(search) || h.artist.toLowerCase().includes(search)
    );
  }
  if (tag) {
    list = list.filter((h) => (h.tags || []).some((t) => t.toLowerCase() === tag));
  }
  list.sort((a, b) => a.title.localeCompare(b.title));
  res.json(list);
});

apiRouter.post("/admin/hymns", authenticate, requireAdmin, (req, res) => {
  const { title, artist, tone, tags, youtube_url, spotify_url, lyrics, is_weekly, week_order } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ detail: "Título é obrigatório" });
  }
  const id = genId();
  const hymn: Hymn = {
    id,
    title: title.trim(),
    artist: artist || "",
    tone: tone || "",
    tags: Array.isArray(tags) ? tags : [],
    youtube_id: extractYoutubeId(youtube_url),
    youtube_url: youtube_url || null,
    spotify_url: spotify_url || null,
    lyrics: lyrics || null,
    is_weekly: !!is_weekly,
    week_order: Number(week_order) || 0,
    created_at: new Date().toISOString(),
  };
  hymns.set(id, hymn);
  res.json(hymn);
});

apiRouter.put("/admin/hymns/:id", authenticate, requireAdmin, (req, res) => {
  const hymn = hymns.get(req.params.id);
  if (!hymn) {
    return res.status(404).json({ detail: "Hino não encontrado" });
  }
  const { title, artist, tone, tags, youtube_url, spotify_url, lyrics, is_weekly, week_order } = req.body || {};
  if (title) hymn.title = title.trim();
  if (artist !== undefined) hymn.artist = artist;
  if (tone !== undefined) hymn.tone = tone;
  if (tags !== undefined) hymn.tags = Array.isArray(tags) ? tags : [];
  if (youtube_url !== undefined) {
    hymn.youtube_url = youtube_url || null;
    hymn.youtube_id = extractYoutubeId(youtube_url);
  }
  if (spotify_url !== undefined) hymn.spotify_url = spotify_url || null;
  if (lyrics !== undefined) hymn.lyrics = lyrics || null;
  if (is_weekly !== undefined) hymn.is_weekly = !!is_weekly;
  if (week_order !== undefined) hymn.week_order = Number(week_order) || 0;
  hymns.set(hymn.id, hymn);
  res.json(hymn);
});

apiRouter.delete("/admin/hymns/:id", authenticate, requireAdmin, (req, res) => {
  if (!hymns.has(req.params.id)) {
    return res.status(404).json({ detail: "Hino não encontrado" });
  }
  hymns.delete(req.params.id);
  res.json({ ok: true });
});

// MEMBERS & BIRTHDAYS
apiRouter.get("/members/birthdays", authenticate, (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const out: any[] = [];
  Array.from(users.values()).forEach((u) => {
    if (!u.birth_date) return;
    const parts = u.birth_date.split("-");
    if (parts.length !== 3) return;
    const bYear = parseInt(parts[0], 10);
    const bMonth = parseInt(parts[1], 10);
    const bDay = parseInt(parts[2], 10);
    if (isNaN(bYear) || isNaN(bMonth) || isNaN(bDay)) return;

    let nextBd = new Date(today.getFullYear(), bMonth - 1, bDay);
    if (nextBd.getTime() < today.getTime()) {
      nextBd = new Date(today.getFullYear() + 1, bMonth - 1, bDay);
    }
    const diffMs = nextBd.getTime() - today.getTime();
    const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));

    out.push({
      id: u.id,
      full_name: u.full_name,
      whatsapp: u.whatsapp,
      birth_date: u.birth_date,
      day: bDay,
      month: bMonth,
      month_name: MONTHS_PT[bMonth - 1] || "",
      turning_age: nextBd.getFullYear() - bYear,
      is_today: daysUntil === 0,
      is_this_month: bMonth === today.getMonth() + 1,
      days_until: daysUntil,
    });
  });

  out.sort((a, b) => a.days_until - b.days_until);
  res.json(out);
});

apiRouter.get("/admin/members", authenticate, requireAdmin, (req, res) => {
  const list = Array.from(users.values())
    .map(userOut)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  res.json(list);
});

apiRouter.post("/admin/members", authenticate, requireAdmin, (req, res) => {
  const { full_name, birth_date, whatsapp, password } = req.body || {};
  if (!full_name || full_name.trim().length < 3) {
    return res.status(400).json({ detail: "Nome deve ter pelo menos 3 caracteres" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ detail: "Informe uma senha inicial de pelo menos 6 caracteres" });
  }
  const cleanWhatsapp = (whatsapp || "").replace(/\D/g, "");
  if (cleanWhatsapp.length < 10) {
    return res.status(400).json({ detail: "WhatsApp inválido (use DDD + número)" });
  }
  const existing = Array.from(users.values()).find((u) => u.whatsapp === cleanWhatsapp);
  if (existing) {
    return res.status(400).json({ detail: "Este WhatsApp já está cadastrado" });
  }

  const id = genId();
  const user: User = {
    id,
    full_name: full_name.trim(),
    birth_date: birth_date || "",
    whatsapp: cleanWhatsapp,
    role: "member",
    password_hash: bcrypt.hashSync(password, 10),
    created_at: new Date().toISOString(),
  };
  users.set(id, user);
  res.json(userOut(user));
});

apiRouter.put("/admin/members/:id", authenticate, requireAdmin, (req, res) => {
  const target = users.get(req.params.id);
  if (!target) {
    return res.status(404).json({ detail: "Integrante não encontrado" });
  }
  const { full_name, birth_date, whatsapp, password } = req.body || {};
  if (full_name) target.full_name = full_name.trim();
  if (birth_date !== undefined) target.birth_date = birth_date;
  if (whatsapp) {
    const cleanWhatsapp = whatsapp.replace(/\D/g, "");
    const conflict = Array.from(users.values()).find(
      (u) => u.whatsapp === cleanWhatsapp && u.id !== target.id
    );
    if (conflict) {
      return res.status(400).json({ detail: "Este WhatsApp já está cadastrado em outra conta" });
    }
    target.whatsapp = cleanWhatsapp;
  }
  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ detail: "A senha deve ter pelo menos 6 caracteres" });
    }
    target.password_hash = bcrypt.hashSync(password, 10);
  }
  users.set(target.id, target);
  res.json(userOut(target));
});

apiRouter.delete("/admin/members/:id", authenticate, requireAdmin, (req, res) => {
  const target = users.get(req.params.id);
  if (!target) {
    return res.status(404).json({ detail: "Integrante não encontrado" });
  }
  if (target.role === "admin") {
    return res.status(400).json({ detail: "Não é possível remover um administrador" });
  }
  users.delete(target.id);
  res.json({ ok: true });
});

// MEDIA
apiRouter.get("/media", authenticate, (req, res) => {
  const list = Array.from(media.values())
    .filter((m) => !m.is_deleted)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((m) => ({
      id: m.id,
      title: m.title,
      media_type: m.media_type,
      storage_path: m.storage_path,
      original_filename: m.original_filename,
      content_type: m.content_type,
      size: m.size,
      created_at: m.created_at,
    }));
  res.json(list);
});

apiRouter.post(
  "/admin/media",
  authenticate,
  requireAdmin,
  upload.single("file"),
  (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ detail: "Envie apenas fotos ou vídeos" });
    }
    const contentType = req.file.mimetype || "application/octet-stream";
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      return res.status(400).json({ detail: "Envie apenas fotos ou vídeos" });
    }
    const id = genId();
    const title = (req.body?.title || "").trim() || req.file.originalname || "Mídia";
    const item: MediaItem = {
      id,
      title,
      media_type: contentType.startsWith("video/") ? "video" : "foto",
      storage_path: `media/${id}`,
      original_filename: req.file.originalname,
      content_type: contentType,
      size: req.file.size,
      buffer: req.file.buffer,
      is_deleted: false,
      created_at: new Date().toISOString(),
    };
    media.set(id, item);
    res.json({
      id: item.id,
      title: item.title,
      media_type: item.media_type,
      storage_path: item.storage_path,
      original_filename: item.original_filename,
      content_type: item.content_type,
      size: item.size,
      created_at: item.created_at,
    });
  }
);

apiRouter.delete("/admin/media/:id", authenticate, requireAdmin, (req, res) => {
  const item = media.get(req.params.id);
  if (!item || item.is_deleted) {
    return res.status(404).json({ detail: "Mídia não encontrada" });
  }
  item.is_deleted = true;
  media.set(item.id, item);
  res.json({ ok: true });
});

apiRouter.get("/media/:id/file", authenticate, (req, res) => {
  const item = media.get(req.params.id);
  if (!item || item.is_deleted) {
    return res.status(404).json({ detail: "Arquivo não encontrado" });
  }
  if (item.buffer) {
    res.setHeader("Content-Type", item.content_type);
    return res.send(item.buffer);
  }
  return res.status(404).json({ detail: "Arquivo indisponível" });
});

// App server setup
async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === "production";

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());

  // Mount API router
  app.use("/api", apiRouter);

  if (!isProduction) {
    // Development mode: attach Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets from dist/
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
