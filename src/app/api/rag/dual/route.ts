import { elasticClient } from '@/lib/elastic/client';
import { v4 as uuidv4 } from 'uuid';

import { respData, respErr } from '@/shared/lib/resp';

async function getPersona(customer_email: string) {
  try {
    const response = await elasticClient.search({
      index: 'clientmind_persona',
      size: 1,
      query: {
        term: { 'customer_email.keyword': customer_email.toLowerCase() },
      },
      ignore_unavailable: true,
    });
    const doc = response.hits.hits?.[0]?._source as any;

    // If no persona found, try to fetch recent interactions from events
    if (!doc) {
      const eventsResponse = await elasticClient.search({
        index: 'clientmind_events',
        size: 5,
        query: {
          term: { 'customer_email.keyword': customer_email.toLowerCase() },
        },
        sort: [{ approved_at: { order: 'desc' } }],
        ignore_unavailable: true,
      });

      const history = (eventsResponse.hits.hits || []).map((hit: any) => ({
        summary: `Subject: ${hit._source.subject}\nContent: ${hit._source.draft_content?.substring(0, 500)}...`,
        date: hit._source.approved_at,
        source_id: hit._source.email_id || hit._id,
      }));

      return {
        tags: [],
        interaction_history: history,
      };
    }

    return {
      tags: doc?.tags || [],
      interaction_history: doc?.interaction_history || [],
    };
  } catch (e) {
    console.error('Error fetching persona/history:', e);
    return { tags: [], interaction_history: [] };
  }
}

async function searchKnowledge(query_text: string, top_k: number) {
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
    // Explicitly request fields we need in _source
    _source: ['chunk_id', 'source', 'chunk_text', 'metadata', 'content'],
  });

  // Debug log: print the first hit's source structure
  if (process.env.DEBUG_LOGS === 'true' && response.hits.hits.length > 0) {
    console.log(
      'First hit structure:',
      JSON.stringify(response.hits.hits[0], null, 2)
    );
  }

  return (response.hits.hits || []).map((hit: any) => ({
    chunk_id: hit._source?.chunk_id || hit._id,
    source: hit._source?.source || '',
    chunk_text:
      hit._source?.chunk_text ||
      hit._source?.content ||
      hit._source?.text ||
      '', // Try multiple common field names
    score: hit._score || 0,
    metadata: hit._source?.metadata || {},
  }));
}

export async function POST(request: Request) {
  try {
    const rawText = await request.text();
    if (!rawText) {
      return respErr('Request body is empty');
    }

    let body;
    try {
      body = JSON.parse(rawText);
    } catch (e) {
      console.error('JSON parse error:', e);
      return respErr('Invalid JSON in request body');
    }

    const { customer_email, query_text, top_k = 3 } = body;

    // Validate inputs
    let memory = null;
    let warnings: string[] = [];
    if (!customer_email) {
      console.warn(
        'Missing customer_email. Proceeding with empty memory context.'
      );
      warnings.push('Missing customer_email. Memory context skipped.');
      memory = { tags: [], interaction_history: [] };
    }
    if (!query_text) {
      return respErr('query_text is required');
    }

    const [fetchedMemory, hits] = await Promise.all([
      customer_email
        ? getPersona(customer_email)
        : Promise.resolve({ tags: [], interaction_history: [] }),
      searchKnowledge(query_text, top_k),
    ]);

    memory = fetchedMemory;

    // Fallback: If ELSER returns no hits, try standard match query
    if (hits.length === 0) {
      console.log(
        'ELSER returned 0 hits, falling back to standard match query'
      );
      const fallbackResponse = await elasticClient.search({
        index: 'clientmind_knowledge',
        size: top_k,
        query: {
          multi_match: {
            query: query_text,
            fields: ['chunk_text', 'content'],
            fuzziness: 'AUTO',
          },
        },
        _source: ['chunk_id', 'source', 'chunk_text', 'metadata', 'content'],
      });

      hits.push(
        ...(fallbackResponse.hits.hits || []).map((hit: any) => ({
          chunk_id: hit._source?.chunk_id || hit._id,
          source: hit._source?.source || '',
          chunk_text:
            hit._source?.chunk_text ||
            hit._source?.content ||
            hit._source?.text ||
            '',
          score: hit._score || 0,
          metadata: hit._source?.metadata || {},
        }))
      );
    }

    return respData({
      correlation_id: uuidv4(),
      memory,
      knowledge: { hits },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (e: any) {
    console.error('dual rag failed:', e.message);
    // Return generic error in production
    const isDev = process.env.NODE_ENV === 'development';
    const errorDetails = isDev
      ? e?.meta?.body?.error?.reason ||
        e?.meta?.body?.error?.type ||
        e.message ||
        JSON.stringify(e)
      : 'Internal Server Error';
    return respErr(`dual rag failed: ${errorDetails}`);
  }
}
