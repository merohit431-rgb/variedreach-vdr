import { registerAs } from '@nestjs/config';

// 100 ("full") isn't separately configurable -- it's definitionally "at or
// over the room's storage limit," there's no meaningful value to tune.
export default registerAs('storage', () => ({
  warningPercent: parseInt(process.env.STORAGE_WARNING_PERCENT || '80', 10),
  criticalPercent: parseInt(process.env.STORAGE_CRITICAL_PERCENT || '95', 10),
}));
