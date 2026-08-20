export interface ReviewsInterface {
  id?: string;
  user_id: string;
  organization_id: string;
  course_id: string;
  rating: number;
  comment?: string;
  reviewed_at?: Date;
}
