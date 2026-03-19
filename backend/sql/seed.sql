-- Password for all demo users: password123
INSERT INTO users (username, password, role)
VALUES
  ('employee1', '$2b$10$ZnCXrWxhDaUPmtb97RDhmuWDo3BDmxlAgFPtVX.Z/Q1QmNEwteotW', 'employee'),
  ('employee2', '$2b$10$ZnCXrWxhDaUPmtb97RDhmuWDo3BDmxlAgFPtVX.Z/Q1QmNEwteotW', 'employee'),
  ('manager1', '$2b$10$ZnCXrWxhDaUPmtb97RDhmuWDo3BDmxlAgFPtVX.Z/Q1QmNEwteotW', 'manager');

-- employee1 sample submitted timesheet
INSERT INTO timesheets (id, user_id, week_start, status, submitted_at)
VALUES (1, 1, '2026-03-16', 'submitted', NOW());

INSERT INTO time_entries (timesheet_id, work_date, project_name, hours, notes)
VALUES
  (1, '2026-03-16', 'Client A', 8, 'Sprint planning and dev work'),
  (1, '2026-03-17', 'Client A', 7.5, 'Feature implementation'),
  (1, '2026-03-18', 'Internal', 2, 'Team sync and documentation');

-- employee2 sample draft timesheet
INSERT INTO timesheets (id, user_id, week_start, status)
VALUES (2, 2, '2026-03-16', 'draft');

INSERT INTO time_entries (timesheet_id, work_date, project_name, hours, notes)
VALUES
  (2, '2026-03-16', 'Client B', 6, 'Bug fixes'),
  (2, '2026-03-17', 'Client B', 8, 'New report module');

SELECT setval('timesheets_id_seq', (SELECT MAX(id) FROM timesheets));
