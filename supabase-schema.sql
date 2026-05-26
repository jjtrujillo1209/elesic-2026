-- ============================================================
-- ELESIC 2026 — Schema Supabase
-- Pega este SQL en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Tabla 1: Sesiones (un registro por equipo·escenario)
CREATE TABLE IF NOT EXISTS sesiones (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  equipo      TEXT        NOT NULL,       -- ALFA | BETA | GAMA | DELTA
  escenario   TEXT        NOT NULL,       -- E1 | E2 | E3 | E3A
  instructor  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla 2: Respuestas por evento
CREATE TABLE IF NOT EXISTS respuestas (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sesion_id               UUID        REFERENCES sesiones(id) ON DELETE CASCADE,
  equipo                  TEXT        NOT NULL,
  escenario               TEXT        NOT NULL,
  evento_codigo           TEXT        NOT NULL,    -- E1, E2, ... E6
  evento_titulo           TEXT,
  opciones_seleccionadas  JSONB       DEFAULT '[]'::jsonb,
  justificacion           TEXT        DEFAULT '',
  puntaje_total           INTEGER     DEFAULT 0,
  puntaje_pct             NUMERIC(6,1) DEFAULT 0,
  nivel                   TEXT,                   -- EXCELENTE | ALTO | MEDIO | BAJO
  bloom_nivel             TEXT,
  bloom_pct               NUMERIC(6,1) DEFAULT 0,
  kohlberg_etapa          TEXT,
  kohlberg_pct            NUMERIC(6,1) DEFAULT 0,
  palabras_justificacion  INTEGER     DEFAULT 0,
  guardado_en             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sesion_id, evento_codigo)
);

-- Tabla 3: Resultado final integral por sesión
CREATE TABLE IF NOT EXISTS resultados_finales (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  sesion_id       UUID         REFERENCES sesiones(id) ON DELETE CASCADE,
  equipo          TEXT         NOT NULL,
  escenario       TEXT         NOT NULL,
  desempeno_pct   NUMERIC(6,1) DEFAULT 0,
  bloom_pct       NUMERIC(6,1) DEFAULT 0,
  kohlberg_pct    NUMERIC(6,1) DEFAULT 0,
  integrado_pct   NUMERIC(6,1) DEFAULT 0,
  banda           TEXT,                            -- A | B | C | D
  bloom_ajuste    NUMERIC(6,1) DEFAULT 0,
  kohlberg_ajuste NUMERIC(6,1) DEFAULT 0,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (sesion_id)
);

-- ============================================================
-- Row Level Security — acceso público para el ejercicio
-- ============================================================
ALTER TABLE sesiones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_finales ENABLE ROW LEVEL SECURITY;

-- Política: cualquier usuario anónimo puede leer e insertar
CREATE POLICY "anon_all_sesiones"
  ON sesiones FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_all_respuestas"
  ON respuestas FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_all_resultados"
  ON resultados_finales FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Vista útil: ranking en vivo
-- ============================================================
CREATE OR REPLACE VIEW ranking_elesic AS
SELECT
  rf.equipo,
  rf.escenario,
  rf.integrado_pct,
  rf.banda,
  rf.desempeno_pct,
  rf.bloom_pct,
  rf.kohlberg_pct,
  s.instructor,
  s.created_at
FROM resultados_finales rf
JOIN sesiones s ON s.id = rf.sesion_id
ORDER BY rf.integrado_pct DESC;
