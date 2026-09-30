-- 0015: Remove the Reports and Analytics domains.
--
-- The Reports section (derived per-inspection report artifacts, §34) and the
-- Analytics section (authority-level aggregate overview) are retired from the
-- product. The analytics repository read live tables directly and had no
-- dedicated persistence; only the `reports` table needs dropping.

DROP TABLE IF EXISTS "reports";
