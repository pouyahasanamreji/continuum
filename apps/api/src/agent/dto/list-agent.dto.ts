import { z } from 'zod';

export const listAgentDto = z.object({ project: z.string() });
export type ListAgentDto = z.infer<typeof listAgentDto>;
