import { validateProductionEnv } from './validate-production-env';

describe('validateProductionEnv', () => {
  const originalEnv = { ...process.env };
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('does nothing outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.COOKIE_SECRET;

    validateProductionEnv();

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits when secrets are missing in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.COOKIE_SECRET;

    validateProductionEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when secrets are still the dev placeholders', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'dev-access-secret-change-in-production-min-32-chars';
    process.env.COOKIE_SECRET = 'dev-cookie-secret-change-in-production';

    validateProductionEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when a secret is shorter than 32 characters', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'too-short';
    process.env.COOKIE_SECRET = 'a'.repeat(40);

    validateProductionEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when the seed admin password is still the documented default', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.COOKIE_SECRET = 'b'.repeat(40);
    process.env.SEED_ADMIN_PASSWORD = 'ChangeMe123!';

    validateProductionEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when PAYMENT_PROVIDER is not set to razorpay', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.COOKIE_SECRET = 'b'.repeat(40);
    delete process.env.PAYMENT_PROVIDER;

    validateProductionEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when PAYMENT_PROVIDER is explicitly "mock"', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.COOKIE_SECRET = 'b'.repeat(40);
    process.env.PAYMENT_PROVIDER = 'mock';

    validateProductionEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when razorpay is selected but its credentials are missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.COOKIE_SECRET = 'b'.repeat(40);
    process.env.PAYMENT_PROVIDER = 'razorpay';
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    validateProductionEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('passes when production secrets are real and long enough', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.COOKIE_SECRET = 'b'.repeat(40);
    process.env.SEED_ADMIN_PASSWORD = 'something-else-entirely';
    process.env.PAYMENT_PROVIDER = 'razorpay';
    process.env.RAZORPAY_KEY_ID = 'rzp_live_test';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';

    validateProductionEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  // Added during the Phase 3C.1 audit closure, after a real staging
  // incident: staging deliberately sets NODE_ENV=production (to catch real
  // misconfigurations) but must never be ABLE to hold live payment
  // credentials. APP_ENVIRONMENT=staging is the one narrow exception to the
  // PAYMENT_PROVIDER check -- every other check in this file must stay
  // exactly as strict on staging as in real production.
  describe('APP_ENVIRONMENT=staging payment exemption (Phase 3C.1)', () => {
    it('passes with a non-razorpay PAYMENT_PROVIDER when APP_ENVIRONMENT=staging', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
      process.env.COOKIE_SECRET = 'b'.repeat(40);
      process.env.APP_ENVIRONMENT = 'staging';
      process.env.PAYMENT_PROVIDER = 'mock';

      validateProductionEnv();

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('still exits for a non-razorpay PAYMENT_PROVIDER when APP_ENVIRONMENT is unset (real production is never affected)', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
      process.env.COOKIE_SECRET = 'b'.repeat(40);
      delete process.env.APP_ENVIRONMENT;
      process.env.PAYMENT_PROVIDER = 'mock';

      validateProductionEnv();

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('still requires all three Razorpay keys on staging if PAYMENT_PROVIDER=razorpay is actually chosen there', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
      process.env.COOKIE_SECRET = 'b'.repeat(40);
      process.env.APP_ENVIRONMENT = 'staging';
      process.env.PAYMENT_PROVIDER = 'razorpay';
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      validateProductionEnv();

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('REGRESSION GUARD: APP_ENVIRONMENT=staging does not weaken the JWT/COOKIE secret checks', () => {
      process.env.NODE_ENV = 'production';
      process.env.APP_ENVIRONMENT = 'staging';
      process.env.PAYMENT_PROVIDER = 'mock';
      delete process.env.JWT_ACCESS_SECRET;
      delete process.env.COOKIE_SECRET;

      validateProductionEnv();

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('passes cleanly with a realistic staging configuration end to end', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
      process.env.COOKIE_SECRET = 'b'.repeat(40);
      process.env.SEED_ADMIN_PASSWORD = 'something-else-entirely';
      process.env.APP_ENVIRONMENT = 'staging';
      process.env.PAYMENT_PROVIDER = 'mock';
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      validateProductionEnv();

      expect(exitSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  // Backfilling coverage for a pre-existing branch that had none before
  // Phase 3C touched this file -- confirmed missing during the Phase 3C
  // codebase review, not new logic.
  describe('RANKING_PROVIDER (pre-existing logic, newly tested)', () => {
    function validEnv() {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
      process.env.COOKIE_SECRET = 'b'.repeat(40);
      process.env.PAYMENT_PROVIDER = 'razorpay';
      process.env.RAZORPAY_KEY_ID = 'rzp_live_test';
      process.env.RAZORPAY_KEY_SECRET = 'test-secret';
      process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
    }

    it('passes when RANKING_PROVIDER is unset (the permanently-supported mock default)', () => {
      validEnv();
      delete process.env.RANKING_PROVIDER;
      delete process.env.RANKING_EXTERNAL_API_KEY;

      validateProductionEnv();

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('passes when RANKING_PROVIDER is explicitly "mock"', () => {
      validEnv();
      process.env.RANKING_PROVIDER = 'mock';

      validateProductionEnv();

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('exits when RANKING_PROVIDER=external but RANKING_EXTERNAL_API_KEY is missing', () => {
      validEnv();
      process.env.RANKING_PROVIDER = 'external';
      delete process.env.RANKING_EXTERNAL_API_KEY;

      validateProductionEnv();

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('passes when RANKING_PROVIDER=external and RANKING_EXTERNAL_API_KEY is set', () => {
      validEnv();
      process.env.RANKING_PROVIDER = 'external';
      process.env.RANKING_EXTERNAL_API_KEY = 'test-key';

      validateProductionEnv();

      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('CLAUDE_API_ENABLED (Phase 3C)', () => {
    function validEnv() {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
      process.env.COOKIE_SECRET = 'b'.repeat(40);
      process.env.PAYMENT_PROVIDER = 'razorpay';
      process.env.RAZORPAY_KEY_ID = 'rzp_live_test';
      process.env.RAZORPAY_KEY_SECRET = 'test-secret';
      process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
    }

    it('passes when CLAUDE_API_ENABLED is unset (the permanently-safe default)', () => {
      validEnv();
      delete process.env.CLAUDE_API_ENABLED;
      delete process.env.ANTHROPIC_API_KEY;

      validateProductionEnv();

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('passes when CLAUDE_API_ENABLED is explicitly "false"', () => {
      validEnv();
      process.env.CLAUDE_API_ENABLED = 'false';
      delete process.env.ANTHROPIC_API_KEY;

      validateProductionEnv();

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('passes when CLAUDE_API_ENABLED is a truthy-looking but non-"true" value (never silently enables)', () => {
      validEnv();
      process.env.CLAUDE_API_ENABLED = '1';
      delete process.env.ANTHROPIC_API_KEY;

      validateProductionEnv();

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('exits when CLAUDE_API_ENABLED=true but ANTHROPIC_API_KEY is missing', () => {
      validEnv();
      process.env.CLAUDE_API_ENABLED = 'true';
      delete process.env.ANTHROPIC_API_KEY;

      validateProductionEnv();

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ANTHROPIC_API_KEY is not set'));
    });

    it('passes when CLAUDE_API_ENABLED=true and ANTHROPIC_API_KEY is set', () => {
      validEnv();
      process.env.CLAUDE_API_ENABLED = 'true';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      validateProductionEnv();

      expect(exitSpy).not.toHaveBeenCalled();
    });
  });
});
