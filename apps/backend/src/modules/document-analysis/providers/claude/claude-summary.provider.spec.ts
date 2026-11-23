import { ClaudeSummaryProvider } from './claude-summary.provider';
import {
  ClaudeAuthError,
  ClaudeInvalidResponseError,
  ClaudeRateLimitedError,
  ClaudeTimeoutError,
  ClaudeTransientError,
} from './claude-summary.interface';
import type { ConfigService } from '@nestjs/config';
import type { ChunkSentenceInput } from '../../chunking/page-chunk.builder';

const mockCreate = jest.fn();

// Preserves every REAL named export (including the real RateLimitError/
// AuthenticationError/etc. classes) while replacing only the default-
// exported Anthropic constructor with a mock -- so this spec's `instanceof`
// assertions and the provider's own `instanceof Anthropic.RateLimitError`
// checks resolve against the exact same real class, not a fake stand-in.
jest.mock('@anthropic-ai/sdk', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk');
  const MockAnthropic = jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } }));
  Object.assign(MockAnthropic, actual);
  return { __esModule: true, default: MockAnthropic };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Anthropic = require('@anthropic-ai/sdk').default;

const CONFIG = {
  'claude.apiEnabled': true,
  'claude.apiKey': 'sk-ant-test',
  'claude.summaryModel': 'claude-sonnet-5-5',
  'claude.maxTokens': 4096,
  'claude.maxRetries': 2,
  'claude.requestTimeoutMs': 60000,
};

function buildProvider(overrides: Partial<typeof CONFIG> = {}) {
  const config = { ...CONFIG, ...overrides };
  const configService = { get: jest.fn((key: string) => config[key as keyof typeof config]) } as unknown as ConfigService;
  return new ClaudeSummaryProvider(configService);
}

const SENTENCES: ChunkSentenceInput[] = [
  { sentenceId: 's1', pageNumber: 1, sequenceNumber: 0, text: 'The applicant filed for liquidation.', extractionMethod: 'NATIVE_TEXT' },
];
const CONTEXT = { documentAnalysisId: 'analysis-1', chunkIndex: 0, totalChunks: 1 };

function validResponse(overrides: Partial<{ statements: unknown[]; model: string; stop_reason: string }> = {}) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ statements: overrides.statements ?? [] }) }],
    model: overrides.model ?? 'claude-sonnet-5-5',
    usage: { input_tokens: 120, output_tokens: 40 },
    stop_reason: overrides.stop_reason ?? 'end_turn',
  };
}

describe('ClaudeSummaryProvider.analyzeChunk', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    (Anthropic as jest.Mock).mockClear();
  });

  // The single most important regression guard in this whole phase: with
  // the feature disabled, the Anthropic SDK must never even be constructed,
  // let alone called.
  it('never constructs the Anthropic client or calls the API when claude.apiEnabled is false', async () => {
    const provider = buildProvider({ 'claude.apiEnabled': false });

    await expect(provider.analyzeChunk(SENTENCES, CONTEXT)).rejects.toThrow(ClaudeAuthError);

    expect(Anthropic).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns parsed statements, model used, and token usage for a valid response', async () => {
    mockCreate.mockResolvedValue(
      validResponse({
        statements: [{ sectionType: 'FINANCIAL_FIGURES', statementText: 'Claims total ₹2.4 crore.', citedSentenceIds: ['s1'] }],
      }),
    );
    const provider = buildProvider();

    const result = await provider.analyzeChunk(SENTENCES, CONTEXT);

    expect(result.statements).toEqual([
      { sectionType: 'FINANCIAL_FIGURES', statementText: 'Claims total ₹2.4 crore.', citedSentenceIds: ['s1'] },
    ]);
    expect(result.modelUsed).toBe('claude-sonnet-5-5');
    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(40);
    expect(result.stopReason).toBe('end_turn');
  });

  it('sends the request using the configured model, max_tokens, tools, and output_config.format', async () => {
    mockCreate.mockResolvedValue(validResponse());
    const provider = buildProvider();

    await provider.analyzeChunk(SENTENCES, CONTEXT);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const request = mockCreate.mock.calls[0][0];
    expect(request.model).toBe('claude-sonnet-5-5');
    expect(request.max_tokens).toBe(4096);
    expect(request.tools).toEqual([expect.objectContaining({ name: 'document_text' })]);
    expect(request.output_config).toEqual({ format: { type: 'json_schema', schema: expect.objectContaining({ type: 'object' }) } });
  });

  it('delivers sentence text only inside a JSON-encoded tool_result block, never in plain system/user text', async () => {
    mockCreate.mockResolvedValue(validResponse());
    const provider = buildProvider();

    await provider.analyzeChunk(SENTENCES, CONTEXT);

    const request = mockCreate.mock.calls[0][0];
    expect(request.system).not.toContain('The applicant filed for liquidation');
    const userTurns = request.messages.filter((m: { role: string }) => m.role === 'user');
    const toolResultTurn = userTurns.find((m: { content: Array<{ type: string }> }) =>
      m.content.some((block) => block.type === 'tool_result'),
    );
    expect(toolResultTurn).toBeDefined();
    const toolResultBlock = toolResultTurn.content.find((b: { type: string }) => b.type === 'tool_result');
    expect(typeof toolResultBlock.content).toBe('string');
    const decoded = JSON.parse(toolResultBlock.content);
    expect(decoded.sentences).toEqual([{ sentenceId: 's1', pageNumber: 1, text: 'The applicant filed for liquidation.' }]);
  });

  it('constructs the Anthropic client with the configured apiKey, maxRetries, and timeout', async () => {
    mockCreate.mockResolvedValue(validResponse());
    const provider = buildProvider({ 'claude.maxRetries': 3, 'claude.requestTimeoutMs': 15000 });

    await provider.analyzeChunk(SENTENCES, CONTEXT);

    expect(Anthropic).toHaveBeenCalledWith({ apiKey: 'sk-ant-test', maxRetries: 3, timeout: 15000 });
  });

  it('reuses the same client instance across multiple calls rather than reconstructing it', async () => {
    mockCreate.mockResolvedValue(validResponse());
    const provider = buildProvider();

    await provider.analyzeChunk(SENTENCES, CONTEXT);
    await provider.analyzeChunk(SENTENCES, CONTEXT);

    expect(Anthropic).toHaveBeenCalledTimes(1);
  });

  it('maps a RateLimitError to ClaudeRateLimitedError', async () => {
    mockCreate.mockRejectedValue(new Anthropic.RateLimitError(429, {}, 'rate limited', new Headers()));
    const provider = buildProvider();

    await expect(provider.analyzeChunk(SENTENCES, CONTEXT)).rejects.toThrow(ClaudeRateLimitedError);
  });

  it('maps an APIConnectionTimeoutError to ClaudeTimeoutError', async () => {
    mockCreate.mockRejectedValue(new Anthropic.APIConnectionTimeoutError());
    const provider = buildProvider();

    await expect(provider.analyzeChunk(SENTENCES, CONTEXT)).rejects.toThrow(ClaudeTimeoutError);
  });

  it('maps an AuthenticationError to ClaudeAuthError', async () => {
    mockCreate.mockRejectedValue(new Anthropic.AuthenticationError(401, {}, 'invalid key', new Headers()));
    const provider = buildProvider();

    await expect(provider.analyzeChunk(SENTENCES, CONTEXT)).rejects.toThrow(ClaudeAuthError);
  });

  it('maps an InternalServerError (5xx) to ClaudeTransientError', async () => {
    mockCreate.mockRejectedValue(new Anthropic.InternalServerError(500, {}, 'server error', new Headers()));
    const provider = buildProvider();

    await expect(provider.analyzeChunk(SENTENCES, CONTEXT)).rejects.toThrow(ClaudeTransientError);
  });

  it('throws ClaudeInvalidResponseError when the response has no text content block', async () => {
    mockCreate.mockResolvedValue({ content: [], model: 'claude-sonnet-5-5', usage: { input_tokens: 10, output_tokens: 0 } });
    const provider = buildProvider();

    await expect(provider.analyzeChunk(SENTENCES, CONTEXT)).rejects.toThrow(ClaudeInvalidResponseError);
  });

  it('throws ClaudeInvalidResponseError when the response text is not valid JSON', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'not json' }], model: 'claude-sonnet-5-5', usage: {} });
    const provider = buildProvider();

    await expect(provider.analyzeChunk(SENTENCES, CONTEXT)).rejects.toThrow(ClaudeInvalidResponseError);
  });

  it('throws ClaudeInvalidResponseError when the parsed JSON is schema-valid-shaped but missing statements', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ notStatements: [] }) }], model: 'claude-sonnet-5-5', usage: {} });
    const provider = buildProvider();

    await expect(provider.analyzeChunk(SENTENCES, CONTEXT)).rejects.toThrow(ClaudeInvalidResponseError);
  });

  it('handles a token-limited (max_tokens) stop reason without throwing, reporting it in the result', async () => {
    mockCreate.mockResolvedValue(validResponse({ stop_reason: 'max_tokens' }));
    const provider = buildProvider();

    const result = await provider.analyzeChunk(SENTENCES, CONTEXT);

    expect(result.stopReason).toBe('max_tokens');
  });
});
