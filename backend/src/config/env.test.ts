import { describe, expect, it } from 'vitest';
import { productionStorageError } from './env.js';

const s3Configured = {
  NODE_ENV: 'production',
  STORAGE_DRIVER: 's3',
  AWS_REGION: 'ap-south-1',
  AWS_S3_BUCKET: 'pananexus-reports',
  AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
  AWS_SECRET_ACCESS_KEY: 'super-secret-value',
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
      AWS_REGION: 'ap-south-1',
      AWS_S3_BUCKET: 'pananexus-reports',
    });
    expect(reason).toContain('AWS_ACCESS_KEY_ID');
    expect(reason).toContain('AWS_SECRET_ACCESS_KEY');
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
