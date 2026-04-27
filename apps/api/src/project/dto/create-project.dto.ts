import { z } from 'zod';

export const createProjectDto = z.object({
  path: z.string(),
  name: z.string().optional(),
});
export type CreateProjectDto = z.infer<typeof createProjectDto>;
