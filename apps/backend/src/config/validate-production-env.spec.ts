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

  it('passes when production secrets are real and long enough', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.COOKIE_SECRET = 'b'.repeat(40);
    process.env.SEED_ADMIN_PASSWORD = 'something-else-entirely';

    validateProductionEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
