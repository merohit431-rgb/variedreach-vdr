'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Shield,
  Stamp,
  KeyRound,
  History,
  Eye,
  FileText,
  BarChart3,
  CloudUpload,
  ChevronDown,
  ChevronRight,
  Check,
  Folder,
  Users,
  ArrowRight,
  Lock,
  Zap,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/cn';

// ─── Scroll-reveal wrapper ────────────────────────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── CountUp hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number, enabled: boolean, decimals = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const start = Date.now();
    const duration = 1800;
    const tick = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = eased * target;
      setCount(decimals ? Math.round(value * 10) / 10 : Math.round(value));
      if (progress >= 1) clearInterval(tick);
    }, 16);
    return () => clearInterval(tick);
  }, [enabled, target, decimals]);
  return count;
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600">
      {children}
    </span>
  );
}

// ─── 1. Hero ──────────────────────────────────────────────────────────────────

const HERO_FOLDERS = [
  { name: '01  Financials', badge: 'Encrypted', badgeCls: 'bg-green-500/10 text-green-600' },
  { name: '02  Legal Documents', badge: 'Watermarked', badgeCls: 'bg-amber-500/10 text-amber-600' },
  { name: '03  Claims Register', badge: 'View Only', badgeCls: 'bg-blue-500/10 text-blue-600' },
  { name: '04  Resolution Plan', badge: 'Restricted', badgeCls: 'bg-red-500/10 text-red-400' },
];

function VDRCard() {
  return (
    <div
      className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-300/50"
      style={{ transform: 'perspective(1000px) rotateY(-8deg) rotateX(3deg)' }}
    >
      <div className="mb-4 flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
        <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-mk-t3">
          CIRP #4471 — Data Room
        </span>
      </div>
      <div className="space-y-1">
        {HERO_FOLDERS.map((folder, i) => (
          <motion.div
            key={folder.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.12, duration: 0.4 }}
            className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50"
          >
            <div className="flex items-center gap-2.5">
              <Folder className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              <span className="text-sm text-mk-t2">{folder.name}</span>
            </div>
            <span className={cn('rounded px-2 py-0.5 text-[10px] font-semibold', folder.badgeCls)}>
              {folder.badge}
            </span>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 border-t border-slate-200 pt-4 text-center">
        <div>
          <div className="text-sm font-bold text-blue-600">24</div>
          <div className="text-[10px] text-mk-t3">Members</div>
        </div>
        <div>
          <div className="text-sm font-bold text-blue-600">847</div>
          <div className="text-[10px] text-mk-t3">Documents</div>
        </div>
        <div>
          <div className="text-sm font-bold text-green-600">Live</div>
          <div className="text-[10px] text-mk-t3">Status</div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section
      className="relative flex min-h-screen items-center overflow-hidden bg-mk-bg pt-16"
      aria-labelledby="hero-headline"
    >
      {/* Dot-grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          {/* Left */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <SectionLabel>Virtual Data Room</SectionLabel>
            </motion.div>

            <motion.h1
              id="hero-headline"
              className="mt-5 text-4xl font-bold leading-tight tracking-tight text-mk-text sm:text-5xl lg:text-[3.25rem]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              Secure, audited data rooms.{' '}
              <span className="text-blue-600">Built for Indian enterprise.</span>
            </motion.h1>

            <motion.p
              className="mt-5 text-lg leading-relaxed text-mk-t2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
            >
              Purpose-built for CIRP, liquidation, M&amp;A due diligence, and confidential transactions.
              Dynamic watermarking, eight-level access control, and a complete tamper-evident audit trail
              — in one platform.
            </motion.p>

            <motion.div
              className="mt-8 flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-5 py-3 text-sm font-semibold text-mk-t2 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                Book a live demo
              </Link>
            </motion.div>

            <motion.p
              className="mt-6 text-xs text-mk-t3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              No credit card required &nbsp;·&nbsp; Room live in under 5 minutes &nbsp;·&nbsp; Cancel anytime
            </motion.p>
          </div>

          {/* Right — VDR card */}
          <motion.div
            className="flex justify-center lg:justify-end"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <VDRCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── 2. Problem ───────────────────────────────────────────────────────────────

const OLD_WAY = [
  {
    title: 'Email file sharing',
    icon: '📧',
    pains: [
      'Attachments forwarded without your knowledge',
      'No version control — which PDF is the latest?',
      'Zero audit trail — impossible to prove who saw what',
      'A single forward can expose the entire deal',
    ],
  },
  {
    title: 'Shared drives & folders',
    icon: '📁',
    pains: [
      'Anyone with access can share with anyone else',
      'No watermarking — leaks are untraceable',
      'No role hierarchy — one permission level for all',
      'Compliance evidence is non-existent',
    ],
  },
  {
    title: 'Generic cloud storage',
    icon: '☁️',
    pains: [
      'Not built for legal or regulatory compliance',
      'No per-user download policy enforcement',
      'No legal-grade audit export for courts or NCLT',
      'Security is an afterthought',
    ],
  },
];

function ProblemSection() {
  return (
    <section className="bg-mk-bg py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <SectionLabel>The problem</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold text-mk-text sm:text-4xl">
            Stop sharing sensitive documents over email.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-mk-t2">
            For CIRP proceedings, M&amp;A due diligence, and high-stakes transactions, the stakes are too high
            for workarounds. The old way fails you in ways you may not even see until it&apos;s too late.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {OLD_WAY.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.1}>
              <div className="h-full rounded-xl border border-red-500/10 bg-mk-s1 p-6">
                <div className="mb-3 text-2xl">{item.icon}</div>
                <h3 className="mb-4 text-base font-semibold text-mk-text">{item.title}</h3>
                <ul className="space-y-2.5">
                  {item.pains.map((pain) => (
                    <li key={pain} className="flex items-start gap-2.5 text-sm text-mk-t2">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500/60" />
                      {pain}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3}>
          <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-6 text-center">
            <p className="text-sm font-medium text-blue-600">
              Varied Reach VDR solves every one of these problems — out of the box, for every data room you
              create.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 3. Stats ─────────────────────────────────────────────────────────────────

const STATS = [
  { label: 'Room setup time', value: 5, suffix: ' min', prefix: '<' },
  { label: 'Access role levels', value: 8, suffix: '', prefix: '' },
  { label: 'Audit traceability', value: 100, suffix: '%', prefix: '' },
  { label: 'Max file size', value: 2, suffix: ' GB', prefix: '' },
  { label: 'Platform availability', value: 99.9, suffix: '%', prefix: '', decimals: 1 },
];

function StatCard({ stat, enabled }: { stat: (typeof STATS)[0]; enabled: boolean }) {
  const count = useCountUp(stat.value, enabled, stat.decimals);
  return (
    <div className="rounded-xl border border-slate-200 bg-mk-s1 p-6 text-center">
      <div className="text-3xl font-bold text-blue-600 sm:text-4xl">
        {stat.prefix}
        {count}
        {stat.suffix}
      </div>
      <div className="mt-2 text-sm text-mk-t3">{stat.label}</div>
    </div>
  );
}

function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  return (
    <section className="bg-mk-s1 py-20" ref={ref}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-mk-t3">
            Platform capabilities
          </p>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            >
              <StatCard stat={stat} enabled={inView} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4. Platform Demo ─────────────────────────────────────────────────────────

const DEMO_STEPS = [
  {
    num: '01',
    title: 'Create your data room',
    desc: 'Name your room, select a type (CIRP, M&A, Liquidation), and choose your document access policy. Up and running in under 5 minutes.',
    illustration: (
      <div className="rounded-lg bg-mk-s1 p-5">
        <p className="mb-4 text-xs font-semibold text-mk-t4">New Data Room</p>
        <div className="space-y-3">
          {['Room name', 'Type', 'Download policy'].map((label) => (
            <div key={label}>
              <div className="mb-1 text-[10px] text-mk-t3">{label}</div>
              <div className="rounded border border-slate-200 bg-mk-bg px-3 py-2 text-xs text-mk-t2">
                {label === 'Room name' && 'CIRP Proceedings #4471'}
                {label === 'Type' && 'Insolvency & CIRP  ▾'}
                {label === 'Download policy' && 'Watermarked Only  ▾'}
              </div>
            </div>
          ))}
          <button className="mt-2 w-full rounded-md bg-blue-600 py-2 text-xs font-semibold text-white">
            Create Data Room
          </button>
        </div>
      </div>
    ),
  },
  {
    num: '02',
    title: 'Organize with folders',
    desc: 'Drag-and-drop files or upload entire folder trees. Organize by section — Financials, Legal, Claims, Resolution Plans. Structure your room to mirror your process.',
    illustration: (
      <div className="rounded-lg bg-mk-s1 p-5">
        <p className="mb-3 text-xs font-semibold text-mk-t4">CIRP #4471</p>
        {['01 Financials', '02 Legal Documents', '03 Claims Register', '04 Resolution Plan'].map(
          (name, i) => (
            <div
              key={name}
              className="mb-1 flex items-center justify-between rounded-md px-3 py-2 hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <Folder className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                <span className="text-xs text-mk-t2">{name}</span>
              </div>
              <span className="text-[10px] text-mk-t3">{[24, 8, 156, 3][i]} files</span>
            </div>
          ),
        )}
      </div>
    ),
  },
  {
    num: '03',
    title: 'Invite by role',
    desc: 'Assign each stakeholder an exact role — RP, CoC Member, Auditor, Resolution Applicant, or Guest. Each role sees only what they are explicitly authorized to see.',
    illustration: (
      <div className="rounded-lg bg-mk-s1 p-5">
        <p className="mb-3 text-xs font-semibold text-mk-t4">Invite Members</p>
        <div className="mb-3 flex gap-2">
          <div className="flex-1 rounded border border-slate-200 bg-mk-bg px-2 py-1.5 text-[11px] text-mk-t3">
            email@example.com
          </div>
          <div className="rounded border border-slate-200 bg-mk-bg px-2 py-1.5 text-[11px] text-mk-t2">
            CoC Member ▾
          </div>
        </div>
        <div className="space-y-1.5">
          {[
            { name: 'Rajiv Sharma', role: 'RP', color: 'text-blue-600' },
            { name: 'Meera Iyer', role: 'CoC Member', color: 'text-green-600' },
            { name: 'Anil Bansal', role: 'Auditor', color: 'text-amber-600' },
          ].map((u) => (
            <div key={u.name} className="flex items-center justify-between rounded-md bg-mk-bg px-3 py-2">
              <span className="text-[11px] text-mk-t2">{u.name}</span>
              <span className={cn('text-[10px] font-semibold', u.color)}>{u.role}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    num: '04',
    title: 'Preview with watermark',
    desc: "Every preview and download is watermarked on the fly with the viewer's name, email, and timestamp. If a document leaks, you know exactly who downloaded it.",
    illustration: (
      <div className="relative overflow-hidden rounded-lg bg-mk-s1 p-5">
        <p className="mb-3 text-xs font-semibold text-mk-t4">Document Preview</p>
        <div className="relative rounded border border-slate-200 bg-mk-bg p-4">
          <div className="mb-3 h-2 w-24 rounded bg-slate-100" />
          <div className="space-y-1.5">
            {[16, 24, 20, 14, 22].map((w, i) => (
              <div key={i} className={`h-1.5 rounded bg-slate-100`} style={{ width: `${w * 4}px` }} />
            ))}
          </div>
          {/* Watermark */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <span
              className="select-none text-[10px] font-bold text-red-400/30"
              style={{ transform: 'rotate(-35deg)', whiteSpace: 'nowrap' }}
            >
              MEERA IYER · meera@example.com · 02/07/2026
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    num: '05',
    title: 'Track every action',
    desc: 'A tamper-evident audit trail logs every view, download, upload, and permission change with who, what, and when. Exportable for regulatory or court submission.',
    illustration: (
      <div className="rounded-lg bg-mk-s1 p-5">
        <p className="mb-3 text-xs font-semibold text-mk-t4">Audit Trail</p>
        <div className="space-y-2">
          {[
            { action: 'Downloaded', file: 'FinancialReport.pdf', user: 'M. Iyer', time: '14:32' },
            { action: 'Viewed', file: 'ClaimsRegister.xlsx', user: 'R. Sharma', time: '14:18' },
            { action: 'Uploaded', file: 'LegalOpinion.docx', user: 'A. Bansal', time: '13:55' },
          ].map((log) => (
            <div
              key={log.time}
              className="flex items-center justify-between rounded-md bg-mk-bg px-3 py-2"
            >
              <div>
                <span className="text-[10px] font-semibold text-blue-600">{log.action}</span>
                <span className="ml-1.5 text-[10px] text-mk-t3">{log.file}</span>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-mk-t2">{log.user}</div>
                <div className="text-[10px] text-mk-t3">{log.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    num: '06',
    title: 'Generate reports',
    desc: 'Export deal analytics, document access reports, and compliance summaries — formatted for boards, regulators, and courts. One click, every time.',
    illustration: (
      <div className="rounded-lg bg-mk-s1 p-5">
        <p className="mb-3 text-xs font-semibold text-mk-t4">Reports</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {[
            { label: 'Total Views', value: '1,247' },
            { label: 'Downloads', value: '89' },
            { label: 'Active Users', value: '24' },
            { label: 'Documents', value: '847' },
          ].map((s) => (
            <div key={s.label} className="rounded-md bg-mk-bg px-3 py-2">
              <div className="text-sm font-bold text-blue-600">{s.value}</div>
              <div className="text-[10px] text-mk-t3">{s.label}</div>
            </div>
          ))}
        </div>
        <button className="w-full rounded-md bg-blue-600/20 py-1.5 text-[11px] font-semibold text-blue-600">
          Export Report →
        </button>
      </div>
    ),
  },
];

function PlatformDemoSection() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % DEMO_STEPS.length), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="bg-mk-bg py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold text-mk-text sm:text-4xl">
            From setup to deal close in minutes.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-mk-t2">
            Six steps. Every data room you run on Varied Reach follows this same secure, auditable process.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:items-start">
          {/* Step list */}
          <div className="space-y-1">
            {DEMO_STEPS.map((step, i) => (
              <button
                key={step.num}
                onClick={() => setActive(i)}
                className={cn(
                  'w-full rounded-xl px-5 py-4 text-left transition-all duration-200',
                  active === i
                    ? 'border border-blue-500/20 bg-blue-500/[0.08]'
                    : 'hover:bg-slate-50',
                )}
              >
                <div className="flex items-start gap-4">
                  <span
                    className={cn(
                      'mt-0.5 text-xs font-bold tabular-nums',
                      active === i ? 'text-blue-600' : 'text-mk-t4',
                    )}
                  >
                    {step.num}
                  </span>
                  <div>
                    <p
                      className={cn(
                        'text-sm font-semibold transition-colors',
                        active === i ? 'text-mk-text' : 'text-mk-t2',
                      )}
                    >
                      {step.title}
                    </p>
                    {active === i && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-1.5 text-sm leading-relaxed text-mk-t2"
                      >
                        {step.desc}
                      </motion.p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Illustration */}
          <div className="lg:sticky lg:top-24">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-slate-200 bg-mk-s2 p-6"
              >
                {DEMO_STEPS[active].illustration}
              </motion.div>
            </AnimatePresence>
            {/* Progress dots */}
            <div className="mt-4 flex justify-center gap-1.5">
              {DEMO_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  aria-label={`Step ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    active === i ? 'w-6 bg-blue-500' : 'w-1.5 bg-slate-300',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 5. Security ──────────────────────────────────────────────────────────────

const SECURITY_PILLARS = [
  {
    icon: Stamp,
    title: 'Dynamic watermarking',
    desc: 'Every download carries the recipient\'s name, email, and timestamp. Leaks are always traceable back to source.',
  },
  {
    icon: KeyRound,
    title: 'Granular role-based access',
    desc: 'Eight distinct access levels. External users can never see or download more than you explicitly allow.',
  },
  {
    icon: History,
    title: 'Tamper-evident audit trail',
    desc: 'Every action — view, download, upload, permission change — is logged with who, what, and when.',
  },
  {
    icon: Lock,
    title: 'Configurable download policy',
    desc: 'Per-room policy: preview only, original, watermarked, or all. Applied consistently for every stakeholder.',
  },
  {
    icon: Eye,
    title: 'External-role safeguards',
    desc: 'External roles can never receive unwatermarked originals, even if the room policy would otherwise allow it.',
  },
  {
    icon: Shield,
    title: 'Encrypted at rest & in transit',
    desc: 'AES-256 encryption for every file at rest. TLS 1.3 for every transfer. Zero plaintext exposure.',
  },
];

function SecuritySection() {
  return (
    <section className="bg-mk-s1 py-24" aria-labelledby="security-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <SectionLabel>Security</SectionLabel>
          <h2
            id="security-heading"
            className="mt-4 text-3xl font-bold text-mk-text sm:text-4xl"
          >
            Bank-grade security for every document.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-mk-t2">
            Built from the ground up for scenarios where a single untracked download can cost a deal, a
            case, or a career.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY_PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <Reveal key={pillar.title} delay={i * 0.07}>
                <div className="h-full rounded-xl border border-slate-200 bg-mk-bg p-6 transition-colors hover:border-blue-500/20">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Icon className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-mk-text">{pillar.title}</h3>
                  <p className="text-sm leading-relaxed text-mk-t2">{pillar.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.3}>
          <div className="mt-10 text-center">
            <Link
              href="/security"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Read our full security architecture
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 6. Industries ────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { icon: '⚖️', title: 'IBC & CIRP', desc: 'End-to-end document management for CIRP proceedings under the Insolvency and Bankruptcy Code.' },
  { icon: '🏛️', title: 'Liquidation', desc: 'Coordinate asset documentation, creditor communication, and compliance reporting.' },
  { icon: '🤝', title: 'M&A Due Diligence', desc: 'Buy-side and sell-side diligence with watermarked previews and per-party access control.' },
  { icon: '📈', title: 'Private Equity & VC', desc: 'Investment committee reviews, portfolio monitoring, and LP reporting — securely.' },
  { icon: '🏦', title: 'Banking & NBFC', desc: 'Loan syndication, restructuring documentation, and regulatory filing workflows.' },
  { icon: '⚖️', title: 'Law Firms', desc: 'Matter-specific rooms for client document exchange with full traceability.' },
  { icon: '🏠', title: 'Homebuyer Committees', desc: 'IBC Section 7A homebuyer representation with structured document access and audit.' },
  { icon: '🏗️', title: 'Real Estate & Infra', desc: 'Project data rooms for lenders, investors, and regulatory stakeholders.' },
  { icon: '🏢', title: 'Stressed Assets', desc: 'ARC and IBA-led resolution processes with role-segregated document access.' },
  { icon: '🔍', title: 'Forensic & Advisory', desc: 'Investigation and advisory engagements requiring complete and exportable audit evidence.' },
];

function IndustriesSection() {
  return (
    <section className="bg-mk-bg py-24" aria-labelledby="industries-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <SectionLabel>Industries</SectionLabel>
          <h2
            id="industries-heading"
            className="mt-4 text-3xl font-bold text-mk-text sm:text-4xl"
          >
            Built for every high-stakes transaction.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-mk-t2">
            One platform, purpose-configured for ten industries where document security is not optional.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {INDUSTRIES.map((ind, i) => (
            <motion.div
              key={ind.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.04, duration: 0.45 }}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-mk-s1 p-5 transition-all duration-200 hover:border-blue-500/20 hover:bg-mk-s2"
            >
              <div className="mb-3 text-xl">{ind.icon}</div>
              <h3 className="mb-1.5 text-sm font-semibold text-mk-text">{ind.title}</h3>
              <p className="text-xs leading-relaxed text-mk-t3">{ind.desc}</p>
              <div className="absolute inset-y-0 left-0 w-0.5 bg-blue-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            </motion.div>
          ))}
        </div>

        <Reveal delay={0.4}>
          <div className="mt-8 text-center">
            <Link
              href="/industries"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Explore all industries
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 7. Features ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    tag: 'Watermarking',
    title: 'Every download carries the downloader\'s identity.',
    desc: 'Dynamic watermarks are applied on the fly — name, email, and timestamp — to every PDF download and preview. If a document leaks, the source is immediately identifiable. There are no exceptions for external roles.',
    benefits: ['Automatic, no manual steps', 'Applied to previews and downloads', 'External roles always watermarked', 'Court-admissible evidence of access'],
    icon: Stamp,
  },
  {
    tag: 'Access Control',
    title: 'Eight access levels. Zero ambiguity.',
    desc: 'Org Admin, RP, Liquidator, CoC Member, Auditor, Resolution Applicant, Guest, and External Read-Only. Each role is scoped to exactly what that stakeholder should see — and nothing more. Access can be revoked at any time.',
    benefits: ['Role assigned per person, per room', 'No over-privileged access', 'Instant revocation', 'CIRP-aligned role structure'],
    icon: KeyRound,
  },
  {
    tag: 'Office Preview',
    title: 'View Word, Excel, and PowerPoint without downloading.',
    desc: 'Docx, xlsx, and pptx files are converted and served as secure, watermarked previews in the browser. Stakeholders get full readability without receiving the original file.',
    benefits: ['Word, Excel, PowerPoint support', 'No plugin or app required', 'Watermarked even in preview', 'Lazy-cached for speed'],
    icon: Eye,
  },
  {
    tag: 'Audit Trail',
    title: 'A complete, tamper-evident record of every action.',
    desc: 'Every view, download, upload, permission change, and invitation is logged with actor, timestamp, and IP. The audit trail is immutable and exportable — formatted for regulators, courts, or board submission.',
    benefits: ['Every action logged, no exceptions', 'Immutable and timestamped', 'Exportable for NCLT or IBC proceedings', 'Filterable by user, action, date'],
    icon: History,
  },
  {
    tag: 'Cloud Import',
    title: 'Import directly from Google Drive or OneDrive.',
    desc: 'Connect your cloud storage and select files to import directly into your data room — no manual download and re-upload. Imported files go through the full VDR pipeline: watermarking, access control, and audit trail.',
    benefits: ['Google Drive and OneDrive support', 'Folder import with structure preserved', 'Full pipeline applied post-import', 'Token persisted for repeat imports'],
    icon: CloudUpload,
  },
  {
    tag: 'Download Policy',
    title: 'You control what can be downloaded. For every room.',
    desc: 'Set per-data-room download policy: preview only, original, watermarked, or both. The policy applies to every user in the room consistently — and can be changed at any time as the deal evolves.',
    benefits: ['4 policy levels per room', 'Applied to all users uniformly', 'Changeable without re-inviting', 'External roles get additional protection'],
    icon: Lock,
  },
  {
    tag: 'Reports',
    title: 'Deal intelligence, in one click.',
    desc: 'Generate activity reports, document access summaries, user engagement analytics, and storage reports. Export as structured data for compliance review, board presentation, or regulatory submission.',
    benefits: ['Access reports by user and file', 'Download and view analytics', 'Exportable CSV and structured data', 'Storage utilization breakdown'],
    icon: BarChart3,
  },
];

function FeaturesSection() {
  return (
    <section className="bg-mk-s1 py-24" aria-labelledby="features-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <SectionLabel>Features</SectionLabel>
          <h2
            id="features-heading"
            className="mt-4 text-3xl font-bold text-mk-text sm:text-4xl"
          >
            Every feature built for security, not convenience.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-mk-t2">
            Each capability exists because the alternative — email, shared drives, generic cloud — creates
            risk that high-stakes transactions cannot afford.
          </p>
        </Reveal>

        <div className="mt-14 space-y-16">
          {FEATURES.map((feat, i) => {
            const Icon = feat.icon;
            const isEven = i % 2 === 0;
            return (
              <Reveal key={feat.tag} delay={0.05}>
                <div
                  className={cn(
                    'grid items-center gap-10 lg:grid-cols-2',
                    !isEven && 'lg:[&>:first-child]:order-2',
                  )}
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                      {feat.tag}
                    </span>
                    <h3 className="mt-3 text-xl font-bold text-mk-text sm:text-2xl">{feat.title}</h3>
                    <p className="mt-4 text-mk-t2 leading-relaxed">{feat.desc}</p>
                    <ul className="mt-5 space-y-2">
                      {feat.benefits.map((b) => (
                        <li key={b} className="flex items-center gap-2.5 text-sm text-mk-t2">
                          <Check className="h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-mk-bg p-10">
                    <Icon
                      className="h-16 w-16 text-blue-600/40"
                      aria-hidden="true"
                      strokeWidth={1}
                    />
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.2}>
          <div className="mt-14 text-center">
            <Link
              href="/features"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View full feature list
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 8. Integrations ─────────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    name: 'Google Drive',
    desc: 'Import files and folders directly from Drive into your VDR. Access token saved for repeat imports.',
    icon: Globe,
    color: 'text-blue-600',
  },
  {
    name: 'Microsoft OneDrive',
    desc: 'Connect OneDrive via OAuth and select files to import. Full VDR pipeline applied on import.',
    icon: CloudUpload,
    color: 'text-blue-500',
  },
  {
    name: 'Email delivery',
    desc: 'Invitations, notifications, and welcome messages delivered reliably via enterprise email infrastructure.',
    icon: FileText,
    color: 'text-purple-600',
  },
  {
    name: 'REST API',
    desc: 'Programmatic access to rooms, files, members, and audit events. Integrate into your own workflows.',
    icon: Zap,
    color: 'text-amber-600',
  },
];

function IntegrationsSection() {
  return (
    <section className="bg-mk-bg py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <SectionLabel>Integrations</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold text-mk-text sm:text-4xl">
            Works with your existing tools.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-mk-t2">
            Import from cloud storage you already use. Deliver notifications through your existing email
            infrastructure. Connect to your workflows via API.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INTEGRATIONS.map((intg, i) => {
            const Icon = intg.icon;
            return (
              <Reveal key={intg.name} delay={i * 0.08}>
                <div className="h-full rounded-xl border border-slate-200 bg-mk-s1 p-5 transition-colors hover:border-blue-500/20">
                  <Icon className={cn('mb-4 h-7 w-7', intg.color)} aria-hidden="true" />
                  <h3 className="mb-2 text-sm font-semibold text-mk-text">{intg.name}</h3>
                  <p className="text-xs leading-relaxed text-mk-t3">{intg.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal delay={0.3}>
          <p className="mt-6 text-center text-xs text-mk-t4">
            More integrations coming soon &nbsp;·&nbsp; Contact us to request a specific integration
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 9. Journey ───────────────────────────────────────────────────────────────

const JOURNEY_STEPS = [
  { num: '01', title: 'Create account', desc: 'Sign up, verify email. Ready in 2 minutes.' },
  { num: '02', title: 'Create data room', desc: 'Name, type, and download policy.' },
  { num: '03', title: 'Upload documents', desc: 'Drag-drop, folder import, or cloud import.' },
  { num: '04', title: 'Invite stakeholders', desc: 'Assign roles per person.' },
  { num: '05', title: 'Stakeholders access', desc: 'Secure previews, watermarked downloads.' },
  { num: '06', title: 'Monitor activity', desc: 'Real-time audit trail and alerts.' },
  { num: '07', title: 'Export & close', desc: 'Compliance reports for courts and boards.' },
];

function JourneySection() {
  return (
    <section className="bg-mk-s1 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <SectionLabel>Journey</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold text-mk-text sm:text-4xl">
            From account creation to deal close.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-mk-t2">Seven steps. Every CIRP, every M&A, every liquidation follows this same path.</p>
        </Reveal>

        <div className="relative mt-14">
          {/* Connecting line (desktop) */}
          <div
            className="absolute left-6 top-6 hidden h-[calc(100%-48px)] w-px bg-slate-100 lg:block"
            aria-hidden="true"
          />

          <div className="space-y-4 lg:ml-20">
            {JOURNEY_STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 0.06}>
                <div className="relative flex items-start gap-5">
                  <div className="absolute -left-[72px] hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-mk-s2 text-xs font-bold text-blue-600 lg:flex">
                    {step.num}
                  </div>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-mk-s2 text-xs font-bold text-blue-600 lg:hidden">
                    {step.num}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-mk-bg px-5 py-4 flex-1">
                    <p className="text-sm font-semibold text-mk-text">{step.title}</p>
                    <p className="mt-0.5 text-xs text-mk-t3">{step.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 10. Pricing ──────────────────────────────────────────────────────────────

function PricingSection() {
  return (
    <section className="bg-mk-bg py-24" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <SectionLabel>Pricing</SectionLabel>
          <h2
            id="pricing-heading"
            className="mt-4 text-3xl font-bold text-mk-text sm:text-4xl"
          >
            Simple, transparent pricing.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-mk-t2">
            No per-user seat fees. No surprise overages. One plan for everything you need.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              View all pricing plans
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/contact"
              className="text-sm font-medium text-mk-t2 hover:text-slate-900 transition-colors"
            >
              Talk to us about enterprise pricing →
            </Link>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {[
            {
              name: 'Starter',
              desc: 'For individual RPs and small liquidations.',
              features: ['Up to 10 members', 'Up to 5 data rooms', '50 GB storage', 'All security features', 'Email support'],
              cta: 'Start free trial',
            },
            {
              name: 'Professional',
              desc: 'For active deal teams and mid-size proceedings.',
              features: ['Up to 50 members', 'Unlimited data rooms', '250 GB storage', 'Priority support', 'Advanced reports'],
              cta: 'Start free trial',
              highlight: true,
            },
            {
              name: 'Business',
              desc: 'For large firms, banks, and high-volume proceedings.',
              features: ['Unlimited members', 'Unlimited data rooms', '1 TB storage', 'Dedicated support', 'Custom integrations'],
              cta: 'Contact us',
            },
          ].map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.1}>
              <div
                className={cn(
                  'flex h-full flex-col rounded-xl border p-6',
                  plan.highlight
                    ? 'border-blue-500/40 bg-blue-500/[0.06]'
                    : 'border-slate-200 bg-mk-s1',
                )}
              >
                {plan.highlight && (
                  <span className="mb-3 self-start rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                    Most popular
                  </span>
                )}
                <h3 className="text-base font-bold text-mk-text">{plan.name}</h3>
                <p className="mt-1 text-xs text-mk-t3">{plan.desc}</p>
                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-mk-t2">
                      <Check className="h-3.5 w-3.5 flex-shrink-0 text-green-600" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.cta === 'Contact us' ? '/contact' : '/signup'}
                  className={cn(
                    'mt-6 block rounded-md py-2.5 text-center text-sm font-semibold transition-colors',
                    plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'border border-slate-300 text-mk-t2 hover:border-slate-300 hover:text-slate-900',
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.3}>
          <p className="mt-6 text-center text-xs text-mk-t4">
            All plans include: watermarking, RBAC, audit trail, office preview, and cloud import.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 11. FAQ ─────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'Is Varied Reach VDR compliant with IBC 2016 requirements for CIRP proceedings?',
    a: 'Yes. The platform is designed specifically for IBC proceedings. The audit trail, role-based access (RP, CoC, Resolution Applicant), and watermarked document sharing align with IBBI regulations and NCLT submission requirements.',
  },
  {
    q: 'How does dynamic watermarking work in practice?',
    a: "When a user downloads or previews a document, the system applies a watermark in real-time containing their name, email address, and timestamp. This happens server-side — users cannot bypass or remove it. Every single download is traced.",
  },
  {
    q: 'Can external stakeholders (Resolution Applicants, Auditors, Guests) access documents without creating an Org account?',
    a: 'External users are invited via email and can access their permitted documents through a secure link. They do not need to create an organisation account — they log in as invited members of a specific data room.',
  },
  {
    q: 'What happens to data after a CIRP is closed or a deal is completed?',
    a: 'You retain full access to your data room and all documents for the lifetime of your subscription. You can archive the room, export the audit trail, and download all documents before closure. Nothing is automatically deleted.',
  },
  {
    q: 'How is access differentiated between Committee of Creditors and Resolution Applicants?',
    a: 'CoC Members and Resolution Applicants are separate roles with distinct permission levels. You can configure which folders and documents each group can view. Resolution Applicants typically receive watermarked view-only access to specific sections.',
  },
  {
    q: 'Where is data stored? Is it stored in India?',
    a: 'All data is stored on servers within our infrastructure. If you have specific data residency requirements for regulatory compliance, please contact us — we can discuss options for your use case.',
  },
  {
    q: 'Can I export the audit trail for submission to the NCLT or IBBI?',
    a: 'Yes. The audit trail is exportable as structured data at any time. It includes actor, action, document, timestamp, and IP address — formatted for regulatory or court submission.',
  },
  {
    q: 'How large can individual file uploads be?',
    a: 'Individual files can be up to 2 GB each. For very large financial models, asset schedules, or engineering documents, this accommodates most enterprise file sizes.',
  },
  {
    q: 'What file types can be previewed without downloading?',
    a: 'PDF files are natively previewed in the browser. Word (docx), Excel (xlsx), and PowerPoint (pptx) files are converted and served as secure previews — no desktop application needed.',
  },
  {
    q: 'Is there a limit on how many data rooms I can create?',
    a: 'Starter plan: up to 5 data rooms. Professional and Business plans: unlimited data rooms. You can run multiple concurrent CIRP proceedings, M&A transactions, and client engagements simultaneously.',
  },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-mk-s1 py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal className="text-center">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold text-mk-text sm:text-4xl">
            Common questions.
          </h2>
          <p className="mt-4 text-mk-t2">
            Specific to IBC, CIRP, and high-stakes document security.
          </p>
        </Reveal>

        <div className="mt-12 space-y-1">
          {FAQS.map((faq, i) => (
            <Reveal key={i} delay={i * 0.03}>
              <div className="rounded-xl border border-slate-200 bg-mk-bg">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={open === i}
                >
                  <span className="text-sm font-medium text-mk-text">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      'mt-0.5 h-4 w-4 flex-shrink-0 text-mk-t3 transition-transform duration-200',
                      open === i && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </button>
                <AnimatePresence>
                  {open === i && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="border-t border-slate-100 px-5 pb-4 pt-3 text-sm leading-relaxed text-mk-t2">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3}>
          <p className="mt-8 text-center text-sm text-mk-t3">
            Have a question we haven&apos;t answered?{' '}
            <Link href="/contact" className="text-blue-600 hover:text-blue-700">
              Contact us →
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 12. CTA Banner ──────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="bg-mk-bg py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] px-8 py-14">
            <h2 className="text-3xl font-bold text-mk-text sm:text-4xl">
              Start your data room today.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-mk-t2">
              No credit card required. Room live in under 5 minutes. Cancel anytime.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-7 py-3.5 text-sm font-semibold text-mk-t2 transition-colors hover:text-slate-900"
              >
                Book a live demo
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-mk-t4">
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                Dynamic watermarking
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                Role-based access control
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                Complete audit trail
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                Cloud import
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function MarketingHomeContent() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <StatsSection />
      <PlatformDemoSection />
      <SecuritySection />
      <IndustriesSection />
      <FeaturesSection />
      <IntegrationsSection />
      <JourneySection />
      <PricingSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
