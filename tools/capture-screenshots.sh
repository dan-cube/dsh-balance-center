#!/bin/sh
# Capture the two README screenshots from the running DSH window (macOS).
# Requires Screen Recording permission for your terminal app on first use.
set -eu
cd "$(dirname "$0")/.."
mkdir -p docs/screenshots

echo "[1/2] Switch the DSH window to the sidebar state (balance rows above the account block)."
printf 'Press Enter, then click the DSH window: '
read -r _
screencapture -x -o -w docs/screenshots/sidebar.png

echo "[2/2] Open Settings → 余额与额度 in DSH."
printf 'Press Enter, then click the DSH window: '
read -r _
screencapture -x -o -w docs/screenshots/settings.png

echo "Done:"
ls -l docs/screenshots/*.png
