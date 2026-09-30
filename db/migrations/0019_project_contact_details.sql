-- Contact details for a monitored facility (person in charge + contacts).
-- Structured columns instead of free-text description parsing (§9: the
-- application works in typed Netram concepts, not embedded documents).

ALTER TABLE projects ADD COLUMN contact_name varchar(200);
ALTER TABLE projects ADD COLUMN contact_phone varchar(40);
ALTER TABLE projects ADD COLUMN contact_email varchar(200);
