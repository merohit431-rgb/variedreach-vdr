import { mfaOtpCodeTemplate } from './mfa-otp-code.template';

// Phase 4 finding P4-10: the OTP code previously appeared in the subject
// line, which MailService.dispatch() persists verbatim into EmailLog with
// no redaction, indefinitely. The subject is the one field that matters
// here (dispatch() never logs the HTML/text body) -- this locks in that
// the code can never regress back into it.
describe('mfaOtpCodeTemplate', () => {
  const CODE = '482913';

  it('never puts the code in the subject line', () => {
    const result = mfaOtpCodeTemplate({ code: CODE, expiresInMinutes: 10 });

    expect(result.subject).not.toContain(CODE);
  });

  it('still puts the code in the body -- the user genuinely needs to read it there', () => {
    const result = mfaOtpCodeTemplate({ code: CODE, expiresInMinutes: 10 });

    // The HTML body renders the code space-separated for display
    // (e.g. "4 8 2 9 1 3"), not the contiguous digits -- the plain-text
    // body uses the raw code directly.
    expect(result.html).toContain(CODE.split('').join(' '));
    expect(result.text).toContain(CODE);
  });

  it('does not leak the code into the HTML preheader/preview text either', () => {
    const result = mfaOtpCodeTemplate({ code: CODE, expiresInMinutes: 10 });

    // The preheader is emitted near the top of the rendered HTML, distinct
    // from the visible, space-separated code block further down.
    const preheaderRegion = result.html.slice(0, 300);
    expect(preheaderRegion).not.toContain(CODE);
  });
});
