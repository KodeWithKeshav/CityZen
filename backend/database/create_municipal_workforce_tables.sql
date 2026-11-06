-- Finishes the 3-stage complaint_workflow system (Initial Review ->
-- Assessment -> Resolution) that routes/adminMinimal.js already implements
-- against the `complaint_workflow` table, but whose /officers and
-- /contractors endpoints currently return two hardcoded mock records
-- instead of querying real data. This migration adds the real
-- departments/officers/contractors tables, a default category->department
-- routing table (standard Indian ULB department structure), and the
-- SLA/escalation columns the admin "Complaint Workflow" panel needs.
--
-- Run this manually in the Supabase SQL editor for your project - same
-- ad-hoc pattern as the other files in this database/ folder (complaints
-- and complaint_workflow were created directly in the Supabase dashboard,
-- not via tracked migrations).
--
-- Backing feature: routes/adminMinimal.js (officers/contractors/
-- departments CRUD, stage updates, escalation) + the admin
-- ComplaintWorkflowPanel + DepartmentsAndStaff page.

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  designation TEXT,       -- e.g. "Junior Engineer", "Sanitary Inspector", "Assistant Executive Engineer"
  phone TEXT,
  email TEXT,
  ward TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialization TEXT,    -- e.g. "Road Repair", "Streetlight Maintenance", "Tree Removal"
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default category -> department routing, so a new complaint's workflow can
-- auto-suggest the right department instead of starting unassigned.
CREATE TABLE IF NOT EXISTS category_department_map (
  category TEXT PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE
);

ALTER TABLE complaint_workflow
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_level INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reopened_count INT NOT NULL DEFAULT 0;

-- Seed standard Indian Urban Local Body (ULB) departments and the default
-- routing for this app's 7 civic issue categories. ON CONFLICT so this is
-- safe to re-run.
INSERT INTO departments (name) VALUES
  ('Public Works Department'),
  ('Sanitation Department'),
  ('Water Supply Department'),
  ('Electricity & Street Lighting Department'),
  ('Health Department'),
  ('Horticulture & Parks Department'),
  ('Traffic & Roads Department')
ON CONFLICT (name) DO NOTHING;

INSERT INTO category_department_map (category, department_id)
SELECT 'pothole', id FROM departments WHERE name = 'Public Works Department'
ON CONFLICT (category) DO NOTHING;
INSERT INTO category_department_map (category, department_id)
SELECT 'road_waterlogging', id FROM departments WHERE name = 'Water Supply Department'
ON CONFLICT (category) DO NOTHING;
INSERT INTO category_department_map (category, department_id)
SELECT 'garbage_dumping', id FROM departments WHERE name = 'Sanitation Department'
ON CONFLICT (category) DO NOTHING;
INSERT INTO category_department_map (category, department_id)
SELECT 'fallen_electric_pole', id FROM departments WHERE name = 'Electricity & Street Lighting Department'
ON CONFLICT (category) DO NOTHING;
INSERT INTO category_department_map (category, department_id)
SELECT 'fallen_tree', id FROM departments WHERE name = 'Horticulture & Parks Department'
ON CONFLICT (category) DO NOTHING;
INSERT INTO category_department_map (category, department_id)
SELECT 'concrete_structure_damage', id FROM departments WHERE name = 'Public Works Department'
ON CONFLICT (category) DO NOTHING;
INSERT INTO category_department_map (category, department_id)
SELECT 'stray_cattle', id FROM departments WHERE name = 'Health Department'
ON CONFLICT (category) DO NOTHING;
