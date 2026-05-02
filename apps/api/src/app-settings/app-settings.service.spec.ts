import { AppSettingsService } from './app-settings.service';
import { AppSettingsRepository } from './infrastructure/persistence/app-settings.repository';
import {
  SETTING_ANTHROPIC_API_KEY,
  SETTING_ANTHROPIC_TOKENIZER_MODEL,
  SETTING_EMBEDDER_DIM,
  SETTING_EMBEDDER_MODEL,
  SETTING_EMBEDDER_URL,
} from './app-settings.keys';
import { DEFAULT_EMBEDDER_MODEL } from '../embedder/embedder-profile';

describe('AppSettingsService', () => {
  let getValue: jest.Mock;
  let setValue: jest.Mock;
  let deleteValue: jest.Mock;
  let applyPatch: jest.Mock;
  let service: AppSettingsService;
  let savedKey: string | undefined;
  let savedModel: string | undefined;
  let savedEmbedder: string | undefined;
  let savedEmbedderModel: string | undefined;
  let savedEmbedderDim: string | undefined;

  beforeEach(() => {
    getValue = jest.fn();
    setValue = jest.fn();
    deleteValue = jest.fn();
    applyPatch = jest.fn();
    const repo: AppSettingsRepository = {
      getValue,
      setValue,
      deleteValue,
      applyPatch,
    };
    service = new AppSettingsService(repo);
    savedKey = process.env.ANTHROPIC_API_KEY;
    savedModel = process.env.ANTHROPIC_TOKENIZER_MODEL;
    savedEmbedder = process.env.EMBEDDER_URL;
    savedEmbedderModel = process.env.EMBEDDER_MODEL;
    savedEmbedderDim = process.env.EMBEDDER_DIM;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_TOKENIZER_MODEL;
    delete process.env.EMBEDDER_URL;
    delete process.env.EMBEDDER_MODEL;
    delete process.env.EMBEDDER_DIM;
  });

  afterEach(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
    if (savedModel === undefined) delete process.env.ANTHROPIC_TOKENIZER_MODEL;
    else process.env.ANTHROPIC_TOKENIZER_MODEL = savedModel;
    if (savedEmbedder === undefined) delete process.env.EMBEDDER_URL;
    else process.env.EMBEDDER_URL = savedEmbedder;
    if (savedEmbedderModel === undefined) delete process.env.EMBEDDER_MODEL;
    else process.env.EMBEDDER_MODEL = savedEmbedderModel;
    if (savedEmbedderDim === undefined) delete process.env.EMBEDDER_DIM;
    else process.env.EMBEDDER_DIM = savedEmbedderDim;
  });

  it('applyPanelPatch maps camelCase to env-var keys', () => {
    service.applyPanelPatch({
      anthropicApiKey: 'sk-test',
      anthropicTokenizerModel: 'claude-haiku-4-5',
    });
    expect(applyPatch).toHaveBeenCalledWith(
      {
        [SETTING_ANTHROPIC_API_KEY]: 'sk-test',
        [SETTING_ANTHROPIC_TOKENIZER_MODEL]: 'claude-haiku-4-5',
      },
      expect.any(Number),
    );
  });

  it('applyPanelPatch maps embedderUrl to EMBEDDER_URL', () => {
    service.applyPanelPatch({
      embedderUrl: 'http://localhost:11434/api/embed',
    });
    expect(applyPatch).toHaveBeenCalledWith(
      { [SETTING_EMBEDDER_URL]: 'http://localhost:11434/api/embed' },
      expect.any(Number),
    );
  });

  it('applyPanelPatch maps embedderModel to EMBEDDER_MODEL', () => {
    service.applyPanelPatch({ embedderModel: 'mxbai-embed-large' });
    expect(applyPatch).toHaveBeenCalledWith(
      { [SETTING_EMBEDDER_MODEL]: 'mxbai-embed-large' },
      expect.any(Number),
    );
  });

  it('applyPanelPatch stringifies embedderDim before storage', () => {
    service.applyPanelPatch({ embedderDim: 512 });
    expect(applyPatch).toHaveBeenCalledWith(
      { [SETTING_EMBEDDER_DIM]: '512' },
      expect.any(Number),
    );
  });

  it('applyPanelPatch passes empty string through (clear)', () => {
    service.applyPanelPatch({ anthropicApiKey: '' });
    expect(applyPatch).toHaveBeenCalledWith(
      { [SETTING_ANTHROPIC_API_KEY]: '' },
      expect.any(Number),
    );
  });

  it('resolve precedence: DB > env > null', () => {
    getValue.mockReturnValueOnce('db-val');
    expect(service.resolve(SETTING_ANTHROPIC_API_KEY)).toBe('db-val');

    getValue.mockReturnValueOnce(null);
    process.env.ANTHROPIC_API_KEY = 'env-val';
    expect(service.resolve(SETTING_ANTHROPIC_API_KEY)).toBe('env-val');

    getValue.mockReturnValueOnce(null);
    delete process.env.ANTHROPIC_API_KEY;
    expect(service.resolve(SETTING_ANTHROPIC_API_KEY)).toBeNull();
  });

  it('resolve treats empty-string DB value as null and falls through to env', () => {
    getValue.mockReturnValueOnce('');
    process.env.ANTHROPIC_API_KEY = 'env-val';
    expect(service.resolve(SETTING_ANTHROPIC_API_KEY)).toBe('env-val');
  });

  it('readAllForPanel reports effective sources', () => {
    getValue.mockImplementation((k: string) =>
      k === SETTING_ANTHROPIC_API_KEY ? 'sk-db' : null,
    );
    process.env.ANTHROPIC_TOKENIZER_MODEL = 'claude-haiku-4-5';
    let result = service.readAllForPanel();
    expect(result.effective).toEqual({
      anthropicApiKey: 'db',
      anthropicTokenizerModel: 'env',
      embedderUrl: 'unset',
      embedderModel: 'default',
      embedderDim: 'default',
    });
    expect(result.anthropicApiKey).toBe('sk-db');
    expect(result.anthropicTokenizerModel).toBeNull();
    expect(result.embedderUrl).toBeNull();
    expect(result.embedderModel).toBeNull();
    expect(result.embedderDim).toBeNull();

    getValue.mockReturnValue(null);
    delete process.env.ANTHROPIC_TOKENIZER_MODEL;
    result = service.readAllForPanel();
    expect(result.effective).toEqual({
      anthropicApiKey: 'unset',
      anthropicTokenizerModel: 'default',
      embedderUrl: 'unset',
      embedderModel: 'default',
      embedderDim: 'default',
    });
  });

  it('readAllForPanel reports embedderUrl effective: db / env / unset', () => {
    getValue.mockImplementation((k: string) =>
      k === SETTING_EMBEDDER_URL ? 'http://db' : null,
    );
    expect(service.readAllForPanel().effective.embedderUrl).toBe('db');
    expect(service.readAllForPanel().embedderUrl).toBe('http://db');

    getValue.mockReturnValue(null);
    process.env.EMBEDDER_URL = 'http://env';
    expect(service.readAllForPanel().effective.embedderUrl).toBe('env');
    expect(service.readAllForPanel().embedderUrl).toBeNull();

    delete process.env.EMBEDDER_URL;
    expect(service.readAllForPanel().effective.embedderUrl).toBe('unset');
  });

  it('readAllForPanel reports embedderModel effective: db / env / default with DB > env precedence', () => {
    getValue.mockImplementation((k: string) =>
      k === SETTING_EMBEDDER_MODEL ? 'db-model' : null,
    );
    process.env.EMBEDDER_MODEL = 'env-model';
    let result = service.readAllForPanel();
    expect(result.effective.embedderModel).toBe('db');
    expect(result.embedderModel).toBe('db-model');

    getValue.mockReturnValue(null);
    result = service.readAllForPanel();
    expect(result.effective.embedderModel).toBe('env');
    expect(result.embedderModel).toBeNull();

    delete process.env.EMBEDDER_MODEL;
    result = service.readAllForPanel();
    expect(result.effective.embedderModel).toBe('default');
  });

  it('readAllForPanel parses embedderDim integer; null on NaN/empty', () => {
    getValue.mockImplementation((k: string) =>
      k === SETTING_EMBEDDER_DIM ? '512' : null,
    );
    expect(service.readAllForPanel().embedderDim).toBe(512);

    getValue.mockImplementation((k: string) =>
      k === SETTING_EMBEDDER_DIM ? 'not-a-number' : null,
    );
    expect(service.readAllForPanel().embedderDim).toBeNull();

    getValue.mockImplementation((k: string) =>
      k === SETTING_EMBEDDER_DIM ? '' : null,
    );
    expect(service.readAllForPanel().embedderDim).toBeNull();
  });

  it('readAllForPanel embedderDim DB > env > default precedence', () => {
    getValue.mockImplementation((k: string) =>
      k === SETTING_EMBEDDER_DIM ? '256' : null,
    );
    process.env.EMBEDDER_DIM = '1024';
    let result = service.readAllForPanel();
    expect(result.effective.embedderDim).toBe('db');
    expect(result.embedderDim).toBe(256);

    getValue.mockReturnValue(null);
    result = service.readAllForPanel();
    expect(result.effective.embedderDim).toBe('env');
    expect(result.embedderDim).toBe(1024);

    delete process.env.EMBEDDER_DIM;
    result = service.readAllForPanel();
    expect(result.effective.embedderDim).toBe('default');
    expect(result.embedderDim).toBeNull();
  });

  it('resolveEmbedderProfile resolves DB > env > defaults', () => {
    getValue.mockImplementation((k: string) => {
      if (k === SETTING_EMBEDDER_URL) return 'http://db/v1/embeddings';
      if (k === SETTING_EMBEDDER_MODEL) return 'db-model';
      if (k === SETTING_EMBEDDER_DIM) return '512';
      return null;
    });
    process.env.EMBEDDER_URL = 'http://env/v1/embeddings';
    process.env.EMBEDDER_MODEL = 'env-model';
    process.env.EMBEDDER_DIM = '1024';

    expect(service.resolveEmbedderProfile()).toMatchObject({
      url: 'http://db/v1/embeddings',
      model: 'db-model',
      dim: 512,
      configured: true,
    });
  });

  it('resolveEmbedderProfile treats empty DB values as env/default fallback', () => {
    getValue.mockImplementation((k: string) => {
      if (
        k === SETTING_EMBEDDER_URL ||
        k === SETTING_EMBEDDER_MODEL ||
        k === SETTING_EMBEDDER_DIM
      )
        return '';
      return null;
    });
    process.env.EMBEDDER_URL = 'http://env/v1/embeddings';

    expect(service.resolveEmbedderProfile()).toMatchObject({
      url: 'http://env/v1/embeddings',
      model: DEFAULT_EMBEDDER_MODEL,
      dim: 768,
      configured: true,
    });
  });

  it('resolveEmbedderProfile falls back to 768 for invalid dim', () => {
    getValue.mockImplementation((k: string) => {
      if (k === SETTING_EMBEDDER_URL) return 'http://db/v1/embeddings';
      if (k === SETTING_EMBEDDER_DIM) return 'not-a-number';
      return null;
    });

    expect(service.resolveEmbedderProfile()).toMatchObject({
      dim: 768,
      configured: true,
    });
  });

  it('resolveEmbedderProfile changes signature when same-dim model changes', () => {
    getValue.mockImplementation((k: string) => {
      if (k === SETTING_EMBEDDER_URL) return 'http://db/v1/embeddings';
      if (k === SETTING_EMBEDDER_MODEL) return 'model-a';
      if (k === SETTING_EMBEDDER_DIM) return '768';
      return null;
    });
    const first = service.resolveEmbedderProfile().signature;
    getValue.mockImplementation((k: string) => {
      if (k === SETTING_EMBEDDER_URL) return 'http://db/v1/embeddings';
      if (k === SETTING_EMBEDDER_MODEL) return 'model-b';
      if (k === SETTING_EMBEDDER_DIM) return '768';
      return null;
    });

    expect(service.resolveEmbedderProfile().signature).not.toBe(first);
  });

  it('resolveEmbedderProfile changes signature when URL changes', () => {
    getValue.mockImplementation((k: string) => {
      if (k === SETTING_EMBEDDER_URL) return 'http://db-a/v1/embeddings';
      if (k === SETTING_EMBEDDER_MODEL) return 'model-a';
      return null;
    });
    const first = service.resolveEmbedderProfile().signature;
    getValue.mockImplementation((k: string) => {
      if (k === SETTING_EMBEDDER_URL) return 'http://db-b/v1/embeddings';
      if (k === SETTING_EMBEDDER_MODEL) return 'model-a';
      return null;
    });

    expect(service.resolveEmbedderProfile().signature).not.toBe(first);
  });

  it('resolveEmbedderProfile reports no URL as unconfigured with null signature', () => {
    getValue.mockReturnValue(null);

    expect(service.resolveEmbedderProfile()).toEqual({
      url: null,
      model: DEFAULT_EMBEDDER_MODEL,
      dim: 768,
      configured: false,
      signature: null,
    });
  });
});
