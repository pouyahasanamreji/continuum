import { z } from 'zod';

export const getProjectDto = z.object({ path: z.string() });
export type GetProjectDto = z.infer<typeof getProjectDto>;
