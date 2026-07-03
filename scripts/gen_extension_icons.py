#!/usr/bin/env python3
"""Generate PNG icons at the sizes Chrome needs from the SVG source."""
import subprocess
import sys
from pathlib import Path

ICONS_DIR = Path(__file__).resolve().parents[1] / "apps" / "extension" / "icons"
SVG = ICONS_DIR / "icon.svg"

SIZES = [16, 32, 48, 128]

def convert():
    for size in SIZES:
        out = ICONS_DIR / f"icon-{size}.png"
        try:
            import cairosvg
            cairosvg.svg2png(url=str(SVG), write_to=str(out), output_width=size, output_height=size)
            print(f"Wrote {out}")
            continue
        except ImportError:
            pass
        try:
            subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(SVG), "-o", str(out)], check=True)
            print(f"Wrote {out}")
            continue
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
        print(f"WARNING: could not convert {SVG} to {out} (no SVG converter available)", file=sys.stderr)

if __name__ == "__main__":
    convert()
