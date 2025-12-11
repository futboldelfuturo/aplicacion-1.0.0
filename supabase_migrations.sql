-- Migración: Agregar youtube_canal_id a la tabla teams
-- Cambio: Los canales de YouTube ahora se asignan a equipos en lugar de usuarios

-- Agregar columna youtube_canal_id a la tabla teams
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS youtube_canal_id UUID REFERENCES youtube_canales(id) ON DELETE SET NULL;

-- Comentario para documentar el cambio
COMMENT ON COLUMN teams.youtube_canal_id IS 'Canal de YouTube asignado al equipo. Los videos subidos por usuarios de este equipo usarán este canal.';

-- Migración: Agregar campos adicionales a la tabla jugadores
-- Campos: año_nacimiento, pie_habil, club, estatura, peso

-- Agregar ano_nacimiento (año de nacimiento del jugador)
-- Nota: Usamos 'ano' sin tilde para evitar problemas con caracteres especiales en PostgreSQL
ALTER TABLE jugadores 
ADD COLUMN IF NOT EXISTS ano_nacimiento INTEGER NULL;

-- Agregar pie_habil (pie hábil del jugador: Izquierdo, Derecho, Ambos)
ALTER TABLE jugadores 
ADD COLUMN IF NOT EXISTS pie_habil VARCHAR(50) NULL;

-- Agregar club (club al que pertenece el jugador)
ALTER TABLE jugadores 
ADD COLUMN IF NOT EXISTS club VARCHAR(255) NULL;

-- Agregar estatura (estatura en centímetros)
ALTER TABLE jugadores 
ADD COLUMN IF NOT EXISTS estatura NUMERIC(5,2) NULL;

-- Agregar peso (peso en kilogramos)
ALTER TABLE jugadores 
ADD COLUMN IF NOT EXISTS peso NUMERIC(5,2) NULL;

-- Comentarios para documentar los cambios
COMMENT ON COLUMN jugadores.ano_nacimiento IS 'Año de nacimiento del jugador';
COMMENT ON COLUMN jugadores.pie_habil IS 'Pie hábil del jugador (Izquierdo, Derecho, Ambos)';
COMMENT ON COLUMN jugadores.club IS 'Club al que pertenece el jugador';
COMMENT ON COLUMN jugadores.estatura IS 'Estatura del jugador en centímetros';
COMMENT ON COLUMN jugadores.peso IS 'Peso del jugador en kilogramos';

-- Permitir que equipo_id sea NULL en la tabla jugadores
ALTER TABLE jugadores 
ALTER COLUMN equipo_id DROP NOT NULL;

-- Permitir que categoria_id sea NULL en la tabla jugadores (ya no se usa categoría)
ALTER TABLE jugadores 
ALTER COLUMN categoria_id DROP NOT NULL;

-- Permitir que categoria_id sea NULL en la tabla analisisjugadores (ya no se usa categoría para análisis de jugadores)
ALTER TABLE analisisjugadores 
ALTER COLUMN categoria_id DROP NOT NULL;

