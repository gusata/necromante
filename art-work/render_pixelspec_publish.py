"""Run the project's PixelSpec renderer with a Windows directory-publish fallback.

The renderer validates every frame in a staging folder before publishing it. On
this workspace, Windows denies the final directory rename, so copy the already
validated stage into a new destination and remove it only after the copy succeeds.
"""

from __future__ import annotations

import os
import runpy
import shutil
import sys
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
SCRIPTS = PROJECT / ".claude" / "skills" / "codeart2d" / "scripts"
RENDERER = SCRIPTS / "render_pixelspec.py"
sys.path.insert(0, str(SCRIPTS))

import forge_core  # noqa: E402


def publish_with_windows_fallback(stage: str | os.PathLike, final: str | os.PathLike) -> None:
    stage_path, final_path = Path(stage), Path(final)
    if os.path.lexists(final_path):
        raise FileExistsError(f"refusing to replace existing output {final_path}")
    try:
        os.rename(stage_path, final_path)
    except PermissionError:
        if os.path.lexists(final_path):
            raise
        try:
            shutil.copytree(stage_path, final_path)
        except BaseException:
            shutil.rmtree(final_path, ignore_errors=True)
            raise
        shutil.rmtree(stage_path)


forge_core.publish_directory_no_replace = publish_with_windows_fallback
sys.argv = [str(RENDERER), *sys.argv[1:]]
runpy.run_path(str(RENDERER), run_name="__main__")
