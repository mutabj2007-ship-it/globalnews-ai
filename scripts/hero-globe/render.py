"""Renderer for the decorative Hero globe asset. See render-hero-globe.mjs for
the authority note and the rules this asset is built under. Build tool only —
never imported by the application."""
import json, math, os
import numpy as np
from PIL import Image, ImageFilter

N = 1600                      # output is square, NxN
R = N * 0.474                 # sphere radius, leaving room for the atmosphere
CX = CY = N / 2.0
LON0, LAT0 = math.radians(15.0), math.radians(20.0)   # Europe/Africa framing
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'frontend', 'public', 'images', 'hero-globe-night.png')

yy, xx = np.mgrid[0:N, 0:N].astype(np.float64)
dx = (xx - CX) / R
dy = (CY - yy) / R
rho2 = dx * dx + dy * dy
inside = rho2 <= 1.0
rho = np.sqrt(np.clip(rho2, 0, 1))

# inverse orthographic -> lon/lat
c = np.arcsin(np.clip(rho, 0, 1))
sinc, cosc = np.sin(c), np.cos(c)
with np.errstate(invalid='ignore', divide='ignore'):
    lat = np.arcsin(np.clip(cosc * math.sin(LAT0) + np.where(rho == 0, 0, dy * sinc * math.cos(LAT0) / np.maximum(rho, 1e-9)), -1, 1))
    lon = LON0 + np.arctan2(dx * sinc, rho * math.cos(LAT0) * cosc - dy * sinc * math.sin(LAT0))
lon = (lon + math.pi) % (2 * math.pi) - math.pi

# ── land mask, sampled from an equirectangular raster of the land polygons ──
land_img = Image.open(os.path.join(HERE, 'land-equirect.png')).convert('L')
LW, LH = land_img.size
land_arr = np.asarray(land_img).astype(np.float64) / 255.0
px = ((lon + math.pi) / (2 * math.pi) * (LW - 1)).astype(np.int32)
py = ((math.pi / 2 - lat) / math.pi * (LH - 1)).astype(np.int32)
np.clip(px, 0, LW - 1, out=px); np.clip(py, 1, LH - 2, out=py)
land = np.where(inside & (np.abs(lat) < math.radians(83.0)), land_arr[py, px], 0.0)

# ── lighting: sun up and to the left, terminator falling to lower right ──
sun = np.array([-0.42, 0.50, 0.76]); sun /= np.linalg.norm(sun)
nz = np.sqrt(np.clip(1 - rho2, 0, 1))
lam = np.clip(dx * sun[0] + dy * sun[1] + nz * sun[2], 0, 1)
day = np.clip((lam - 0.02) / 0.70, 0, 1) ** 0.72          # lit fraction
night = 1.0 - day

def fbm(shape, octaves=6, seed=7, start=24):
    rng = np.random.default_rng(seed)
    out = np.zeros(shape); amp = 1.0; tot = 0.0; s = start
    for _ in range(octaves):
        g = rng.random((s, s))
        layer = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize(shape[::-1], Image.BICUBIC)).astype(np.float64) / 255.0
        out += layer * amp; tot += amp; amp *= 0.52; s *= 2
    return out / tot

# ── base colour ─────────────────────────────────────────────────────────────
rgb = np.zeros((N, N, 3))
ocean_day  = np.array([0.075, 0.205, 0.420]);  ocean_night = np.array([0.006, 0.022, 0.058])
land_day   = np.array([0.135, 0.235, 0.300]);  land_night  = np.array([0.018, 0.038, 0.062])
tex = fbm((N, N), seed=11, start=40)
land_tint = 1.0 + (tex - 0.5) * 0.72
for i in range(3):
    ocean = ocean_day[i] * day + ocean_night[i] * night
    ground = (land_day[i] * day + land_night[i] * night) * land_tint
    rgb[:, :, i] = ocean * (1 - land) + ground * land

# ── coastal rim: where land meets water, the edge catches the light ─────────
from PIL import ImageFilter as _IF
_land_img = Image.fromarray((land * 255).astype(np.uint8))
_blur = np.asarray(_land_img.filter(_IF.GaussianBlur(2.6))).astype(np.float64) / 255.0
coast = np.clip(np.abs(land - _blur) * 3.0, 0, 1) * inside
for i, ch in enumerate((0.42, 0.70, 0.95)):
    rgb[:, :, i] += coast * ch * (0.18 + 0.60 * day)

# ── city light: soft blooms at real cities, weighted to the night side ──────
cities = json.load(open(os.path.join(HERE, 'cities.json')))
glow = np.zeros((N, N))
for _name, clat, clon, tier in cities:
    la, lo = math.radians(clat), math.radians(clon)
    cosd = math.sin(LAT0) * math.sin(la) + math.cos(LAT0) * math.cos(la) * math.cos(lo - LON0)
    if cosd <= 0.04:            # on the far side of the sphere
        continue
    gx = CX + R * (math.cos(la) * math.sin(lo - LON0))
    gy = CY - R * (math.cos(LAT0) * math.sin(la) - math.sin(LAT0) * math.cos(la) * math.cos(lo - LON0))
    rad = (3.0, 4.6, 7.0)[tier - 1] * (0.55 + 0.45 * cosd)
    amp = (0.40, 0.68, 1.00)[tier - 1] * (0.35 + 0.65 * cosd)
    # A city is a conurbation, not a point: each one scatters a handful of
    # small satellite blooms around its centre, deterministically seeded, so
    # the result is an irregular urban patch rather than a neat circle. This is
    # what stops the light reading as a marker — a marker is one shape in one
    # place, and this is a cluster with no centre a reader can point at.
    rs = np.random.default_rng(abs(hash(_name)) % (2**32))
    n_sat = (5, 10, 16)[tier - 1]
    for k in range(n_sat):
        jx = gx + rs.normal(0, rad * 2.1)
        jy = gy + rs.normal(0, rad * 2.1)
        jr = rad * (0.5 + rs.random() * 0.9)
        ja = amp * (0.35 + rs.random() * 0.65) / (1 + 0.15 * k)
        x0, x1 = int(max(0, jx - jr * 3)), int(min(N, jx + jr * 3))
        y0, y1 = int(max(0, jy - jr * 3)), int(min(N, jy + jr * 3))
        if x1 <= x0 or y1 <= y0:
            continue
        sy, sx = np.mgrid[y0:y1, x0:x1]
        d2 = (sx - jx) ** 2 + (sy - jy) ** 2
        glow[y0:y1, x0:x1] += ja * np.exp(-d2 / (2 * jr * jr))
glow = np.asarray(Image.fromarray((np.clip(glow, 0, 4) * 63).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4.5))).astype(np.float64) / 255.0 * 4
glow *= land * (0.42 + 0.85 * night) * inside
glow = np.where(land > 0.35, glow, glow * 0.25)   # no bleed past the coast          # brightest on the night side, only on land
warm = np.array([1.00, 0.80, 0.52])
for i in range(3):
    rgb[:, :, i] += glow * warm[i] * 1.85

# ── cloud veil ──────────────────────────────────────────────────────────────
cl = fbm((N, N), octaves=7, seed=29, start=56)
cloud = np.clip((cl - 0.655) * 2.6, 0, 1) ** 2.1 * (0.12 + 0.88 * day)
for i in range(3):
    rgb[:, :, i] = rgb[:, :, i] * (1 - cloud * 0.20) + np.array([0.76, 0.86, 0.96])[i] * cloud * 0.20

# ── limb darkening, then a soft atmosphere (no hard ring) ───────────────────
limb = np.clip(1.0 - (rho ** 3.2) * 0.85, 0, 1)
rgb *= limb[:, :, None]
haze = np.clip((rho - 0.66) / 0.34, 0, 1) ** 1.45 * (0.22 + 0.78 * day)
for i, ch in enumerate((0.33, 0.62, 0.95)):
    rgb[:, :, i] += haze * ch * 0.62

alpha = inside.astype(np.float64)
edge = np.clip((1.0 - rho) / 0.012, 0, 1)
alpha *= edge
# NO BAKED OUTER GLOW. A constant-colour annulus outside the disc reads as a
# ring and, blurred against the page, as streaks. The atmosphere is drawn in CSS
# in the hero instead, where it can be wider and softer than a PNG allows and
# where it can extend around the globe into the rest of the scene.

img = np.dstack([np.clip(rgb, 0, 1) * 255, np.clip(alpha, 0, 1) * 255]).astype(np.uint8)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
Image.fromarray(img, 'RGBA').save(OUT, optimize=True)
print('wrote', os.path.normpath(OUT), Image.open(OUT).size, os.path.getsize(OUT), 'bytes')
