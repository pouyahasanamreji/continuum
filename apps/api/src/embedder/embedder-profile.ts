import { createHash } from 'node:crypto';

export const DEFAULT_EMBEDDER_MODEL = 'Snowflake/snowflake-arctic-embed-m-v1.5';
export const DEFAULT_EMBEDDER_DIM = 768;
export const INPROCESS_EMBEDDER_MODEL_ID = DEFAULT_EMBEDDER_MODEL;

export function inprocessEmbedderUrl(
  modelId: string = INPROCESS_EMBEDDER_MODEL_ID,
): string {
  return `inprocess://${modelId}`;
}

export interface EmbedderProfile {
  url: string;
  model: string;
  dim: number;
}

export interface ResolvedEmbedderProfile {
  url: string | null;
  model: string;
  dim: number;
  configured: boolean;
  signature: string | null;
}

export interface EmbeddedVector {
  embedding: number[];
  profile: EmbedderProfile;
}

export function makeEmbedderSignature(profile: EmbedderProfile): string {
  const canonical = JSON.stringify({
    url: profile.url,
    model: profile.model,
    dim: profile.dim,
  });
  return createHash('sha256')
    .update(canonical)
    .digest('base64url')
    .slice(0, 12);
}
