# Book DB Schema

The server uses one SQLite database file per book. Default location: `server/data/<bookId>.sqlite`.

## Tables

- `meta`
  - `key` (TEXT, PK)
  - `value` (TEXT)
  - Stores `book_id`, `text_hash`, `ingested_at`.

- `tokens`
  - `id` (INTEGER, PK)
  - `sentence_id` (TEXT)
  - `token_id` (TEXT) Freeling token id
  - `begin`, `end` (INTEGER) character span in normalized book text
  - `form` (TEXT) Freeling surface form (may include `_` for MWEs)
  - `surface` (TEXT) exact substring from the book text span
  - `lemma`, `pos`, `tag`, `ctag`, `mood`, `tense`, `person`, `gen`, `num`

- `verb_forms`
  - `lemma` (TEXT)
  - `tense_label` (TEXT)
  - `forms` (TEXT)
  - `is_irregular` (INTEGER 0/1)
  - Primary key `(lemma, tense_label)`

- `translations`
  - `id` (INTEGER, PK)
  - `token_id` (INTEGER) -> `tokens.id`
  - `context_hash` (TEXT) sha256 of sentence snippet
  - `context_sentence` (TEXT)
  - `target_language` (TEXT)
  - `word_translation` (TEXT)
  - `usage_examples_json` (TEXT) JSON array of {Portuguese, Translation}
  - `updated_at` (INTEGER epoch ms)
  - Unique `(token_id, context_hash, target_language)`

## Ingestion (example)

1. Build verb forms (requires `verbecc`):

```bash
python3 server/scripts/buildVerbForms.py \
  --tagged-file storyText-tagged.json \
  --output /tmp/verb_forms.json
```

2. Ingest tokens + verb forms:

```bash
tsx server/scripts/ingestBook.ts \
  --book-id book-1 \
  --tagged-file storyText-tagged.json \
  --text-file client/src/content/storyText.ts \
  --db-path server/data/book-1.sqlite \
  --verb-forms /tmp/verb_forms.json
```

# Auth DB Schema

The server also uses a separate SQLite database for authentication data. Default location:
`server/data/auth.sqlite`.

## Tables

- `users`
  - `id` (INTEGER, PK)
  - `email` (TEXT, UNIQUE)
  - `password_hash` (TEXT) PBKDF2 hash of the client-side SHA-256
  - `password_salt` (TEXT)
  - `created_at` (INTEGER epoch ms)
