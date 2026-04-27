import { z } from 'zod';

export const getPlotDto = z.object({ project: z.string() });
export type GetPlotDto = z.infer<typeof getPlotDto>;
