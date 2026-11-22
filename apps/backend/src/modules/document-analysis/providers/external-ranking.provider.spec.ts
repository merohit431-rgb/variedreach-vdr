import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalAiRankingProvider } from './external-ranking.provider';

describe('ExternalAiRankingProvider', () => {
  it('refuses to run when no external API key is configured (the default, approved posture)', async () => {
    const config = { get: jest.fn().mockReturnValue('') } as unknown as ConfigService;
    const provider = new ExternalAiRankingProvider(config);

    await expect(provider.rank([])).rejects.toThrow(ServiceUnavailableException);
  });

  it('still refuses even when a key IS configured -- the real call is deliberately unimplemented pending separate approval', async () => {
    const config = { get: jest.fn().mockReturnValue('some-configured-key') } as unknown as ConfigService;
    const provider = new ExternalAiRankingProvider(config);

    await expect(provider.rank([])).rejects.toThrow(ServiceUnavailableException);
  });

  it('never makes any network call -- rejecting synchronously/immediately regardless of input', async () => {
    const config = { get: jest.fn().mockReturnValue('') } as unknown as ConfigService;
    const provider = new ExternalAiRankingProvider(config);

    const sentences = [{ sentenceId: 's1', pageNumber: 1, text: 'Confidential document text that must never leave this process.' }];
    await expect(provider.rank(sentences)).rejects.toThrow();
  });
});
