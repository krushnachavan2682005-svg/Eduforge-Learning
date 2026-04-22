export interface ReviewsInterface {
  id?: string;
  user_id: string;
  client_id: string;
  course_id: string;
  rating: number;
  comment?: string;
  reviewed_at?: Date;
}
