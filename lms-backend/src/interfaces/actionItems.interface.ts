export interface AssignByObject {
  id: string;
  name: string;
}

export interface ReviewerObject {
  id: string;
  name: string;
}
export interface ActionItemsInterface {
  id?: string;
  client_id: string;
  task_name?: string;
  total_score?: string;
  description?: string;
  level?: string;
  reviewer?: ReviewerObject[];
  pdf_attachment?: string;
  created_at?: Date;
  updated_at?: Date;
}
