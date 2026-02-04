import { elasticClient } from '@/lib/elastic/client';
import { v4 as uuidv4 } from 'uuid';

import { mergeTags } from '@/shared/lib/persona';
import { respData, respErr } from '@/shared/lib/resp';

export async function POST(request: Request) {
  try {
    const {
      email,
      memory = {},
      knowledge = {},
      persona_config = {},
    } = await request.json();
    if (!email?.email_id || !email?.subject || !email?.body || !email?.from) {
      return respErr('email (email_id, subject, body, from) is required');
    }

    const tags = memory?.tags || [];
    const history = memory?.interaction_history || [];
    const hits = knowledge?.hits || [];
    const tone = persona_config?.tone || 'friendly';
    const agentName = persona_config?.agent_name || 'ClientMind';

    const tagLine =
      tags.length > 0
        ? `Known preferences: ${tags
            .map((tag: any) => `${tag.label}(${tag.type})`)
            .join(', ')}.`
        : 'No stored preferences were found.';

    const historyLine =
      history.length > 0
        ? `Previous interactions:\n${history
            .slice(0, 5)
            .map((h: any) => `- [${h.date}] ${h.summary}`)
            .join('\n')}`
        : 'No previous interaction history found.';

    const knowledgeLine =
      hits.length > 0
        ? `Relevant references: ${hits
            .slice(0, 3)
            .map((hit: any) => hit.chunk_text)
            .join(' ')}`
        : 'No relevant knowledge snippets were found.';

    const agentId = process.env.ELASTIC_AGENT_ID;
    if (!agentId) {
      return respErr('ELASTIC_AGENT_ID is not configured');
    }

    const systemPrompt = [
      `# Role`,
      `You are not a robot, you are a **SHEIN Exclusive Fashion Consultant (Style Bestie)**.`,
      `Goal: Solve problems with a warm, professional, and fashion-forward tone.`,
      '',
      `# Guidelines`,
      `- **No Robotic Language**: Never say "according to the database" or "our records show".`,
      `- **Explicit Memory & History**: `,
      `  1. Check 'Memory & Preferences' (Tags) first.`,
      `  2. Check 'History' (Previous Interactions) second. If you find specific user details (like height, weight, build, or past issues) in the History that are NOT in the Memory, you MUST use them as if they were current knowledge.`,
      `  3. If you find measurements (e.g., 180cm, 90kg), explicitly mention them (e.g., "Since I remember you're a tall 180cm...").`,
      `- **Memory Extraction**: You MUST extract any new user attributes (height, weight, fit preference) into the "new_memories" array in your JSON response.`,
      `- **Emotional Value**: Appropriately compliment the user's taste. Use Emojis 😊 to create a friendly vibe.`,
      `- **Strict adherence to facts**: Do not invent policies or timelines not found in the Knowledge.`,
      `- **Format**: Return a JSON object (NO markdown formatting) with the following structure:`,
      `{`,
      `  "draft_html": "The HTML body of the email (Use <p>, <strong>, etc.). Do NOT include a Subject line.",`,
      `  "new_memories": [`,
      `    { "label": "Height 180cm", "type": "basic" },`,
      `    { "label": "Weight 90kg", "type": "basic" }`,
      `  ]`,
      `}`,
    ].join('\n');

    const userPrompt = [
      `# Context Data`,
      `1. **Email Subject**: ${email.subject}`,
      `2. **Email Body**: ${email.body}`,
      `3. **Memory & Preferences**: ${tagLine}`,
      `4. **History**: ${historyLine}`,
      `5. **Knowledge Base**: ${knowledgeLine}`,
      '',
      `# Task`,
      `Write a clear, complete, and personalized reply email in HTML format based on the above guidelines. Return JSON only.`,
    ].join('\n');

    const combinedInput = `${systemPrompt}\n\n${userPrompt}`;

    // Construct Kibana URL from Elasticsearch URL (assuming standard Cloud pattern)
    // Replace .es. with .kb. in the hostname
    const esUrl = process.env.ELASTIC_CLOUD_URL || '';
    const kibanaUrl = esUrl.replace('.es.', '.kb.').replace(':443', '');
    const apiKey = process.env.ELASTIC_API_KEY;

    if (!kibanaUrl || !apiKey) {
      return respErr('ELASTIC_CLOUD_URL or ELASTIC_API_KEY is not configured');
    }

    const isDebug = process.env.DEBUG_LOGS === 'true';

    if (isDebug) {
      console.log('[DEBUG] Calling Agent Builder:', {
        url: `${kibanaUrl}/api/agent_builder/converse/async`,
        agentId,
        apiKeyPrefix: apiKey.substring(0, 5) + '...',
      });
    }

    // Use Agent Builder API
    // Documentation: https://www.elastic.co/docs/api/doc/serverless/operation/operation-post-agent-builder-converse-async
    const agentResponse = await fetch(
      `${kibanaUrl}/api/agent_builder/converse/async`,
      {
        method: 'POST',
        headers: {
          Authorization: `ApiKey ${apiKey}`,
          'Content-Type': 'application/json',
          'kbn-xsrf': 'true',
        },
        body: JSON.stringify({
          agent_id: agentId,
          input: combinedInput,
        }),
      }
    );

    console.log('[DEBUG] Response Status:', agentResponse.status);

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error(
        'Agent Builder API Error:',
        agentResponse.status,
        errorText
      );
      if (agentResponse.status === 403) {
        return respErr(
          `Permission denied. Please ensure your API Key has 'read_agent_builder' privileges. Error: ${errorText}`
        );
      }
      return respErr(
        `Agent invocation failed: ${agentResponse.status} ${agentResponse.statusText} - ${errorText}`
      );
    }

    // Handle SSE stream accumulation manually
    let fullContent = '';
    const decoder = new TextDecoder();
    const eventsReceived: string[] = [];
    let currentEvent: string | null = null;

    // Node.js fetch response.body is a ReadableStream
    if (agentResponse.body) {
      const reader = agentResponse.body.getReader();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        if (isDebug) {
          console.log(
            '[DEBUG] Raw chunk received:',
            text.substring(0, 100) + (text.length > 100 ? '...' : '')
          ); // Log raw chunk
        }
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (isDebug) {
            console.log('[DEBUG] Processing line:', trimmed); // Log every line
          }

          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.substring(7).trim();
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.substring(6);
            try {
              const data = JSON.parse(dataStr);
              // Agent Builder Event Structure
              // We are looking for the final answer or incremental updates
              // The event type is in data.event OR from 'event:' line
              const eventType = currentEvent || data.event;
              const eventData = data.data;

              if (eventType) {
                eventsReceived.push(eventType);
              }

              if (isDebug) {
                console.log(
                  '[DEBUG] Parsed Event:',
                  eventType,
                  JSON.stringify(eventData).substring(0, 100)
                ); // Log event type
              }

              // Check for specific events
              if (eventType === 'message_chunk' && eventData?.text_chunk) {
                fullContent += eventData.text_chunk;
                if (isDebug)
                  console.log(
                    '[DEBUG] Added chunk, length:',
                    fullContent.length
                  );
              } else if (
                eventType === 'message_complete' &&
                eventData?.message_content
              ) {
                fullContent = eventData.message_content;
                if (isDebug)
                  console.log(
                    '[DEBUG] Message complete, length:',
                    fullContent.length
                  );
              } else if (
                (eventType === 'message' || !eventType) &&
                eventData?.round?.response?.message
              ) {
                // Legacy or alternative event format
                // If eventType is missing, but structure matches, try to use it
                fullContent = eventData.round.response.message;
                if (isDebug)
                  console.log(
                    '[DEBUG] Legacy message, length:',
                    fullContent.length
                  );
              }

              // Reset current event after processing data
              currentEvent = null;
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.substring(6);
          try {
            const data = JSON.parse(dataStr);
            const eventType = currentEvent || data.event;
            const eventData = data.data;
            if (eventType) eventsReceived.push(eventType);

            if (eventType === 'message_chunk' && eventData?.text_chunk) {
              fullContent += eventData.text_chunk;
            } else if (
              eventType === 'message_complete' &&
              eventData?.message_content
            ) {
              fullContent = eventData.message_content;
            } else if (
              (eventType === 'message' || !eventType) &&
              eventData?.round?.response?.message
            ) {
              fullContent = eventData.round.response.message;
            }
          } catch (e) {
            console.error('Error parsing SSE data (buffer):', e);
          }
        }
      }
    }

    let draft = '';
    let newMemories: any[] = [];

    try {
      // Clean up markdown blocks if present
      const cleanContent = fullContent.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanContent);
      draft = parsed.draft_html || '';
      newMemories = parsed.new_memories || [];
    } catch (e) {
      console.warn(
        'Failed to parse JSON draft, falling back to regex extraction'
      );
      // Fallback: Extract draft_html and new_memories via regex
      const draftMatch = fullContent.match(
        /"draft_html":\s*"([\s\S]*?)"(?=,\s*"new_memories"|})/
      );
      if (draftMatch) {
        draft = draftMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      } else {
        draft = fullContent;
      }

      // Extract memories like: { "label": "...", "type": "..." }
      const memoryMatches = fullContent.matchAll(
        /\{\s*"label":\s*"([^"]+)",\s*"type":\s*"([^"]+)"\s*\}/g
      );
      for (const match of memoryMatches) {
        newMemories.push({ label: match[1], type: match[2] });
      }

      if (newMemories.length > 0) {
        console.log(
          `Successfully extracted ${newMemories.length} memories via regex fallback`
        );
      }
    }

    if (!draft) {
      console.error('Draft generation empty response (stream)', eventsReceived);
      return respErr(
        `draft generation failed: empty stream response. Events received: ${eventsReceived.join(
          ', '
        )}`
      );
    }

    const draftId = uuidv4();
    const customerEmail = email.from.toLowerCase();

    // 1. Save Draft to ES (clientmind_drafts)
    try {
      await elasticClient.index({
        index: 'clientmind_drafts',
        id: draftId,
        document: {
          draft_id: draftId,
          email_id: email.email_id,
          customer_email: customerEmail,
          subject: email.subject,
          original_body: email.body,
          draft_content: draft,
          status: 'pending',
          created_at: new Date(),
          reasoning: `agent:${agentId} | tone:${tone} | tags:${tags.length} | history:${history.length} | hits:${hits.length}`,
        },
      });
    } catch (e) {
      console.error('Failed to save draft to ES', e);
    }

    // 2. Update Persona (if email exists and memories found)
    if (customerEmail && newMemories.length > 0) {
      try {
        // Fetch existing using ID (email) or keyword search
        const current = await elasticClient.search({
          index: 'clientmind_persona',
          size: 1,
          query: { term: { 'customer_email.keyword': customerEmail } },
        });
        const existing = current.hits.hits?.[0]?._source as any;

        // Unified merge logic using shared library
        const existingTags = existing?.tags || [];
        const tagsToAdd = newMemories.map((m: any) => ({
          label: m.label,
          type: m.type || 'basic',
          source: 'email_inference',
          date: new Date().toISOString().split('T')[0],
        }));

        const mergedTags = mergeTags(existingTags, tagsToAdd);

        await elasticClient.index({
          index: 'clientmind_persona',
          id: customerEmail, // Use email as fixed ID
          document: {
            customer_email: customerEmail,
            tags: mergedTags,
            interaction_history: existing?.interaction_history || [],
            updated_at: new Date().toISOString(),
          },
        });
        console.log(
          `Persona updated for ${customerEmail} with ${tagsToAdd.length} new tags`
        );
      } catch (e) {
        console.error('Failed to update persona', e);
      }
    }

    const reasoning = `agent:${agentId} | tone:${tone} | tags:${tags.length} | history:${history.length} | hits:${hits.length}`;

    return respData({
      correlation_id: uuidv4(),
      draft,
      reasoning,
      draft_id: draftId,
    });
  } catch (e: any) {
    console.error('draft generate failed:', e);
    // Return detailed error info for debugging only in dev
    const isDev = process.env.NODE_ENV === 'development';
    const errorDetails = isDev
      ? e?.meta?.body?.error?.reason ||
        e?.meta?.body?.error?.type ||
        e.message ||
        JSON.stringify(e)
      : 'Internal Server Error';
    return respErr(`draft generate failed: ${errorDetails}`);
  }
}
