'use client';

import { useState, FormEvent } from 'react';
import { CalendarClock, CheckCircle2, Mail, PhoneCall } from 'lucide-react';
import { useContact } from '@/hooks/use-contact';

const USE_CASES = [
  { value: 'CIRP', label: 'CIRP' },
  { value: 'LIQUIDATION', label: 'Liquidation' },
  { value: 'MA_DUE_DILIGENCE', label: 'M&A Due Diligence' },
  { value: 'OTHER', label: 'Other / general' },
];

const TIME_SLOTS = [
  { value: 'MORNING', label: 'Morning (9am – 12pm IST)' },
  { value: 'AFTERNOON', label: 'Afternoon (12pm – 4pm IST)' },
  { value: 'EVENING', label: 'Evening (4pm – 7pm IST)' },
];

const ROLES = [
  'Resolution Professional / IP',
  'Law firm',
  'Bank / ARC / Lender',
  'Corporate / deal team',
  'Advisor / consultant',
  'Other',
];

const inputClasses =
  'mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

function FieldLabel({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700">
      {children}
      {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
    </label>
  );
}

function DemoForm() {
  const { requestDemo } = useContact();
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [firmName, setFirmName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [useCase, setUseCase] = useState('CIRP');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredSlot, setPreferredSlot] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ received: boolean } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await requestDemo({
      fullName,
      firmName,
      workEmail,
      phone,
      role: role || undefined,
      useCase,
      preferredDate: preferredDate || undefined,
      preferredSlot: preferredSlot || undefined,
      message: message || undefined,
      website: website || undefined,
    });
    setSubmitting(false);
    if (result.success) {
      setDone({ received: result.received });
    } else {
      setError(result.message);
    }
  }

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-bold text-mk-text">Demo request received.</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-mk-t3">
          {done.received
            ? `We'll confirm your slot at ${workEmail} within one business day.`
            : 'Your details were recorded, but our notification system had a hiccup. To be safe, email rohit@variedreach.com and we will confirm your slot directly.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="demo-name">Full name</FieldLabel>
          <input
            id="demo-name"
            required
            maxLength={150}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Priya Sharma"
            className={inputClasses}
          />
        </div>
        <div>
          <FieldLabel htmlFor="demo-email">Work email</FieldLabel>
          <input
            id="demo-email"
            type="email"
            required
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
            placeholder="priya@firm.com"
            className={inputClasses}
          />
        </div>
        <div>
          <FieldLabel htmlFor="demo-firm">Firm / company</FieldLabel>
          <input
            id="demo-firm"
            required
            maxLength={150}
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="Sharma & Associates"
            className={inputClasses}
          />
        </div>
        <div>
          <FieldLabel htmlFor="demo-phone">Phone</FieldLabel>
          <input
            id="demo-phone"
            type="tel"
            required
            pattern="[0-9+\-()\s]{7,20}"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98100 12345"
            className={inputClasses}
          />
        </div>
        <div>
          <FieldLabel htmlFor="demo-role" optional>
            Your role
          </FieldLabel>
          <select id="demo-role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClasses}>
            <option value="">Select…</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="demo-usecase">Primary use case</FieldLabel>
          <select
            id="demo-usecase"
            required
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            className={inputClasses}
          >
            {USE_CASES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="demo-date" optional>
            Preferred date
          </FieldLabel>
          <input
            id="demo-date"
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <FieldLabel htmlFor="demo-slot" optional>
            Preferred time
          </FieldLabel>
          <select
            id="demo-slot"
            value={preferredSlot}
            onChange={(e) => setPreferredSlot(e.target.value)}
            className={inputClasses}
          >
            <option value="">Any time</option>
            {TIME_SLOTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4">
        <FieldLabel htmlFor="demo-message" optional>
          Anything specific you want covered?
        </FieldLabel>
        <textarea
          id="demo-message"
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. We're running two concurrent CIRPs and need CoC access segregated…"
          className={inputClasses}
        />
      </div>

      {/* Honeypot — invisible to people, tempting to bots */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="demo-website">Website</label>
        <input
          id="demo-website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-md bg-slate-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Request demo slot'}
      </button>
      <p className="mt-3 text-center text-xs text-mk-t4">
        We&apos;ll confirm by email within one business day. No obligation.
      </p>
    </form>
  );
}

function CallbackForm() {
  const { requestCallback } = useContact();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bestTime, setBestTime] = useState('MORNING');
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ received: boolean } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await requestCallback({
      fullName,
      phone,
      bestTime,
      website: website || undefined,
    });
    setSubmitting(false);
    if (result.success) {
      setDone({ received: result.received });
    } else {
      setError(result.message);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-mk-text">Callback requested.</p>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-mk-t3">
          {done.received
            ? 'We’ll call you at the time you chose — usually the same business day.'
            : 'Your request was recorded, but to be safe you can also call us directly on +91 88510 96461.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <FieldLabel htmlFor="cb-name">Full name</FieldLabel>
        <input
          id="cb-name"
          required
          maxLength={150}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Priya Sharma"
          className={inputClasses}
        />
      </div>
      <div className="mt-4">
        <FieldLabel htmlFor="cb-phone">Phone</FieldLabel>
        <input
          id="cb-phone"
          type="tel"
          required
          pattern="[0-9+\-()\s]{7,20}"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98100 12345"
          className={inputClasses}
        />
      </div>
      <div className="mt-4">
        <FieldLabel htmlFor="cb-time">Best time to call</FieldLabel>
        <select
          id="cb-time"
          required
          value={bestTime}
          onChange={(e) => setBestTime(e.target.value)}
          className={inputClasses}
        >
          {TIME_SLOTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="cb-website">Website</label>
        <input
          id="cb-website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-md border border-slate-300 bg-white py-2.5 text-sm font-semibold text-mk-t2 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Request a callback'}
      </button>
    </form>
  );
}

export default function BookDemoPage() {
  return (
    <div className="bg-mk-bg">
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <span className="inline-block rounded-full border border-blue-600/25 bg-blue-600/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-700">
            Book a demo
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-tight text-mk-text sm:text-5xl">
            See the platform against your own use case.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mk-t2">
            A 30-minute guided walkthrough with a specialist — watermarking, permissions, audit
            trail, and reports, shown live on the real product. No trial accounts, no obligation.
          </p>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-mk-s1 py-14 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.5fr,1fr] lg:gap-8">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <CalendarClock className="h-4 w-4 text-slate-600" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-mk-text">Schedule a live demo</h2>
                <p className="text-xs text-mk-t3">Pick a slot; we confirm by email.</p>
              </div>
            </div>
            <div className="mt-6">
              <DemoForm />
            </div>
          </div>

          <div className="space-y-6">
            <div id="callback" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                  <PhoneCall className="h-4 w-4 text-slate-600" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-mk-text">Request a callback</h2>
                  <p className="text-xs text-mk-t3">Prefer to talk first? We&apos;ll call you.</p>
                </div>
              </div>
              <div className="mt-6">
                <CallbackForm />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
              <p className="flex items-center gap-2 text-sm font-semibold text-mk-text">
                <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Prefer email?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-mk-t3">
                Write to{' '}
                <a href="mailto:rohit@variedreach.com" className="font-medium text-blue-700 hover:text-blue-800">
                  rohit@variedreach.com
                </a>{' '}
                or call{' '}
                <a href="tel:+918851096461" className="font-medium text-blue-700 hover:text-blue-800">
                  +91 88510 96461
                </a>{' '}
                (Mon–Fri, 9am–6pm IST).
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
