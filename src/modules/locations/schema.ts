import { z } from 'zod';
import { LAT_MIN, LAT_MAX, LNG_MIN, LNG_MAX } from '../../shared/config';

export const createLocationSchema = z.object({
  name: z.string().min(1).max(255),
  lat: z.number().min(LAT_MIN).max(LAT_MAX),
  lng: z.number().min(LNG_MIN).max(LNG_MAX),
  radiusMeters: z.number().positive().max(50000).default(200),
});

export const updateLocationSchema = createLocationSchema.partial();
