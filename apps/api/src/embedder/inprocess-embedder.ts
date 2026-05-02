import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { createRequire } from 'node:module';
import { EmbedderError } from './embedder.error';
import {
  DEFAULT_EMBEDDER_DIM,
  INPROCESS_EMBEDDER_MODEL_ID,
} from './embedder-profile';

export { INPROCESS_EMBEDDER_MODEL_ID };

const requireForTransformers = createRequire(__filename);
type TransformersModule = typeof import('@huggingface/transformers');

type FeatureExtractionPipeline = (
  text: string,
  opts: { pooling: 'cls' | 'mean'; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

@Injectable()
export class InprocessEmbedderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InprocessEmbedderService.name);
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  onApplicationBootstrap(): void {
    void this.warm().catch((err) => {
      this.logger.warn(
        `inprocess embedder warm failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  async warm(): Promise<void> {
    await this.getPipeline();
  }

  async embed(text: string): Promise<number[]> {
    const pipe = await this.getPipeline();
    let out: { data: ArrayLike<number> };
    try {
      out = await pipe(text, { pooling: 'cls', normalize: true });
    } catch (err) {
      throw new EmbedderError(
        'inprocess_inference_failed',
        err instanceof Error ? err.message : String(err),
      );
    }
    const vec = Array.from(out.data);
    if (vec.length !== DEFAULT_EMBEDDER_DIM) {
      throw new EmbedderError(
        'inprocess_inference_failed',
        `got ${vec.length} expected ${DEFAULT_EMBEDDER_DIM}`,
      );
    }
    return vec;
  }

  private getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = this.loadPipeline().catch((err) => {
        this.pipelinePromise = null;
        throw err;
      });
    }
    return this.pipelinePromise;
  }

  private async loadPipeline(): Promise<FeatureExtractionPipeline> {
    try {
      const mod = requireForTransformers(
        '@huggingface/transformers',
      ) as TransformersModule;
      const cacheDir = process.env.TRANSFORMERS_CACHE;
      if (cacheDir) {
        (mod.env as { cacheDir: string }).cacheDir = cacheDir.endsWith('/')
          ? cacheDir
          : `${cacheDir}/`;
      }
      const pipe = (await mod.pipeline(
        'feature-extraction',
        INPROCESS_EMBEDDER_MODEL_ID,
        { dtype: 'q8' },
      )) as unknown as FeatureExtractionPipeline;
      this.logger.log(
        `inprocess embedder loaded: ${INPROCESS_EMBEDDER_MODEL_ID}`,
      );
      return pipe;
    } catch (err) {
      throw new EmbedderError(
        'inprocess_load_failed',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
