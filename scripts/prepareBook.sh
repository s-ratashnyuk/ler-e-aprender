#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/prepareBook.sh [options] --book-name "<book name>" --book-file <book-text.txt> --book-author "<book author>"

Required options:
  --book-name <name>     Title of the book (use quotes for spaces)
  --book-file <path>     Plain text file path
  --book-author <author> Author name (use quotes for spaces)

Options:
  --book-id <id>         Book id (defaults to a generated UUID)
  --description <text>   Description (defaults to book name)
  --cover-file <path>    Cover image file (defaults to cover.jpg/cover.png beside the book file)
  --tagged-file <path>   Output FreeLing tagged JSON (default: book-tagged.json beside book file)
  --verb-forms <path>    Output verb forms JSON (default: book-verb-forms.json beside book file)
  --sentence-translations <path> Sentence translations JSON (default: sentence-translations.json beside book file)
  --force-tagging        Always re-run FreeLing tagging (even if tagged file exists)
  --force-verb-forms     Always rebuild verb forms (even if verb forms file exists)
  --out <path>           Output prepared JSON (default: prepared.json beside book file)
  --help                 Show this help
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BOOK_NAME=""
BOOK_FILE=""
BOOK_AUTHOR=""
BOOK_ID=""
DESCRIPTION=""
COVER_FILE=""
TAGGED_FILE=""
VERB_FORMS_FILE=""
SENTENCE_TRANSLATIONS_FILE=""
OUT_FILE=""
FORCE_TAGGING="false"
FORCE_VERB_FORMS="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --book-name)
      BOOK_NAME="${2:-}"
      shift 2
      ;;
    --book-file)
      BOOK_FILE="${2:-}"
      shift 2
      ;;
    --book-author)
      BOOK_AUTHOR="${2:-}"
      shift 2
      ;;
    --book-id)
      BOOK_ID="${2:-}"
      shift 2
      ;;
    --description)
      DESCRIPTION="${2:-}"
      shift 2
      ;;
    --cover-file)
      COVER_FILE="${2:-}"
      shift 2
      ;;
    --tagged-file)
      TAGGED_FILE="${2:-}"
      shift 2
      ;;
    --verb-forms)
      VERB_FORMS_FILE="${2:-}"
      shift 2
      ;;
    --sentence-translations)
      SENTENCE_TRANSLATIONS_FILE="${2:-}"
      shift 2
      ;;
    --force-tagging)
      FORCE_TAGGING="true"
      shift
      ;;
    --force-verb-forms)
      FORCE_VERB_FORMS="true"
      shift
      ;;
    --out)
      OUT_FILE="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      echo "Unexpected positional argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$BOOK_NAME" || -z "$BOOK_FILE" || -z "$BOOK_AUTHOR" ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "$BOOK_FILE" ]]; then
  echo "Book file not found: $BOOK_FILE" >&2
  exit 1
fi

BOOK_DIR="$(cd "$(dirname "$BOOK_FILE")" && pwd)"

slugify() {
  local value="$1"
  if command -v iconv >/dev/null 2>&1; then
    value="$(printf "%s" "$value" | iconv -f utf-8 -t ascii//TRANSLIT)"
  fi
  value="$(printf "%s" "$value" | tr '[:upper:]' '[:lower:]')"
  value="$(printf "%s" "$value" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
  printf "%s" "$value"
}

if [[ -z "$BOOK_ID" ]]; then
  if [[ -x "${SCRIPT_DIR}/venv/bin/python" ]]; then
    BOOK_ID="$("${SCRIPT_DIR}/venv/bin/python" - <<'PY'
import uuid
print(uuid.uuid4())
PY
)"
  elif command -v python3 >/dev/null 2>&1; then
    BOOK_ID="$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
)"
  else
    BOOK_ID="$(slugify "$BOOK_NAME")"
  fi
fi

if [[ -z "$DESCRIPTION" ]]; then
  DESCRIPTION="$BOOK_NAME"
fi

if [[ -z "$TAGGED_FILE" ]]; then
  TAGGED_FILE="${BOOK_DIR}/book-tagged.json"
fi

if [[ -z "$VERB_FORMS_FILE" ]]; then
  VERB_FORMS_FILE="${BOOK_DIR}/book-verb-forms.json"
fi

if [[ -z "$OUT_FILE" ]]; then
  OUT_FILE="${BOOK_DIR}/prepared.json"
fi

if [[ -z "$COVER_FILE" ]]; then
  if [[ -f "${BOOK_DIR}/cover.jpg" ]]; then
    COVER_FILE="${BOOK_DIR}/cover.jpg"
  elif [[ -f "${BOOK_DIR}/cover.png" ]]; then
    COVER_FILE="${BOOK_DIR}/cover.png"
  fi
fi

if [[ -z "$SENTENCE_TRANSLATIONS_FILE" ]]; then
  if [[ -f "${BOOK_DIR}/sentence-translations.json" ]]; then
    SENTENCE_TRANSLATIONS_FILE="${BOOK_DIR}/sentence-translations.json"
  fi
fi

PYTHON_BIN="${SCRIPT_DIR}/venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  else
    echo "Python 3 is required (tried ${SCRIPT_DIR}/venv/bin/python and python3)." >&2
    exit 1
  fi
fi

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [[ -x "/Users/stan/.nvm/versions/node/v20.12.2/bin/node" ]]; then
  NODE_BIN="/Users/stan/.nvm/versions/node/v20.12.2/bin/node"
else
  echo "node is required to run prepareBookJson.ts. Install it or add it to PATH." >&2
  exit 1
fi

TSX_BIN=""
if command -v tsx >/dev/null 2>&1; then
  TSX_BIN="$(command -v tsx)"
elif [[ -x "/Users/stan/.nvm/versions/node/v20.12.2/bin/tsx" ]]; then
  TSX_BIN="/Users/stan/.nvm/versions/node/v20.12.2/bin/tsx"
else
  echo "tsx is required to run prepareBookJson.ts. Install it or add it to PATH." >&2
  exit 1
fi

DOCKER_AVAILABLE="false"
if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -qx "peaceful_leavitt"; then
    DOCKER_AVAILABLE="true"
  fi
fi

NEED_TAGGING="true"
if [[ -f "$TAGGED_FILE" && "$FORCE_TAGGING" != "true" ]]; then
  NEED_TAGGING="false"
fi

if [[ "$NEED_TAGGING" == "true" ]]; then
  if [[ "$DOCKER_AVAILABLE" != "true" ]]; then
    echo "Docker container not running: peaceful_leavitt" >&2
    exit 1
  fi

  echo "Tokenizing with FreeLing (docker: peaceful_leavitt)..."
  docker exec -i peaceful_leavitt sh -lc "analyze -f /usr/share/freeling/config/pt.cfg --output json" \
    < "$BOOK_FILE" > "$TAGGED_FILE"
else
  echo "Using existing tagged file: $TAGGED_FILE"
fi

NEED_VERB_FORMS="true"
if [[ -f "$VERB_FORMS_FILE" && "$FORCE_VERB_FORMS" != "true" && "$NEED_TAGGING" != "true" ]]; then
  NEED_VERB_FORMS="false"
fi

if [[ "$NEED_VERB_FORMS" == "true" ]]; then
  echo "Building verb forms..."
  "$PYTHON_BIN" "${SCRIPT_DIR}/build-verb-forms/buildVerbForms.py" \
    --tagged-file "$TAGGED_FILE" \
    --output "$VERB_FORMS_FILE"
else
  echo "Using existing verb forms: $VERB_FORMS_FILE"
fi

echo "Preparing final book JSON..."
PREPARE_ARGS=(
  "--book-id" "$BOOK_ID"
  "--name" "$BOOK_NAME"
  "--author" "$BOOK_AUTHOR"
  "--description" "$DESCRIPTION"
  "--text-file" "$BOOK_FILE"
  "--tagged-file" "$TAGGED_FILE"
  "--verb-forms" "$VERB_FORMS_FILE"
  "--out" "$OUT_FILE"
)

if [[ -n "$COVER_FILE" ]]; then
  PREPARE_ARGS+=("--cover-file" "$COVER_FILE")
fi

if [[ -n "$SENTENCE_TRANSLATIONS_FILE" ]]; then
  PREPARE_ARGS+=("--sentence-translations" "$SENTENCE_TRANSLATIONS_FILE")
fi

"$NODE_BIN" "$TSX_BIN" "${SCRIPT_DIR}/prepareBookJson.ts" "${PREPARE_ARGS[@]}"

echo "Done."
echo "Tagged JSON: $TAGGED_FILE"
echo "Verb forms:  $VERB_FORMS_FILE"
echo "Prepared:    $OUT_FILE"
