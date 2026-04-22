
export interface CourseInterface {
  id: string;
  //   instructor_id: string;
  //   subcategory_id: string;
  title: string;
  description?: string;
  language?: string;
  price?: number;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  thumbnail_url?: string;
  is_published?: boolean;
  client_id: string;
  created_at?: Date;
  updated_at?: Date;
}
