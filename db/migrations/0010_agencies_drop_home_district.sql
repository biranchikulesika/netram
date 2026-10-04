-- Agencies no longer carry a "home district": the field was never consumed
-- downstream (no facility-linkage or jurisdiction enforcement) and only served
-- a creation-time permission check, so it has been removed entirely.
ALTER TABLE organisations
  DROP CONSTRAINT organisations_district_id_districts_id_fk,
  DROP COLUMN district_id;