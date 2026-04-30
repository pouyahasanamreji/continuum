import { EmbedderService } from './embedder.service';
import { EmbedderError } from './embedder.error';
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
  new EmbedderService(
    new StubAppSettings(store) as unknown as AppSettingsService,
  );

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

describe('EmbedderService', () => {
  let savedUrl: string | undefined;
  let savedModel: string | undefined;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    savedUrl = process.env.EMBEDDER_URL;
    savedModel = process.env.EMBEDDER_MODEL;
    delete process.env.EMBEDDER_URL;
    delete process.env.EMBEDDER_MODEL;
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    if (savedUrl === undefined) delete process.env.EMBEDDER_URL;
    else process.env.EMBEDDER_URL = savedUrl;
    if (savedModel === undefined) delete process.env.EMBEDDER_MODEL;
    else process.env.EMBEDDER_MODEL = savedModel;
    fetchSpy.mockRestore();
  });

  it('throws url_missing when DB and env both unset', async () => {
    const service = make();
    await expect(service.embed('hello')).rejects.toMatchObject({
      name: 'EmbedderError',
      reason: 'url_missing',
    });
    await expect(service.embed('hello')).rejects.toBeInstanceOf(EmbedderError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws upstream_rejected on non-2xx response', async () => {
    const service = make(new Map([['EMBEDDER_URL', 'http://x/embed']]));
    fetchSpy.mockResolvedValue(jsonResponse(500, { error: 'boom' }));
    await expect(service.embed('hello')).rejects.toMatchObject({
      name: 'EmbedderError',
      reason: 'upstream_rejected',
      detail: '500',
    });
  });

  it('throws upstream_failed on network error', async () => {
    const service = make(new Map([['EMBEDDER_URL', 'http://x/embed']]));
    fetchSpy.mockRejectedValue(new Error('econnrefused'));
    await expect(service.embed('hello')).rejects.toMatchObject({
      name: 'EmbedderError',
      reason: 'upstream_failed',
    });
  });

  it('throws bad_response_shape when embeddings missing', async () => {
    const service = make(new Map([['EMBEDDER_URL', 'http://x/embed']]));
    fetchSpy.mockResolvedValue(jsonResponse(200, {}));
    await expect(service.embed('hello')).rejects.toMatchObject({
      reason: 'bad_response_shape',
    });
  });

  it('throws bad_response_shape when embeddings empty', async () => {
    const service = make(new Map([['EMBEDDER_URL', 'http://x/embed']]));
    fetchSpy.mockResolvedValue(jsonResponse(200, { embeddings: [[]] }));
    await expect(service.embed('hello')).rejects.toMatchObject({
      reason: 'bad_response_shape',
    });
  });

  it('throws bad_response_shape when embedding values non-numeric', async () => {
    const service = make(new Map([['EMBEDDER_URL', 'http://x/embed']]));
    fetchSpy.mockResolvedValue(
      jsonResponse(200, { embeddings: [['not-a-number']] }),
    );
    await expect(service.embed('hello')).rejects.toMatchObject({
      reason: 'bad_response_shape',
    });
  });

  it('returns embedding vector on 2xx', async () => {
    const service = make(new Map([['EMBEDDER_URL', 'http://x/embed']]));
    const vec = [0.1, 0.2, 0.3];
    fetchSpy.mockResolvedValue(jsonResponse(200, { embeddings: [vec] }));
    await expect(service.embed('hello')).resolves.toEqual(vec);
  });

  it('posts model=embeddinggemma + input=text body to URL exactly', async () => {
    const service = make(new Map([['EMBEDDER_URL', 'http://x/embed']]));
    fetchSpy.mockResolvedValue(jsonResponse(200, { embeddings: [[0.1]] }));
    await service.embed('the-text');
    const calls = fetchSpy.mock.calls as Array<[FetchInput, FetchInit]>;
    expect(calls[0][0]).toBe('http://x/embed');
    const init = calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/json',
    );
    const body = JSON.parse(init.body as string) as {
      model: string;
      input: string;
    };
    expect(body).toEqual({ model: 'embeddinggemma', input: 'the-text' });
  });

  it('posts OpenAI-compatible body to /v1/embeddings URLs', async () => {
    const service = make(
      new Map([['EMBEDDER_URL', 'http://embedder:80/v1/embeddings']]),
    );
    fetchSpy.mockResolvedValue(
      jsonResponse(200, { data: [{ embedding: [0.1, 0.2] }] }),
    );
    await service.embed('the-text');
    const calls = fetchSpy.mock.calls as Array<[FetchInput, FetchInit]>;
    expect(calls[0][0]).toBe('http://embedder:80/v1/embeddings');
    const init = calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as {
      model: string;
      input: string;
      encoding_format: string;
    };
    expect(body).toEqual({
      model: 'embeddinggemma',
      input: 'the-text',
      encoding_format: 'float',
    });
  });

  it('parses OpenAI-compatible embedding response from /v1/embeddings', async () => {
    const service = make(
      new Map([['EMBEDDER_URL', 'http://embedder:80/v1/embeddings']]),
    );
    fetchSpy.mockResolvedValue(
      jsonResponse(200, { data: [{ embedding: [0.1, 0.2] }] }),
    );
    await expect(service.embed('hello')).resolves.toEqual([0.1, 0.2]);
  });

  it.each([
    ['missing data', {}],
    ['empty data', { data: [] }],
    ['missing embedding', { data: [{}] }],
    ['empty embedding', { data: [{ embedding: [] }] }],
    ['non-numeric embedding values', { data: [{ embedding: [0.1, 'x'] }] }],
  ])(
    'throws bad_response_shape for OpenAI-compatible response with %s',
    async (_label, body) => {
      const service = make(
        new Map([['EMBEDDER_URL', 'http://embedder:80/v1/embeddings']]),
      );
      fetchSpy.mockResolvedValue(jsonResponse(200, body));
      await expect(service.embed('hello')).rejects.toMatchObject({
        reason: 'bad_response_shape',
      });
    },
  );

  it('DB URL wins over env', async () => {
    process.env.EMBEDDER_URL = 'http://env';
    const service = make(new Map([['EMBEDDER_URL', 'http://db']]));
    fetchSpy.mockResolvedValue(jsonResponse(200, { embeddings: [[0.1]] }));
    await service.embed('hi');
    const calls = fetchSpy.mock.calls as Array<[FetchInput, FetchInit]>;
    expect(calls[0][0]).toBe('http://db');
  });

  it('falls back to env URL when DB empty string', async () => {
    process.env.EMBEDDER_URL = 'http://env';
    const service = make(new Map([['EMBEDDER_URL', '']]));
    fetchSpy.mockResolvedValue(jsonResponse(200, { embeddings: [[0.1]] }));
    await service.embed('hi');
    const calls = fetchSpy.mock.calls as Array<[FetchInput, FetchInit]>;
    expect(calls[0][0]).toBe('http://env');
  });

  it('DB-set EMBEDDER_MODEL overrides default', async () => {
    const service = make(
      new Map([
        ['EMBEDDER_URL', 'http://x/embed'],
        ['EMBEDDER_MODEL', 'mxbai-embed-large'],
      ]),
    );
    fetchSpy.mockResolvedValue(jsonResponse(200, { embeddings: [[0.1]] }));
    await service.embed('hi');
    const calls = fetchSpy.mock.calls as Array<[FetchInput, FetchInit]>;
    const body = JSON.parse((calls[0][1] as RequestInit).body as string) as {
      model: string;
    };
    expect(body.model).toBe('mxbai-embed-large');
  });

  it('env-set EMBEDDER_MODEL overrides default when DB unset', async () => {
    process.env.EMBEDDER_MODEL = 'env-model';
    const service = make(new Map([['EMBEDDER_URL', 'http://x/embed']]));
    fetchSpy.mockResolvedValue(jsonResponse(200, { embeddings: [[0.1]] }));
    await service.embed('hi');
    const calls = fetchSpy.mock.calls as Array<[FetchInput, FetchInit]>;
    const body = JSON.parse((calls[0][1] as RequestInit).body as string) as {
      model: string;
    };
    expect(body.model).toBe('env-model');
  });

  it('DB EMBEDDER_MODEL wins over env', async () => {
    process.env.EMBEDDER_MODEL = 'env-model';
    const service = make(
      new Map([
        ['EMBEDDER_URL', 'http://x/embed'],
        ['EMBEDDER_MODEL', 'db-model'],
      ]),
    );
    fetchSpy.mockResolvedValue(jsonResponse(200, { embeddings: [[0.1]] }));
    await service.embed('hi');
    const calls = fetchSpy.mock.calls as Array<[FetchInput, FetchInit]>;
    const body = JSON.parse((calls[0][1] as RequestInit).body as string) as {
      model: string;
    };
    expect(body.model).toBe('db-model');
  });

  it('uses DB/env model precedence for OpenAI-compatible requests', async () => {
    process.env.EMBEDDER_MODEL = 'env-model';
    const service = make(
      new Map([
        ['EMBEDDER_URL', 'http://embedder:80/v1/embeddings'],
        ['EMBEDDER_MODEL', 'google/embeddinggemma-300m'],
      ]),
    );
    fetchSpy.mockResolvedValue(
      jsonResponse(200, { data: [{ embedding: [0.1, 0.2] }] }),
    );
    await service.embed('hi');
    const calls = fetchSpy.mock.calls as Array<[FetchInput, FetchInit]>;
    const body = JSON.parse((calls[0][1] as RequestInit).body as string) as {
      model: string;
      encoding_format: string;
    };
    expect(body.model).toBe('google/embeddinggemma-300m');
    expect(body.encoding_format).toBe('float');
  });
});
