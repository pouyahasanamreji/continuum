import { AppSettingsService } from './app-settings.service';
import { AppSettingsRepository } from './infrastructure/persistence/app-settings.repository';
import {
  SETTING_ANTHROPIC_API_KEY,
  SETTING_ANTHROPIC_TOKENIZER_MODEL,
  SETTING_EMBEDDER_URL,
} from './app-settings.keys';

describe('AppSettingsService', () => {
  let getValue: jest.Mock;
  let setValue: jest.Mock;
  let deleteValue: jest.Mock;
  let applyPatch: jest.Mock;
  let service: AppSettingsService;
  let savedKey: string | undefined;
  let savedModel: string | undefined;
  let savedEmbedder: string | undefined;

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
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_TOKENIZER_MODEL;
    delete process.env.EMBEDDER_URL;
  });

  afterEach(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
    if (savedModel === undefined) delete process.env.ANTHROPIC_TOKENIZER_MODEL;
    else process.env.ANTHROPIC_TOKENIZER_MODEL = savedModel;
    if (savedEmbedder === undefined) delete process.env.EMBEDDER_URL;
    else process.env.EMBEDDER_URL = savedEmbedder;
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
    });
    expect(result.anthropicApiKey).toBe('sk-db');
    expect(result.anthropicTokenizerModel).toBeNull();
    expect(result.embedderUrl).toBeNull();

    getValue.mockReturnValue(null);
    delete process.env.ANTHROPIC_TOKENIZER_MODEL;
    result = service.readAllForPanel();
    expect(result.effective).toEqual({
      anthropicApiKey: 'unset',
      anthropicTokenizerModel: 'default',
      embedderUrl: 'unset',
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
});
