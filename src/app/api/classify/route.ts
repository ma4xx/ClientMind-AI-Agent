import { elasticClient } from '@/lib/elastic/client';
import { v4 as uuidv4 } from 'uuid';

import { respData, respErr } from '@/shared/lib/resp';

export async function POST(request: Request) {
  try {
    const { model_id, messages } = await request.json();
    if (!model_id || !messages) {
      return respErr('model_id and messages are required');
    }

    const response = await elasticClient.transport.request(
      {
        method: 'POST',
        // Append /_stream to the path as required by the error message
        path: `/_inference/chat_completion/${model_id}/_stream`,
        body: {
          messages,
        },
      },
      { meta: true }
    );

    const stream = response.body as any;
    let fullContent = '';
    let debugLog = ''; // Capture raw stream for debugging
    const decoder = new TextDecoder();

    // Handle stream accumulation
    if (stream) {
      try {
        let buffer = '';
        for await (const chunk of stream) {
          let text = '';
          if (typeof chunk === 'string') {
            text = chunk;
          } else {
            text = decoder.decode(chunk, { stream: true });
          }

          // Debug: capture first 1000 chars of raw output
          if (debugLog.length < 1000) {
            debugLog += text.substring(0, 1000 - debugLog.length);
          }

          buffer += text;
          const lines = buffer.split('\n');
          // Keep the last line in the buffer as it might be incomplete
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.substring(6);
              if (dataStr === '[DONE]') continue;
              try {
                const data = JSON.parse(dataStr);
                const delta = data.choices?.[0]?.delta?.content || '';
                fullContent += delta;
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            } else if (trimmed.startsWith('event:')) {
              // Ignore event lines
              continue;
            } else {
              // Try parsing line directly just in case "data: " prefix is missing or it's a raw JSON line
              try {
                const data = JSON.parse(trimmed);
                const delta = data.choices?.[0]?.delta?.content || '';
                if (delta) fullContent += delta;
              } catch (e) {}
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              const delta = data.choices?.[0]?.delta?.content || '';
              fullContent += delta;
            } catch (e) {}
          }
        }
      } catch (err: any) {
        console.error('Stream processing error:', err);
        return respErr(
          `Stream processing error: ${err.message || String(err)}`
        );
      }
    } else {
      // Fallback if body is not a stream (unlikely for stream: true)
      return respErr('Unexpected response format: not a stream');
    }

    const content = fullContent;

    if (!content) {
      return respErr(
        `inference failed: no content returned from stream. Debug: ${debugLog.substring(0, 200)}...`
      );
    }

    let parsedContent = content;
    try {
      // Try to parse JSON if the model returns a JSON string
      if (typeof content === 'string' && content.trim().startsWith('{')) {
        parsedContent = JSON.parse(content);
      }
    } catch {}

    return respData({
      correlation_id: uuidv4(),
      result: parsedContent,
      raw_content: content,
    });
  } catch (e: any) {
    console.log('classify failed:', e);
    // If it's an Elastic error, try to return useful info
    const errorMessage =
      e?.meta?.body?.error?.reason || e.message || 'Unknown error';
    return respErr(`classify failed: ${errorMessage}`);
  }
}
