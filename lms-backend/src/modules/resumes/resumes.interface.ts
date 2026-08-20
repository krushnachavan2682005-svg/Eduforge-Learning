export interface ResumeInterface {
  id: string;
  user_id: string;
  name: string;
  label: string;
  email: string;
  phone: string;
  address: string;

  degree: string;
  institution: string;
  graduation_year: number;

  company: string;
  role: string;
  years_of_experience: number;

  skills: string[];

  project_title: string;
  project_description: string;

  created_at: Date;
  updated_at: Date;
}
