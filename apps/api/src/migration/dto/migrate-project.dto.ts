import { z } from 'zod';

export const migrateProjectDto = z.object({
  path: z.string(),
  name: z.string().optional(),
  plotContent: z.string().optional(),
  knowledgeContent: z.string().optional(),
  agents: z
    .array(z.object({ slug: z.string(), content: z.string() }))
    .max(200)
    .default([]),
});
export type MigrateProjectDto = z.infer<typeof migrateProjectDto>;
