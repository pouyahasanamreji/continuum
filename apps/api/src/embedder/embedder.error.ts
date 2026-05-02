export class EmbedderError extends Error {
  constructor(
    public readonly reason:
      | 'upstream_rejected'
      | 'upstream_failed'
      | 'bad_response_shape'
      | 'dimension_mismatch'
      | 'inprocess_load_failed'
      | 'inprocess_inference_failed',
    public readonly detail?: string,
  ) {
    super(`embedder: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'EmbedderError';
  }
}
