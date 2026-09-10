-- SPEC-DB-00: Inicialización idempotente del esquema dedicado 'sharink'
-- Permite que múltiples proyectos convivan en una sola base de datos PostgreSQL sin colisiones.

CREATE SCHEMA IF NOT EXISTS sharink;

-- Asegurar que el usuario actual tenga permisos completos sobre el esquema
GRANT ALL ON SCHEMA sharink TO CURRENT_USER;
