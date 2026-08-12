#!/usr/bin/env bash

# Salir inmediatamente si ocurre un error
set -e

OUTPUT_DIR="docs"
OUTPUT_FILE="$OUTPUT_DIR/code_skeleton.md"

echo "Generando esqueleto del proyecto..."

# Buscar ctags compatible
CTAGS_CMD="ctags"

# En macOS el ctags de BSD (el de Xcode) no soporta -R ni las otras opciones.
# Verificamos si ctags es Universal o Exuberant Ctags.
if ! ctags --version 2>/dev/null | grep -q -E -i "universal ctags|exuberant ctags"; then
  # Si el comando 'ctags' por defecto no es compatible, intentamos buscarlo usando Homebrew
  if command -v brew >/dev/null 2>&1; then
    BREW_CTAGS="$(brew --prefix)/bin/ctags"
    if [ -x "$BREW_CTAGS" ] && "$BREW_CTAGS" --version 2>/dev/null | grep -q -E -i "universal ctags|exuberant ctags"; then
      CTAGS_CMD="$BREW_CTAGS"
    fi
  fi
fi

# Volvemos a comprobar si finalmente tenemos un ctags válido
if ! "$CTAGS_CMD" --version 2>/dev/null | grep -q -E -i "universal ctags|exuberant ctags"; then
  echo "⚠️ Error: Se requiere Universal Ctags o Exuberant Ctags para generar el esqueleto."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "En macOS, el ctags por defecto no es compatible. Por favor instálalo ejecutando:"
    echo "  brew install universal-ctags"
  else
    echo "Por favor instala universal-ctags a través de tu gestor de paquetes."
  fi
  exit 1
fi

echo "# Esqueleto y Firmas del Proyecto" > "$OUTPUT_FILE"

"$CTAGS_CMD" -R \
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