import { execFileSync } from 'node:child_process';
import { INPROCESS_EMBEDDER_MODEL_ID } from './inprocess-embedder';
import { DEFAULT_EMBEDDER_DIM } from './embedder-profile';

const HEAVY = process.env.RUN_HEAVY_TESTS === '1';

(HEAVY ? describe : describe.skip)('InprocessEmbedderService [HEAVY]', () => {
  jest.setTimeout(180_000);

  it('exposes the expected default model id', () => {
    expect(INPROCESS_EMBEDDER_MODEL_ID).toBe(
      'Snowflake/snowflake-arctic-embed-m-v1.5',
    );
  });

  // The model load + inference is run in a child node process to avoid the
  // jest VM Float32Array/onnxruntime incompatibility (cross-realm typed-array
  // constructor mismatch).
  it('embeds text into a 768-d vector with sane cosine similarity', () => {
    const script = `
        (async () => {
          const { pipeline } = require('@huggingface/transformers');
          const pipe = await pipeline(
            'feature-extraction',
            ${JSON.stringify(INPROCESS_EMBEDDER_MODEL_ID)},
            { dtype: 'q8' },
          );
          const a = Array.from((await pipe('hello', { pooling: 'cls', normalize: true })).data);
          const b = Array.from((await pipe('world', { pooling: 'cls', normalize: true })).data);
          let dot = 0, na = 0, nb = 0;
          for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
          const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
          process.stdout.write(JSON.stringify({ dim: a.length, sim }));
        })().catch((e) => { process.stderr.write(String(e?.stack ?? e)); process.exit(1); });
      `;
    const out = execFileSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const result = JSON.parse(out) as { dim: number; sim: number };
    expect(result.dim).toBe(DEFAULT_EMBEDDER_DIM);
    expect(result.sim).toBeGreaterThan(0);
    expect(result.sim).toBeLessThan(1);
  });
});
