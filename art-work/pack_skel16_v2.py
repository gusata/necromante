"""Package the checked PixelSpec frames as the game's Aseprite-style atlas."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / "art-work" / "skel16-v2-final" / "base" / "frames"
SPRITES = ROOT / "public" / "assets" / "sprites"
PNG = SPRITES / "esqueleto-v2.png"
JSON = SPRITES / "esqueleto-v2.json"
FRAME_LAYOUT = (("walk0", 0, 0), ("walk1", 16, 0), ("attack", 0, 22))


def main() -> None:
    if PNG.exists() or JSON.exists():
        raise FileExistsError("refusing to replace an existing esqueleto-v2 asset")

    atlas = Image.new("RGBA", (32, 44), (0, 0, 0, 0))
    for name, x, y in FRAME_LAYOUT:
        path = FRAMES / f"{name}.png"
        with Image.open(path) as frame:
            if frame.size != (16, 22):
                raise ValueError(f"{path} must be 16x22, got {frame.size}")
            atlas.alpha_composite(frame.convert("RGBA"), (x, y))

    with (SPRITES / "esqueleto.json").open(encoding="utf-8") as source:
        metadata = json.load(source)
    metadata["meta"]["app"] = "art-work/pack_skel16_v2.py"
    metadata["meta"]["version"] = "1.0.0"
    metadata["meta"]["image"] = PNG.name

    atlas.save(PNG)
    with JSON.open("w", encoding="utf-8", newline="\n") as output:
        json.dump(metadata, output, indent=2, ensure_ascii=False)
        output.write("\n")


if __name__ == "__main__":
    main()
