#!/usr/bin/env bash
# Render color-adjust plugin test images using the genart CLI.
# Usage: bash test-renders/render.sh
#
# Prerequisites:
#   cd ~/genart-dev/cli && npm link   (makes `genart` available globally)
#   — or use: npx --prefix ~/genart-dev/cli genart ...

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

GENART="${GENART_CLI:-genart}"

echo "Rendering hsl-adjustments..."
"$GENART" render "$DIR/hsl-adjustments.genart" -o "$DIR/hsl-adjustments.png"

echo "Rendering levels-adjustments..."
"$GENART" render "$DIR/levels-adjustments.genart" -o "$DIR/levels-adjustments.png"

echo "Rendering curves-adjustments..."
"$GENART" render "$DIR/curves-adjustments.genart" -o "$DIR/curves-adjustments.png"

echo "Done. Output in $DIR/"
