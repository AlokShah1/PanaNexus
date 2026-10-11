import { describe, expect, it } from 'vitest';
import { productionStorageError } from './env.js';

const s3Configured = {
  NODE_ENV: 'production',
  STORAGE_DRIVER: 's3',
  S3_REGION: 'ap-south-1',
  S3_BUCKET: 'pananexus-reports',
  S3_ACCESS_KEY_ID: 'AKIAEXAMPLE',
  S3_SECRET_ACCESS_KEY: 'super-secret-value',
};

describe('productionStorageError', () => {
  it('rejects local disk storage in production', () => {
    const reason = productionStorageError({ NODE_ENV: 'production', STORAGE_DRIVER: 'local' });
    expect(reason).toContain('STORAGE_DRIVER must be "s3"');
  });

  it('rejects an unset storage driver in production', () => {
    expect(productionStorageError({ NODE_ENV: 'production' })).toContain('STORAGE_DRIVER must be "s3"');
  });

  it('lists missing S3 variables without leaking secret values', () => {
    const reason = productionStorageError({
      NODE_ENV: 'production',
      STORAGE_DRIVER: 's3',
      S3_REGION: 'ap-south-1',
      S3_BUCKET: 'pananexus-reports',
    });
    expect(reason).toContain('S3_ACCESS_KEY_ID');
    expect(reason).toContain('S3_SECRET_ACCESS_KEY');
    expect(reason).not.toContain('super-secret-value');
  });

  it('accepts a fully configured S3 production environment', () => {
    expect(productionStorageError(s3Configured)).toBeNull();
  });

  it('allows local disk storage outside production', () => {
    expect(productionStorageError({ NODE_ENV: 'development', STORAGE_DRIVER: 'local' })).toBeNull();
    expect(productionStorageError({ NODE_ENV: 'test', STORAGE_DRIVER: 'local' })).toBeNull();
  });
});
