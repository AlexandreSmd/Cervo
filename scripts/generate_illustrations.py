"""Génère les illustrations SVG originales des questions (web/public/questions/).

Toutes les images sont créées ici : aucune question de droits. Relancer ce script
reproduit exactement les mêmes fichiers (graines fixes).
Usage : uv run --project api python scripts/generate_illustrations.py
"""

from __future__ import annotations

import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "web" / "public" / "questions"
W, H = 600, 400
BG = "#F2F4FB"
INK = "#14183A"
ACCENT = "#5B4BFF"
GREEN = "#1FA971"
ORANGE = "#F2A33A"
RED = "#E5484D"


def svg(body: str, w: int = W, h: int = H, bg: str = BG) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
        f'<rect width="{w}" height="{h}" rx="24" fill="{bg}"/>{body}</svg>\n'
    )


def write(name: str, content: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(content, encoding="utf-8")


def dots(name: str, n: int, seed: int, color: str = ACCENT, r: float = 6) -> None:
    rng = random.Random(seed)
    pts: list[tuple[float, float]] = []
    tries = 0
    min_d = 2 * r + 2
    while len(pts) < n and tries < 200000:
        tries += 1
        x, y = rng.uniform(30, W - 30), rng.uniform(30, H - 30)
        if all((x - a) ** 2 + (y - b) ** 2 >= min_d ** 2 for a, b in pts):
            pts.append((x, y))
    assert len(pts) == n, (name, len(pts))
    body = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{color}"/>' for x, y in pts)
    write(name, svg(body))


def angle(name: str, degrees: float, rotation: float) -> None:
    cx, cy, L = 300, 230, 200
    a1 = math.radians(rotation)
    a2 = math.radians(rotation + degrees)
    x1, y1 = cx + L * math.cos(a1), cy - L * math.sin(a1)
    x2, y2 = cx + L * math.cos(a2), cy - L * math.sin(a2)
    rr = 50
    ax1, ay1 = cx + rr * math.cos(a1), cy - rr * math.sin(a1)
    ax2, ay2 = cx + rr * math.cos(a2), cy - rr * math.sin(a2)
    large = 1 if degrees > 180 else 0
    body = (
        f'<path d="M{ax1:.1f},{ay1:.1f} A{rr},{rr} 0 {large} 0 {ax2:.1f},{ay2:.1f}" fill="none" stroke="{ORANGE}" stroke-width="5"/>'
        f'<line x1="{cx}" y1="{cy}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>'
        f'<line x1="{cx}" y1="{cy}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>'
        f'<circle cx="{cx}" cy="{cy}" r="9" fill="{ACCENT}"/>'
    )
    write(name, svg(body))


def pie(name: str, percent: float, start: float) -> None:
    cx, cy, r = 300, 200, 160
    a0 = math.radians(start)
    a1 = math.radians(start + 360 * percent / 100)
    x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
    x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
    large = 1 if percent > 50 else 0
    body = (
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#DDE1F2" stroke="{INK}" stroke-width="3"/>'
        f'<path d="M{cx},{cy} L{x0:.1f},{y0:.1f} A{r},{r} 0 {large} 1 {x1:.1f},{y1:.1f} Z" fill="{ACCENT}" stroke="{INK}" stroke-width="3"/>'
    )
    write(name, svg(body))


def lines(name: str, a: float, b: float) -> None:
    body = (
        f'<text x="40" y="140" font-family="sans-serif" font-size="36" font-weight="700" fill="{INK}">A</text>'
        f'<line x1="90" y1="128" x2="{90 + a:.1f}" y2="128" stroke="{ACCENT}" stroke-width="14" stroke-linecap="butt"/>'
        f'<text x="40" y="280" font-family="sans-serif" font-size="36" font-weight="700" fill="{INK}">B</text>'
        f'<line x1="90" y1="268" x2="{90 + b:.1f}" y2="268" stroke="{ORANGE}" stroke-width="14" stroke-linecap="butt"/>'
    )
    write(name, svg(body))


def flag(name: str, stripes: list[str], vertical: bool = True, extra: str = "") -> None:
    w, h = 450, 300
    n = len(stripes)
    parts = []
    for i, col in enumerate(stripes):
        if vertical:
            parts.append(f'<rect x="{i * w / n:.2f}" y="0" width="{w / n + 0.5:.2f}" height="{h}" fill="{col}"/>')
        else:
            parts.append(f'<rect x="0" y="{i * h / n:.2f}" width="{w}" height="{h / n + 0.5:.2f}" fill="{col}"/>')
    inner = "".join(parts) + extra
    body = f'<g transform="translate(75,50)"><rect width="{w}" height="{h}" fill="#fff"/>{inner}<rect width="{w}" height="{h}" fill="none" stroke="{INK}" stroke-opacity=".25" stroke-width="2"/></g>'
    write(name, svg(body))


def polygon_points(cx, cy, r, sides, rot=-90):
    return " ".join(
        f"{cx + r * math.cos(math.radians(rot + 360 * i / sides)):.1f},{cy + r * math.sin(math.radians(rot + 360 * i / sides)):.1f}"
        for i in range(sides)
    )


def shapes_sequence(name: str) -> None:
    body = ""
    for i, sides in enumerate([3, 4, 5, 6]):
        cx = 90 + i * 140
        body += f'<polygon points="{polygon_points(cx, 200, 55, sides)}" fill="{ACCENT}" fill-opacity=".85" stroke="{INK}" stroke-width="4"/>'
    body += f'<text x="540" y="222" font-family="sans-serif" font-size="64" font-weight="700" fill="{INK}" text-anchor="middle">?</text>'
    write(name, svg(body))


def grid_squares(name: str, n: int) -> None:
    size = 300
    x0, y0 = 150, 50
    step = size / n
    body = ""
    for i in range(n + 1):
        body += f'<line x1="{x0}" y1="{y0 + i * step:.1f}" x2="{x0 + size}" y2="{y0 + i * step:.1f}" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
        body += f'<line x1="{x0 + i * step:.1f}" y1="{y0}" x2="{x0 + i * step:.1f}" y2="{y0 + size}" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
    write(name, svg(body))


def triangle_split(name: str) -> None:
    # Grand triangle avec deux droites partant du sommet : 6 triangles au total.
    ax, ay, bx, by, cx, cy = 300, 40, 80, 360, 520, 360
    body = f'<polygon points="{ax},{ay} {bx},{by} {cx},{cy}" fill="none" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
    for t in (1 / 3, 2 / 3):
        px = bx + (cx - bx) * t
        body += f'<line x1="{ax}" y1="{ay}" x2="{px:.1f}" y2="{cy}" stroke="{INK}" stroke-width="6" stroke-linecap="round"/>'
    write(name, svg(body))


def cube_stack(name: str) -> None:
    # Escalier de cubes vu de face : 3 + 2 + 1 = 6 cubes visibles, base pleine.
    s = 70
    body = ""
    heights = [3, 2, 1]
    x0, base = 195, 330
    for col, hgt in enumerate(heights):
        for row in range(hgt):
            x, y = x0 + col * s, base - (row + 1) * s
            body += f'<rect x="{x}" y="{y}" width="{s}" height="{s}" fill="{ACCENT}" fill-opacity=".8" stroke="{INK}" stroke-width="4"/>'
    write(name, svg(body))


def tower(name: str, shape: str) -> None:
    """Silhouettes stylisées de monuments (illustrations, pas à l'échelle exacte)."""
    ground = f'<rect x="0" y="360" width="{W}" height="40" fill="#C9CEE6"/>'
    figure = ""
    if shape == "eiffel":
        figure = (
            f'<path d="M300,30 L310,110 L330,190 L380,360 L345,360 L300,260 L255,360 L220,360 L270,190 L290,110 Z" fill="{INK}"/>'
            f'<rect x="262" y="185" width="76" height="10" fill="{INK}"/><rect x="282" y="105" width="36" height="8" fill="{INK}"/>'
        )
    elif shape == "skytree":
        figure = (
            f'<path d="M300,20 L304,90 L314,130 L318,250 L338,360 L262,360 L282,250 L286,130 L296,90 Z" fill="{INK}"/>'
            f'<rect x="284" y="150" width="32" height="16" rx="4" fill="{INK}"/><rect x="288" y="205" width="24" height="12" rx="4" fill="{INK}"/>'
        )
    elif shape == "burj":
        figure = (
            f'<path d="M300,15 L303,80 L310,120 L314,170 L322,220 L330,270 L342,320 L352,360 L248,360 L258,320 L270,270 L278,220 L286,170 L290,120 L297,80 Z" fill="{INK}"/>'
        )
    elif shape == "pyramid":
        figure = f'<polygon points="300,120 520,360 80,360" fill="{ORANGE}" stroke="{INK}" stroke-width="4"/>'
    elif shape == "liberty":
        figure = (
            f'<rect x="250" y="250" width="100" height="110" fill="#8C93B8"/>'
            f'<path d="M285,250 L290,160 L282,150 L290,120 L310,120 L318,150 L310,160 L315,250 Z" fill="{GREEN}"/>'
            f'<rect x="312" y="60" width="8" height="70" fill="{GREEN}"/><path d="M308,62 L324,62 L316,40 Z" fill="{ORANGE}"/>'
            f'<circle cx="300" cy="112" r="12" fill="{GREEN}"/>'
        )
    elif shape == "bigben":
        figure = (
            f'<rect x="270" y="110" width="60" height="250" fill="{INK}"/><polygon points="270,110 300,40 330,110" fill="{INK}"/>'
            f'<circle cx="300" cy="140" r="18" fill="{BG}"/><line x1="300" y1="140" x2="300" y2="128" stroke="{INK}" stroke-width="3"/>'
            f'<line x1="300" y1="140" x2="309" y2="140" stroke="{INK}" stroke-width="3"/>'
        )
    person = f'<g fill="{ACCENT}"><circle cx="470" cy="343" r="4"/><rect x="467" y="347" width="6" height="13"/></g>'
    write(name, svg(ground + figure + person))


def main() -> None:
    for i, (n, color, r) in enumerate([
        (37, ACCENT, 9), (64, GREEN, 8), (95, ORANGE, 7), (150, ACCENT, 6), (230, RED, 5),
        (320, GREEN, 5), (480, ACCENT, 4), (720, ORANGE, 3.5), (52, RED, 9), (180, GREEN, 6),
    ]):
        dots(f"points-{n}.svg", n, seed=1000 + i, color=color, r=r)
    for deg, rot in [(35, 10), (72, 30), (110, 5), (145, 20), (20, 60), (160, 10), (90, 25), (55, 100)]:
        angle(f"angle-{deg}.svg", deg, rot)
    for pct, start in [(18, -90), (35, -60), (62, -90), (82, -30), (8, 0), (45, 20)]:
        pie(f"disque-{pct}.svg", pct, start)
    for a, b, label in [(60, 240, "x4"), (90, 225, "x2-5"), (40, 400, "x10"), (120, 180, "x1-5"), (50, 350, "x7")]:
        lines(f"lignes-{label}.svg", a, b)
    flag("drapeau-italie.svg", ["#009246", "#FFFFFF", "#CE2B37"])
    flag("drapeau-irlande.svg", ["#169B62", "#FFFFFF", "#FF883E"])
    flag("drapeau-belgique.svg", ["#000000", "#FDDA24", "#EF3340"])
    flag("drapeau-allemagne.svg", ["#000000", "#DD0000", "#FFCE00"], vertical=False)
    flag("drapeau-pays-bas.svg", ["#AE1C28", "#FFFFFF", "#21468B"], vertical=False)
    flag("drapeau-autriche.svg", ["#C8102E", "#FFFFFF", "#C8102E"], vertical=False)
    flag("drapeau-japon.svg", ["#FFFFFF"], extra='<circle cx="225" cy="150" r="90" fill="#BC002D"/>')
    flag("drapeau-suede.svg", ["#006AA7"], extra='<rect x="125" y="0" width="50" height="300" fill="#FECC00"/><rect x="0" y="125" width="450" height="50" fill="#FECC00"/>')
    flag("drapeau-pologne.svg", ["#FFFFFF", "#DC143C"], vertical=False)
    flag("drapeau-ukraine.svg", ["#0057B7", "#FFD700"], vertical=False)
    flag("drapeau-roumanie.svg", ["#002B7F", "#FCD116", "#CE1126"])
    flag("drapeau-hongrie.svg", ["#CE2939", "#FFFFFF", "#477050"], vertical=False)
    shapes_sequence("suite-polygones.svg")
    grid_squares("grille-3x3.svg", 3)
    grid_squares("grille-2x2.svg", 2)
    triangle_split("triangles.svg")
    cube_stack("cubes-escalier.svg")
    for shape in ["eiffel", "skytree", "burj", "pyramid", "liberty", "bigben"]:
        tower(f"monument-{shape}.svg", shape)
    print(f"Illustrations générées dans {OUT}")


if __name__ == "__main__":
    main()
