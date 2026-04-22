export interface lessonInterface {
  id: string;
  section_id: string;
  duration: string;
  title: string;
  content_type: contentType;
  content_url: string;
  sort_order: number;
}

export interface contentType {
  url: "string";
  file_name?: string;
  file_type: "VIDEO" | "PDF" | "TEXT" | "QUIZ";
}
