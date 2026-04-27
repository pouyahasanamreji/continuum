import { z } from 'zod';

export const renameProjectDto = z.object({
  path: z.string(),
  name: z.string(),
});
export type RenameProjectDto = z.infer<typeof renameProjectDto>;
