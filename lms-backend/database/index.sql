-- ============================================
-- SECOND-PASS VALIDATED INDEXES
-- ============================================

-- ============================================
-- STUDENTS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_students_org_created 
ON students (organization_id, created_at DESC);

-- ============================================
-- COURSES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_courses_org_created 
ON courses (organization_id, created_at DESC);

-- ============================================
-- SECTIONS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sections_course 
ON sections (course_id);

-- ============================================
-- LESSONS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lessons_section 
ON lessons (section_id);

-- ============================================
-- ENROLLMENTS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_enrollments_org_user 
ON enrollments (organization_id, user_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_org_course 
ON enrollments (organization_id, course_id);

-- ============================================
-- ASSIGNED ACTION ITEMS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_assigned_actions_org_user 
ON assigned_action_items (organization_id, user_id, status);

-- ============================================
-- EXAM USER MAPPINGS (STUDENT RESULTS)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_eum_org_user_completed 
ON exam_user_mappings (organization_id, user_id, is_completed);

-- ============================================
-- EXAMS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_exams_org_created 
ON exams (organization_id, created_at DESC);
