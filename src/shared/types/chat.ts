export interface Chat {
  id: string;
  userId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  model: string;
  provider: string;
  title: string;
  parts: string;
  metadata?: string | null;
  content?: string | null;
}
