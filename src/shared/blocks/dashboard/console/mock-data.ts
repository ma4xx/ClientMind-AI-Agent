import { EmailItem, KnowledgeHit, PersonaTag } from './types';

export const MOCK_EMAILS: EmailItem[] = [
  {
    id: '1',
    avatar: 'JD',
    name: 'John Doe',
    email: 'john@example.com',
    intent: 'Sales Inquiry',
    snippet: 'My previous M size shirt was a bit tight...',
    time: '10 min ago',
    subject: 'Sizing question for the new Trench Coat',
    body: 'Hi, I bought a shirt last time in M size but it felt a bit tight around the chest (about 2cm small). I am looking at the new Blue Trench Coat. Should I go for L this time? Also, does it have wool? I am allergic.',
    isVip: true,
    status: 'pending',
  },
  {
    id: '2',
    avatar: 'AS',
    name: 'Alice Smith',
    email: 'alice@example.com',
    intent: 'Logistics',
    snippet: 'Where is my order #12345?',
    time: '2 hours ago',
    subject: 'Order Status Inquiry',
    body: 'Hello, I haven\'t received any update on my order #12345. Can you check?',
    isVip: false,
    status: 'pending',
  },
  {
    id: '3',
    avatar: 'MK',
    name: 'Mike Kite',
    email: 'mike@test.com',
    intent: 'Refund',
    snippet: 'I want to return the item...',
    time: '1 day ago',
    subject: 'Return Request',
    body: 'The color is not what I expected. How do I return this?',
    isVip: false,
    status: 'processed',
  },
];

export const MOCK_PERSONA_TAGS: Record<string, PersonaTag[]> = {
  '1': [
    { id: 't1', label: 'M码偏紧 (Chest -2cm)', type: 'warning', source: '2023-10-15 Email', date: '2023-10-15' },
    { id: 't2', label: 'Allergic to Wool', type: 'warning', source: 'Current Email', date: '2024-05-20' },
    { id: 't3', label: 'Prefers Trench Coat', type: 'opportunity', source: 'Browsing History', date: '2023-11-02' },
    { id: 't4', label: 'VIP Level 2', type: 'basic', source: 'CRM', date: '2023-01-01' },
    { id: 't5', label: 'Asked about Blue color', type: 'history', source: '2023-09-10 Chat', date: '2023-09-10' },
  ],
};

export const MOCK_KNOWLEDGE_HITS: Record<string, KnowledgeHit[]> = {
  '1': [
    {
      id: 'k1',
      file: '2024_Size_Chart.pdf',
      segment: '...Trench coat L size fits chest 100-105cm. Compared to Shirt M (96cm), it allows more room...',
      score: 0.92,
    },
    {
      id: 'k2',
      file: 'Material_Safety_Data.docx',
      segment: '...The Blue Trench Coat (Model TC-2024) is made of 100% Polyester. No wool content...',
      score: 0.88,
    },
    {
      id: 'k3',
      file: 'Return_Policy.txt',
      segment: '...Items can be returned within 30 days if unworn...',
      score: 0.45,
    },
  ],
};

export const MOCK_COT_STEPS = [
  "1. 检测到用户询问风衣尺码及材质过敏问题。",
  "2. 检索记忆发现用户曾反馈‘衬衫 M 码胸围偏小 2cm’，且‘对羊毛过敏’。",
  "3. 检索知识库确认：1) 风衣 L 码胸围 100-105cm（适合用户）；2) 该款风衣为 100% 聚酯纤维，无羊毛。",
  "4. 策略：推荐 L 码以确保舒适度，并明确告知材质安全（无羊毛）。",
];

export const MOCK_DRAFT_REPLY = `Dear John,

Thank you for reaching out!

Regarding your sizing query: Since you mentioned the M size shirt was a bit tight around the chest previously, and our Trench Coat L size fits a chest circumference of 100-105cm (providing that extra room you need), I strongly recommend going for the **L size** for a perfect fit.

Also, good news regarding your allergy concern: The Blue Trench Coat is made of **100% Polyester** and contains **no wool**, so it is completely safe for you to wear.

Let me know if you need any other details!

Best regards,
Jessica from Support`;
