-- Programme (scheme) geographic scope: some schemes are national, some are
-- state-specific, some district-specific. The scope governs which facilities
-- may link to the programme.
ALTER TABLE programmes
  ADD COLUMN scope_level varchar(20) NOT NULL DEFAULT 'national',
  ADD COLUMN state_id uuid REFERENCES states (id),
  ADD COLUMN district_id uuid REFERENCES districts (id);

-- Indexes for the two scope lookups (national needs none).
CREATE INDEX programmes_state_id_idx ON programmes (state_id);
CREATE INDEX programmes_district_id_idx ON programmes (district_id);
