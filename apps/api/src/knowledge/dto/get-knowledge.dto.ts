import { z } from 'zod';

export const getKnowledgeDto = z.object({
  project: z.string(),
  section: z.string().optional(),
});
export type GetKnowledgeDto = z.infer<typeof getKnowledgeDto>;
