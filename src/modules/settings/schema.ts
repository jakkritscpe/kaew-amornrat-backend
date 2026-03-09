import { z } from 'zod';

export const updateSettingsSchema = z.object({
  defaultOtRateType: z.enum(['multiplier', 'fixed']).optional(),
  defaultOtRateValue: z.number().positive().optional(),
});
