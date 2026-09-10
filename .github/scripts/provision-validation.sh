#!/usr/bin/env bash
# Provision disposable CI runners, never a user's normal VS Code installation.
set -euo pipefail
: "${RUNNER_TEMP:?Use a disposable Actions runner}"
: "${GITHUB_ENV:?Actions environment file required}"
validation_tools="$RUNNER_TEMP/binary-markdown-tools"
mkdir -p "$validation_tools"
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) platform=linux-x64; pandoc_asset=linux-amd64.tar.gz; pandoc_sha=c224fab89f827d3623380ecb7c1078c163c769c849a14ac27e8d3bfbb914c9b4 ;;
  Darwin-arm64) platform=darwin-arm64; pandoc_asset=arm64-macOS.zip; pandoc_sha=3eaeb3bd10982aecba5dd76158745a4f805afb39ab72a519bba2533c98ce002d ;;
  Darwin-x86_64) platform=darwin; pandoc_asset=x86_64-macOS.zip; pandoc_sha=922e35c0210d7ca20ee9327811361d6d7f0ef0adda089e0e74cb3756c3d713f9 ;;
  *) echo 'Unsupported validation runner' >&2; exit 1 ;;
esac
curl --fail --location --retry 3 "https://github.com/jgm/pandoc/releases/download/3.8.3/pandoc-3.8.3-$pandoc_asset" -o "$validation_tools/pandoc-download"
printf '%s  %s\n' "$pandoc_sha" "$validation_tools/pandoc-download" | shasum -a 256 --check
if [[ "$platform" == linux-* ]]; then
  tar -xzf "$validation_tools/pandoc-download" -C "$validation_tools"
  sudo apt-get update
  sudo apt-get install --no-install-recommends -y poppler-utils xvfb xauth libnss3 libgbm1 libasound2t64
  validation_browser="$(command -v google-chrome || command -v chromium || true)"
else
  unzip -q "$validation_tools/pandoc-download" -d "$validation_tools"
  brew list poppler >/dev/null 2>&1 || brew install poppler
  validation_browser='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
fi
validation_pandoc="$(find "$validation_tools" -type f -path '*/bin/pandoc' -print -quit)"
test -x "$validation_pandoc"
if [[ ! -x "$validation_browser" ]]; then
  npx playwright install --with-deps chromium
  validation_browser="$(node -e 'process.stdout.write(require("playwright-core").chromium.executablePath())')"
fi
test -x "$validation_browser"
printf 'EXPORT_PANDOC_PATH=%s\nEXPORT_BROWSER_PATH=%s\nPLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=%s\n' "$validation_pandoc" "$validation_browser" "$validation_browser" >> "$GITHUB_ENV"
"$validation_pandoc" --version
"$validation_browser" --version
pdftotext -v

# The minimum version is an extra Linux lane; stable exercises today's release.
validation_code_version="${VALIDATION_CODE_VERSION:-latest}"
case "$validation_code_version" in latest|1.85.0) ;; *) echo 'Unexpected VS Code validation version' >&2; exit 1 ;; esac
curl --fail --location --retry 3 "https://update.code.visualstudio.com/$validation_code_version/$platform/stable" -o "$validation_tools/vscode-download"
shasum -a 256 "$validation_tools/vscode-download"
mkdir "$validation_tools/vscode"
if [[ "$platform" == linux-* ]]; then
  tar -xzf "$validation_tools/vscode-download" -C "$validation_tools/vscode"
  validation_code="$validation_tools/vscode/VSCode-linux-x64/bin/code"
else
  unzip -q "$validation_tools/vscode-download" -d "$validation_tools/vscode"
  validation_code="$validation_tools/vscode/Visual Studio Code.app/Contents/Resources/app/bin/code"
fi
test -x "$validation_code"
"$validation_code" --version
printf 'VALIDATION_CODE=%s\n' "$validation_code" >> "$GITHUB_ENV"
python3 -m venv "$validation_tools/audit-venv"
"$validation_tools/audit-venv/bin/python" -m pip install --disable-pip-version-check 'pypdf==6.18.0' 'Pillow==12.3.0'
printf 'VALIDATION_PYTHON=%s\n' "$validation_tools/audit-venv/bin/python" >> "$GITHUB_ENV"
