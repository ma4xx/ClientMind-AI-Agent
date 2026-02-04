import { elasticClient } from '@/lib/elastic/client';
import { v4 as uuidv4 } from 'uuid';

import { respData, respErr } from '@/shared/lib/resp';

type DraftRecord = {
  draft_id?: string;
  email_id?: string;
  customer_email?: string;
  subject?: string;
  original_body?: string;
  draft_content?: string;
  status?: string;
  created_at?: string | Date;
  reasoning?: string;
};

type EventRecord = {
  draft_id?: string;
  approved_by?: string;
  approved_at?: string | Date;
  status?: string;
};

export async function POST(request: Request) {
  try {
    const { limit = 50 } = await request.json().catch(() => ({}));

    const draftsResponse = await elasticClient.search({
      index: 'clientmind_drafts',
      size: limit,
      sort: [{ created_at: { order: 'desc' } }],
      _source: [
        'draft_id',
        'email_id',
        'customer_email',
        'subject',
        'original_body',
        'draft_content',
        'status',
        'created_at',
        'reasoning',
      ],
    });

    const drafts = (draftsResponse.hits.hits || []).map((hit: any) => ({
      ...(hit._source as DraftRecord),
      draft_id: hit._source?.draft_id || hit._id,
    }));

    const draftIds = drafts
      .map((draft) => draft.draft_id)
      .filter((id): id is string => Boolean(id));

    let eventMap = new Map<string, EventRecord>();
    if (draftIds.length > 0) {
      const eventsResponse = await elasticClient.search({
        index: 'clientmind_events',
        ignore_unavailable: true,
        size: draftIds.length,
        query: { terms: { draft_id: draftIds } },
        sort: [{ approved_at: { order: 'desc' } }],
        _source: ['draft_id', 'approved_by', 'approved_at', 'status'],
      });

      for (const hit of eventsResponse.hits.hits || []) {
        const event = hit._source as EventRecord;
        const draftId = event?.draft_id;
        if (draftId && !eventMap.has(draftId)) {
          eventMap.set(draftId, event);
        }
      }
    }

    const events = drafts.map((draft) => {
      const event = draft.draft_id ? eventMap.get(draft.draft_id) : undefined;
      return {
        correlation_id: uuidv4(),
        draft_id: draft.draft_id,
        email_id: draft.email_id,
        customer_email: draft.customer_email,
        subject: draft.subject,
        original_body: draft.original_body,
        draft_content: draft.draft_content,
        status: event?.status || draft.status || 'pending',
        created_at: draft.created_at,
        approved_by: event?.approved_by,
        approved_at: event?.approved_at,
        reasoning: draft.reasoning || '',
      };
    });

    return respData({ events });
  } catch (e: any) {
    console.log('events list failed:', e);
    return respErr('events list failed');
  }
}
