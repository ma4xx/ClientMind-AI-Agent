import { elasticClient } from '@/lib/elastic/client';
import { v4 as uuidv4 } from 'uuid';

import { mergeHistory, mergeTags } from '@/shared/lib/persona';
import { respData, respErr } from '@/shared/lib/resp';

export async function POST(request: Request) {
  try {
    const {
      customer_email,
      tags = [],
      interaction_history = [],
      persona_config = {},
    } = await request.json();
    if (!customer_email) {
      return respErr('customer_email is required');
    }

    const current = await elasticClient.search({
      index: 'clientmind_persona',
      size: 1,
      query: { term: { customer_email } },
    });

    const existing = current.hits.hits?.[0]?._source as any;
    const mergedTags = mergeTags(existing?.tags || [], tags);
    const mergedHistory = mergeHistory(
      existing?.interaction_history || [],
      interaction_history
    );
    const mergedConfig = {
      ...(existing?.persona_config || {}),
      ...(persona_config || {}),
    };

    const response = await elasticClient.index({
      index: 'clientmind_persona',
      id: customer_email,
      document: {
        customer_email,
        tags: mergedTags,
        interaction_history: mergedHistory,
        persona_config: mergedConfig,
      },
    });

    return respData({
      correlation_id: uuidv4(),
      updated: true,
      version: response._version,
      persona_config: mergedConfig,
    });
  } catch (e: any) {
    console.log('persona upsert failed:', e);
    return respErr('persona upsert failed');
  }
}
