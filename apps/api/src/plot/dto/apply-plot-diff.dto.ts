import { z } from 'zod';

export const applyPlotDiffDto = z.object({
  project: z.string(),
  diff: z.string().min(1),
});
export type ApplyPlotDiffDto = z.infer<typeof applyPlotDiffDto>;
