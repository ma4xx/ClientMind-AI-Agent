import { elasticClient } from '@/lib/elastic/client';
import { v4 as uuidv4 } from 'uuid';

import { respData, respErr } from '@/shared/lib/resp';

export async function POST(request: Request) {
  try {
    const {
      draft_id,
      approved_by,
      n8n_callback_url: provided_callback_url,
      draft_content,
      email_id,
      customer_email,
      subject,
    } = await request.json();
    if (!draft_id || !approved_by) {
      return respErr('draft_id and approved_by are required');
    }

    let callbackUrl = provided_callback_url;

    // Fetch callback_url from ES if not provided
    if (!callbackUrl) {
      try {
        console.log('Fetching callback for draft_id:', draft_id);
        const draftRes = await elasticClient.get({
          index: 'clientmind_drafts',
          id: draft_id,
        });
        if (draftRes.found) {
          callbackUrl = (draftRes._source as any).n8n_callback_url;
          console.log('Found callbackUrl in ES:', callbackUrl);
        } else {
          console.log('Draft not found in ES for callback');
        }
      } catch (e) {
        console.log('fetch draft for callback failed:', e);
      }
    }

    const correlationId = uuidv4();
    const messageId = uuidv4();

    await elasticClient.index({
      index: 'clientmind_events',
      document: {
        correlation_id: correlationId,
        draft_id,
        approved_by,
        approved_at: new Date(),
        status: 'approved',
        n8n_callback_url: callbackUrl || '',
        message_id: messageId,
        draft_content: draft_content || '',
        email_id: email_id || '',
        customer_email: customer_email || '',
        subject: subject || '',
      },
    });

    try {
      await elasticClient.update({
        index: 'clientmind_drafts',
        id: draft_id,
        doc: {
          status: 'approved',
          approved_by,
          approved_at: new Date(),
          draft_content: draft_content || undefined,
        },
        doc_as_upsert: false,
      });
    } catch (e) {
      console.log('draft status update failed:', e);
    }

    // Update Persona interaction history
    if (customer_email) {
      try {
        const normalizedEmail = customer_email.toLowerCase();
        const summary = `Subject: ${subject || 'No Subject'}\nDraft: ${draft_content?.substring(0, 500) || ''}...`;

        // Search if persona exists
        const personaRes = await elasticClient.search({
          index: 'clientmind_persona',
          query: { term: { 'customer_email.keyword': normalizedEmail } },
        });

        const interaction = {
          summary,
          date: new Date().toISOString(),
          source_id: email_id || draft_id,
        };

        if (personaRes.hits.hits.length > 0) {
          const hit = personaRes.hits.hits[0];
          const currentHistory = (hit._source as any).interaction_history || [];
          const currentTags = (hit._source as any).tags || [];

          await elasticClient.index({
            index: 'clientmind_persona',
            id: normalizedEmail, // Always use email as ID
            document: {
              customer_email: normalizedEmail,
              tags: currentTags, // Preserve tags
              interaction_history: [interaction, ...currentHistory].slice(
                0,
                10
              ), // Keep last 10
              updated_at: new Date().toISOString(),
            },
          });
        } else {
          await elasticClient.index({
            index: 'clientmind_persona',
            id: normalizedEmail, // Always use email as ID
            document: {
              customer_email: normalizedEmail,
              tags: [],
              interaction_history: [interaction],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          });
        }
        console.log('Persona updated for:', normalizedEmail);
      } catch (e) {
        console.error('Failed to update persona:', e);
      }
    }

    // Call n8n callback to resume workflow
    if (callbackUrl) {
      try {
        // Fix for localhost on some systems (IPv6 vs IPv4)
        const finalCallbackUrl = callbackUrl.replace('localhost', '127.0.0.1');

        console.log('Sending callback to n8n:', finalCallbackUrl);
        const callbackPayload = {
          status: 'approved',
          approved_by,
          draft_content: draft_content || '',
          draft_id,
        };
        console.log(
          'Callback payload:',
          JSON.stringify(callbackPayload, null, 2)
        );

        const callbackResponse = await fetch(finalCallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(callbackPayload),
        });

        const responseText = await callbackResponse.text();
        console.log('n8n callback status:', callbackResponse.status);
        console.log('n8n callback response:', responseText);

        if (callbackResponse.ok) {
          console.log('n8n callback successful');
        } else {
          console.error(
            `n8n callback returned error status: ${callbackResponse.status} ${callbackResponse.statusText}`
          );
          console.error(
            'Hint: If status is 404, the n8n execution may have expired or the URL is for a different execution.'
          );
        }
      } catch (callbackErr: any) {
        console.error('n8n callback network error:', callbackErr.message);
        if (callbackErr.message.includes('ECONNREFUSED')) {
          console.error(
            'Hint: n8n server seems to be down or unreachable at this URL.'
          );
        }
      }
    } else {
      console.warn('No callbackUrl found for draft_id:', draft_id);
    }

    return respData({
      correlation_id: correlationId,
      sent: true,
      message_id: messageId,
    });
  } catch (e: any) {
    console.log('draft approve failed:', e);
    return respErr('draft approve failed');
  }
}
