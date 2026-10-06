from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import asyncio
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional

import bcrypt
import jwt
import requests
from bson import ObjectId
from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator
from starlette.middleware.cors import CORSMiddleware

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
GOOGLE_SESSION_DATA_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

PyObjectId = Annotated[str, BeforeValidator(str)]

MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
             "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

ANNOUNCEMENT_CATEGORIES = {"Agenda", "Congresso", "Aviso"}


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: PyObjectId = Field(default_factory=lambda: str(ObjectId()), alias="_id")

    def to_mongo(self) -> dict:
        doc = {k: v for k, v in self.model_dump(by_alias=True).items() if v is not None}
        if doc.get("_id"):
            doc["_id"] = ObjectId(doc["_id"])
        else:
            doc.pop("_id", None)
        return doc

    @classmethod
    def from_mongo(cls, doc: Optional[dict]):
        if not doc:
            return None
        doc = dict(doc)
        doc["_id"] = str(doc["_id"])
        return cls(**doc)


class User(BaseDocument):
    full_name: str
    birth_date: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    picture: Optional[str] = None
    user_id: Optional[str] = None
    auth_provider: Optional[str] = None
    role: str = "member"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Hymn(BaseDocument):
    title: str
    artist: str = ""
    tone: str = ""
    tags: List[str] = []
    youtube_id: Optional[str] = None
    youtube_url: Optional[str] = None
    spotify_url: Optional[str] = None
    lyrics: Optional[str] = None
    is_weekly: bool = False
    week_order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Announcement(BaseDocument):
    title: str
    description: str = ""
    category: str = "Aviso"
    event_date: Optional[str] = None
    is_featured: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def _validate_birth_date(v: str) -> str:
    try:
        datetime.strptime(v, "%Y-%m-%d")
    except ValueError:
        raise ValueError("Data de aniversário inválida")
    return v


def _validate_whatsapp(v: str) -> str:
    digits = re.sub(r"\D", "", v)
    if len(digits) < 10:
        raise ValueError("WhatsApp inválido (use DDD + número)")
    return digits


class RegisterInput(BaseModel):
    full_name: str = Field(min_length=3)
    birth_date: str
    whatsapp: str
    password: str = Field(min_length=6)

    _bd = field_validator("birth_date")(_validate_birth_date)
    _wa = field_validator("whatsapp")(_validate_whatsapp)


class ProfileInput(BaseModel):
    birth_date: str
    whatsapp: str

    _bd = field_validator("birth_date")(_validate_birth_date)
    _wa = field_validator("whatsapp")(_validate_whatsapp)


class LoginInput(BaseModel):
    identifier: str
    password: str


class GoogleSessionInput(BaseModel):
    session_id: str


class HymnInput(BaseModel):
    title: str = Field(min_length=1)
    artist: str = ""
    tone: str = ""
    tags: List[str] = []
    youtube_url: Optional[str] = None
    spotify_url: Optional[str] = None
    lyrics: Optional[str] = None
    is_weekly: bool = False
    week_order: int = 0


class AnnouncementInput(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    category: str = "Aviso"
    event_date: Optional[str] = None
    is_featured: bool = False

    @field_validator("category")
    @classmethod
    def check_category(cls, v: str) -> str:
        return v if v in ANNOUNCEMENT_CATEGORIES else "Aviso"

    @field_validator("event_date")
    @classmethod
    def check_event_date(cls, v: Optional[str]) -> Optional[str]:
        if v:
            try:
                datetime.strptime(v, "%Y-%m-%d")
            except ValueError:
                raise ValueError("Data do evento inválida")
        return v or None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, identifier: str) -> str:
    payload = {"sub": user_id, "idt": identifier, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=15)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, user_id: str, identifier: str):
    response.set_cookie("access_token", create_access_token(user_id, identifier),
                        httponly=True, secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie("refresh_token", create_refresh_token(user_id),
                        httponly=True, secure=True, samesite="none", max_age=604800, path="/")


def user_out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id")) if doc.get("_id") else doc.get("user_id")
    doc.pop("password_hash", None)
    return doc


async def get_current_user(request: Request) -> dict:
    bearer = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        bearer = auth_header[7:]

    session_token = request.cookies.get("session_token") or bearer
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token})
        if session:
            expires_at = session["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                raise HTTPException(401, "Sessão expirada")
            user = await db.users.find_one({"user_id": session["user_id"]})
            if not user:
                raise HTTPException(401, "Usuário não encontrado")
            return user_out(user)

    token = request.cookies.get("access_token") or bearer
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Token inválido")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    return user_out(user)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Acesso restrito ao administrador")
    return user


async def check_lockout(key: str):
    rec = await db.login_attempts.find_one({"identifier": key})
    if rec and rec.get("count", 0) >= 5:
        last = datetime.fromisoformat(rec["last_attempt"])
        if datetime.now(timezone.utc) - last < timedelta(minutes=15):
            raise HTTPException(429, "Muitas tentativas. Tente novamente em 15 minutos.")


async def record_failed_attempt(key: str):
    await db.login_attempts.update_one(
        {"identifier": key},
        {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


@api_router.get("/")
async def root():
    return {"message": "Banda El Shaday API"}


@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    existing = await db.users.find_one({"whatsapp": data.whatsapp})
    if existing:
        raise HTTPException(400, "Este WhatsApp já está cadastrado")
    user = User(full_name=data.full_name.strip(), birth_date=data.birth_date,
                whatsapp=data.whatsapp, role="member")
    doc = user.to_mongo()
    doc["password_hash"] = hash_password(data.password)
    await db.users.insert_one(doc)
    set_auth_cookies(response, user.id, data.whatsapp)
    return user.model_dump()


@api_router.post("/auth/login")
async def login(data: LoginInput, request: Request, response: Response):
    identifier = data.identifier.strip()
    query = {"email": identifier.lower()} if "@" in identifier else {"whatsapp": re.sub(r"\D", "", identifier)}
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{identifier.lower()}"
    await check_lockout(key)
    user = await db.users.find_one(query)
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        await record_failed_attempt(key)
        raise HTTPException(401, "Credenciais inválidas")
    await db.login_attempts.delete_one({"identifier": key})
    set_auth_cookies(response, str(user["_id"]), identifier)
    return user_out(user)


@api_router.post("/auth/google/session")
async def google_session(data: GoogleSessionInput, response: Response):
    def fetch_session():
        return requests.get(GOOGLE_SESSION_DATA_URL,
                            headers={"X-Session-ID": data.session_id}, timeout=10)
    try:
        r = await asyncio.to_thread(fetch_session)
    except Exception:
        raise HTTPException(502, "Falha ao validar a sessão do Google")
    if r.status_code != 200:
        raise HTTPException(401, "Sessão do Google inválida")
    payload = r.json()
    email = payload["email"].lower()

    user = await db.users.find_one({"email": email})
    if user is None:
        doc = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "full_name": payload.get("name") or email.split("@")[0],
            "email": email,
            "picture": payload.get("picture"),
            "role": "member",
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(doc)
        user = await db.users.find_one({"user_id": doc["user_id"]})
    else:
        updates = {}
        if payload.get("picture") and not user.get("picture"):
            updates["picture"] = payload["picture"]
        if not user.get("user_id"):
            updates["user_id"] = f"user_{uuid.uuid4().hex[:12]}"
        if updates:
            await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
            user.update(updates)

    await db.user_sessions.delete_many({"user_id": user["user_id"]})
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": payload["session_token"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    response.set_cookie("session_token", payload["session_token"],
                        httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return user_out(user)


@api_router.put("/auth/profile")
async def complete_profile(data: ProfileInput, user: dict = Depends(get_current_user)):
    conflict = await db.users.find_one({"whatsapp": data.whatsapp, "_id": {"$ne": ObjectId(user["id"])}})
    if conflict:
        raise HTTPException(400, "Este WhatsApp já está cadastrado em outra conta")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"birth_date": data.birth_date, "whatsapp": data.whatsapp}},
    )
    updated = await db.users.find_one({"_id": ObjectId(user["id"])})
    return user_out(updated)


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "Sem sessão")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Token inválido")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Sessão expirada")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    response.set_cookie("access_token", create_access_token(str(user["_id"]), user.get("email") or user.get("whatsapp") or ""),
                        httponly=True, secure=True, samesite="none", max_age=900, path="/")
    return {"ok": True}


@api_router.get("/public/highlights")
async def public_highlights():
    docs = await db.hymns.find({"is_weekly": True}).sort("week_order", 1).to_list(4)
    return [{"id": str(d["_id"]), "title": d["title"], "artist": d.get("artist", ""),
             "tone": d.get("tone", ""), "tags": d.get("tags", []),
             "youtube_id": d.get("youtube_id")} for d in docs]


@api_router.get("/public/announcements")
async def public_announcements():
    docs = await db.announcements.find().sort(
        [("is_featured", -1), ("created_at", -1)]).to_list(3)
    return [Announcement.from_mongo(d).model_dump() for d in docs]


@api_router.get("/public/media")
async def public_media():
    docs = await db.media.find({"is_deleted": False, "media_type": "foto"}) \
        .sort("created_at", -1).to_list(8)
    return [{"id": str(d["_id"]), "title": d.get("title", "")} for d in docs]


@api_router.get("/public/media/{media_id}/file")
async def public_media_file(media_id: str):
    record = await db.media.find_one(
        {"_id": ObjectId(media_id), "is_deleted": False, "media_type": "foto"})
    if not record:
        raise HTTPException(404, "Arquivo não encontrado")
    try:
        data, content_type = await asyncio.to_thread(get_object, record["storage_path"])
    except Exception:
        raise HTTPException(404, "Arquivo não encontrado no armazenamento")
    return Response(content=data, media_type=record.get("content_type") or content_type,
                    headers={"Cache-Control": "public, max-age=3600"})


@api_router.get("/announcements")
async def list_announcements(user: dict = Depends(get_current_user)):
    docs = await db.announcements.find().sort(
        [("is_featured", -1), ("created_at", -1)]).to_list(100)
    return [Announcement.from_mongo(d).model_dump() for d in docs]


@api_router.post("/admin/announcements")
async def create_announcement(data: AnnouncementInput, admin: dict = Depends(require_admin)):
    doc = Announcement(**data.model_dump())
    await db.announcements.insert_one(doc.to_mongo())
    return doc.model_dump()


@api_router.put("/admin/announcements/{announcement_id}")
async def update_announcement(announcement_id: str, data: AnnouncementInput, admin: dict = Depends(require_admin)):
    result = await db.announcements.update_one(
        {"_id": ObjectId(announcement_id)}, {"$set": data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(404, "Aviso não encontrado")
    doc = await db.announcements.find_one({"_id": ObjectId(announcement_id)})
    return Announcement.from_mongo(doc).model_dump()


@api_router.delete("/admin/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, admin: dict = Depends(require_admin)):
    result = await db.announcements.delete_one({"_id": ObjectId(announcement_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Aviso não encontrado")
    return {"ok": True}


@api_router.get("/hymns/week")
async def weekly_hymns(user: dict = Depends(get_current_user)):
    docs = await db.hymns.find({"is_weekly": True}).sort("week_order", 1).to_list(50)
    return [Hymn.from_mongo(d).model_dump() for d in docs]


@api_router.get("/hymns")
async def list_hymns(search: str = "", tag: str = "", user: dict = Depends(get_current_user)):
    query: dict = {}
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [{"title": rx}, {"artist": rx}]
    if tag:
        query["tags"] = tag
    docs = await db.hymns.find(query).sort("title", 1).to_list(500)
    return [Hymn.from_mongo(d).model_dump() for d in docs]


@api_router.get("/members/birthdays")
async def members_birthdays(user: dict = Depends(get_current_user)):
    users = await db.users.find({"birth_date": {"$nin": [None, ""]}}).to_list(2000)
    today = datetime.now().date()
    out = []
    for u in users:
        try:
            bd = datetime.strptime(u["birth_date"], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        try:
            next_bd = bd.replace(year=today.year)
        except ValueError:
            next_bd = bd.replace(year=today.year, day=28)
        if next_bd < today:
            try:
                next_bd = bd.replace(year=today.year + 1)
            except ValueError:
                next_bd = bd.replace(year=today.year + 1, day=28)
        days_until = (next_bd - today).days
        out.append({
            "id": str(u["_id"]),
            "full_name": u["full_name"],
            "whatsapp": u.get("whatsapp"),
            "birth_date": u["birth_date"],
            "day": bd.day,
            "month": bd.month,
            "month_name": MONTHS_PT[bd.month - 1],
            "turning_age": next_bd.year - bd.year,
            "is_today": days_until == 0,
            "is_this_month": bd.month == today.month,
            "days_until": days_until,
        })
    out.sort(key=lambda x: x["days_until"])
    return out


def extract_youtube_id(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    m = re.search(r"(?:youtube\.com/(?:watch\?[^#]*v=|embed/|shorts/)|youtu\.be/)([\w-]{11})", url)
    if m:
        return m.group(1)
    if re.fullmatch(r"[\w-]{11}", url.strip()):
        return url.strip()
    return None


@api_router.post("/admin/hymns")
async def create_hymn(data: HymnInput, admin: dict = Depends(require_admin)):
    doc = Hymn(**data.model_dump())
    mongo_doc = doc.to_mongo()
    mongo_doc["youtube_id"] = extract_youtube_id(data.youtube_url)
    await db.hymns.insert_one(mongo_doc)
    result = doc.model_dump()
    result["youtube_id"] = mongo_doc["youtube_id"]
    return result


@api_router.put("/admin/hymns/{hymn_id}")
async def update_hymn(hymn_id: str, data: HymnInput, admin: dict = Depends(require_admin)):
    update = data.model_dump()
    update["youtube_id"] = extract_youtube_id(data.youtube_url)
    result = await db.hymns.update_one({"_id": ObjectId(hymn_id)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Hino não encontrado")
    doc = await db.hymns.find_one({"_id": ObjectId(hymn_id)})
    return Hymn.from_mongo(doc).model_dump()


@api_router.delete("/admin/hymns/{hymn_id}")
async def delete_hymn(hymn_id: str, admin: dict = Depends(require_admin)):
    result = await db.hymns.delete_one({"_id": ObjectId(hymn_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Hino não encontrado")
    return {"ok": True}


class MemberInput(BaseModel):
    full_name: str = Field(min_length=3)
    birth_date: str
    whatsapp: str
    password: Optional[str] = None

    _bd = field_validator("birth_date")(_validate_birth_date)
    _wa = field_validator("whatsapp")(_validate_whatsapp)


@api_router.get("/admin/members")
async def list_members(admin: dict = Depends(require_admin)):
    users = await db.users.find().sort("full_name", 1).to_list(2000)
    return [user_out(u) for u in users]


@api_router.post("/admin/members")
async def create_member(data: MemberInput, admin: dict = Depends(require_admin)):
    if not data.password or len(data.password) < 6:
        raise HTTPException(400, "Informe uma senha inicial de pelo menos 6 caracteres")
    existing = await db.users.find_one({"whatsapp": data.whatsapp})
    if existing:
        raise HTTPException(400, "Este WhatsApp já está cadastrado")
    user = User(full_name=data.full_name.strip(), birth_date=data.birth_date,
                whatsapp=data.whatsapp, role="member")
    doc = user.to_mongo()
    doc["password_hash"] = hash_password(data.password)
    await db.users.insert_one(doc)
    return user.model_dump()


@api_router.put("/admin/members/{member_id}")
async def update_member(member_id: str, data: MemberInput, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"_id": ObjectId(member_id)})
    if not target:
        raise HTTPException(404, "Integrante não encontrado")
    conflict = await db.users.find_one({"whatsapp": data.whatsapp, "_id": {"$ne": ObjectId(member_id)}})
    if conflict:
        raise HTTPException(400, "Este WhatsApp já está cadastrado em outra conta")
    update = {"full_name": data.full_name.strip(), "birth_date": data.birth_date,
              "whatsapp": data.whatsapp}
    if data.password:
        if len(data.password) < 6:
            raise HTTPException(400, "A senha deve ter pelo menos 6 caracteres")
        update["password_hash"] = hash_password(data.password)
    await db.users.update_one({"_id": ObjectId(member_id)}, {"$set": update})
    return user_out(await db.users.find_one({"_id": ObjectId(member_id)}))


@api_router.delete("/admin/members/{member_id}")
async def delete_member(member_id: str, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"_id": ObjectId(member_id)})
    if not target:
        raise HTTPException(404, "Integrante não encontrado")
    if target.get("role") == "admin":
        raise HTTPException(400, "Não é possível remover um administrador")
    await db.users.delete_one({"_id": ObjectId(member_id)})
    await db.user_sessions.delete_many({"user_id": target.get("user_id")})
    return {"ok": True}


STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "banda-el-shaday"
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key}, timeout=120)
    if resp.status_code == 404:
        init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": storage_key}, timeout=120)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


class MediaItem(BaseDocument):
    title: str = ""
    media_type: str = "foto"
    storage_path: str
    original_filename: str = ""
    content_type: str = "application/octet-stream"
    size: int = 0
    is_deleted: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


MAX_MEDIA_SIZE = 100 * 1024 * 1024


@api_router.get("/media")
async def list_media(user: dict = Depends(get_current_user)):
    docs = await db.media.find({"is_deleted": False}).sort("created_at", -1).to_list(500)
    return [MediaItem.from_mongo(d).model_dump() for d in docs]


@api_router.post("/admin/media")
async def upload_media(file: UploadFile = File(...), title: str = Form(""),
                       admin: dict = Depends(require_admin)):
    content_type = file.content_type or "application/octet-stream"
    if not (content_type.startswith("image/") or content_type.startswith("video/")):
        raise HTTPException(400, "Envie apenas fotos ou vídeos")
    data = await file.read()
    if len(data) > MAX_MEDIA_SIZE:
        raise HTTPException(400, "Arquivo muito grande (máximo 100 MB)")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    path = f"{APP_NAME}/media/{admin['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = await asyncio.to_thread(put_object, path, data, content_type)
    except Exception:
        logging.getLogger(__name__).exception("Falha no upload para o storage")
        raise HTTPException(502, "Falha ao enviar o arquivo. Tente novamente.")
    item = MediaItem(
        title=title.strip() or (file.filename or "Mídia"),
        media_type="video" if content_type.startswith("video/") else "foto",
        storage_path=result["path"],
        original_filename=file.filename or "",
        content_type=content_type,
        size=result.get("size", len(data)),
    )
    await db.media.insert_one(item.to_mongo())
    return item.model_dump()


@api_router.delete("/admin/media/{media_id}")
async def delete_media(media_id: str, admin: dict = Depends(require_admin)):
    result = await db.media.update_one({"_id": ObjectId(media_id)}, {"$set": {"is_deleted": True}})
    if result.matched_count == 0:
        raise HTTPException(404, "Mídia não encontrada")
    return {"ok": True}


@api_router.get("/media/{media_id}/file")
async def media_file(media_id: str, user: dict = Depends(get_current_user)):
    record = await db.media.find_one({"_id": ObjectId(media_id), "is_deleted": False})
    if not record:
        raise HTTPException(404, "Arquivo não encontrado")
    try:
        data, content_type = await asyncio.to_thread(get_object, record["storage_path"])
    except Exception:
        raise HTTPException(404, "Arquivo não encontrado no armazenamento")
    return Response(content=data, media_type=record.get("content_type") or content_type)


SEED_HYMNS = [
    {"title": "A Ele a Glória / Porque Ele Vive", "artist": "Gabriela Rocha", "tone": "E",
     "tags": ["Adoração", "Abertura"], "youtube_url": "https://www.youtube.com/watch?v=zawIqlbwFqI",
     "spotify_url": "https://open.spotify.com/search/A%20Ele%20a%20Gl%C3%B3ria%20Gabriela%20Rocha",
     "is_weekly": True, "week_order": 1,
     "lyrics": "A Ele a glória\nA Ele o louvor\nA Ele o domínio\nEle é o meu Senhor"},
    {"title": "Lugar Secreto / Pai Nosso", "artist": "Gabriela Rocha", "tone": "G",
     "tags": ["Adoração", "Ceia"], "youtube_url": "https://www.youtube.com/watch?v=cffSMjavggA",
     "spotify_url": "https://open.spotify.com/search/Lugar%20Secreto%20Gabriela%20Rocha",
     "is_weekly": True, "week_order": 2,
     "lyrics": "Quero comungar contigo\nNo lugar secreto\nTe adorar em espírito\nEm espírito e em verdade"},
    {"title": "Caminho no Deserto (Way Maker)", "artist": "Leeland / Sinach", "tone": "B",
     "tags": ["Adoração"], "youtube_url": "https://www.youtube.com/watch?v=iJCV_2H9xD0",
     "spotify_url": "https://open.spotify.com/search/Way%20Maker%20Leeland",
     "is_weekly": True, "week_order": 3,
     "lyrics": "Caminho no deserto\nLuz na escuridão\nMeu Deus, é quem Tu és"},
    {"title": "O Amor Tem Nome (Reckless Love)", "artist": "Bethel Music", "tone": "D",
     "tags": ["Adoração"], "youtube_url": "https://www.youtube.com/watch?v=Sc6SSHuZvQE",
     "spotify_url": "https://open.spotify.com/search/Reckless%20Love%20Bethel%20Music",
     "is_weekly": False, "week_order": 0,
     "lyrics": "Antes de eu falar\nTu cantaste sobre mim\nTu tens sido tão bom\nTão bom para mim"},
    {"title": "Oceanos (Onde Meus Pés Podem Falhar)", "artist": "Hillsong UNITED", "tone": "Bm",
     "tags": ["Adoração", "Ceia"], "youtube_url": "https://www.youtube.com/watch?v=dy9nwe9_xzw",
     "spotify_url": "https://open.spotify.com/search/Oceans%20Hillsong%20UNITED",
     "is_weekly": False, "week_order": 0,
     "lyrics": "Tu me chamas sobre as águas\nAo desconhecido, para Te buscar\nE aí estou eu, aos Teus pés"},
    {"title": "Raridade", "artist": "Anderson Freire", "tone": "C",
     "tags": ["Adoração"], "youtube_url": "https://www.youtube.com/results?search_query=Raridade+Anderson+Freire",
     "spotify_url": "https://open.spotify.com/search/Raridade%20Anderson%20Freire",
     "is_weekly": False, "week_order": 0},
    {"title": "Grandes Coisas", "artist": "Fernandinho", "tone": "A",
     "tags": ["Jubilo", "Abertura"], "youtube_url": "https://www.youtube.com/results?search_query=Grandes+Coisas+Fernandinho",
     "spotify_url": "https://open.spotify.com/search/Grandes%20Coisas%20Fernandinho",
     "is_weekly": False, "week_order": 0},
    {"title": "Ninguém Explica Deus", "artist": "Preto no Branco", "tone": "F",
     "tags": ["Ceia", "Adoração"], "youtube_url": "https://www.youtube.com/results?search_query=Ningu%C3%A9m+Explica+Deus+Preto+no+Branco",
     "spotify_url": "https://open.spotify.com/search/Ningu%C3%A9m%20Explica%20Deus%20Preto%20no%20Branco",
     "is_weekly": False, "week_order": 0},
]

SEED_ANNOUNCEMENTS = [
    {"title": "Congresso de Adoração 2026", "category": "Congresso", "event_date": "2026-11-21",
     "description": "A Banda El Shaday ministrará no Congresso de Adoração. Guardem a data: um fim de semana inteiro de louvor, palavra e comunhão. Escala e horários serão confirmados no grupo da banda.",
     "is_featured": True},
    {"title": "Ensaio geral — sábados às 16h", "category": "Agenda", "event_date": None,
     "description": "Ensaio semanal de toda a banda no salão principal. Cheguem 15 minutos antes para afinação e passagem de som.",
     "is_featured": False},
    {"title": "Culto de Santa Ceia — escala especial", "category": "Agenda", "event_date": "2026-11-02",
     "description": "No culto de ceia os hinos da semana serão ministrados em tom mais suave. Confirmem presença com a liderança até sexta-feira.",
     "is_featured": False},
]


async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL")
    password = os.environ.get("ADMIN_PASSWORD")
    if not email or not password:
        return
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "full_name": "Administrador",
            "email": email,
            "password_hash": hash_password(password),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logging.getLogger(__name__).info("Admin seed criado: %s", email)


@app.on_event("startup")
async def startup():
    try:
        await asyncio.to_thread(init_storage)
        logging.getLogger(__name__).info("Storage inicializado")
    except Exception as e:
        logging.getLogger(__name__).error("Falha ao inicializar storage: %s", e)
    await db.users.create_index("whatsapp", unique=True, sparse=True)
    await db.users.create_index("email", unique=True, sparse=True)
    await db.user_sessions.create_index("session_token")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await seed_admin()
    if await db.hymns.count_documents({}) == 0:
        docs = []
        for h in SEED_HYMNS:
            hymn = Hymn(**h)
            doc = hymn.to_mongo()
            doc["youtube_id"] = extract_youtube_id(h.get("youtube_url"))
            docs.append(doc)
        await db.hymns.insert_many(docs)
    if await db.announcements.count_documents({}) == 0:
        await db.announcements.insert_many(
            [Announcement(**a).to_mongo() for a in SEED_ANNOUNCEMENTS])


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
