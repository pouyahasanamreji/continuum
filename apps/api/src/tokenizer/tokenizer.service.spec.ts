import { TokenizerService } from './tokenizer.service';
import { TokenizerError } from './tokenizer.error';
import { AppSettingsService } from '../app-settings/app-settings.service';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

class StubAppSettings {
  constructor(private store: Map<string, string | null> = new Map()) {}
  resolve(key: string): string | null {
    const fromStore = this.store.has(key)
      ? (this.store.get(key) ?? null)
      : null;
    if (fromStore !== null && fromStore !== '') return fromStore;
    return process.env[key] ?? null;
  }
}

const make = (store?: Map<string, string | null>) =>
  new TokenizerService(
    new StubAppSettings(store) as unknown as AppSettingsService,
  );

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

describe('TokenizerService', () => {
  let savedKey: string | undefined;
  let savedModel: string | undefined;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    savedKey = process.env.ANTHROPIC_API_KEY;
    savedModel = process.env.ANTHROPIC_TOKENIZER_MODEL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_TOKENIZER_MODEL;
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
    if (savedModel === undefined) delete process.env.ANTHROPIC_TOKENIZER_MODEL;
    else process.env.ANTHROPIC_TOKENIZER_MODEL = savedModel;
    fetchSpy.mockRestore();
  });

  it('throws api_key_missing when DB and env both unset', async () => {
    const service = make();
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
    const service = make(new Map([['ANTHROPIC_API_KEY', 'sk-test']]));
    fetchSpy.mockResolvedValue(jsonResponse(500, { error: 'boom' }));
    await expect(service.countTokens('hello')).rejects.toMatchObject({
      name: 'TokenizerError',
      reason: 'upstream_rejected',
      detail: '500',
    });
  });

  it('returns input_tokens on 2xx response', async () => {
    const service = make(new Map([['ANTHROPIC_API_KEY', 'sk-test']]));
    fetchSpy.mockResolvedValue(jsonResponse(200, { input_tokens: 42 }));
    await expect(service.countTokens('hello')).resolves.toEqual({
      inputTokens: 42,
      model: 'claude-opus-4-7',
    });
  });

  it('short-circuits empty input without calling fetch', async () => {
    const service = make(new Map([['ANTHROPIC_API_KEY', 'sk-test']]));
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

  it('DB API key wins over env', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-from-env';
    const service = make(new Map([['ANTHROPIC_API_KEY', 'sk-from-db']]));
    fetchSpy.mockResolvedValue(jsonResponse(200, { input_tokens: 1 }));
    await service.countTokens('hello');
    const calls = fetchSpy.mock.calls as Array<[FetchInput, FetchInit]>;
    const init = calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(
      'sk-from-db',
    );
  });

  it('falls back to env API key when DB empty', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-from-env';
    const service = make(new Map([['ANTHROPIC_API_KEY', '']]));
    fetchSpy.mockResolvedValue(jsonResponse(200, { input_tokens: 1 }));
    await service.countTokens('hello');
    const calls = fetchSpy.mock.calls as Array<[FetchInput, FetchInit]>;
    const init = calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(
      'sk-from-env',
    );
  });

  it('uses DB model when set, env unset', async () => {
    const service = make(
      new Map([
        ['ANTHROPIC_API_KEY', 'sk-test'],
        ['ANTHROPIC_TOKENIZER_MODEL', 'claude-haiku-4-5'],
      ]),
    );
    fetchSpy.mockResolvedValue(jsonResponse(200, { input_tokens: 1 }));
    await service.countTokens('hello');
    const calls = fetchSpy.mock.calls as Array<[FetchInput, FetchInit]>;
    const init = calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as { model: string };
    expect(body.model).toBe('claude-haiku-4-5');
  });
});
