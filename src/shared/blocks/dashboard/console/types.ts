export interface EmailItem {
  id: string;
  avatar: string;
  name: string;
  email: string;
  intent: string;
  snippet: string;
  time: string;
  subject: string;
  body: string;
  isVip?: boolean;
  status: string;
  draftId?: string;
  emailId?: string;
  draftContent?: string;
  reasoning?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export type TagType = 'warning' | 'opportunity' | 'basic' | 'history';

export interface PersonaTag {
  id: string;
  label: string;
  type: TagType;
  source: string;
  date: string;
}

export interface KnowledgeHit {
  id: string;
  file: string;
  segment: string;
  score: number;
}

export interface ChainOfThoughtStep {
  id: string;
  step: number;
  content: string;
}

export interface AgentState {
  selectedEmailId: string | null;
  isProcessing: boolean;
  draft: string;
}
