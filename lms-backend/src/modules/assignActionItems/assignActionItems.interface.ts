export interface AssignedActionItemsInterface {
  id: string;
  action_item_id: string[];
  class_id?: string[];
  user_id: string[];
  status: "ASSIGNED" | "SUBMITTED" | "APPROVED" | "REJECTED";
  attachment?: string[] | null;
  comment?: string | null;
  assigned_at: Date;
  notes?: string | null;
}
