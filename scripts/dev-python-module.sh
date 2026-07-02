#!/usr/bin/env sh
set -eu

service_dir="${1:?service directory is required}"
port="${2:?port is required}"

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
app_root="$(CDPATH= cd -- "$script_dir/.." && pwd)"
workspace_root="$(CDPATH= cd -- "$app_root/.." && pwd)"
service_path="$(CDPATH= cd -- "$app_root/$service_dir" && pwd)"
shared_venv="$workspace_root/.venv/bin/python"

cd "$service_path"

if [ -x "$shared_venv" ]; then
  python_bin="$shared_venv"
elif [ -x ".venv/bin/python" ]; then
  python_bin=".venv/bin/python"
elif [ -x "venv/bin/python" ]; then
  python_bin="venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  python_bin="python3"
elif command -v python >/dev/null 2>&1; then
  python_bin="python"
else
  echo "No Python interpreter found. Create $workspace_root/.venv or install python3." >&2
  exit 127
fi

PYTHONUNBUFFERED=1 "$python_bin" -m uvicorn api.main:app \
  --reload \
  --host 127.0.0.1 \
  --port "$port" \
  --log-level info
