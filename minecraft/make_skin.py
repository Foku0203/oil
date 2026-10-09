"""Generate a 64x64 Minecraft skin: white shirt, black tie, grey pants,
white shoes, black two-block haircut, black eyes. Also writes a preview."""

import random
from pathlib import Path

from PIL import Image

OUT = Path(__file__).parent
rng = random.Random(203)

# --- palette ---------------------------------------------------------------
SKIN = (236, 196, 160)
SKIN_SHADE = (214, 170, 136)
LIP = (190, 120, 100)
HAIR = (22, 22, 26)
HAIR_HI = (48, 48, 56)
SHAVED = (120, 104, 96)  # two-block undercut (stubble)
BROW = (30, 24, 22)
EYE_WHITE = (245, 245, 245)
EYE_BLACK = (12, 12, 14)
SHIRT = (246, 246, 246)
SHIRT_SHADE = (222, 222, 226)
TIE = (18, 18, 20)
TIE_HI = (52, 52, 58)
BELT = (30, 26, 24)
BUCKLE = (190, 190, 196)
PANTS = (118, 120, 126)
PANTS_SHADE = (96, 98, 104)
SHOE = (250, 250, 250)
SOLE = (200, 200, 204)

img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
px = img.load()


def put(x, y, c, jitter=0):
    if jitter:
        d = rng.randint(-jitter, jitter)
        c = tuple(max(0, min(255, v + d)) for v in c)
    px[x, y] = (*c, 255)


def faces(u, v, w, h, d):
    """Return {face: (x, y, width, height)} for a box UV at (u, v)."""
    return {
        "top": (u + d, v, w, d),
        "bottom": (u + d + w, v, w, d),
        "right": (u, v + d, d, h),
        "front": (u + d, v + d, w, h),
        "left": (u + d + w, v + d, d, h),
        "back": (u + 2 * d + w, v + d, w, h),
    }


def paint(rect, fn, jitter=4):
    x0, y0, w, h = rect
    for y in range(h):
        for x in range(w):
            c = fn(x, y, w, h)
            if c is not None:
                put(x0 + x, y0 + y, c, jitter)


# --- head (8x8x8) ----------------------------------------------------------
head = faces(0, 0, 8, 8, 8)
hat = faces(32, 0, 8, 8, 8)

paint(head["top"], lambda x, y, w, h: HAIR_HI if (x + y * 3) % 7 == 0 else HAIR)
paint(head["bottom"], lambda *a: SKIN_SHADE)

FACE = [
    "HHHHHHHH",
    "HHHHHSSH",
    "SHHHSSSS",
    "SBBSSBBS",
    "SWESSEWS",
    "SSSNNSSS",
    "SSSLLSSS",
    "SSSSSSSS",
]
KEY = {"H": HAIR, "S": SKIN, "B": BROW, "W": EYE_WHITE, "E": EYE_BLACK,
       "N": SKIN_SHADE, "L": LIP}
paint(head["front"], lambda x, y, w, h: KEY[FACE[y][x]])


def side(front_at_right):
    def fn(x, y, w, h):
        f = (w - 1 - x) if front_at_right else x  # distance from the face
        if y <= 2:
            return HAIR
        if f <= 1:
            return SKIN if not (f == 1 and y == 3) else SHAVED
        if f in (3, 4) and y in (4, 5):
            return SKIN_SHADE  # ear
        if y == 7 and f <= 3:
            return SKIN
        return SHAVED
    return fn


paint(head["right"], side(front_at_right=True))
paint(head["left"], side(front_at_right=False))
paint(head["back"], lambda x, y, w, h: HAIR if y <= 3 else (SKIN if y == 7 else SHAVED))

# hat layer: extra volume on top so the hair sits over the shaved sides
paint(hat["top"], lambda x, y, w, h: HAIR if (x * y) % 5 else HAIR_HI)
paint(hat["front"], lambda x, y, w, h: HAIR if y == 0 or (y == 1 and x in (1, 2, 3)) else None)
paint(hat["right"], lambda x, y, w, h: HAIR if y <= 1 else None)
paint(hat["left"], lambda x, y, w, h: HAIR if y <= 1 else None)
paint(hat["back"], lambda x, y, w, h: HAIR if y <= 2 else None)

# --- body (8x12x4) ---------------------------------------------------------
body = faces(16, 16, 8, 12, 4)


def shirt_front(x, y, w, h):
    if y == 11:
        return BUCKLE if x in (3, 4) else BELT
    if x in (3, 4) and y <= 9:
        if y == 0:
            return TIE  # knot
        if y == 9:
            return TIE if x == 3 else SHIRT_SHADE  # pointed tip
        return TIE_HI if (x == 3 and y in (2, 5)) else TIE
    if y == 0 and x in (2, 5):
        return SHIRT_SHADE  # collar points
    if x in (2, 5) and y >= 1:
        return SHIRT_SHADE if y % 3 == 0 else SHIRT
    return SHIRT


paint(body["front"], shirt_front)
paint(body["back"], lambda x, y, w, h: BELT if y == 11 else (SHIRT_SHADE if x in (0, 7) or y == 10 else SHIRT))
for f in ("left", "right"):
    paint(body[f], lambda x, y, w, h: BELT if y == 11 else SHIRT)
paint(body["top"], lambda x, y, w, h: SHIRT_SHADE if x in (3, 4) else SHIRT)
paint(body["bottom"], lambda *a: PANTS)

# --- arms (4x12x4) ---------------------------------------------------------
def sleeve(x, y, w, h):
    if y >= 10:
        return SKIN if y == 10 else SKIN_SHADE
    if y == 9:
        return SHIRT_SHADE  # cuff
    return SHIRT_SHADE if (x == 0 and y % 4 == 2) else SHIRT


for u, v in ((40, 16), (32, 48)):  # right arm, left arm
    arm = faces(u, v, 4, 12, 4)
    for f in ("front", "back", "left", "right"):
        paint(arm[f], sleeve)
    paint(arm["top"], lambda *a: SHIRT)
    paint(arm["bottom"], lambda *a: SKIN_SHADE)

# --- legs (4x12x4) ---------------------------------------------------------
def leg_front(crease_x):
    def fn(x, y, w, h):
        if y == 11:
            return SOLE
        if y == 10:
            return SHOE
        if y == 9:
            return PANTS_SHADE  # hem
        return PANTS_SHADE if x == crease_x else PANTS
    return fn


for u, v, crease in ((0, 16, 2), (16, 48, 1)):  # right leg, left leg
    leg = faces(u, v, 4, 12, 4)
    paint(leg["front"], leg_front(crease))
    for f in ("back", "left", "right"):
        paint(leg[f], leg_front(-1))
    paint(leg["top"], lambda *a: PANTS)
    paint(leg["bottom"], lambda *a: SOLE)

img.save(OUT / "skin.png")

# --- flat front/back preview ----------------------------------------------
def crop(rect):
    x, y, w, h = rect
    return img.crop((x, y, x + w, y + h))


def view(which):
    canvas = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    parts = {
        "head": (head, hat, (4, 0)),
        "body": (body, None, (4, 8)),
        "r_arm": (faces(40, 16, 4, 12, 4), None, (0, 8)),
        "l_arm": (faces(32, 48, 4, 12, 4), None, (12, 8)),
        "r_leg": (faces(0, 16, 4, 12, 4), None, (4, 20)),
        "l_leg": (faces(16, 48, 4, 12, 4), None, (8, 20)),
    }
    for name, (base, over, (ox, oy)) in parts.items():
        if which == "back":
            # mirror positions so the character's right side is on our right
            swap = {"r_arm": (12, 8), "l_arm": (0, 8), "r_leg": (8, 20), "l_leg": (4, 20)}
            ox, oy = swap.get(name, (ox, oy))
        canvas.alpha_composite(crop(base[which]), (ox, oy))
        if over:
            canvas.alpha_composite(crop(over[which]), (ox, oy))
    return canvas


scale = 12
pad = 4
preview = Image.new("RGBA", ((16 * 2 + pad * 3) * scale, (32 + pad * 2) * scale), (92, 156, 220, 255))
for i, which in enumerate(("front", "back")):
    v = view(which).resize((16 * scale, 32 * scale), Image.NEAREST)
    preview.alpha_composite(v, ((pad + i * (16 + pad)) * scale, pad * scale))
preview.save(OUT / "preview.png")
print("wrote skin.png and preview.png")
