import { describe, expect, it } from 'vitest';
import {
  interactionConfigurationChecks,
  getConfigurationProfile,
  connectionFailureReason,
  isSecretConfigured,
} from './interaction-readiness';

describe('S6A Interaction Readiness & Fail-Closed Configuration Gate', () => {
  const baseEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/test',
    INTERACTION_TEXT_DRIVER: 'durable',
    INTERACTION_COHORT_V2_ENABLED: '1',
    GEMINI_API_KEY: 'fixture-gemini-key-long-enough-for-testing',
  };

  it('passes all required checks under valid durable configuration', () => {
    const checks = interactionConfigurationChecks(baseEnv);
    const required = checks.filter(c => c.required);
    expect(required.every(c => c.status === 'configured')).toBe(true);
    expect(checks.find(c => c.name.includes('DATABASE_URL'))?.status).toBe('configured');
    expect(checks.find(c => c.name.includes('driver agreement'))?.status).toBe('configured');
  });

  it('fails closed when INTERACTION_TEXT_DRIVER has an invalid value', () => {
    const checks = interactionConfigurationChecks({ ...baseEnv, INTERACTION_TEXT_DRIVER: 'invalid_driver_name' });
    const driverCheck = checks.find(c => c.name.includes('INTERACTION_TEXT_DRIVER valid'));
    expect(driverCheck?.status).toBe('blocked');
    expect(driverCheck?.reason).toBe('invalid_driver');
  });

  it('fails closed when V2 intake is enabled but text driver is snapshot', () => {
    const checks = interactionConfigurationChecks({
      ...baseEnv,
      INTERACTION_COHORT_V2_ENABLED: '1',
      INTERACTION_TEXT_DRIVER: 'snapshot',
    });
    const agreementCheck = checks.find(c => c.name === 'V2 Landing Intake driver agreement');
    expect(agreementCheck?.status).toBe('blocked');
    expect(agreementCheck?.reason).toBe('durable_driver_required');
  });

  it('marks V2 intake as disabled without blocking core system when disabled', () => {
    const checks = interactionConfigurationChecks({
      ...baseEnv,
      INTERACTION_COHORT_V2_ENABLED: '0',
      INTERACTION_TEXT_DRIVER: 'snapshot',
    });
    const intakeCheck = checks.find(c => c.name.includes('V2 Landing Intake policy'));
    expect(intakeCheck?.status).toBe('disabled');
    expect(intakeCheck?.required).toBe(false);
    expect(intakeCheck?.details).toContain('Existing v2 workspaces remain readable and resumable');
  });

  it('fails closed when source connectors are enabled under snapshot driver', () => {
    const checks = interactionConfigurationChecks({
      ...baseEnv,
      INTERACTION_PDF_ENABLED: '1',
      INTERACTION_TEXT_DRIVER: 'snapshot',
      INTERACTION_COHORT_V2_ENABLED: '0',
    });
    const connectorCheck = checks.find(c => c.name.includes('External Source connectors driver agreement'));
    expect(connectorCheck?.status).toBe('blocked');
    expect(connectorCheck?.reason).toBe('durable_driver_required');
  });

  it('marks optional connectors as disabled when unset or set to 0', () => {
    const checks = interactionConfigurationChecks({
      ...baseEnv,
      INTERACTION_PDF_ENABLED: '0',
      INTERACTION_WEB_ENABLED: '0',
      INTERACTION_YOUTUBE_ENABLED: '0',
      INTERACTION_GITHUB_ENABLED: '0',
    });
    expect(checks.find(c => c.name.includes('PDF Source Capability'))?.status).toBe('disabled');
    expect(checks.find(c => c.name.includes('Web Source Capability'))?.status).toBe('disabled');
    expect(checks.find(c => c.name.includes('YouTube Source Capability'))?.status).toBe('disabled');
    expect(checks.find(c => c.name.includes('GitHub Source Capability'))?.status).toBe('disabled');
  });

  it('blocks YouTube capability if enabled without OAuth credentials or dev fixture', () => {
    const checks = interactionConfigurationChecks({
      ...baseEnv,
      INTERACTION_YOUTUBE_ENABLED: '1',
      INTERACTION_YOUTUBE_FIXTURE: '0',
      INTERACTION_YOUTUBE_TEST_MOCK: '0',
      YOUTUBE_API_KEY: undefined,
    });
    const ytCheck = checks.find(c => c.name.includes('YouTube Source Capability'));
    expect(ytCheck?.status).toBe('blocked');
    expect(ytCheck?.reason).toBe('missing_provider_credentials');
    expect(ytCheck?.details).toContain('video owner OAuth credentials');
  });

  it('flags rate limit risk if GitHub is enabled without dedicated GITHUB_TOKEN', () => {
    const checks = interactionConfigurationChecks({
      ...baseEnv,
      INTERACTION_GITHUB_ENABLED: '1',
      GITHUB_TOKEN: undefined,
    });
    const ghCheck = checks.find(c => c.name.includes('GitHub Source Capability'));
    expect(ghCheck?.status).toBe('configured');
    expect(ghCheck?.reason).toBe('rate_limit_risk');
    expect(ghCheck?.details).toContain('60 req/hr');
  });

  it('identifies rollout profiles accurately', () => {
    expect(getConfigurationProfile({ ...baseEnv, INTERACTION_MODEL_FIXTURE: '1' })).toBe('isolated_local');
    expect(
      getConfigurationProfile({
        ...baseEnv,
        NODE_ENV: 'production',
        INTERACTION_MODEL_FIXTURE: '0',
        INTERACTION_COHORT_V2_ENABLED: '1',
        INTERACTION_TEXT_DRIVER: 'durable',
        INTERACTION_YOUTUBE_ENABLED: '0',
        INTERACTION_GITHUB_ENABLED: '0',
      })
    ).toBe('initial_rollout');
    expect(
      getConfigurationProfile({
        ...baseEnv,
        NODE_ENV: 'production',
        INTERACTION_MODEL_FIXTURE: '0',
        INTERACTION_COHORT_V2_ENABLED: '0',
      })
    ).toBe('disabled_intake');
  });

  it('never discloses secret values or sensitive connection strings in reports', () => {
    const sensitiveKey = 'secret-key-that-must-never-be-printed-in-any-log-12345';
    const sensitiveDb = 'postgresql://admin:super_secret_password@db.example.com:5432/production';
    const checks = interactionConfigurationChecks({
      ...baseEnv,
      DATABASE_URL: sensitiveDb,
      GEMINI_API_KEY: sensitiveKey,
    });
    const serialized = JSON.stringify(checks);
    expect(serialized).not.toContain(sensitiveKey);
    expect(serialized).not.toContain('super_secret_password');
    expect(isSecretConfigured('placeholder')).toBe(false);
    expect(isSecretConfigured('[SENSITIVE]')).toBe(false);
  });

  it.each([
    ['ENOTFOUND', 'dns_not_found'],
    ['ETIMEOUT', 'dns_timeout'],
    [18, 'authentication_failed'],
    ['28P01', 'authentication_failed'],
    ['unknown_err', 'connection_failed'],
  ])('classifies connection failure code %s accurately without echoing raw driver messages', (code, reason) => {
    expect(connectionFailureReason({ code, message: 'sensitive db internal' })).toBe(reason);
  });
});
