-- Inspector/official contact phone: collected at registration time so field
-- inspectors can be reached for scheduling; optional for officials.
ALTER TABLE users
  ADD COLUMN phone varchar(20);
