CREATE TABLE IF NOT EXISTS services (
  id           serial PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  price_rub    integer NOT NULL CHECK (price_rub >= 0),
  duration_min integer NOT NULL CHECK (duration_min > 0),
  active       boolean NOT NULL DEFAULT true,
  sort         integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookings (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  phone      text NOT NULL,
  telegram   text,
  service_id integer NOT NULL REFERENCES services(id),
  color      text,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  comment    text,
  status     text NOT NULL DEFAULT 'new'
             CHECK (status IN ('new','confirmed','rejected','cancelled')),
  consent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  -- Два активных интервала не могут пересекаться: защита от двойного бронирования на уровне БД.
  CONSTRAINT bookings_no_overlap
    EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&)
    WHERE (status IN ('new','confirmed'))
);
CREATE INDEX IF NOT EXISTS bookings_starts_idx ON bookings (starts_at);

CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
