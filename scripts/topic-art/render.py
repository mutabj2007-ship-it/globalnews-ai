"""
TOPIC CARD ARTWORK — a build tool, never imported by the application.

The Product Owner's addition to the desktop correction phase requires each
`Explore by topic` card to carry a visual area, in this preference order:

    "a real representative topic image from governed Home/topic content;
     otherwise a category-relevant editorial image treatment;
     otherwise a tasteful topic visual/illustration fallback."

The first option is not available and would not be honest if it were. The
governed feed's categories are the news taxonomy (world, politics, business,
technology, science, health, sports, entertainment); the six topics are
INTELLIGENCE MODULES. Mapping one onto the other would put a specific
article's photograph on a card that is not about that article, which asserts
a relationship the data does not carry. So this is the third option, done
properly: abstract editorial artwork per topic.

Each image is a non-representational composition in the topic's own accent —
a field gradient, a geometric motif that suggests the subject, and a soft
vignette. No place, no people, no scene, no event. Nothing here can be read
as reporting, and nothing here can go stale.

Everything is deterministic: fixed geometry, seeded noise. Re-running
reproduces the files byte for byte.

    python scripts/topic-art/render.py
"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

W, H = 720, 360
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'images', 'topics')

# Accent per topic, taken from the sampled Product Owner prototype fills.
TOPICS = {
    'world':        ((6, 52, 110),  (4, 26, 58),  (108, 230, 255)),
    'economy':      ((36, 30, 100), (10, 20, 46), (178, 150, 252)),
    'energy':       ((0, 62, 54),   (5, 28, 34),  (31, 252, 201)),
    'security':     ((72, 24, 44),  (20, 18, 34), (255, 141, 151)),
    'humanitarian': ((84, 50, 20),  (24, 24, 34), (255, 199, 98)),
    'market':       ((22, 36, 56),  (8, 20, 34),  (168, 191, 209)),
}


def field(a, b):
    im = Image.new('RGB', (W, H))
    px = im.load()
    for y in range(H):
        for x in range(W):
            t = (x / W) * 0.62 + (y / H) * 0.38
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return im


def motif(name, accent):
    """One geometric mark per topic, drawn large and soft. Not a picture."""
    layer = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(layer)
    cx, cy = int(W * 0.72), int(H * 0.52)

    if name == 'world':                       # concentric parallels
        for i in range(7):
            r = 40 + i * 30
            d.ellipse([cx - r, cy - int(r * 0.55), cx + r, cy + int(r * 0.55)], outline=90 - i * 8, width=3)
    elif name == 'economy':                   # rising columns
        for i in range(6):
            h = 38 + i * 26
            x = int(W * 0.50) + i * 42
            d.rectangle([x, cy + 70 - h, x + 24, cy + 70], fill=42 + i * 9)
    elif name == 'energy':                    # radiating lines
        for i in range(12):
            a = math.radians(i * 30)
            d.line([cx, cy, cx + int(math.cos(a) * 170), cy + int(math.sin(a) * 120)], fill=60, width=3)
        d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill=110)
    elif name == 'security':                  # shield outline
        d.polygon([(cx, cy - 105), (cx + 92, cy - 58), (cx + 74, cy + 78),
                   (cx, cy + 118), (cx - 74, cy + 78), (cx - 92, cy - 58)], outline=105, width=5)
    elif name == 'humanitarian':              # linked arcs
        for i, off in enumerate((-96, 0, 96)):
            r = 52 - abs(i - 1) * 8
            d.ellipse([cx + off - r, cy - r, cx + off + r, cy + r], outline=95, width=4)
    else:                                     # market: a trend path
        pts = [(int(W * 0.44) + i * 46, cy + 76 - int(46 * math.sin(i * 0.9)) - i * 12) for i in range(7)]
        d.line(pts, fill=100, width=5, joint='curve')

    layer = layer.filter(ImageFilter.GaussianBlur(2.2))
    tint = Image.new('RGB', (W, H), accent)
    return layer, tint


def vignette():
    v = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(v)
    d.ellipse([-W // 3, -H // 2, W + W // 3, H + H // 2], fill=255)
    return v.filter(ImageFilter.GaussianBlur(90))


def main():
    os.makedirs(OUT, exist_ok=True)
    vig = vignette()
    for name, (a, b, accent) in TOPICS.items():
        im = field(a, b)
        mask, tint = motif(name, accent)
        im = Image.composite(Image.blend(im, tint, 0.55), im, mask)
        # darken the outer edge so card text always sits on a calm surface
        dark = Image.new('RGB', (W, H), (3, 8, 16))
        im = Image.composite(im, dark, vig)
        # a low diagonal weave, the same one the story artwork uses
        weave = Image.new('L', (W, H), 0)
        wd = ImageDraw.Draw(weave)
        for x in range(-H, W, 13):
            wd.line([(x, 0), (x + H, H)], fill=16, width=1)
        im = Image.composite(Image.new('RGB', (W, H), (255, 255, 255)), im, weave.point(lambda v: v // 8))
        im.save(os.path.join(OUT, f'{name}.png'), optimize=True)
        print('wrote', name)


if __name__ == '__main__':
    main()
