#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="$HOME/.notion-audio-kokoro"
VENV_DIR="$WORKSPACE_DIR/.venv"
COREML_VENV_DIR="$WORKSPACE_DIR/.venv-coreml"
MLX_VENV_DIR="$WORKSPACE_DIR/.venv-mlx"
REQUIREMENTS_FILE="$ROOT_DIR/tools/kokoro/requirements.txt"
REQUIREMENTS_MLX_FILE="$ROOT_DIR/tools/kokoro/requirements-mlx.txt"
COREML_SRC_DIR="$WORKSPACE_DIR/coreml-src"
PYTHON_BIN="${PYTHON_BIN:-}"
LOCAL_TTS_BACKEND="${LOCAL_TTS_BACKEND:-kokoro-coreml}"

mkdir -p "$WORKSPACE_DIR/jobs" "$WORKSPACE_DIR/models" "$WORKSPACE_DIR/artifacts" "$WORKSPACE_DIR/coreml"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required for local Kokoro setup on macOS."
  echo "Install Homebrew, then install: python@3.12 espeak-ng ffmpeg"
  exit 1
fi

for dep in python@3.12 espeak-ng ffmpeg; do
  if ! brew list "$dep" >/dev/null 2>&1; then
    echo "Installing missing Homebrew dependency: $dep"
    brew install "$dep"
  fi
done

if [ -z "$PYTHON_BIN" ]; then
  if command -v python3.12 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3.12)"
  else
    PYTHON_BIN="/opt/homebrew/bin/python3.12"
  fi
fi

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Could not find a compatible Python 3.12 binary."
  echo "Set PYTHON_BIN explicitly and retry."
  exit 1
fi

PYTHON_VERSION="$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
case "$PYTHON_VERSION" in
  3.10|3.11|3.12) ;;
  *)
    echo "Kokoro requires Python 3.10-3.12, but found $PYTHON_VERSION at $PYTHON_BIN"
    exit 1
    ;;
esac

# --- MLX-Audio & Alignment Environment Setup ---

echo "Setting up MLX-Audio generation environment (.venv-mlx)..."
if [ ! -d "$MLX_VENV_DIR" ]; then
  "$PYTHON_BIN" -m venv "$MLX_VENV_DIR"
fi
source "$MLX_VENV_DIR/bin/activate"
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r "$REQUIREMENTS_MLX_FILE"
deactivate

echo "Setting up WhisperX alignment environment (.venv)..."
if [ ! -d "$VENV_DIR" ]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r "$REQUIREMENTS_FILE"

cat <<EOF
MLX-Audio and Alignment workspaces are ready!

  Generation Environment: $MLX_VENV_DIR (via mlx-audio)
  Alignment Environment:  $VENV_DIR (via WhisperX)
  Workspace Root:         $WORKSPACE_DIR

Next steps:
  1. Ensure LOCAL_TTS_BACKEND=mlx-audio is in your .env
  2. Start the app: npm run dev
  3. Generate audio from the UI (development) or:
     npm run audio:generate -- <pageId>
EOF
