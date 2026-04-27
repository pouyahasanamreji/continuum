import { z } from 'zod';

export const deleteProjectDto = z.object({ path: z.string() });
export type DeleteProjectDto = z.infer<typeof deleteProjectDto>;
