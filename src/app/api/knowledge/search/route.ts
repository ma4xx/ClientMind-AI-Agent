import { elasticClient } from '@/lib/elastic/client';
import { respData, respErr } from '@/shared/lib/resp';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const { query_text, top_k = 3 } = await request.json();
    if (!query_text) {
      return respErr('query_text is required');
    }

    const response = await elasticClient.search({
      index: 'clientmind_knowledge',
      size: top_k,
      query: {
        text_expansion: {
          content_embedding: {
            model_id: '.elser_model_2_linux-x86_64',
            model_text: query_text,
          },
        },
      },
    });

    const hits = (response.hits.hits || []).map((hit: any) => ({
      chunk_id: hit._source?.chunk_id || hit._id,
      source: hit._source?.source || '',
      chunk_text: hit._source?.chunk_text || '',
      score: hit._score || 0,
      metadata: hit._source?.metadata || {},
    }));

    return respData({ correlation_id: uuidv4(), hits });
  } catch (e: any) {
    console.log('knowledge search failed:', e);
    return respErr('knowledge search failed');
  }
}
