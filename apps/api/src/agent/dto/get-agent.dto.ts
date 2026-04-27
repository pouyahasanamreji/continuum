import { z } from 'zod';

export const getAgentDto = z.object({
  project: z.string(),
  slug: z.string(),
});
export type GetAgentDto = z.infer<typeof getAgentDto>;
