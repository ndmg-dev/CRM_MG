export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string | null;
  orderIndex: number;
}

export type AskSource = 'cache' | 'llm';

export interface AskResponse {
  answer: string;
  source: AskSource;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  source?: AskSource;
}
