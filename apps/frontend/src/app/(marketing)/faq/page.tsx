const FAQS = [
  {
    question: 'How is pricing calculated?',
    answer:
      'Pricing is based on the storage you need, billed monthly per GB at your plan\'s rate, subject to the plan\'s minimum commitment. GST (18%) is added on top of the calculated charge.',
  },
  {
    question: 'Can I change my storage or plan later?',
    answer:
      'Yes. Plan and storage changes, along with billing and subscription management, are part of our subscription tools — reach out to support and we\'ll help you adjust your plan.',
  },
  {
    question: 'What happens to my documents if a payment is missed?',
    answer:
      'We never delete your documents over a billing issue. Accounts move to a read-only state with an extended grace period before any further action, so you always have time to resolve a payment problem without losing access to your data.',
  },
  {
    question: 'Are downloaded documents watermarked?',
    answer:
      'Each data room has a configurable download policy set by its administrator — preview only, original downloads, watermarked downloads, or both. Watermarks embed the recipient\'s identity so leaked documents can be traced.',
  },
  {
    question: 'Who can access a data room?',
    answer:
      'Only people explicitly invited to a data room, each assigned one of our roles (Organisation Admin, Resolution Professional, CoC Member, Auditor, Legal Advisor, and others) that determines exactly what they can see and do.',
  },
  {
    question: 'Is my data encrypted?',
    answer: 'All traffic to and from Varied Reach is encrypted in transit over TLS, with authenticated, short-lived access sessions.',
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Frequently asked questions</h1>

      <dl className="mt-10 space-y-8">
        {FAQS.map((faq) => (
          <div key={faq.question} className="border-b border-slate-100 pb-8 last:border-0">
            <dt className="font-semibold text-slate-900">{faq.question}</dt>
            <dd className="mt-2 text-sm text-slate-600">{faq.answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
