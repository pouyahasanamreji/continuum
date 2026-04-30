export class EmbedderError extends Error {
  constructor(
    public readonly reason:
      | 'url_missing'
      | 'upstream_rejected'
      | 'upstream_failed'
      | 'bad_response_shape'
      | 'dimension_mismatch',
    public readonly detail?: string,
  ) {
    super(`embedder: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'EmbedderError';
  }
}
