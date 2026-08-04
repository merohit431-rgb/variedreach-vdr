// The documented dev placeholders from .env.example and the hardcoded
// fallbacks in app.config.ts / jwt.config.ts — if any of these are still in
// effect when NODE_ENV=production, refuse to boot rather than silently serve
// traffic signed with a secret that's sitting in a public repo.
const KNOWN_PLACEHOLDERS = new Set([
  'dev-cookie-secret-change-in-production',
  'dev-access-secret-change-in-production-min-32-chars',
  'dev-access-secret-change-in-production-32-chars',
]);

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const failures: string[] = [];

  for (const key of ['JWT_ACCESS_SECRET', 'COOKIE_SECRET']) {
    const value = process.env[key];
    if (!value) {
      failures.push(`${key} is not set`);
    } else if (KNOWN_PLACEHOLDERS.has(value)) {
      failures.push(`${key} is still set to its development placeholder value`);
    } else if (value.length < 32) {
      failures.push(`${key} must be at least 32 characters`);
    }
  }

  if (process.env.SEED_ADMIN_PASSWORD === 'ChangeMe123!') {
    failures.push('SEED_ADMIN_PASSWORD is still the documented default — change it before seeding production data');
  }

  // payment.config.ts falls back to the mock, always-approve payment provider
  // whenever PAYMENT_PROVIDER isn't set to exactly 'razorpay' — so an unset
  // or misconfigured value here would silently start production accepting
  // fabricated payment confirmations for real checkouts, not just failing to
  // charge. Same class of risk as the secrets above; same fail-fast response.
  if (process.env.PAYMENT_PROVIDER !== 'razorpay') {
    failures.push(
      `PAYMENT_PROVIDER must be set to "razorpay" in production (currently: ${process.env.PAYMENT_PROVIDER ? `"${process.env.PAYMENT_PROVIDER}"` : 'not set'} — this silently falls back to the mock, always-approve payment provider)`,
    );
  } else {
    for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) {
      if (!process.env[key]) {
        failures.push(`${key} is not set (required when PAYMENT_PROVIDER=razorpay)`);
      }
    }
  }

  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      'Refusing to start: NODE_ENV=production with insecure configuration:\n' +
        failures.map((failure) => `  - ${failure}`).join('\n'),
    );
    process.exit(1);
  }
}
