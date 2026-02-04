import { elasticClient } from '@/lib/elastic/client';
import { v4 as uuidv4 } from 'uuid';

import { respData, respErr } from '@/shared/lib/resp';

export async function POST(request: Request) {
  try {
    const { customer_email } = await request.json();
    if (!customer_email) {
      return respErr('customer_email is required');
    }

    const response = await elasticClient.search({
      index: 'clientmind_persona',
      size: 1,
      query: {
        term: { customer_email },
      },
    });

    const doc = response.hits.hits?.[0]?._source as any;
    const tags = doc?.tags || [];
    const interaction_history = doc?.interaction_history || [];
    const persona_config = doc?.persona_config || {};

    return respData({
      correlation_id: uuidv4(),
      tags,
      interaction_history,
      persona_config,
    });
  } catch (e: any) {
    console.log('persona get failed:', e);
    return respErr('persona get failed');
  }
}
