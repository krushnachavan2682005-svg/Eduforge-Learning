CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  language VARCHAR(50),
  price DECIMAL(10, 2),
  level VARCHAR(20) NOT NULL CHECK (
    level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')
  ),
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  client_id UUID NOT NULL,
  tags TEXT [] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(225) NOT NULL,
  course_id UUID NOT NULL,
  seq_no INT,
  client_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  seq_no INT,
  duration VARCHAR(255),
  content_type JSON,
  course_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  client_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID NOT NULL,
  course_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (
    rating >= 1
    AND rating <= 5
  ),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE course_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID [] NOT NULL,
    class_id UUID [] NOT NULL,
  user_id UUID [] NOT NULL,
  client_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE section_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  section_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  client_id UUID NOT NULL,
  user_id UUID NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  user_quiz_answers JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    label VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    url TEXT,
    summary TEXT,

    -- Nested structures as JSONB
    location JSONB,
    education JSONB,
    skills JSONB,
    work JSONB,
    projects JSONB,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);


-- 1. Exams
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR NOT NULL,
    subject VARCHAR NOT NULL,
    total_marks INTEGER NOT NULL,
    passing_marks INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    exam_date TIMESTAMP NOT NULL,
    created_on TIMESTAMP DEFAULT NOW(),
    updated_on TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_exams_user_id ON exams(user_id);

-- 2. Questions
CREATE TABLE exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL,
    type VARCHAR(5) NOT NULL CHECK (type IN ('mcq', 'short', 'long')),
    text TEXT NOT NULL,
    marks INTEGER NOT NULL,
    is_mandatory BOOLEAN NOT NULL,
    correct_answer VARCHAR,
    options JSONB,
    created_on TIMESTAMP DEFAULT NOW(),
    updated_on TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_exam_questions_exam 
        FOREIGN KEY (exam_id) 
        REFERENCES exams(id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_exam_questions_exam_id ON exam_questions(exam_id);
CREATE INDEX idx_exam_questions_type ON exam_questions(type);


-- Exam session
CREATE TABLE exam_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL,
    user_id UUID NOT NULL,
    current_question_index INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    answers_data JSONB NOT NULL DEFAULT '[]',
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    UNIQUE (exam_id, user_id, is_completed) 
);
CREATE INDEX idx_exam_sessions_exam_user ON exam_sessions(exam_id, user_id);
CREATE INDEX idx_exam_sessions_active ON exam_sessions(is_completed);

-- Exam user mappings
CREATE TABLE exam_user_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL,
    user_id UUID NOT NULL,
    session_id UUID NOT NULL,
    total_marks_obtained FLOAT NOT NULL DEFAULT 0,
    total_possible_marks FLOAT NOT NULL,
    percentage FLOAT NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMP NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_taken_minutes INTEGER NOT NULL DEFAULT 0,
    final_answers JSONB NOT NULL DEFAULT '[]',    
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
    UNIQUE (exam_id, user_id, session_id) 
);
CREATE INDEX IF NOT EXISTS idx_exam_mappings_exam_user ON exam_user_mappings(exam_id, user_id);
CREATE INDEX IF NOT EXISTS idx_exam_mappings_user ON exam_user_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_mappings_session ON exam_user_mappings(session_id);

-- Exam Assignments
CREATE TABLE exam_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL,
    user_id UUID NOT NULL,
    client_id UUID,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    UNIQUE (exam_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_exam_user ON exam_assignments(exam_id, user_id);

CREATE TABLE "exam_reviews" (
    "id" UUID PRIMARY KEY,
    "exam_id" UUID NOT NULL REFERENCES "exams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "exam_user_mapping_id" UUID NOT NULL UNIQUE REFERENCES "exam_user_mappings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "reviewer_id" UUID NOT NULL,
    "reviewed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "reviewed_answers" JSONB NOT NULL,
    "total_marks_obtained" REAL NOT NULL,
    "percentage" REAL NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "client_id" UUID,
    "created_on" TIMESTAMPTZ DEFAULT NOW(),
    "updated_on" TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    total_score VARCHAR(255),
    description TEXT,
    pdf_attachment TEXT,
    level VARCHAR(255),
    assign_by JSONB NOT NULL,
    reviewer JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assigned_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_item_id UUID[] NOT NULL,
    class_id UUID,
    user_id UUID[],
    client_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED'
    CHECK (status IN ('ASSIGNED', 'SUBMITTED', 'APPROVED', 'REJECTED')),
    score INTEGER CHECK (score >= 0),
    attachment TEXT[] DEFAULT '{}',
    pdf_attachment TEXT,
    comment TEXT,
    notes Text,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CHECK (
        user_id IS NOT NULL
        OR class_id IS NOT NULL
        OR client_id IS NOT NULL
    )
);

CREATE TABLE levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    level_name VARCHAR(255) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_client_level_name UNIQUE(client_id, level_name)
);

CREATE TABLE IF NOT EXISTS student_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    client_id UUID NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    studentName VARCHAR(255) NOT NULL,
    achieved_marks INTEGER,
    total_marks INTEGER,
    exam_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(10) CHECK (status IN ('Pass', 'Fail')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE publish_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_id UUID NOT NULL,
  assignment_id UUID NOT NULL,
  user_id UUID NOT NULL,
  publish BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);