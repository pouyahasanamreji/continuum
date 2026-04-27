import { z } from 'zod';

export const applyKnowledgeDiffDto = z.object({
  project: z.string(),
  diff: z.string().min(1),
});
export type ApplyKnowledgeDiffDto = z.infer<typeof applyKnowledgeDiffDto>;
