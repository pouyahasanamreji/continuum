import { z } from 'zod';
import { SLUG_RE } from '../../common/slug';

export const createAgentDto = z.object({
  project: z.string(),
  slug: z.string().regex(SLUG_RE),
  branch: z.string(),
  worktree: z.string(),
  reservedPaths: z.array(z.string()).default([]),
  request: z.string(),
  plan: z.string(),
  implPrompt: z.string(),
  coordinationBrief: z.string(),
});
export type CreateAgentDto = z.infer<typeof createAgentDto>;
