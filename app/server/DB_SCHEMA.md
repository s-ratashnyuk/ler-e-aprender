# Book DB Schema

The server uses one SQLite database file per book. `DATABASE_PATH` is required to resolve database files, for example: `DATABASE_PATH=<path>/db`.

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

## Sentence Translations DB

Sentence translations are stored in a separate SQLite file per book, named
`<book-id>.sentences.sqlite` in the same database directory.

Tables:

- `sentence_meta`
  - `key` (TEXT, PK)
  - `value` (TEXT)
  - Stores metadata from `sentence-translations.json` plus `book_id`.

- `sentences`
  - `id` (INTEGER, PK)
  - `sentence_index` (INTEGER)
  - `raw_start`, `raw_end` (INTEGER) original slice offsets
  - `start`, `end` (INTEGER) trimmed slice offsets
  - `text` (TEXT)
  - `hash` (TEXT) sha1 of sentence text
  - `translation` (TEXT)

## Wiktionary Articles DB

Dictionary articles are stored in `wiktionary-articles.sqlite` under the database directory.

Tables:

- `wiktionary_articles`
  - `key` (TEXT, PK) `word-pos`
  - `word` (TEXT)
  - `pos` (TEXT)
  - `translations_json` (TEXT) JSON array of {glosses, examples}
  - `source` (TEXT) `wiktionary` or `openai`
  - `updated_at` (INTEGER epoch ms)

## Ingestion (example)

1. Prepare a book payload (includes tagging + verb forms):

```bash
scripts/prepareBook.sh "Book Title" /path/to/book.txt "Author Name"
```

2. Ingest the prepared payload (same pipeline as `/api/books`):

```bash
tsx scripts/ingestBook.ts \
  --book-json /path/to/prepared.json
```

# Auth DB Schema

The server also uses a separate SQLite database for authentication data, resolved under
`DATABASE_PATH/auth.sqlite`.

## Tables

- `users`
  - `id` (INTEGER, PK)
  - `email` (TEXT, UNIQUE)
  - `password_hash` (TEXT) PBKDF2 hash of the client-side SHA-256
  - `password_salt` (TEXT)
  - `created_at` (INTEGER epoch ms)
