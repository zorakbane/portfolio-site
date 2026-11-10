#!/usr/bin/env python3
"""Resize + convert source images to WebP for the site.

Usage:  python3 tools/optimize_images.py [SRC_ROOT]
SRC_ROOT defaults to ../ (the portfolio workspace holding media/, extracted/).
Each entry: output key -> (source path relative to SRC_ROOT, [widths]).
Outputs static/img/<key>-<w>.webp. Never upscales.
To add a new image: add a line to IMAGES, run this script, and reference the
key in data/projects.json ("image": "<key>").
"""
import os, sys, json
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(os.path.dirname(__file__), '..', 'static', 'img')
X = 'extracted/derickjanssen/'
IMAGES = {
  # featured (Steam store art)
  'voidwood':        ('media/voidwood_reveal_thumb.jpg', [600]),
  'voidwood-header': ('media/voidwood_header.jpg', [460]),
  'rise':            ('media/rise_of_elements_library_hero.jpg', [800, 1600]),
  'rise-header':     ('media/rise_of_elements_header.jpg', [460]),
  'ark':             ('media/ark_ascended_library_hero.jpg', [800, 1600]),
  'ark-header':      ('media/ark_ascended_header.jpg', [460]),
  'starfield':       ('media/steam/starfield_library_hero.jpg', [800, 1600]),
  'starfield-header':('media/steam/starfield_header.jpg', [460]),
  'fo76':            ('media/steam/fo76_library_hero.jpg', [800, 1600]),
  'fo76-header':     ('media/steam/fo76_header.jpg', [460]),
  'skyrimvr':        ('media/steam/skyrimvr_library_hero.jpg', [800, 1600]),
  'skyrimvr-header': ('media/steam/skyrimvr_header.jpg', [460]),
  'fo4vr':           ('media/steam/fo4vr_library_hero.jpg', [800, 1600]),
  'fo4vr-header':    ('media/steam/fo4vr_header.jpg', [460]),
  # earlier games (Steam / official press)
  'strife':          ('media/steam/strife_capsule.jpg', [480, 616]),
  'strife-header':   ('media/steam/strife_header.jpg', [460]),
  'savage':          ('media/steam/savage_capsule.jpg', [480, 616]),
  'savage-header':   ('media/steam/savage_header.jpg', [460]),
  'chroma':          ('media/chroma_trailer_thumb.jpg', [480, 960]),
  'chroma-2':        ('media/chroma_smu_2.jpg', [480, 660]),
  'chroma-3':        ('media/chroma_smu_1.jpg', [480, 660]),
  'strife-logo':     (X+'game-projects/Strife Logo - Color.png', [600]),
  'chroma-tools':    (X+'individual-projects/tools/Tools-Chroma.png', [480, 915]),
  'gar':             (X+'individual-projects/artificial-intelligence/GAR_weapons.png', [480, 960]),
  'cell':            (X+'game-projects/cell_gameplay.png', [480, 960]),
  'cell-menu':       (X+'game-projects/main_Screen.png', [480, 960]),
  'cell-editor':     (X+'individual-projects/tools/Tools-Cell3.png', [480, 960]),
  'puppies':         (X+'individual-projects/tools/UI-PIS2.png', [480, 960]),
  'puppies-2':       (X+'game-projects/pis1.png', [319]),
  'puppies-tools':   (X+'individual-projects/tools/Tools-PIS.png', [480, 960]),
  # tech / AI / side
  'engine-light':    (X+'individual-projects/shaderLightOnCam.png', [480, 960]),
  'engine-lod':      (X+'individual-projects/lod.png', [480, 960]),
  'engine-bsp':      (X+'individual-projects/bsp-collada.png', [480, 960]),
  'engine-parallax': (X+'individual-projects/parallax1.png', [480, 960]),
  'engine-physics':  (X+'individual-projects/physicsOnTerrain.png', [480, 795]),
  'neat-genome':     (X+'individual-projects/genome.png', [470]),
  'neat-fitness':    (X+'individual-projects/fitnessOverTime.png', [480, 766]),
  'aibattle':        (X+'individual-projects/AIbattle-1-2012-01-16T01_00_18Z.png', [480, 960]),
  'robot-vision':    (X+'individual-projects/bananas-out1.jpg', [460]),
  'collision-editor':(X+'individual-projects/tools/collision editor.jpg', [480, 960]),
  'jas-tiles':       (X+'individual-projects/tools/JAS-tileEditor.png', [480, 960]),
  'jas':             (X+'game-projects/johnyAppleSiege.png', [480, 960]),
  'fireice':         (X+'game-projects/fireIce.png', [480, 960]),
  'sinistar':        (X+'game-projects/sinistar.png', [480, 960]),
  'projectm':        (X+'small-projects/468px-Project_M[1].jpg', [468]),
  'evolve':          (X+'gaming/evolve.png', [480, 960]),
  'derick':          (X+'home/derick.jpg', [318]),
}

def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for key, (rel, widths) in IMAGES.items():
        p = os.path.join(SRC, rel)
        im = Image.open(p).convert('RGB')
        w0, h0 = im.size
        outs = []
        for w in widths:
            w = min(w, w0)
            h = round(h0 * w / w0)
            r = im.resize((w, h), Image.LANCZOS) if w != w0 else im
            fn = f'{key}-{w}.webp'
            r.save(os.path.join(OUT, fn), 'WEBP', quality=78, method=6)
            outs.append(w)
        meta[key] = {'w': sorted(set(outs)), 'ratio': round(w0 / h0, 4)}
    with open(os.path.join(OUT, 'images.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    print(f'{len(meta)} images ->', os.path.abspath(OUT))

if __name__ == '__main__':
    main()
