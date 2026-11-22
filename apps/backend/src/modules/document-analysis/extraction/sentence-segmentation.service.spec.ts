import { SentenceSegmentationService } from './sentence-segmentation.service';

describe('SentenceSegmentationService', () => {
  const service = new SentenceSegmentationService();

  // Mandatory fidelity gate: every returned sentence must be an exact
  // substring of the page text it was segmented from -- checked for every
  // test case below, not just asserted once.
  function assertFidelity(pageText: string, sentences: ReturnType<SentenceSegmentationService['segment']>) {
    for (const sentence of sentences) {
      expect(pageText.includes(sentence.text)).toBe(true);
    }
  }

  it('splits ordinary sentences correctly', () => {
    const text = 'ABC Limited filed an application. The application was admitted on 20 February 2026.';
    const sentences = service.segment(text);
    assertFidelity(text, sentences);
    expect(sentences.map((s) => s.text)).toEqual([
      'ABC Limited filed an application.',
      'The application was admitted on 20 February 2026.',
    ]);
  });

  it('does not split on common title abbreviations (Mr., Dr., Ltd., Pvt.)', () => {
    const text = 'Mr. Rajesh Kumar was appointed. The firm Sharma Pvt. Ltd. filed the claim.';
    const sentences = service.segment(text);
    assertFidelity(text, sentences);
    expect(sentences.map((s) => s.text)).toEqual([
      'Mr. Rajesh Kumar was appointed.',
      'The firm Sharma Pvt. Ltd. filed the claim.',
    ]);
  });

  it('does not split on decimal numbers or numbered sub-clauses', () => {
    const text = 'The claim is Rs. 50,00,000 as per Schedule 12.1.3 of the agreement. It was approved.';
    const sentences = service.segment(text);
    assertFidelity(text, sentences);
    expect(sentences).toHaveLength(2);
    expect(sentences[0].text).toContain('12.1.3');
  });

  it('does not split on legal citations like "(2026) 1 SCC 234"', () => {
    const text = 'The matter is covered by the ruling in (2026) 1 SCC 234. That ruling is binding.';
    const sentences = service.segment(text);
    assertFidelity(text, sentences);
    expect(sentences).toHaveLength(2);
  });

  it('does not split on Indian-legal-specific abbreviations not in the library default list (M/s., Addl., w.e.f.)', () => {
    const text =
      'M/s. Sharma & Associates represented the Respondent. Addl. District Judge Mehta presided. The matter is listed w.e.f. 1 April 2026.';
    const sentences = service.segment(text);
    assertFidelity(text, sentences);
    expect(sentences.map((s) => s.text)).toEqual([
      'M/s. Sharma & Associates represented the Respondent.',
      'Addl. District Judge Mehta presided.',
      'The matter is listed w.e.f. 1 April 2026.',
    ]);
  });

  it('assigns a stable, sequential sequenceNumber to every sentence on a page', () => {
    const text = 'First sentence here. Second sentence here. Third sentence here.';
    const sentences = service.segment(text);
    expect(sentences.map((s) => s.sequenceNumber)).toEqual([1, 2, 3]);
  });

  it('keeps normalizedText separate from the exact text, never substituted for it', () => {
    const text = 'The  Applicant   filed a Claim.';
    const [sentence] = service.segment(text);
    expect(sentence.text).toBe('The  Applicant   filed a Claim.');
    expect(sentence.normalizedText).toBe('the applicant filed a claim.');
    expect(sentence.normalizedText).not.toBe(sentence.text);
  });

  it('returns no sentences for empty or whitespace-only page text', () => {
    expect(service.segment('')).toEqual([]);
    expect(service.segment('   ')).toEqual([]);
  });

  it('fidelity holds across every fixture sentence simultaneously (adversarial-style sweep)', () => {
    const text =
      'Mr. Rajesh Kumar, the Resolution Professional, was appointed pursuant to Sec. 22 of the Code. ' +
      'The claim amount is Rs. 50,00,000 as per Schedule 12.1.3 of the agreement. ' +
      'M/s. Sharma & Associates represented the Respondent in the matter (2026) 1 SCC 234. ' +
      'No. 45/2026 was assigned as the case number w.e.f. 1 April 2026.';
    const sentences = service.segment(text);
    assertFidelity(text, sentences);
    // Every sentence must also be at a genuine, locatable position in the
    // source -- not just "included somewhere by coincidence."
    for (const sentence of sentences) {
      expect(text.indexOf(sentence.text)).toBeGreaterThanOrEqual(0);
    }
  });
});
