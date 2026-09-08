#!/usr/bin/env python3
"""Verify frozen export inputs using only Python's standard library.

This checks input consistency. It does not render documents or certify exports.
Never update manifest hashes automatically in response to a failed verification.
"""

import hashlib
import json
import re
import struct
import sys
import zlib
from pathlib import Path


BASE = Path(__file__).resolve().parent


def markdown_inventory(text):
    """Describe source constructs, excluding headings/math inside code fences."""
    lines = text.splitlines()
    outside = []
    blocks = []
    language = None
    body = []
    tables = []
    table_rows = []
    for line in lines:
        if line.startswith("```"):
            if language is None:
                language = line[3:].strip()
                body = []
            else:
                blocks.append({"language": language, "lines": len(body)})
                language = None
            continue
        if language is not None:
            body.append(line)
            continue
        outside.append(line)
        if line.startswith("|"):
            table_rows.append(line)
        elif table_rows:
            tables.append(max(0, len(table_rows) - 2))
            table_rows = []
    if language is not None:
        raise ValueError("Unclosed Markdown code fence")
    if table_rows:
        tables.append(max(0, len(table_rows) - 2))
    outside_text = "\n".join(outside)
    return {
        "utf8_bytes": len(text.encode("utf-8")),
        "whitespace_delimited_words": len(text.split()),
        "source_lines": len(lines),
        "headings": sum(bool(re.match(r"^#{1,6} ", line)) for line in outside),
        "fenced_blocks": blocks,
        "table_data_rows": tables,
        "display_equations": sum(line.strip() == "$$" for line in outside) // 2,
        "inline_equations": len(re.findall(r"(?<!\$)\$(?!\$)[^\n]+?(?<!\$)\$(?!\$)", outside_text)),
        "image_references": re.findall(r"!\[[^\]]*\]\(([^)]+)\)", outside_text),
    }


def verify_png(data, expected_width, expected_height):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Invalid PNG signature")
    offset = 8
    compressed = bytearray()
    dimensions = None
    seen_end = False
    while offset < len(data):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        checksum = struct.unpack(">I", data[offset + 8 + length:offset + 12 + length])[0]
        if zlib.crc32(kind + payload) & 0xFFFFFFFF != checksum:
            raise ValueError("Invalid PNG chunk CRC")
        if kind == b"IHDR":
            dimensions = struct.unpack(">IIBBBBB", payload)
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            seen_end = True
        offset += length + 12
    if dimensions != (expected_width, expected_height, 8, 2, 0, 0, 0):
        raise ValueError("PNG dimensions/encoding differ from the fixed RGB8 asset")
    if not seen_end or offset != len(data):
        raise ValueError("PNG is incomplete")
    raw = zlib.decompress(compressed)
    if len(raw) != expected_height * (1 + 3 * expected_width):
        raise ValueError("Unexpected decoded PNG data length")


def main():
    manifest = json.loads((BASE / "manifest.json").read_text(encoding="utf-8"))
    errors = []
    for entry in manifest["files"]:
        path = BASE / entry["path"]
        try:
            data = path.read_bytes()
            if len(data) != entry["bytes"]:
                raise ValueError("Byte size differs from frozen input")
            if hashlib.sha256(data).hexdigest() != entry["sha256"]:
                raise ValueError("SHA-256 differs from frozen input")
            if entry["kind"] == "markdown":
                text = data.decode("utf-8")
                if markdown_inventory(text) != entry["inventory"]:
                    raise ValueError("Source inventory differs from frozen input")
                for marker in entry["required_markers"]:
                    if marker not in text:
                        raise ValueError("Required marker missing: " + marker)
            elif entry["kind"] == "png":
                verify_png(data, entry["width"], entry["height"])
            elif entry["kind"] == "svg":
                import xml.etree.ElementTree as etree
                root = etree.fromstring(data)
                if (root.attrib.get("width"), root.attrib.get("height")) != (str(entry["width"]), str(entry["height"])):
                    raise ValueError("SVG dimensions differ from the inventory")
        except (OSError, ValueError, KeyError, struct.error, zlib.error) as error:
            errors.append(f"{entry['path']}: {error}")
    for path in manifest["intentionally_missing_assets"]:
        if (BASE / path).exists():
            errors.append(f"{path}: intentional missing-resource case now exists")
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f"Verified {len(manifest['files'])} frozen input files for {manifest['fixture_revision']}.")
    print("Input consistency only; reference rendering and export acceptance are not evaluated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
