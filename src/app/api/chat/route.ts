import { Client } from '@elastic/elasticsearch';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  convertToModelMessages,
  createIdGenerator,
  generateId,
  stepCountIs,
  streamText,
  TextUIPart,
  tool,
  UIMessage,
  validateUIMessages,
} from 'ai';
import { z } from 'zod';

import { findChatById } from '@/shared/models/chat';
import {
  ChatMessageStatus,
  createChatMessage,
  getChatMessages,
  NewChatMessage,
} from '@/shared/models/chat_message';
import { getAllConfigs } from '@/shared/models/config';
import { getUserInfo } from '@/shared/models/user';

// Elastic Client Singleton
const elasticClient = new Client({
  node: process.env.ELASTIC_CLOUD_URL,
  auth: { apiKey: process.env.ELASTIC_API_KEY! },
});

export async function POST(req: Request) {
  try {
    const {
      chatId,
      message,
      model,
      webSearch,
      reasoning,
    }: {
      chatId: string;
      message: UIMessage;
      model: string;
      webSearch: boolean;
      reasoning?: boolean;
    } = await req.json();

    if (!chatId || !model) {
      throw new Error('invalid params');
    }

    if (!message || !message.parts || message.parts.length === 0) {
      throw new Error('invalid message');
    }

    // check user sign
    const user = await getUserInfo();
    if (!user) {
      throw new Error('no auth, please sign in');
    }

    // check chat
    const chat = await findChatById(chatId);
    if (!chat) {
      throw new Error('chat not found');
    }

    if (chat.userId !== user?.id) {
      throw new Error('no permission to access this chat');
    }

    const configs = await getAllConfigs();
    const currentTime = new Date();
    const provider = model === 'clientmind-agent' ? 'elastic' : 'openrouter';

    // save user message to database
    const userMessage: NewChatMessage = {
      id: generateId().toLowerCase(),
      chatId,
      userId: user?.id,
      status: ChatMessageStatus.CREATED,
      createdAt: currentTime,
      updatedAt: currentTime,
      role: 'user',
      parts: JSON.stringify(message.parts),
      metadata: JSON.stringify({ model, webSearch, reasoning }),
      model: model,
      provider: provider,
    };
    await createChatMessage(userMessage);

    // load previous messages from database
    const previousMessages = await getChatMessages({
      chatId,
      status: ChatMessageStatus.CREATED,
      page: 1,
      limit: 10,
    });

    let validatedMessages: UIMessage[] = [];
    if (previousMessages.length > 0) {
      validatedMessages = previousMessages.reverse().map((message) => ({
        id: message.id,
        role: message.role,
        parts: message.parts ? JSON.parse(message.parts) : [],
      })) as UIMessage[];
    }

    let result;

    if (model === 'clientmind-agent') {
      const agentId = process.env.ELASTIC_AGENT_ID;
      if (!agentId) throw new Error('ELASTIC_AGENT_ID is not configured');

      // Convert messages to Elastic format
      const messages = convertToModelMessages(validatedMessages);

      // We use a custom fetch implementation for Elastic Inference API streaming
      // Since Vercel AI SDK doesn't have a direct Elastic provider yet
      result = streamText({
        model: {
          provider: 'elastic-inference',
          modelId: agentId,
          doStream: async ({
            messages,
            onChunk,
            onFinish,
          }: {
            messages: any[];
            onChunk: any;
            onFinish: any;
          }) => {
            const response = await elasticClient.transport.request(
              {
                method: 'POST',
                path: `/_inference/chat_completion/${agentId}`,
                body: { messages, stream: true },
              },
              { meta: true }
            );

            const stream = response.body as any; // Node.js stream
            let fullText = '';

            // Transform Elastic stream to AI SDK stream
            const reader = stream[Symbol.asyncIterator]();

            return {
              stream: new ReadableStream({
                async pull(controller) {
                  try {
                    const { done, value } = await reader.next();
                    if (done) {
                      controller.close();
                      onFinish({
                        text: fullText,
                        finishReason: 'stop',
                        usage: {
                          promptTokens: 0,
                          completionTokens: 0,
                          totalTokens: 0,
                        }, // Usage not always available in stream
                        rawResponse: { headers: {} },
                      });
                      return;
                    }

                    const chunkStr = value.toString();
                    const lines = chunkStr
                      .split('\n')
                      .filter((line: string) => line.trim() !== '');

                    for (const line of lines) {
                      if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') continue;

                        try {
                          const data = JSON.parse(dataStr);
                          const delta = data.choices[0]?.delta?.content || '';
                          if (delta) {
                            fullText += delta;
                            controller.enqueue({
                              type: 'text-delta',
                              textBlockIndex: 0,
                              delta,
                            });
                          }
                        } catch (e) {
                          console.error('Error parsing Elastic chunk:', e);
                        }
                      }
                    }
                  } catch (e) {
                    controller.error(e);
                  }
                },
              }),
            };
          },
        } as any, // Custom provider implementation hack
        messages: convertToModelMessages(validatedMessages),
      });
    } else {
      // OpenRouter fallback
      const openrouterApiKey = configs.openrouter_api_key;
      if (!openrouterApiKey) {
        throw new Error('openrouter_api_key is not set');
      }
      const openrouterBaseUrl = configs.openrouter_base_url;
      const openrouter = createOpenRouter({
        apiKey: openrouterApiKey,
        baseURL: openrouterBaseUrl ? openrouterBaseUrl : undefined,
      });

      result = streamText({
        model: openrouter.chat(model),
        messages: convertToModelMessages(validatedMessages),
      });
    }

    // send sources and reasoning back to the client
    return result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: Boolean(reasoning),
      originalMessages: validatedMessages,
      generateMessageId: createIdGenerator({
        size: 16,
      }),
      onFinish: async ({ messages }) => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'assistant') {
          const assistantMessage: NewChatMessage = {
            id: generateId().toLowerCase(),
            chatId,
            userId: user?.id,
            status: ChatMessageStatus.CREATED,
            createdAt: currentTime,
            updatedAt: currentTime,
            model: model,
            provider: provider,
            parts: JSON.stringify(lastMessage.parts),
            role: 'assistant',
          };
          await createChatMessage(assistantMessage);
        }
      },
    });
  } catch (e: any) {
    console.log('chat failed:', e);
    return new Response(e.message, { status: 500 });
  }
}
