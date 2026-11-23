"""Compose the Super Bola Pizzaria share card from the official mascot."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path("/workspace")
MASCOT = ROOT / "public/brand/mascote.png"
FONT = ROOT / ".grok/fonts/Anton-Regular.ttf"
OUT = ROOT / ".grok/og-preview.png"
CUTOUT = ROOT / ".grok/mascot-cutout.png"

W, H = 2400, 1260  # 2× 1200×630, downscaled after


def knockout(src: Image.Image) -> Image.Image:
    arr = np.array(src.convert("RGBA"))
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    mx = np.maximum(np.maximum(r, g), b)
    # Official art sits on a near-black field outside a gold ring.
    # Keep saturated color; fade only the dark field.
    dark = (r < 70) & (g < 28) & (b < 28)
    alpha = np.where(dark, np.clip((mx - 8) / 48.0, 0, 1), 1.0)
    band = Image.fromarray((alpha * 255).astype(np.uint8), mode="L")
    band = band.filter(ImageFilter.GaussianBlur(radius=1.4))
    arr[:, :, 3] = np.array(band)
    return Image.fromarray(arr, mode="RGBA")


def background() -> Image.Image:
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = W * 0.70, H * 0.46
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    t = np.clip(dist / (W * 0.78), 0, 1) ** 0.85
    hot = np.array([215, 0, 0], dtype=np.float32)  # #D70000
    deep = np.array([92, 0, 0], dtype=np.float32)  # richer than #7A0000 at the rim
    img = hot * (1 - t)[..., None] + deep * t[..., None]

    glow = np.clip(1 - dist / (W * 0.42), 0, 1) ** 1.8
    gold = np.array([255, 214, 0], dtype=np.float32)
    img = img * (1 - 0.22 * glow[..., None]) + gold * (0.22 * glow[..., None])

    # Soft pepperoni bokeh — appetite, not a pattern.
    spots = [
        (280, 980, 220, 0.16),
        (520, 260, 160, 0.12),
        (180, 420, 90, 0.10),
        (860, 1040, 140, 0.10),
    ]
    for sx, sy, rad, amt in spots:
        d = np.sqrt((xx - sx) ** 2 + (yy - sy) ** 2)
        m = np.clip(1 - d / rad, 0, 1) ** 2
        pepper = np.array([120, 8, 8], dtype=np.float32)
        img = img * (1 - amt * m[..., None]) + pepper * (amt * m[..., None])

    img = np.clip(img, 0, 255).astype(np.uint8)
    return Image.fromarray(img, mode="RGB").convert("RGBA")


def draw_text_block(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    gold = (255, 214, 0, 255)  # #FFD600
    cream = (255, 245, 230, 255)  # #FFF5E6
    ink = (74, 0, 0, 255)

    # Left column stays clear of the mascot. Title block is vertically centered.
    font_main = ImageFont.truetype(str(FONT), 268)
    font_sub = ImageFont.truetype(str(FONT), 142)

    line1 = "SUPERBOLA"
    line2 = "PIZZARIA"
    b1 = draw.textbbox((0, 0), line1, font=font_main)
    b2 = draw.textbbox((0, 0), line2, font=font_sub)
    w1, h1 = b1[2] - b1[0], b1[3] - b1[1]
    w2, h2 = b2[2] - b2[0], b2[3] - b2[1]

    # Keep the lockup inside the left 58% so it never collides with the hero.
    x1 = 118
    max_w = 1220
    if w1 > max_w:
        raise SystemExit(f"title too wide: {w1}")

    rule_w = max(w1, w2)
    gap = 28
    rule_h = 10
    block_h = h1 + gap + rule_h + gap + h2
    y1 = (H - block_h) // 2 - b1[1]

    # Shadow then fill. Stroke keeps gold readable on red at thumbnail size.
    def stamp(text, xy, font, fill, stroke):
        x, y = xy
        draw.text((x + 6, y + 8), text, font=font, fill=(40, 0, 0, 160))
        draw.text(
            (x, y),
            text,
            font=font,
            fill=fill,
            stroke_width=stroke,
            stroke_fill=ink,
        )

    stamp(line1, (x1 - b1[0], y1), font_main, gold, 8)
    rule_y = y1 + b1[3] + gap
    # Center the rule and the second line under SUPERBOLA.
    rule_x = x1 + (w1 - rule_w) / 2
    draw.rounded_rectangle(
        [rule_x, rule_y, rule_x + w1 * 0.72, rule_y + rule_h],
        radius=5,
        fill=gold,
    )
    x2 = x1 + (w1 - w2) / 2 - b2[0]
    y2 = rule_y + rule_h + gap - b2[1]
    stamp(line2, (x2, y2), font_sub, cream, 5)


def main() -> None:
    base = background()
    hero = knockout(Image.open(MASCOT))
    hero.save(CUTOUT)

    # Full figure, gold ring included, inside the poster frame.
    target_h = 1040
    scale = target_h / hero.height
    hero = hero.resize((int(hero.width * scale), target_h), Image.Resampling.LANCZOS)

    shadow = Image.new("RGBA", hero.size, (0, 0, 0, 0))
    alpha = hero.getchannel("A")
    shadow.putalpha(alpha.point(lambda p: int(p * 0.42)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=18))

    hx = W - hero.width - 78
    hy = (H - hero.height) // 2 + 8
    base.alpha_composite(shadow, (hx + 8, hy + 22))
    base.alpha_composite(hero, (hx, hy))

    draw_text_block(base)

    # Poster frame, inside the safe margin so it isn't a crop casualty.
    frame = ImageDraw.Draw(base)
    frame.rounded_rectangle([28, 28, W - 29, H - 29], radius=36, outline=(255, 214, 0, 255), width=8)
    frame.rounded_rectangle([48, 48, W - 49, H - 49], radius=28, outline=(255, 245, 230, 180), width=3)

    final = base.convert("RGB").resize((1200, 630), Image.Resampling.LANCZOS)
    final.save(OUT, "PNG")
    print("wrote", OUT, final.size)


if __name__ == "__main__":
    main()
