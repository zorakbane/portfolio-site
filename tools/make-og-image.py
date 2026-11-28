#!/usr/bin/env python3
"""Compose static/img/og-1200x630.jpg from the existing headshot."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SHOT = Image.open(ROOT / "static/img/derick-1140.webp").convert("RGBA")
FONT = Path("/usr/share/fonts/truetype/sand-box/google/Inter/Inter-VariableFont_opsz,wght.ttf")
OUT = ROOT / "static/img/og-1200x630.jpg"
W, H = 1200, 630


def font(size, weight):
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_axes([min(max(size, 14), 32), weight])
    return f


def text_size(draw, fnt, text):
    b = draw.textbbox((0, 0), text, font=fnt)
    return b[2] - b[0], b[3] - b[1]


def main():
    img = Image.new("RGBA", (W, H), (7, 7, 13, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = 280, 315
    for r, a in ((420, 28), (300, 40), (200, 28)):
        gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(57, 255, 136, a))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(80)))
    wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(wash).ellipse((700, -80, 1400, 500), fill=(61, 224, 255, 22))
    img = Image.alpha_composite(img, wash.filter(ImageFilter.GaussianBlur(70)))
    draw = ImageDraw.Draw(img)

    size = 420
    portrait = SHOT.resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    ring_pad = 8
    ring = Image.new("RGBA", (size + ring_pad * 2, size + ring_pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse(
        (0, 0, size + ring_pad * 2 - 1, size + ring_pad * 2 - 1),
        outline=(57, 255, 136, 255),
        width=6,
    )
    px, py = 70, (H - size) // 2
    img.paste(ring, (px - ring_pad, py - ring_pad), ring)
    img.paste(portrait, (px, py), mask)
    draw = ImageDraw.Draw(img)

    tx = 560
    kicker_font = font(16, 700)
    name_font = font(64, 800)
    role_font = font(28, 500)
    studio_font = font(24, 500)
    kicker = "PRINCIPAL ENGINEER"
    lines = [
        ("DERICK JANSSEN", name_font, (236, 236, 246, 255)),
        ("Principal Engineer · Game Programmer", role_font, (160, 160, 184, 255)),
        ("Santa Barbara Games", studio_font, (57, 255, 136, 255)),
    ]
    heights = [text_size(draw, f, t)[1] for t, f, _ in lines]
    kicker_h = text_size(draw, kicker_font, kicker)[1]
    block_h = kicker_h + 14 + sum(heights) + 18 + 16
    ty = (H - block_h) // 2
    draw.text((tx, ty), kicker, font=kicker_font, fill=(57, 255, 136, 255))
    ty += kicker_h + 14
    draw.rectangle((tx, ty - 10, tx + 48, ty - 7), fill=(57, 255, 136, 255))
    for i, (text, fnt, color) in enumerate(lines):
        draw.text((tx, ty), text, font=fnt, fill=color)
        ty += heights[i] + (18 if i == 0 else 16 if i == 1 else 0)

    draw.rectangle((0, 0, W, 3), fill=(57, 255, 136, 180))
    draw.rectangle((0, H - 3, W, H), fill=(57, 255, 136, 180))
    img.convert("RGB").save(OUT, "JPEG", quality=90, optimize=True, subsampling=0)
    print(f"wrote {OUT} 1200x630")


if __name__ == "__main__":
    main()
