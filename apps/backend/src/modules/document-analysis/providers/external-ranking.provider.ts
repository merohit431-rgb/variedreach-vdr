import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RankedSentence, SentenceInput, SummaryRankingProvider } from './ranking-provider.interface';

// Architecture-ready, intentionally inert. Activating this provider
// (RANKING_PROVIDER=external) requires a separately-approved follow-up to
// actually implement the HTTP call below -- per the explicit stop
// condition: "Do not activate an external AI provider... without my
// explicit approval." Nothing in this class can send a document's text
// anywhere; `rank()` always throws.
//
// When that approval is given, implementing this class is the ONLY change
// needed to go live -- DocumentAnalysisService/the processor already
// depend on the SummaryRankingProvider interface, not this class directly,
// so swapping providers needs no change anywhere else. At that point, this
// is also where prompt-injection defence belongs: document text is
// untrusted input, must be clearly delimited from any instruction content
// sent to a real model, and the system prompt must explicitly instruct the
// model to treat document content as inert data, never as instructions to
// follow.
@Injectable()
export class ExternalAiRankingProvider implements SummaryRankingProvider {
  constructor(private readonly configService: ConfigService) {}

  // Parameter required by the SummaryRankingProvider interface; this stub deliberately never reads it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async rank(sentences: SentenceInput[]): Promise<RankedSentence[]> {
    const apiKey = this.configService.get<string>('ranking.externalApiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'External AI ranking is not configured. This deployment ships with an inert stub only -- ' +
          'activating a real external provider requires a separately-approved implementation.',
      );
    }
    // Deliberately unimplemented pending separate approval -- see class
    // comment. Never reaches here with the current, always-empty
    // RANKING_EXTERNAL_API_KEY default.
    throw new ServiceUnavailableException(
      'External AI ranking provider is configured but not yet implemented in this build.',
    );
  }
}
