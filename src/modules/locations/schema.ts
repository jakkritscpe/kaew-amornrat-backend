import { z } from 'zod';

export const createLocationSchema = z.object({
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  radiusMeters: z.number().positive().default(200),
});

export const updateLocationSchema = createLocationSchema.partial();
