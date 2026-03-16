"""
Content Studio endpoints — AI content generation, brand kit, publishing.
All endpoints are tenant-scoped via the authenticated user's tenant_id.
"""
import os
import json
import logging
from typing import Optional
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from database.connection import get_db
from database.models import Admin, GeneratedContent, BrandKit, Tenant
from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/content-studio", tags=["Content Studio"])


# ============================================================================
# HELPERS
# ============================================================================

def _get_tenant_id(user: Admin) -> int:
    """Extract tenant_id from authenticated user. Dev users must specify one."""
    if user.tenant_id:
        return user.tenant_id
    raise HTTPException(status_code=403, detail="Usuario no asociado a ninguna agencia")


def _content_to_dict(c: GeneratedContent) -> dict:
    """Serialize a GeneratedContent record to a JSON-safe dict."""
    return {
        "id": c.id,
        "tenant_id": c.tenant_id,
        "content_type": c.content_type,
        "title": c.title,
        "prompt": c.prompt,
        "caption": c.caption,
        "media_url": c.media_url,
        "thumbnail_url": c.thumbnail_url,
        "style": c.style,
        "dimensions": c.dimensions,
        "platform": c.platform,
        "status": c.status,
        "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
        "published_at": c.published_at.isoformat() if c.published_at else None,
        "meta_post_id": c.meta_post_id,
        "generation_cost": c.generation_cost,
        "metadata_json": c.metadata_json,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _brandkit_to_dict(bk: BrandKit) -> dict:
    return {
        "id": bk.id,
        "tenant_id": bk.tenant_id,
        "logo_url": bk.logo_url,
        "primary_color": bk.primary_color,
        "secondary_color": bk.secondary_color,
        "accent_color": bk.accent_color,
        "font_heading": bk.font_heading,
        "font_body": bk.font_body,
        "tagline": bk.tagline,
        "tone": bk.tone,
        "created_at": bk.created_at.isoformat() if bk.created_at else None,
        "updated_at": bk.updated_at.isoformat() if bk.updated_at else None,
    }


# ============================================================================
# CONTENT CRUD
# ============================================================================

@router.get("/content")
def list_content(
    content_type: Optional[str] = Query(None, description="Filter: image, video, post, story"),
    status: Optional[str] = Query(None, description="Filter: draft, published, scheduled, failed"),
    platform: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = _get_tenant_id(current_user)
    q = db.query(GeneratedContent).filter(GeneratedContent.tenant_id == tid)

    if content_type:
        q = q.filter(GeneratedContent.content_type == content_type)
    if status:
        q = q.filter(GeneratedContent.status == status)
    if platform:
        q = q.filter(GeneratedContent.platform == platform)

    total = q.count()
    items = q.order_by(desc(GeneratedContent.created_at)).offset((page - 1) * limit).limit(limit).all()

    return {
        "items": [_content_to_dict(c) for c in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/content/{content_id}")
def get_content(
    content_id: int,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = _get_tenant_id(current_user)
    c = db.query(GeneratedContent).filter(
        GeneratedContent.id == content_id,
        GeneratedContent.tenant_id == tid,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contenido no encontrado")
    return _content_to_dict(c)


@router.post("/content")
def create_content(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = _get_tenant_id(current_user)
    content_type = body.get("content_type")
    if not content_type:
        raise HTTPException(status_code=400, detail="content_type es requerido")

    record = GeneratedContent(
        tenant_id=tid,
        content_type=content_type,
        title=body.get("title"),
        prompt=body.get("prompt"),
        caption=body.get("caption"),
        media_url=body.get("media_url"),
        thumbnail_url=body.get("thumbnail_url"),
        style=body.get("style"),
        dimensions=body.get("dimensions"),
        platform=body.get("platform"),
        status=body.get("status", "draft"),
        scheduled_at=_parse_datetime(body.get("scheduled_at")),
        published_at=_parse_datetime(body.get("published_at")),
        meta_post_id=body.get("meta_post_id"),
        generation_cost=body.get("generation_cost", 0),
        metadata_json=json.dumps(body.get("metadata")) if body.get("metadata") else body.get("metadata_json"),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _content_to_dict(record)


@router.put("/content/{content_id}")
def update_content(
    content_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = _get_tenant_id(current_user)
    c = db.query(GeneratedContent).filter(
        GeneratedContent.id == content_id,
        GeneratedContent.tenant_id == tid,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contenido no encontrado")

    updatable = [
        "title", "prompt", "caption", "media_url", "thumbnail_url",
        "style", "dimensions", "platform", "status", "meta_post_id",
        "generation_cost", "metadata_json",
    ]
    for field in updatable:
        if field in body:
            setattr(c, field, body[field])

    if "scheduled_at" in body:
        c.scheduled_at = _parse_datetime(body["scheduled_at"])
    if "published_at" in body:
        c.published_at = _parse_datetime(body["published_at"])
    if "metadata" in body:
        c.metadata_json = json.dumps(body["metadata"])

    db.commit()
    db.refresh(c)
    return _content_to_dict(c)


@router.delete("/content/{content_id}")
def delete_content(
    content_id: int,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = _get_tenant_id(current_user)
    c = db.query(GeneratedContent).filter(
        GeneratedContent.id == content_id,
        GeneratedContent.tenant_id == tid,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contenido no encontrado")

    db.delete(c)
    db.commit()
    return {"ok": True, "deleted_id": content_id}


# ============================================================================
# GENERATION ENDPOINTS — Pollinations.ai (FREE, no API key needed)
# ============================================================================

def _build_pollinations_prompt(prompt: str, style: str, brand_colors: dict = None) -> str:
    """Enhance the user prompt with style and brand context for better generation."""
    style_map = {
        "profesional": "professional corporate photography, clean composition, high quality",
        "moderno": "modern trendy design, bold typography, vibrant, contemporary",
        "elegante": "elegant luxury aesthetic, refined, sophisticated, premium feel",
        "vibrante": "vibrant colorful, energetic, eye-catching, dynamic",
        "minimalista": "minimalist clean design, lots of white space, simple",
        "corporativo": "corporate business style, trustworthy, polished",
        "festivo": "festive celebration, party atmosphere, joyful colors",
        "premium": "premium high-end, luxury brand feel, gold accents, refined",
    }
    style_suffix = style_map.get(style, "professional high quality")

    enhanced = f"{prompt}, {style_suffix}, advertising quality, sharp focus, 4K"

    if brand_colors and brand_colors.get("primary"):
        enhanced += f", brand color palette {brand_colors['primary']}"

    return enhanced


@router.post("/generate-image")
async def generate_image(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    """Generate a REAL image using Pollinations.ai (free, no API key).
    Returns a URL to the generated image."""
    tid = _get_tenant_id(current_user)
    prompt = body.get("prompt", "")
    style = body.get("style", "modern")
    dimensions = body.get("dimensions", "1080x1080")
    brand_colors = body.get("brand_colors", {})

    if not prompt.strip():
        raise HTTPException(status_code=400, detail="El prompt es requerido")

    # Parse dimensions
    w, h = dimensions.split("x") if "x" in dimensions else ("1080", "1080")

    # Build enhanced prompt
    short_prompt = prompt[:200]
    style_tag = {
        "profesional": "professional photography",
        "moderno": "modern trendy design",
        "elegante": "elegant luxury aesthetic",
        "vibrante": "vibrant colorful energetic",
        "minimalista": "minimalist clean",
        "corporativo": "corporate business",
        "festivo": "festive celebration",
        "premium": "premium high-end luxury",
    }.get(style, "professional")

    final_prompt = f"{short_prompt}, {style_tag}, advertising quality, sharp focus, 4K"

    # Try Hugging Face Inference API first (free with token), fallback to Pollinations
    import base64
    status = "completed"
    image_base64 = None
    generator_used = "none"

    hf_token = os.getenv("HF_API_TOKEN", "")

    if hf_token:
        # Hugging Face Inference — reliable, fast, high quality (SDXL)
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                logger.info(f"[ContentStudio] Generating via HuggingFace SDXL...")
                resp = await client.post(
                    "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
                    headers={"Authorization": f"Bearer {hf_token}"},
                    json={"inputs": final_prompt},
                )
                if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
                    img_bytes = resp.content
                    img_b64 = base64.b64encode(img_bytes).decode("utf-8")
                    content_type = resp.headers.get("content-type", "image/jpeg")
                    image_base64 = f"data:{content_type};base64,{img_b64}"
                    generator_used = "huggingface_sdxl"
                    logger.info(f"[ContentStudio] HF image: {len(img_bytes)} bytes")
                else:
                    error_body = resp.text[:200]
                    logger.warning(f"[ContentStudio] HF returned {resp.status_code}: {error_body}")
        except Exception as e:
            logger.warning(f"[ContentStudio] HF error: {e}")

    # Fallback: Pollinations (free, no auth, but unreliable)
    if not image_base64:
        import urllib.parse
        encoded_prompt = urllib.parse.quote(final_prompt[:150])
        seed = int(datetime.utcnow().timestamp()) % 100000
        pollinations_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={w}&height={h}&seed={seed}&nologo=true"

        try:
            async with httpx.AsyncClient(timeout=90, follow_redirects=True) as client:
                logger.info(f"[ContentStudio] Fallback: Pollinations...")
                resp = await client.get(pollinations_url)
                if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
                    img_bytes = resp.content
                    img_b64 = base64.b64encode(img_bytes).decode("utf-8")
                    content_type = resp.headers.get("content-type", "image/jpeg")
                    image_base64 = f"data:{content_type};base64,{img_b64}"
                    generator_used = "pollinations"
                    logger.info(f"[ContentStudio] Pollinations image: {len(img_bytes)} bytes")
                else:
                    logger.warning(f"[ContentStudio] Pollinations returned {resp.status_code}")
        except Exception as e:
            logger.warning(f"[ContentStudio] Pollinations error: {e}")

    if not image_base64:
        status = "failed"

    # Don't store base64 in DB (too large). Store a reference URL instead.
    storage_url = f"generated://{generator_used}/{int(datetime.utcnow().timestamp())}"

    record = GeneratedContent(
        tenant_id=tid,
        content_type="image",
        prompt=prompt,
        style=style,
        dimensions=dimensions,
        media_url=storage_url,
        thumbnail_url=storage_url,
        status=status,
        generation_cost=0,
        metadata_json=json.dumps({
            "brand_colors": brand_colors,
            "enhanced_prompt": final_prompt,
            "generator": "pollinations.ai",
            "seed": seed,
        }),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    result = _content_to_dict(record)
    # Return base64 image directly (client displays this, NOT stored in DB)
    result["url"] = image_base64 if image_base64 else ""
    return result


@router.post("/generate-video")
async def generate_video(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    """Generate a video using Pollinations.ai text-to-video (free, no API key).
    Note: Video generation takes longer than images."""
    tid = _get_tenant_id(current_user)
    script = body.get("script", "")
    avatar_style = body.get("avatar_style", "professional")
    language = body.get("language", "es")
    duration = body.get("duration", 30)

    if not script.strip():
        raise HTTPException(status_code=400, detail="El guión es requerido")

    # Build video prompt from script
    video_prompt = f"Professional advertisement video: {script}. Style: {avatar_style}, cinematic, high quality, smooth motion"

    # Pollinations.ai video generation endpoint
    import urllib.parse
    encoded_prompt = urllib.parse.quote(video_prompt)
    seed = int(datetime.utcnow().timestamp()) % 100000

    # Pollinations video URL (generates MP4)
    video_url = f"https://video.pollinations.ai/prompt/{encoded_prompt}?seed={seed}"

    # Also generate a thumbnail image for the video
    thumb_prompt = urllib.parse.quote(f"Video thumbnail: {script[:100]}, professional, eye-catching")
    thumbnail_url = f"https://image.pollinations.ai/prompt/{thumb_prompt}?width=1080&height=1920&seed={seed}&nologo=true"

    record = GeneratedContent(
        tenant_id=tid,
        content_type="video",
        prompt=script,
        dimensions="1080x1920",
        media_url=video_url,
        thumbnail_url=thumbnail_url,
        status="completed",
        generation_cost=0,
        metadata_json=json.dumps({
            "avatar_style": avatar_style,
            "language": language,
            "duration": duration,
            "background": body.get("background"),
            "generator": "pollinations.ai",
            "video_url": video_url,
            "seed": seed,
        }),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    result = _content_to_dict(record)
    result["video_url"] = video_url
    result["script"] = script
    result["avatar_style"] = avatar_style
    result["language"] = language
    result["duration"] = duration
    result["estimated_time"] = "30-60 segundos"
    return result


@router.post("/generate-caption")
async def generate_caption(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    """Generate a caption/copy using Claude AI."""
    tid = _get_tenant_id(current_user)
    topic = body.get("topic", "")
    tone = body.get("tone", "profesional")
    platform = body.get("platform", "instagram")
    language = body.get("language", "es")

    # Try to get tenant info for context
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    business_name = tenant.name if tenant else "el negocio"
    business_type = tenant.business_type if tenant else "servicio"

    # Try to get brand kit for tone
    brand_kit = db.query(BrandKit).filter(BrandKit.tenant_id == tid).first()
    if brand_kit and not tone:
        tone = brand_kit.tone or "profesional"

    caption_text = await _generate_caption_with_ai(
        topic=topic,
        tone=tone,
        platform=platform,
        language=language,
        business_name=business_name,
        business_type=business_type,
    )

    # Save as a content record
    record = GeneratedContent(
        tenant_id=tid,
        content_type="post",
        caption=caption_text,
        platform=platform,
        status="draft",
        generation_cost=0,
        metadata_json=json.dumps({
            "topic": topic,
            "tone": tone,
            "language": language,
            "generator": "claude",
        }),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "caption": caption_text,
        "topic": topic,
        "tone": tone,
        "platform": platform,
        "language": language,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


# ============================================================================
# PUBLISHING
# ============================================================================

@router.post("/publish/{content_id}")
def publish_content(
    content_id: int,
    body: dict = None,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    """Publish content to Meta. Placeholder — updates status to 'published'."""
    tid = _get_tenant_id(current_user)
    body = body or {}

    c = db.query(GeneratedContent).filter(
        GeneratedContent.id == content_id,
        GeneratedContent.tenant_id == tid,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contenido no encontrado")

    # TODO: actual Meta API publishing will go here
    c.status = "published"
    c.published_at = datetime.utcnow()
    c.meta_post_id = f"placeholder_{content_id}_{int(datetime.utcnow().timestamp())}"

    if body.get("caption"):
        c.caption = body["caption"]
    if body.get("platforms"):
        c.platform = ",".join(body["platforms"]) if isinstance(body["platforms"], list) else body["platforms"]

    db.commit()
    db.refresh(c)

    result = _content_to_dict(c)
    result["meta_post_ids"] = [
        {"platform": p.strip(), "post_id": f"mock_{p.strip()}_{content_id}"}
        for p in (c.platform or "instagram").split(",")
    ]
    return result


@router.post("/schedule/{content_id}")
def schedule_content(
    content_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    """Schedule content for later publication."""
    tid = _get_tenant_id(current_user)
    scheduled_time = body.get("scheduled_time") or body.get("scheduled_at")
    if not scheduled_time:
        raise HTTPException(status_code=400, detail="scheduled_time es requerido")

    c = db.query(GeneratedContent).filter(
        GeneratedContent.id == content_id,
        GeneratedContent.tenant_id == tid,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contenido no encontrado")

    c.status = "scheduled"
    c.scheduled_at = _parse_datetime(scheduled_time)

    if body.get("caption"):
        c.caption = body["caption"]
    if body.get("platforms"):
        c.platform = ",".join(body["platforms"]) if isinstance(body["platforms"], list) else body["platforms"]

    db.commit()
    db.refresh(c)
    return _content_to_dict(c)


# ============================================================================
# BRAND KIT
# ============================================================================

@router.get("/brand-kit")
def get_brand_kit(
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = _get_tenant_id(current_user)
    bk = db.query(BrandKit).filter(BrandKit.tenant_id == tid).first()
    if not bk:
        # Return defaults
        return {
            "id": None,
            "tenant_id": tid,
            "logo_url": None,
            "primary_color": "#2D5A3D",
            "secondary_color": "#1A1A1A",
            "accent_color": "#C9A84C",
            "font_heading": "Montserrat",
            "font_body": "Inter",
            "tagline": "",
            "tone": "profesional",
            "created_at": None,
            "updated_at": None,
        }
    return _brandkit_to_dict(bk)


@router.put("/brand-kit")
def save_brand_kit(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = _get_tenant_id(current_user)
    bk = db.query(BrandKit).filter(BrandKit.tenant_id == tid).first()

    fields = [
        "logo_url", "primary_color", "secondary_color", "accent_color",
        "font_heading", "font_body", "tagline", "tone",
    ]

    if bk:
        for f in fields:
            if f in body:
                setattr(bk, f, body[f])
    else:
        bk = BrandKit(tenant_id=tid)
        for f in fields:
            if f in body:
                setattr(bk, f, body[f])
        db.add(bk)

    db.commit()
    db.refresh(bk)
    return _brandkit_to_dict(bk)


# ============================================================================
# STATS
# ============================================================================

@router.get("/stats")
def get_content_stats(
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = _get_tenant_id(current_user)
    base = db.query(GeneratedContent).filter(GeneratedContent.tenant_id == tid)

    total = base.count()
    published = base.filter(GeneratedContent.status == "published").count()
    scheduled = base.filter(GeneratedContent.status == "scheduled").count()
    drafts = base.filter(GeneratedContent.status == "draft").count()
    failed = base.filter(GeneratedContent.status == "failed").count()

    # Count by type
    by_type = {}
    for row in db.query(GeneratedContent.content_type, func.count()).filter(
        GeneratedContent.tenant_id == tid
    ).group_by(GeneratedContent.content_type).all():
        by_type[row[0]] = row[1]

    return {
        "total": total,
        "published": published,
        "scheduled": scheduled,
        "drafts": drafts,
        "failed": failed,
        "by_type": by_type,
    }


# ============================================================================
# AI SUGGESTIONS
# ============================================================================

@router.get("/suggestions")
async def get_suggestions(
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    """Get AI-generated content suggestions based on business context."""
    tid = _get_tenant_id(current_user)
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    business_name = tenant.name if tenant else "tu negocio"
    business_type = tenant.business_type if tenant else "servicio"

    suggestions = await _generate_suggestions_with_ai(business_name, business_type)
    return {"suggestions": suggestions}


# ============================================================================
# INTERNAL HELPERS
# ============================================================================

def _parse_datetime(value) -> Optional[datetime]:
    """Parse a datetime string, return None on failure."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


async def _generate_caption_with_ai(
    topic: str, tone: str, platform: str, language: str,
    business_name: str, business_type: str,
) -> str:
    """Call Claude to generate a social media caption."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        # Fallback if no API key
        return _fallback_caption(topic, tone)

    lang_label = "espanol" if language == "es" else "ingles"
    system_prompt = (
        f"Eres un experto en marketing digital y redes sociales. "
        f"Generas copies/captions para {platform} en {lang_label}. "
        f"Negocio: {business_name} ({business_type}). "
        f"Tono: {tone}. "
        f"Reglas: incluye hashtags relevantes, emojis moderados, maximo 300 palabras. "
        f"Responde SOLO con el caption, nada mas."
    )

    try:
        payload = {
            "model": "claude-sonnet-4-5-20250929",
            "max_tokens": 500,
            "system": system_prompt,
            "messages": [{"role": "user", "content": f"Genera un caption sobre: {topic}"}],
            "temperature": 0.8,
        }
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                text = ""
                for block in data.get("content", []):
                    if block.get("type") == "text":
                        text += block.get("text", "")
                if text.strip():
                    return text.strip()
    except Exception as e:
        logger.error(f"[ContentStudio] Caption generation failed: {e}")

    return _fallback_caption(topic, tone)


def _fallback_caption(topic: str, tone: str) -> str:
    """Return a static caption when AI is unavailable."""
    captions = {
        "profesional": (
            f"Descubre nuestro servicio premium de {topic or 'cuidado personal'}. "
            "Calidad que se nota, resultados que hablan por si solos. "
            "Agenda tu cita hoy.\n\n#PremiumService #CalidadProfesional"
        ),
        "amigable": (
            f"Hey! Sabias que tenemos lo mejor en {topic or 'cuidado personal'}? "
            "Ven y compruebalo tu mismo. Te esperamos con los brazos abiertos.\n\n"
            "#VenAVernos #TeEsperamos"
        ),
        "divertido": (
            "Alerta de estilo! Si tu look necesita un upgrade, "
            "nosotros tenemos la solucion. No esperes mas, "
            "tu mejor version te esta esperando.\n\n#NuevoLook #Estilo"
        ),
        "elegante": (
            f"La excelencia en {topic or 'cuidado personal'} tiene nombre. "
            "Experimenta un servicio donde cada detalle cuenta "
            "y cada visita es una experiencia unica.\n\n#Elegancia #Exclusivo"
        ),
    }
    return captions.get(tone, captions["profesional"])


async def _generate_suggestions_with_ai(business_name: str, business_type: str) -> list:
    """Generate content suggestions using Claude."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return _fallback_suggestions(business_name)

    system_prompt = (
        f"Eres un experto en marketing para negocios de {business_type}. "
        f"Genera 5 ideas de contenido para redes sociales para '{business_name}'. "
        f"Responde en JSON: un array de objetos con 'title', 'description', 'content_type' (image/video/story), 'platform' (instagram/facebook/both). "
        f"Solo el JSON, nada mas."
    )

    try:
        payload = {
            "model": "claude-sonnet-4-5-20250929",
            "max_tokens": 800,
            "system": system_prompt,
            "messages": [{"role": "user", "content": "Dame 5 ideas de contenido para esta semana."}],
            "temperature": 0.9,
        }
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                text = ""
                for block in data.get("content", []):
                    if block.get("type") == "text":
                        text += block.get("text", "")
                if text.strip():
                    try:
                        # Try to parse JSON from the response
                        parsed = json.loads(text.strip())
                        if isinstance(parsed, list):
                            return parsed
                    except json.JSONDecodeError:
                        # Try to extract JSON array from text
                        import re
                        match = re.search(r'\[.*\]', text, re.DOTALL)
                        if match:
                            try:
                                return json.loads(match.group())
                            except json.JSONDecodeError:
                                pass
    except Exception as e:
        logger.error(f"[ContentStudio] Suggestions generation failed: {e}")

    return _fallback_suggestions(business_name)


def _fallback_suggestions(business_name: str) -> list:
    """Static suggestions when AI is unavailable."""
    return [
        {
            "title": "Transformacion del dia",
            "description": f"Muestra un antes/despues de un cliente satisfecho de {business_name}",
            "content_type": "image",
            "platform": "instagram",
        },
        {
            "title": "Detras de camaras",
            "description": "Video corto mostrando el proceso de trabajo del equipo",
            "content_type": "video",
            "platform": "both",
        },
        {
            "title": "Tip de la semana",
            "description": "Comparte un consejo profesional de cuidado personal",
            "content_type": "story",
            "platform": "instagram",
        },
        {
            "title": "Testimonio de cliente",
            "description": "Publica la resena de un cliente satisfecho con foto",
            "content_type": "image",
            "platform": "facebook",
        },
        {
            "title": "Promocion especial",
            "description": "Anuncia un descuento o paquete especial para esta semana",
            "content_type": "image",
            "platform": "both",
        },
    ]
