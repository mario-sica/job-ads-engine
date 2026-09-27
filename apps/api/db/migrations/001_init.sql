-- 001_init.sql — Schema iniziale della sezione Annunci
--
-- NB: PRAGMA foreign_keys è per-connessione. Va attivato anche nel client
-- applicativo, altrimenti SQLite ignora tutte le FK.
PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────
-- Luoghi: condivisi tra job offer e annunci
-- ─────────────────────────────────────────────────────────────
CREATE TABLE locations (
  id             INTEGER PRIMARY KEY,
  street_name    TEXT,
  street_number  TEXT,
  postal_code    TEXT,
  locality       TEXT,
  province       TEXT,
  province_code  TEXT,
  region         TEXT,
  country_code   TEXT NOT NULL DEFAULT 'IT'
);

-- Deduplica: stessa tupla = stesso luogo.
-- COALESCE perché negli indici UNIQUE di SQLite i NULL sono tutti distinti.
CREATE UNIQUE INDEX locations_unique ON locations (
  country_code,
  COALESCE(region, ''),
  COALESCE(province_code, ''),
  COALESCE(locality, ''),
  COALESCE(postal_code, ''),
  COALESCE(street_name, ''),
  COALESCE(street_number, '')
);

-- ─────────────────────────────────────────────────────────────
-- Job offer: input interno, read-only per questo servizio
-- Le colonne sono una proiezione del payload, che resta integro in `raw`.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE job_offers (
  id                        TEXT PRIMARY KEY,           -- id della sorgente, es. "jo_001"
  title                     TEXT NOT NULL,
  company_name              TEXT NOT NULL,
  status                    TEXT NOT NULL,              -- valori decisi dalla sorgente
  location_id               INTEGER NOT NULL REFERENCES locations (id),
  contract_type             TEXT,
  min_exp_years             INTEGER,
  max_exp_years             INTEGER,
  ral_min                   INTEGER,
  ral_max                   INTEGER,
  currency                  TEXT,
  required_skills           TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(required_skills)),
  role_description          TEXT,
  location_and_hours        TEXT,
  company_description       TEXT,
  requirements_description  TEXT,
  compensation_package      TEXT,
  raw                       TEXT NOT NULL CHECK (json_valid(raw)),
  created_at                TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- Canali e combinazioni pubblicabili
-- `kind` guida prompt e schema del contenuto; `specs` i vincoli tecnici.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE channels (
  code  TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  kind  TEXT NOT NULL CHECK (kind IN ('job_board', 'messaging', 'social'))
);

CREATE TABLE channel_formats (
  id            INTEGER PRIMARY KEY,
  channel_code  TEXT NOT NULL REFERENCES channels (code),
  format        TEXT NOT NULL CHECK (format IN ('text', 'image', 'image_text')),
  aspect_ratio  TEXT,                                    -- 'A4', '1:1', '4:5', '9:16'
  specs         TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(specs)),
  -- un formato testuale non ha proporzioni, uno con immagine sì
  CHECK ((format = 'text') = (aspect_ratio IS NULL))
);

CREATE UNIQUE INDEX channel_formats_unique
  ON channel_formats (channel_code, format, COALESCE(aspect_ratio, ''));

-- ─────────────────────────────────────────────────────────────
-- Annuncio: dove e come esce una job offer
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ads (
  id                  INTEGER PRIMARY KEY,
  job_offer_id        TEXT    NOT NULL REFERENCES job_offers (id),
  channel_format_id   INTEGER NOT NULL REFERENCES channel_formats (id),
  location_id         INTEGER NOT NULL REFERENCES locations (id),
  location_precision  TEXT    NOT NULL CHECK (location_precision IN ('address', 'locality', 'province')),
  status              TEXT    NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX ads_job_offer      ON ads (job_offer_id);
CREATE INDEX ads_channel_format ON ads (channel_format_id);

-- ─────────────────────────────────────────────────────────────
-- Variante: composizione diversa del contenuto, per A/B test
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ad_variants (
  id                   INTEGER PRIMARY KEY,
  ad_id                INTEGER NOT NULL REFERENCES ads (id),
  label                TEXT    NOT NULL,                -- es. "A", "B"
  angle                TEXT,                            -- direzione data all'LLM
  is_active            INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  current_revision_id  INTEGER,
  created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (ad_id, label),
  -- la revisione corrente deve appartenere a QUESTA variante
  FOREIGN KEY (current_revision_id, id) REFERENCES ad_revisions (id, variant_id)
);

CREATE INDEX ad_variants_ad ON ad_variants (ad_id);

-- ─────────────────────────────────────────────────────────────
-- Revisione: il contenuto. Append-only.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ad_revisions (
  id              INTEGER PRIMARY KEY,
  variant_id      INTEGER NOT NULL REFERENCES ad_variants (id),
  content         TEXT    NOT NULL CHECK (json_valid(content)),
  schema_version  INTEGER NOT NULL,
  source          TEXT    NOT NULL CHECK (source IN ('llm', 'manual')),
  model           TEXT,
  prompt_version  TEXT,
  input_snapshot  TEXT    CHECK (input_snapshot IS NULL OR json_valid(input_snapshot)),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, variant_id),                              -- target della FK composta
  -- una revisione LLM è sempre tracciabile, una manuale non ha metadati di generazione
  CHECK (
    (source = 'llm'    AND model IS NOT NULL AND prompt_version IS NOT NULL AND input_snapshot IS NOT NULL)
    OR
    (source = 'manual' AND model IS NULL     AND prompt_version IS NULL     AND input_snapshot IS NULL)
  )
);

CREATE INDEX ad_revisions_variant ON ad_revisions (variant_id);

CREATE TRIGGER ad_revisions_no_update
BEFORE UPDATE ON ad_revisions
BEGIN
  SELECT RAISE(ABORT, 'ad_revisions is append-only');
END;

CREATE TRIGGER ad_revisions_no_delete
BEFORE DELETE ON ad_revisions
BEGIN
  SELECT RAISE(ABORT, 'ad_revisions is append-only');
END;
