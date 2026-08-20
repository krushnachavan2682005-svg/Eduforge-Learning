export interface QuizzeInterface {
  id: string;              
  lesson_id: string;        
  question: string;        
  options: string[];      
  correct_answer?: string; 
}