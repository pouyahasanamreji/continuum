import { z } from 'zod';

export const updateAgentDto = z.object({
  project: z.string(),
  slug: z.string(),
  status: z.enum(['active', 'merged', 'abandoned']).optional(),
  reservedPaths: z.array(z.string()).optional(),
  postMergeNotes: z.string().optional(),
  mergedCommit: z.string().optional(),
  abandonedReason: z.string().optional(),
});
export type UpdateAgentDto = z.infer<typeof updateAgentDto>;
