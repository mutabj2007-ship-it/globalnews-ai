"""
TOPIC CARD COVER ART — a build tool, never imported by the application.

Product Owner correction:

    "The current abstract artwork is not visually acceptable ... too dark and
     too close to the card tint, so the image area reads as empty ... use a
     strong category-level representative visual ... a user should understand
     the card visually before reading the title."

WHAT THESE ARE, AND WHAT THEY ARE NOT

    "These visuals are module cover imagery, not live article evidence.
     Therefore: do not attach source/time/headline claims to them; do not
     imply they represent a current story; keep them decorative/editorial."

So each image is an ILLUSTRATED SCENE for its subject, not a photograph and
not evidence. Nothing in them is a real place, a real event or a real moment:
they are built from primitives — gradients, silhouettes, lines, discs — by
fixed geometry with seeded noise, so every render is identical and none of
them can go stale or be mistaken for reporting. The card attaches no source,
time or headline to the image, and the module's own title sits beneath it.

WHY THE FIRST VERSION FAILED, IN ONE SENTENCE

It was drawn at roughly the same luminance as the card tint it sat on, so the
"image area" read as empty space. These are built the other way round: a bright
horizon carries real luminance range, silhouettes sit near-black against it,
and the accent supplies saturated highlights. The card's dark scrim is applied
in CSS at the BOTTOM only, where the text is, instead of across the whole frame.

    python scripts/topic-art/render.py
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

W, H = 720, 360
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'images', 'topics')

SKY = {                       # horizon colour            zenith colour
    'world':        ((58, 156, 236), (5, 24, 58)),
    'economy':      ((120, 96, 232), (10, 12, 44)),
    'energy':       ((34, 214, 170), (3, 30, 36)),
    'security':     ((226, 86, 104), (26, 10, 26)),
    'humanitarian': ((244, 168, 62),  (34, 18, 20)),
    'market':       ((96, 170, 226), (8, 20, 38)),
}
INK = (5, 10, 18)


def sky(name):
    """A bright horizon falling to a deep zenith — the luminance range that
    the rejected version did not have."""
    horizon, zenith = SKY[name]
    im = Image.new('RGB', (W, H))
    px = im.load()
    for y in range(H):
        t = (y / H) ** 0.72          # keep the bright band low and wide
        base = [int(zenith[i] + (horizon[i] - zenith[i]) * (1 - t)) for i in range(3)]
        for x in range(W):
            px[x, y] = tuple(base)
    # a warm/bright bloom just above the skyline
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse([-W // 4, int(H * 0.52), W + W // 4, int(H * 1.35)], fill=190)
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    return Image.composite(Image.new('RGB', (W, H), horizon), im, glow.point(lambda v: int(v * 0.55)))


def ink(draw, pts):
    draw.polygon(pts, fill=INK)


def scene(name, im):
    d = ImageDraw.Draw(im)
    rnd = random.Random(hash(name) & 0xFFFF)
    accent = SKY[name][0]
    base = int(H * 0.80)

    if name == 'world':
        # a curved earth limb with meridians and city lights along it
        cx, cy, r = W // 2, int(H * 1.52), int(H * 1.02)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(10, 38, 78))
        for i in range(-3, 4):                      # meridians
            off = i * (r // 4)
            d.arc([cx - r + abs(off) // 3, cy - r, cx + r - abs(off) // 3, cy + r],
                  200, 340, fill=(52, 132, 208), width=2)
        for i in range(3):                          # parallels
            yy = cy - r + int(r * (0.10 + i * 0.085))
            d.arc([cx - r, yy - 26, cx + r, yy + 26], 0, 180, fill=(52, 132, 208), width=2)
        for _ in range(90):                         # settlement lights
            a = rnd.uniform(math.pi * 1.06, math.pi * 1.94)
            rr = r - rnd.uniform(2, 46)
            x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
            s = rnd.choice((1, 1, 2, 2, 3))
            d.ellipse([x - s, y - s, x + s, y + s], fill=(255, 226, 170))

    elif name == 'economy':
        # a financial skyline: towers with lit windows
        x = -20
        while x < W + 40:
            w = rnd.randint(34, 72)
            h = rnd.randint(70, 205)
            top = base - h
            ink(d, [(x, base), (x, top), (x + w, top), (x + w, base)])
            for wy in range(top + 12, base - 8, 16):
                for wx in range(x + 8, x + w - 8, 14):
                    if rnd.random() < 0.55:
                        d.rectangle([wx, wy, wx + 5, wy + 7], fill=(255, 214, 140))
            x += w + rnd.randint(8, 20)
        d.rectangle([0, base, W, H], fill=INK)

    elif name == 'energy':
        # transmission pylons and wind turbines
        for tx in (150, 330, 510):                  # turbines
            th = rnd.randint(120, 165)
            d.line([(tx, base), (tx, base - th)], fill=INK, width=7)
            hub = (tx, base - th)
            for k in range(3):
                a = math.radians(k * 120 + 18)
                d.line([hub, (hub[0] + math.cos(a) * 66, hub[1] + math.sin(a) * 66)], fill=INK, width=6)
            d.ellipse([hub[0] - 7, hub[1] - 7, hub[0] + 7, hub[1] + 7], fill=INK)
        for px_ in (620, 700):                      # pylons
            ph = 150
            d.line([(px_ - 26, base), (px_, base - ph)], fill=INK, width=5)
            d.line([(px_ + 26, base), (px_, base - ph)], fill=INK, width=5)
            for yy in (base - ph + 28, base - ph + 66):
                d.line([(px_ - 34, yy), (px_ + 34, yy)], fill=INK, width=5)
        d.rectangle([0, base, W, H], fill=INK)

    elif name == 'security':
        # a shield over a scanned horizon
        cx, cy = int(W * 0.50), int(H * 0.46)
        for rr in (150, 112, 74):                   # scan rings
            d.ellipse([cx - rr, cy - int(rr * 0.62), cx + rr, cy + int(rr * 0.62)],
                      outline=(236, 120, 134), width=2)
        sh = [(cx, cy - 104), (cx + 78, cy - 62), (cx + 62, cy + 58),
              (cx, cy + 102), (cx - 62, cy + 58), (cx - 78, cy - 62)]
        d.polygon(sh, fill=INK)
        d.line(sh + [sh[0]], fill=(255, 168, 178), width=5, joint='curve')
        d.line([(cx - 26, cy + 4), (cx - 6, cy + 30), (cx + 30, cy - 26)],
               fill=(255, 210, 214), width=7, joint='curve')
        d.rectangle([0, base + 14, W, H], fill=INK)

    elif name == 'humanitarian':
        # relief shelters and figures
        x = 40
        while x < W - 40:
            w = rnd.randint(78, 116)
            h = rnd.randint(52, 76)
            ink(d, [(x, base), (x + w // 2, base - h), (x + w, base)])
            d.line([(x, base), (x + w // 2, base - h)], fill=(255, 206, 140), width=4)
            x += w + rnd.randint(14, 30)
        for fx in (128, 168, 300, 340, 372, 520, 560):   # figures
            fy = base + 6
            d.ellipse([fx - 8, fy - 46, fx + 8, fy - 30], fill=INK)
            ink(d, [(fx - 13, fy), (fx - 10, fy - 28), (fx + 10, fy - 28), (fx + 13, fy)])
        d.rectangle([0, base + 6, W, H], fill=INK)

    elif name == 'market':
        # a candlestick series over port cranes
        for cxp in (560, 650):
            d.line([(cxp, base), (cxp, base - 150)], fill=INK, width=8)
            d.line([(cxp, base - 150), (cxp + 96, base - 150)], fill=INK, width=8)
            d.line([(cxp, base - 150), (cxp - 44, base - 112)], fill=INK, width=7)
            d.line([(cxp + 62, base - 150), (cxp + 62, base - 104)], fill=INK, width=5)
        vals = [0.50, 0.42, 0.58, 0.52, 0.66, 0.60, 0.74, 0.70, 0.84]
        for i, v in enumerate(vals):
            x = 44 + i * 54
            top = base - int(v * 210)
            bot = base - int((v - rnd.uniform(0.07, 0.15)) * 210)
            col = accent if i % 3 else (255, 224, 170)
            d.line([(x, top - 20), (x, bot + 18)], fill=col, width=3)
            d.rectangle([x - 15, top, x + 15, bot], fill=col)
        d.rectangle([0, base, W, H], fill=INK)

    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    for name in SKY:
        im = scene(name, sky(name))
        # a fine editorial weave, kept light so it never dulls the scene
        weave = Image.new('L', (W, H), 0)
        wd = ImageDraw.Draw(weave)
        for x in range(-H, W, 15):
            wd.line([(x, 0), (x + H, H)], fill=10, width=1)
        im = Image.composite(Image.new('RGB', (W, H), (255, 255, 255)), im, weave)
        im.save(os.path.join(OUT, f'{name}.png'), optimize=True)
        print('wrote', name)


if __name__ == '__main__':
    main()
