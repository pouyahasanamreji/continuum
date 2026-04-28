export class TokenizerError extends Error {
  constructor(
    public readonly reason:
      | 'api_key_missing'
      | 'upstream_rejected'
      | 'upstream_failed',
    public readonly detail?: string,
  ) {
    super(`tokenizer: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'TokenizerError';
  }
}
