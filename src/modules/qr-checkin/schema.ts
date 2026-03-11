import { z } from 'zod';
import { LAT_MIN, LAT_MAX, LNG_MIN, LNG_MAX } from '../../shared/config';

export const qrCheckInBodySchema = z.object({
  lat: z.number().min(LAT_MIN).max(LAT_MAX),
  lng: z.number().min(LNG_MIN).max(LNG_MAX),
});
