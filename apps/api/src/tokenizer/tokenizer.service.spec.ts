import { TokenizerService } from './tokenizer.service';
import { TokenizerError } from './tokenizer.error';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('TokenizerService', () => {
  let service: TokenizerService;
  let savedKey: string | undefined;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new TokenizerService();
    savedKey = process.env.ANTHROPIC_API_KEY;
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
    fetchSpy.mockRestore();
  });

  it('throws api_key_missing when ANTHROPIC_API_KEY unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(service.countTokens('hello')).rejects.toMatchObject({
      name: 'TokenizerError',
      reason: 'api_key_missing',
    });
    await expect(service.countTokens('hello')).rejects.toBeInstanceOf(
      TokenizerError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws upstream_rejected on non-2xx response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    fetchSpy.mockResolvedValue(jsonResponse(500, { error: 'boom' }));
    await expect(service.countTokens('hello')).rejects.toMatchObject({
      name: 'TokenizerError',
      reason: 'upstream_rejected',
      detail: '500',
    });
  });

  it('returns input_tokens on 2xx response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    fetchSpy.mockResolvedValue(jsonResponse(200, { input_tokens: 42 }));
    await expect(service.countTokens('hello')).resolves.toEqual({
      inputTokens: 42,
      model: 'claude-opus-4-7',
    });
  });

  it('short-circuits empty input without calling fetch', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    await expect(service.countTokens('')).resolves.toEqual({
      inputTokens: 0,
      model: 'claude-opus-4-7',
    });
    await expect(service.countTokens('   ')).resolves.toEqual({
      inputTokens: 0,
      model: 'claude-opus-4-7',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
