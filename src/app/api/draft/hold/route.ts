import { elasticClient } from '@/lib/elastic/client';
import { v4 as uuidv4 } from 'uuid';

import { respData, respErr } from '@/shared/lib/resp';

export async function POST(request: Request) {
  try {
    const { draft_id, n8n_callback_url, email_id, customer_email, subject } =
      await request.json();
    if (!draft_id || !n8n_callback_url) {
      return respErr('draft_id and n8n_callback_url are required');
    }

    const correlationId = uuidv4();

    await elasticClient.update({
      index: 'clientmind_drafts',
      id: draft_id,
      doc: {
        n8n_callback_url,
        email_id: email_id || undefined,
        customer_email: customer_email || undefined,
        subject: subject || undefined,
        updated_at: new Date(),
      },
      doc_as_upsert: false,
    });

    return respData({
      correlation_id: correlationId,
      saved: true,
    });
  } catch (e: any) {
    console.log('draft hold failed:', e);
    return respErr('draft hold failed');
  }
}
