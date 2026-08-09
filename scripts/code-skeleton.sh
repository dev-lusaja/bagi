#!/usr/bin/env bash

# Salir inmediatamente si ocurre un error
set -e

OUTPUT_DIR="docs"
OUTPUT_FILE="$OUTPUT_DIR/code_skeleton.md"

echo "Generando esqueleto del proyecto..."

echo "# Esqueleto y Firmas del Proyecto" > "$OUTPUT_FILE"

ctags -R \
  -f - \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  --exclude=codeql-db-js \
  --exclude=.agents \
  --exclude=docs \
  --exclude=roadmap \
  --exclude=scripts \
  --fields=+n+k \
  --output-format=xref \
  . | awk '{print $1 " -> " $2 " (" $3 ":" $4 ")"}' >> "$OUTPUT_FILE"

echo "✅ $OUTPUT_FILE generado con éxito."