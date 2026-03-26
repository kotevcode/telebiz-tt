import type {
  AgentConfig,
  AgentMessage,
  MessageAnnotation,
  OpenRouterModel,
  ReasoningDetail,
  SearchAnnotation,
  StreamCallback,
  ToolCall,
  ToolDefinition,
} from '../../agent/types';

import { logDebugMessage } from '../../../util/debugConsole';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: 'anthropic/claude-sonnet-4',
  temperature: 0.7,
  maxTokens: 4096,
};

// Timeout for streaming (30 seconds without any data)
const STREAM_TIMEOUT_MS = 30000;

/**
 * Build plugins configuration from agent config
 * OpenRouter expects plugins as an array: [{ id: 'web', max_results: N }]
 */
function buildPluginsConfig(config: Partial<AgentConfig>): Array<Record<string, unknown>> | undefined {
  if (!config.plugins?.web) return undefined;

  const webPlugin: Record<string, unknown> = { id: 'web' };

  // Pass engine mode (e.g. "native") so the provider controls when to search
  const engine = config.plugins.web;
  if (engine !== 'auto') {
    webPlugin.engine = engine;
  }

  if (config.webSearchOptions?.num_results !== undefined) {
    webPlugin.max_results = config.webSearchOptions.num_results;
  }

  return [webPlugin];
}

/**
 * Build web search options from agent config
 * Only includes search_context_size (max_results is in the plugin object)
 */
function buildWebSearchOptions(config: Partial<AgentConfig>): Record<string, unknown> | undefined {
  if (!config.webSearchOptions?.search_context_size) return undefined;

  return { search_context_size: config.webSearchOptions.search_context_size };
}

/**
 * Parse search annotations from OpenRouter response
 */
function parseSearchAnnotations(annotations?: Array<{
  type: string;
  // Flat format (legacy)
  text?: string;
  url?: string;
  title?: string;
  favicon?: string;
  // OpenAI url_citation format (current)
  url_citation?: {
    url?: string;
    title?: string;
    content?: string;
    start_index?: number;
    end_index?: number;
  };
}>): SearchAnnotation[] | undefined {
  if (!annotations || !Array.isArray(annotations)) return undefined;

  const searchResults = annotations
    .map((ann) => {
      // OpenAI url_citation format (used by OpenRouter)
      if (ann.type === 'url_citation' && ann.url_citation) {
        return {
          type: 'search_result' as const,
          text: ann.url_citation.content || ann.url_citation.title || '',
          url: ann.url_citation.url || '',
          title: ann.url_citation.title || 'Untitled',
          favicon: undefined as string | undefined,
        };
      }
      // Flat format fallback
      if (ann.type === 'search_result') {
        return {
          type: 'search_result' as const,
          text: ann.text || '',
          url: ann.url || '',
          title: ann.title || 'Untitled',
          favicon: ann.favicon,
        };
      }
      return undefined;
    })
    .filter((result): result is SearchAnnotation => Boolean(result?.url));

  return searchResults.length > 0 ? searchResults : undefined;
}

/**
 * Telebiz Agent API Client
 * Handles direct OpenRouter API calls from the client
 * All interactions are client-side only - no Telebiz backend involvement
 */
export interface OpenRouterBalance {
  credits: number;
  usage: number;
}

export class AgentApiClient {
  private cachedModels?: OpenRouterModel[];

  /**
   * Get OpenRouter account balance/credits
   */
  async getBalance(accessToken: string): Promise<OpenRouterBalance> {
    const response = await fetch(`${OPENROUTER_API_URL}/credits`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch balance from OpenRouter');
    }

    const data = await response.json();
    return {
      credits: data.data?.total_credits || 0,
      usage: data.data?.total_usage || 0,
    };
  }

  /**
   * Get available OpenRouter models
   * Called directly from client using the OAuth token
   */
  async getModels(accessToken: string): Promise<OpenRouterModel[]> {
    if (this.cachedModels) {
      return this.cachedModels;
    }

    const response = await fetch(`${OPENROUTER_API_URL}/models`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models from OpenRouter');
    }

    const data = await response.json();
    this.cachedModels = data.data.map((model: {
      id: string;
      name: string;
      description?: string;
      context_length: number;
      pricing: { prompt: string; completion: string };
    }) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      contextLength: model.context_length,
      pricing: {
        prompt: parseFloat(model.pricing.prompt),
        completion: parseFloat(model.pricing.completion),
      },
    }));

    return this.cachedModels!;
  }

  /**
   * Send chat completion request to OpenRouter with streaming
   * Uses OAuth token from the OpenRouter integration
   */
  async streamChat(
    accessToken: string,
    messages: AgentMessage[],
    tools: ToolDefinition[],
    config: Partial<AgentConfig> = {},
    onStream: StreamCallback,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const mergedConfig = { ...DEFAULT_AGENT_CONFIG, ...config };

    // Check if using a Gemini model (requires reasoning token preservation)
    const isGeminiModel = mergedConfig.model?.includes('gemini');

    const openRouterMessages = messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: msg.toolCallId,
          content: msg.content,
        };
      }

      if (msg.role === 'assistant') {
        const assistantMsg: Record<string, unknown> = {
          role: 'assistant' as const,
          content: msg.content || '',
        };

        // Include reasoning for Gemini models
        if (msg.reasoning) {
          assistantMsg.reasoning = msg.reasoning;
        }

        // Include reasoning_details (thought signatures) for Gemini models
        if (msg.reasoningDetails?.length) {
          assistantMsg.reasoning_details = msg.reasoningDetails;
        }

        if (msg.toolCalls?.length) {
          assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          }));
        }

        return assistantMsg;
      }

      return {
        role: msg.role,
        content: msg.content,
      };
    });

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: mergedConfig.model,
      messages: openRouterMessages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      temperature: mergedConfig.temperature,
      max_tokens: mergedConfig.maxTokens,
      stream: true,
    };

    // Add plugins configuration if web search is enabled
    const plugins = buildPluginsConfig(mergedConfig);
    if (plugins) {
      requestBody.plugins = plugins;
      logDebugMessage('info', 'OpenRouter web search enabled:', plugins);
    }

    // Add web search options if specified
    const webSearchOptions = buildWebSearchOptions(mergedConfig);
    if (webSearchOptions) {
      requestBody.web_search_options = webSearchOptions;
      logDebugMessage('info', 'OpenRouter web search options:', webSearchOptions);
    }

    // For Gemini models, include reasoning in the response
    if (isGeminiModel) {
      requestBody.include = ['reasoning'];
    }

    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Telebiz Agent',
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenRouter error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const toolCalls = new Map<number, Partial<ToolCall>>();
    let lastActivityTime = Date.now();

    // Helper to read with timeout
    const readWithTimeout = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
      return Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          const checkTimeout = () => {
            if (Date.now() - lastActivityTime > STREAM_TIMEOUT_MS) {
              reject(new Error('Stream timeout: No data received for 30 seconds'));
            }
          };
          setTimeout(checkTimeout, STREAM_TIMEOUT_MS);
        }),
      ]);
    };

    try {
      while (true) {
        const { done, value } = await readWithTimeout();
        if (done) break;

        lastActivityTime = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') {
            // Emit final accumulated tool calls before signaling done
            if (toolCalls.size > 0) {
              for (const tc of toolCalls.values()) {
                onStream({ type: 'tool_call', toolCall: tc });
              }
            }
            onStream({ type: 'done' });
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;

            if (!delta) continue;

            if (delta.content) {
              onStream({ type: 'content', content: delta.content });
            }

            // Capture reasoning for Gemini models
            if (delta.reasoning) {
              // Extract the step title from reasoning text (format: **Title**)
              const titleMatch = delta.reasoning.match(/^\*\*(.+?)\*\*/);
              const thinkingTitle = titleMatch ? titleMatch[1] : undefined;

              onStream({
                type: 'reasoning',
                reasoning: delta.reasoning,
                thinkingTitle,
              });
            }

            // Capture reasoning_details (thought signatures) for Gemini models
            if (delta.reasoning_details?.length) {
              onStream({
                type: 'reasoning',
                reasoningDetails: delta.reasoning_details as ReasoningDetail[],
              });
            }

            // Parse search annotations — can be at top level, delta, or message
            const annotations = parsed.annotations || delta.annotations || choice?.message?.annotations;
            if (annotations) {
              const searchResults = parseSearchAnnotations(annotations);
              if (searchResults && searchResults.length > 0) {
                logDebugMessage('info', `OpenRouter returned ${searchResults.length} search results`);
                onStream({
                  type: 'annotations',
                  annotations: { searchResults },
                });
              }
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCalls.get(tc.index) || {
                  id: tc.id,
                  type: 'function' as const,
                  function: { name: '', arguments: '' },
                };

                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) {
                  existing.function!.name = tc.function.name;
                }
                if (tc.function?.arguments) {
                  // Simply append - we'll validate at the end
                  existing.function!.arguments += tc.function.arguments;
                }

                toolCalls.set(tc.index, existing);
                // Don't emit intermediate tool calls - only emit final ones after streaming ends
              }
            }
          } catch (parseError) {
            logDebugMessage('warn', 'Failed to parse SSE data:', parseError);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Final tool calls
    if (toolCalls.size > 0) {
      for (const tc of toolCalls.values()) {
        onStream({ type: 'tool_call', toolCall: tc });
      }
    }

    onStream({ type: 'done' });
  }

  /**
   * Non-streaming chat completion (for simpler use cases)
   */
  async chat(
    accessToken: string,
    messages: AgentMessage[],
    tools: ToolDefinition[],
    config: Partial<AgentConfig> = {},
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    let content = '';
    const toolCalls: ToolCall[] = [];

    await this.streamChat(accessToken, messages, tools, config, (delta) => {
      if (delta.type === 'content' && delta.content) {
        content += delta.content;
      }
      if (delta.type === 'tool_call' && delta.toolCall?.id && delta.toolCall.function?.name) {
        const existing = toolCalls.find((tc) => tc.id === delta.toolCall!.id);
        if (!existing) {
          toolCalls.push(delta.toolCall as ToolCall);
        }
      }
    });

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  /**
   * Clear cached data
   */
  clearCache(): void {
    this.cachedModels = undefined;
  }
}
