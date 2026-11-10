"""Découpe public/images/basket.png en zones colorables pour l'icône personnalisée des chaussures.

Usage (Pillow requis) : python3 -I scripts/basket-zones.py public/images/basket.png public/images/basket-zones

Produit des masques en niveaux de gris (blanc = zone) et une encre fixe (contours, ombres, col) :
- fonds : upper (tige), laces (lacets), midsole (semelle, partie haute), outsole (semelle, partie basse) ;
- surcouche sombre : stripes (bandes latérales et arrière) ;
- ink.png : tout ce qui n'est pas recoloré (contours, crampons, col, ombres), superposé en dernier.
Recomposés avec les couleurs d'origine, les calques redonnent l'image de départ à l'anticrénelage près.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter

src = Image.open(sys.argv[1]).convert('RGBA'); W, H = src.size; px = src.load(); out = sys.argv[2]
L = lambda p: (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255
INK = (27, 30, 37); LI = L(INK)  # #1b1e25, couleur d'origine des bandes

def poly_mask(points, grow=0):
  m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(points, fill=255)
  return (m.filter(ImageFilter.MaxFilter(2 * grow + 1)) if grow else m).load()
def below(line): return poly_mask(line + [(W + 2, H + 2), (-2, H + 2)])
def components(accept):
  seen = set()
  for y0 in range(H):
    for x0 in range(W):
      if (x0, y0) in seen or not accept(x0, y0): continue
      stack, comp = [(x0, y0)], []; seen.add((x0, y0))
      while stack:
        x, y = stack.pop(); comp.append((x, y))
        for c, d in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
          if 0 <= c < W and 0 <= d < H and (c, d) not in seen and accept(c, d): seen.add((c, d)); stack.append((c, d))
      yield comp

LACES = poly_mask([(80,40),(88,34),(98,34),(102,37),(106,42),(111,46),(120,50),(130,54),(141,59),(148,62),(149,68),(143,72),(135,72),(125,67),(114,61),(104,56),(96,51),(88,47),(82,45)], grow=2)
# Couture tige/semelle, puis limite basse de la partie haute (maquette du 10 novembre 2026, calée sur les traits du dessin).
SOLE = below([(-2,72),(8,73),(14,79),(20,80),(40,81),(70,81),(80,83),(85,86),(90,88),(95,89),(100,91),(110,93),(120,95),(130,97),(150,96),(160,94),(170,92),(180,90),(185,88),(190,86),(202,84)])
LOWER = below([(-2,82),(8,83),(12,87),(16,89),(20,90),(28,90),(40,89),(52,87),(60,88),(68,89),(72,91),(76,92),(84,93),(92,94),(100,97),(108,99),(116,100),(124,101),(132,102),(148,102),(156,101),(164,99),(172,98),(180,96),(184,94),(188,92),(202,90)])
REAR_STRIPES = poly_mask([(14,45),(20,45),(26,52),(30,58),(38,72),(34,75),(14,62)])
STRIPE_CLIP = poly_mask([(61,88),(80,66),(114,66),(95,90)])
light = lambda x, y: px[x, y][3] > 0 and L(px[x, y]) > 0.55
dark = lambda x, y: px[x, y][3] > 128 and L(px[x, y]) < 0.4

# Lacets : zones claires du polygone entièrement fermées par un contour (celles reliées à l'extérieur sont la tige).
lace_light = set()
for comp in components(lambda x, y: LACES[x, y] and light(x, y)):
  if not any(light(c, d) and not LACES[c, d] for x, y in comp for c, d in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if 0 <= c < W and 0 <= d < H):
    lace_light.update(comp)
# Bandes : la composante sombre isolée sur le flanc, élargie d'un pixel pour l'anticrénelage.
stripes = set()
for comp in components(dark):
  if len(comp) > 100 and all(50 <= x <= 115 and 64 <= y <= 92 for x, y in comp):
    stripes.update((x + dx, y + dy) for x, y in comp for dx in (-1, 0, 1) for dy in (-1, 0, 1))
# Bandes arrière : traits sombres du talon, hors contour extérieur.
stripes.update((x, y) for y in range(H) for x in range(W) if REAR_STRIPES[x, y] and px[x, y][3] > 0 and L(px[x, y]) < 0.88)

layers = {k: Image.new('L', (W, H), 0) for k in ('upper', 'laces', 'midsole', 'stripes', 'outsole')}
lp = {k: v.load() for k, v in layers.items()}
ink = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ip = ink.load()
for y in range(H):
  for x in range(W):
    r, g, b, a = px[x, y]
    if a == 0: continue
    near_lace = LACES[x, y] and any((x + dx, y + dy) in lace_light for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    base = 'laces' if (x, y) in lace_light or (near_lace and not light(x, y)) else 'outsole' if LOWER[x, y] else 'midsole' if SOLE[x, y] else 'upper'
    over = 'stripes' if (x, y) in stripes and (STRIPE_CLIP[x, y] or REAR_STRIPES[x, y]) else None
    amount = max(0.0, min(1.0, (1 - L((r, g, b))) / (1 - LI)))  # part d'encre : blanc 0, #1b1e25 1
    alpha, cover = a / 255, a / 255 * amount
    # Fond réduit pour que fond + surcouche redonnent l'opacité d'origine sur les bords anticrénelés.
    lp[base][x, y] = 0 if cover >= 1 else round(255 * alpha * (1 - amount) / (1 - cover))
    if over: lp[over][x, y] = round(a * amount)
    else: ip[x, y] = (r, g, b, a) if amount >= 0.999 else (*INK, round(a * amount))
os.makedirs(out, exist_ok=True)
for k, v in layers.items(): v.save(f'{out}/{k}.png', optimize=True)
ink.save(f'{out}/ink.png', optimize=True)
