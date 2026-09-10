#!/usr/bin/env python3
"""Regenerate committed icon sizes from the approved PNG on macOS."""
import pathlib
import shutil
import struct
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
source = root / "assets/branding/BinaryMarkdown.png"
if not shutil.which("sips") or not shutil.which("iconutil"):
    raise SystemExit("Icon regeneration uses macOS sips/iconutil. Normal builds use the committed icons.")

def resize(size, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["sips", "-z", str(size), str(size), str(source), "--out", str(target)],
                   check=True, stdout=subprocess.DEVNULL)

resize(256, root / "media/icon.png")
resize(512, root / "electron/build/icon.png")
with tempfile.TemporaryDirectory(prefix="binary-markdown-icons-") as temporary:
    iconset = pathlib.Path(temporary) / "BinaryMarkdown.iconset"
    for size in (16, 32, 128, 256, 512):
        resize(size, iconset / f"icon_{size}x{size}.png")
        resize(size * 2, iconset / f"icon_{size}x{size}@2x.png")
    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o",
                    str(root / "electron/build/icon.icns")], check=True)

# A 256px PNG-backed ICO works with contemporary Windows icon consumers.
png = (root / "media/icon.png").read_bytes()
header = struct.pack("<HHH", 0, 1, 1)
entry = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png), 22)
(root / "electron/build/icon.ico").write_bytes(header + entry + png)
print("Generated extension PNG and desktop PNG/ICNS/ICO from the approved source.")
