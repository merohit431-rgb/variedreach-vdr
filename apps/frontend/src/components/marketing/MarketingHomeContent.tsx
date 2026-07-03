'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Check,
  Cloud,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  Folder,
  FolderLock,
  FolderPlus,
  Gavel,
  History,
  KeyRound,
  LayoutDashboard,
  Lock,
  Minus,
  PenLine,
  Stamp,
  Upload,
  Users,
} from 'lucide-react';
import { PLAN_IDS } from '@variedreach-vdr/shared';
import { cn } from '@/lib/cn';
import { PlanCard } from './PlanCard';
import { AnimatePresence, m, MotionProvider, Reveal, useReducedMotion } from './motion';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-blue-600/25 bg-blue-600/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-700">
      {children}
    </span>
  );
}

// ─── 1. Hero — the product is the hero ───────────────────────────────────────

const FRAME_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Folder, label: 'Files', active: true },
  { icon: Users, label: 'Members' },
  { icon: History, label: 'Activity' },
  { icon: BarChart3, label: 'Reports' },
];

const FRAME_ROWS = [
  { icon: Folder, name: '01 · Financial Statements', meta: '24 files', date: 'Today' },
  { icon: Folder, name: '02 · Claims Register', meta: '18 files', date: 'Yesterday' },
  { icon: FileText, name: 'Information Memorandum.pdf', meta: '4.2 MB', date: '2 Jul', badge: true },
  { icon: FileSpreadsheet, name: 'Asset Schedule.xlsx', meta: '12.8 MB', date: '1 Jul' },
  { icon: FileText, name: 'Valuation Report — Draft.docx', meta: '2.1 MB', date: '28 Jun' },
];

const FRAME_AUDIT = [
  { dot: 'bg-blue-500', text: 'Priya S. viewed Information Memorandum', time: 'now' },
  { dot: 'bg-emerald-500', text: 'Rahul M. downloaded Asset Schedule', time: '1m' },
  { dot: 'bg-violet-500', text: 'CoC member invited to the room', time: '4m' },
  { dot: 'bg-amber-500', text: 'PRA access set to view-only', time: '9m' },
];

function AppFrame() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-card">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="ml-3 text-xs font-medium text-slate-400">
          app.variedreach.com — CIRP #4471
        </span>
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] font-medium text-slate-400 sm:flex">
          <Lock className="h-3 w-3" aria-hidden="true" />
          TLS 1.3 · AES-256
        </span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="hidden w-44 flex-shrink-0 border-r border-slate-100 p-3 sm:block">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
            Data room
          </p>
          {FRAME_NAV.map((item) => (
            <div
              key={item.label}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                item.active ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-400',
              )}
            >
              <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
            </div>
          ))}
        </div>

        {/* File table */}
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white">
              <Upload className="h-3 w-3" aria-hidden="true" />
              Upload
            </span>
            <span className="hidden w-40 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-400 md:block">
              Search documents…
            </span>
            <span className="ml-auto text-[11px] text-slate-400">847 documents</span>
          </div>
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
            {FRAME_ROWS.map((row) => (
              <div key={row.name} className="flex items-center gap-2.5 px-3 py-2.5">
                <row.icon className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate text-xs font-medium text-slate-700">{row.name}</span>
                {row.badge && (
                  <span className="hidden flex-shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 sm:block">
                    Watermarked
                  </span>
                )}
                <span className="ml-auto flex-shrink-0 text-[11px] text-slate-400">{row.meta}</span>
                <span className="hidden w-16 flex-shrink-0 text-right text-[11px] text-slate-400 md:block">
                  {row.date}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit rail */}
        <div className="hidden w-56 flex-shrink-0 border-l border-slate-100 p-4 lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Live audit trail
          </p>
          <div className="mt-3 space-y-3">
            {FRAME_AUDIT.map((entry) => (
              <div key={entry.text} className="flex items-start gap-2">
                <span className={cn('mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full', entry.dot)} />
                <div className="min-w-0">
                  <p className="text-[11px] leading-snug text-slate-600">{entry.text}</p>
                  <p className="text-[10px] text-slate-300">{entry.time}</p>
                </div>
              </div>
            ))}
          </div>
          <m.div
            className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-2.5"
            animate={reduceMotion ? undefined : { opacity: [0, 1, 1, 0], y: [8, 0, 0, -4] }}
            transition={{ duration: 5, times: [0, 0.08, 0.85, 1], repeat: Infinity, repeatDelay: 2.5, delay: 1.2 }}
          >
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
              <Stamp className="h-3 w-3" aria-hidden="true" />
              Watermark applied
            </p>
            <p className="mt-0.5 text-[10px] text-blue-600/80">rahul.m@lenders.in · Asset Schedule.xlsx</p>
          </m.div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  const reduceMotion = useReducedMotion();
  const anim = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section className="relative overflow-hidden bg-mk-bg pt-16" aria-labelledby="hero-headline">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(60%_50%_at_50%_0%,#f1f5f9_0%,transparent_100%)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <m.div {...anim(0.05)}>
            <SectionLabel>Enterprise virtual data room</SectionLabel>
          </m.div>
          <m.h1
            id="hero-headline"
            {...anim(0.15)}
            className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-mk-text sm:text-5xl lg:text-[3.4rem]"
          >
            Every document. Every access.{' '}
            <span className="text-blue-700">Accounted for.</span>
          </m.h1>
          <m.p {...anim(0.28)} className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-mk-t2">
            The virtual data room for CIRP, liquidation, and M&amp;A due diligence — dynamic
            watermarking, eight-role access control, and a court-ready audit trail.
          </m.p>
          <m.div {...anim(0.4)} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/book-demo"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Book a live demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-mk-t2 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              Talk to an expert
            </Link>
          </m.div>
          <m.p {...anim(0.5)} className="mt-6 text-xs text-mk-t4">
            Guided onboarding &nbsp;·&nbsp; Data rooms live in a day &nbsp;·&nbsp; Built for IBC
            workflows
          </m.p>
        </div>

        <m.div {...anim(0.55)} className="mx-auto mt-12 max-w-5xl sm:mt-14">
          <AppFrame />
        </m.div>
      </div>
    </section>
  );
}

// ─── 2. Credibility band ─────────────────────────────────────────────────────

const CRED_ITEMS = [
  { icon: Gavel, label: 'Built for IBC workflows', sub: 'CIRP · Liquidation · M&A' },
  { icon: Stamp, label: '100% of downloads watermarked', sub: 'Server-side, every page' },
  { icon: Users, label: '8 access roles', sub: 'Modelled on real proceedings' },
  { icon: FileUp, label: '2 GB file uploads', sub: 'Folder upload and versioning' },
];

function CredibilityBand() {
  return (
    <section className="border-y border-slate-200 bg-mk-s1">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {CRED_ITEMS.map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
              <item.icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-mk-text">{item.label}</p>
              <p className="mt-0.5 text-xs text-mk-t3">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 3. Product showcase — shown, not described ──────────────────────────────

function FilesMock() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white">
          <Upload className="h-3 w-3" aria-hidden="true" />
          Upload
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500">
          <FolderPlus className="h-3 w-3" aria-hidden="true" />
          New folder
        </span>
        <span className="ml-auto hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 sm:block">
          CIRP folder set · 12 folders
        </span>
      </div>
      <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <Folder className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate text-xs font-medium text-slate-700">01 · Financial Statements</span>
          <span className="ml-auto text-[11px] text-slate-400">24 files</span>
        </div>
        <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-2.5">
          <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate text-xs font-medium text-slate-900">Information Memorandum.pdf</span>
          <span className="ml-auto flex items-center gap-1">
            <span className="rounded-md bg-white p-1 text-slate-400 shadow-soft"><Download className="h-3 w-3" aria-hidden="true" /></span>
            <span className="rounded-md bg-white p-1 text-slate-400 shadow-soft"><History className="h-3 w-3" aria-hidden="true" /></span>
            <span className="rounded-md bg-white p-1 text-slate-400 shadow-soft"><PenLine className="h-3 w-3" aria-hidden="true" /></span>
          </span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate text-xs font-medium text-slate-700">Claims Register.xlsx</span>
          <span className="ml-auto text-[11px] text-slate-400">12.8 MB</span>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
          <span className="flex items-center gap-1.5">
            <FileUp className="h-3 w-3 text-blue-700" aria-hidden="true" />
            Valuation Report — Final.pdf
          </span>
          <span className="text-slate-400">18.4 MB</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
          <m.div
            className="h-full rounded-full bg-blue-600"
            animate={reduceMotion ? { width: '100%' } : { width: ['8%', '100%'] }}
            transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </div>
  );
}

function WatermarkMock() {
  const reduceMotion = useReducedMotion();
  const lineWidths = ['82%', '94%', '76%', '88%', '68%', '90%', '80%', '58%'];
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-medium text-slate-600">
          <FileText className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate">Information Memorandum.pdf — Preview</span>
        </span>
        <span className="flex-shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
          Watermarked
        </span>
      </div>
      <div className="relative mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white p-6">
        <div className="space-y-2.5">
          <div className="h-2.5 w-2/5 rounded bg-slate-200" />
          {lineWidths.map((width, i) => (
            <div key={i} className="h-2 rounded bg-slate-100" style={{ width }} />
          ))}
        </div>
        <m.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-9"
          animate={reduceMotion ? undefined : { opacity: [0.45, 0.85, 0.45] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="-rotate-[24deg] whitespace-nowrap text-[11px] font-semibold tracking-widest text-blue-600/50"
            >
              rahul.mehta@lenders.in · 02 JUL 2026 · 14:05 IST
            </span>
          ))}
        </m.div>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Applied server-side to previews and downloads — recipients can&apos;t remove it.
      </p>
    </div>
  );
}

const PERM_ROLES = ['RP / Liquidator', 'PRA', 'CoC', 'Auditor'];
const PERM_ROWS: { perm: string; values: (boolean | 'wm')[] }[] = [
  { perm: 'View documents', values: [true, true, true, true] },
  { perm: 'Download files', values: [true, 'wm', 'wm', 'wm'] },
  { perm: 'Upload & organise', values: [true, false, false, false] },
  { perm: 'Invite members', values: [true, false, false, false] },
];

function PermissionsMock() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-600">Role permissions — per data room</span>
        <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          8 roles available
        </span>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
        <div className="grid grid-cols-[1.4fr,repeat(4,1fr)] border-b border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Permission
          </span>
          {PERM_ROLES.map((role) => (
            <span
              key={role}
              className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400"
            >
              {role}
            </span>
          ))}
        </div>
        {PERM_ROWS.map((row, rowIdx) => (
          <div
            key={row.perm}
            className={cn(
              'grid grid-cols-[1.4fr,repeat(4,1fr)] items-center px-3 py-2.5',
              rowIdx % 2 === 1 && 'bg-slate-50/50',
            )}
          >
            <span className="text-xs font-medium text-slate-700">{row.perm}</span>
            {row.values.map((value, i) => (
              <span key={i} className="flex justify-center">
                {value === true ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                ) : value === 'wm' ? (
                  <m.span
                    className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-blue-700"
                    animate={reduceMotion ? undefined : { scale: [1, 1.12, 1] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    WM
                  </m.span>
                ) : (
                  <Minus className="h-3.5 w-3.5 text-slate-200" aria-hidden="true" />
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        WM — downloads permitted with a personalised watermark only.
      </p>
    </div>
  );
}

const AUDIT_ENTRIES = [
  { time: '14:05:22', actor: 'Priya Sharma', action: 'Downloaded', target: 'Asset Schedule.xlsx', ip: '103.27.9.14' },
  { time: '14:03:10', actor: 'Rahul Mehta', action: 'Viewed', target: 'Information Memorandum.pdf', ip: '49.36.12.88' },
  { time: '13:58:41', actor: 'Admin (RP)', action: 'Updated role', target: 'PRA → view only', ip: '122.161.4.2' },
  { time: '13:51:03', actor: 'Nikhil Rao', action: 'Logged in', target: '2FA verified', ip: '13.234.1.77' },
];

function AuditMock() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-600">Audit trail — every event, attributed</span>
        <span className="flex flex-shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500">
          <Download className="h-3 w-3" aria-hidden="true" />
          Export for NCLT
        </span>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
        <div className="grid grid-cols-[70px,1.1fr,1.5fr,90px] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 sm:grid-cols-[70px,1.1fr,1.6fr,100px]">
          {['Time', 'User', 'Action', 'IP'].map((header) => (
            <span key={header} className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {header}
            </span>
          ))}
        </div>
        {AUDIT_ENTRIES.map((entry, i) => (
          <m.div
            key={entry.time}
            className={cn(
              'grid grid-cols-[70px,1.1fr,1.5fr,90px] items-center gap-2 px-3 py-2.5 sm:grid-cols-[70px,1.1fr,1.6fr,100px]',
              i % 2 === 1 && 'bg-slate-50/50',
            )}
            animate={
              i === 0 && !reduceMotion ? { opacity: [0, 1], x: [-10, 0] } : undefined
            }
            transition={{ duration: 0.45, repeat: Infinity, repeatDelay: 4.6, ease: 'easeOut' }}
          >
            <span className="font-mono text-[10px] text-slate-400">{entry.time}</span>
            <span className="truncate text-xs font-medium text-slate-700">{entry.actor}</span>
            <span className="truncate text-xs text-slate-500">
              {entry.action} · {entry.target}
            </span>
            <span className="truncate font-mono text-[10px] text-slate-400">{entry.ip}</span>
          </m.div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Actor, action, document, timestamp, and IP — exportable as structured data.
      </p>
    </div>
  );
}

const REPORT_BARS = [42, 65, 50, 78, 58, 92, 70];

function ReportsMock() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-600">Download &amp; view activity — last 7 days</span>
        <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          CSV · Excel · PDF
        </span>
      </div>
      <div className="mt-4 flex h-32 items-end gap-2 sm:h-36">
        {REPORT_BARS.map((height, i) => (
          <m.div
            key={i}
            className="flex-1 rounded-t-md bg-blue-600/80"
            initial={reduceMotion ? false : { height: 0 }}
            animate={{ height: `${height}%` }}
            transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <span key={day} className="flex-1 text-center text-[10px] text-slate-300">
            {day}
          </span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: 'Downloads', value: '312' },
          { label: 'Views', value: '1,204' },
          { label: 'Active users', value: '24' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-sm font-bold text-slate-800">{stat.value}</p>
            <p className="text-[10px] text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportMock() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2.5">
          <Cloud className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <span className="text-xs font-semibold text-slate-800">Google Drive</span>
          <Check className="ml-auto h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5">
          <Cloud className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <span className="text-xs font-medium text-slate-600">Microsoft OneDrive</span>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-slate-100 p-3">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
          <span>Importing “Board &amp; Committee Papers”</span>
          <span className="text-slate-400">34 files</span>
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-slate-400" aria-hidden="true" />
                Minutes — 14th CoC Meeting.pdf
              </span>
              <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-emerald-500/80" />
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-3 w-3 text-slate-400" aria-hidden="true" />
                Creditor Claims — Consolidated.xlsx
              </span>
              <span className="text-slate-400">…</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
              <m.div
                className="h-full rounded-full bg-blue-600"
                animate={reduceMotion ? { width: '100%' } : { width: ['10%', '92%'] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
              />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Folder structure preserved — no re-organising after import.
      </p>
    </div>
  );
}

interface ShowcaseTab {
  id: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  label: string;
  bullets: string[];
  Mock: React.ComponentType;
}

const SHOWCASE_TABS: ShowcaseTab[] = [
  {
    id: 'data-rooms',
    icon: FolderLock,
    label: 'Data rooms & files',
    bullets: [
      'CIRP-ready folder taxonomy out of the box',
      '2 GB per file, folder upload, versioning',
      'PDF and Office preview without download',
    ],
    Mock: FilesMock,
  },
  {
    id: 'watermarking',
    icon: Stamp,
    label: 'Dynamic watermarking',
    bullets: [
      'Name, email, and timestamp on every page',
      'Applied server-side — cannot be stripped',
      'Covers previews and downloads alike',
    ],
    Mock: WatermarkMock,
  },
  {
    id: 'permissions',
    icon: KeyRound,
    label: 'Permissions & RBAC',
    bullets: [
      'Eight roles modelled on real proceedings',
      'Per-room overrides for external parties',
      'Download policy control per data room',
    ],
    Mock: PermissionsMock,
  },
  {
    id: 'audit-trail',
    icon: History,
    label: 'Audit trail',
    bullets: [
      'Every view and download recorded',
      'Actor, document, timestamp, and IP',
      'Exportable for NCLT / IBBI submission',
    ],
    Mock: AuditMock,
  },
  {
    id: 'reports',
    icon: BarChart3,
    label: 'Reports & analytics',
    bullets: [
      'Download and view trends per period',
      'Per-user activity summaries',
      'Export as CSV, Excel, or PDF',
    ],
    Mock: ReportsMock,
  },
  {
    id: 'cloud-import',
    icon: Cloud,
    label: 'Cloud import',
    bullets: [
      'Bring folders from Google Drive',
      'Import from Microsoft OneDrive',
      'Structure preserved, progress tracked',
    ],
    Mock: ImportMock,
  },
];

function ShowcaseSection() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();

  // Nav dropdown deep-links (/#watermarking etc.) select the matching tab.
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '');
      const index = SHOWCASE_TABS.findIndex((tab) => tab.id === hash);
      if (index >= 0) {
        setActive(index);
        setPaused(true);
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  // Auto-advance until the visitor interacts with the tabs.
  useEffect(() => {
    if (paused || reduceMotion) return;
    const timer = setInterval(() => {
      setActive((current) => (current + 1) % SHOWCASE_TABS.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [paused, reduceMotion]);

  const activeTab = SHOWCASE_TABS[active];
  const ActiveMock = activeTab.Mock;

  return (
    <section id="platform" className="bg-mk-s1 py-20 sm:py-24" aria-labelledby="platform-heading">
      <div aria-hidden="true">
        {SHOWCASE_TABS.map((tab) => (
          <span key={tab.id} id={tab.id} className="block scroll-mt-24" />
        ))}
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionLabel>Platform</SectionLabel>
          <h2
            id="platform-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-mk-text sm:text-4xl"
          >
            The platform, shown — not described.
          </h2>
          <p className="mt-4 text-mk-t2">
            Every screen below is the real product. Ask us to demonstrate any of them live.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-[280px,minmax(0,1fr)] lg:gap-10">
          {/* Tab rail — horizontal chips on mobile, vertical list on desktop */}
          <div
            className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0"
            role="tablist"
            aria-label="Platform capabilities"
          >
            {SHOWCASE_TABS.map((tab, index) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={index === active}
                onClick={() => {
                  setActive(index);
                  setPaused(true);
                }}
                className={cn(
                  'flex flex-shrink-0 items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors lg:w-full',
                  index === active
                    ? 'border-slate-200 bg-white font-semibold text-slate-900 shadow-soft'
                    : 'border-transparent text-mk-t3 hover:bg-white/70 hover:text-slate-700',
                )}
              >
                <tab.icon
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    index === active ? 'text-blue-700' : 'text-slate-400',
                  )}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap lg:whitespace-normal">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active panel */}
          <div className="min-w-0" onMouseEnter={() => setPaused(true)}>
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={activeTab.id}
                initial={reduceMotion ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: -10 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
              >
                <div className="min-h-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card sm:min-h-[340px]">
                  <ActiveMock />
                </div>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                  {activeTab.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-2 text-xs leading-relaxed text-mk-t2">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-700" aria-hidden="true" />
                      {bullet}
                    </div>
                  ))}
                </div>
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 4. Security & trust ─────────────────────────────────────────────────────

const TRUST_ROWS = [
  {
    icon: Stamp,
    title: 'Dynamic watermarking',
    body: 'Name, email, and timestamp applied server-side to every page of every preview and download.',
  },
  {
    icon: History,
    title: 'Complete audit trail',
    body: 'Every view and download recorded with actor, document, timestamp, and IP — exportable for NCLT or IBBI submission.',
  },
  {
    icon: KeyRound,
    title: 'Granular access control',
    body: 'Eight roles modelled on real proceedings — RP, PRA, CoC member, auditor, legal advisor — with per-room overrides.',
  },
  {
    icon: Lock,
    title: 'Encryption & isolation',
    body: 'Encrypted in transit and at rest, IP allowlisting, and optional NDA gating per data room.',
  },
];

const AUDIENCES = [
  {
    title: 'Resolution professionals',
    body: 'Run CIRP and liquidation with CoC, PRAs, and auditors in one controlled room.',
  },
  {
    title: 'Law firms',
    body: 'Share privileged documents with external counsel on your terms.',
  },
  {
    title: 'Banks & ARCs',
    body: 'Evaluate stressed assets with watermarked, view-only access.',
  },
  {
    title: 'Corporate deal teams',
    body: 'Close M&A and fundraising diligence without email attachments.',
  },
];

function TrustSection() {
  return (
    <section className="bg-mk-bg py-20 sm:py-24" aria-labelledby="trust-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr,1.2fr] lg:gap-16">
          <Reveal>
            <SectionLabel>Security</SectionLabel>
            <h2
              id="trust-heading"
              className="mt-4 text-3xl font-bold tracking-tight text-mk-text sm:text-4xl"
            >
              Security that stands up to scrutiny.
            </h2>
            <p className="mt-4 leading-relaxed text-mk-t2">
              When the documents are a company&apos;s most sensitive, &ldquo;trust us&rdquo; is not
              an answer. Every control here is verifiable in the product — ask us to show you any of
              them live.
            </p>
            <Link
              href="/security"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800"
            >
              Read the security overview
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-soft">
              {TRUST_ROWS.map((row) => (
                <div key={row.title} className="flex items-start gap-4 p-5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <row.icon className="h-4 w-4 text-slate-600" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-mk-text">{row.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-mk-t3">{row.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-mk-t4">Who it serves</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((audience) => (
              <div key={audience.title} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-mk-text">{audience.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-mk-t3">{audience.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 5. Pricing — single source ──────────────────────────────────────────────

function PricingTeaser() {
  return (
    <section className="border-t border-slate-200 bg-mk-s1 py-20 sm:py-24" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionLabel>Pricing</SectionLabel>
          <h2
            id="pricing-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-mk-text sm:text-4xl"
          >
            Pay for storage. Everything else is included.
          </h2>
          <p className="mt-4 text-mk-t2">
            No per-user seat fees. No feature gating by tier. No hidden charges.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PLAN_IDS.map((id, index) => {
            const highlighted = id === 'PROFESSIONAL';
            return (
              <Reveal key={id} delay={index * 0.08} className="h-full">
                <PlanCard
                  planId={id}
                  compact
                  highlighted={highlighted}
                  cta={
                    <Link
                      href="/book-demo"
                      className={cn(
                        'block w-full rounded-md py-2.5 text-center text-sm font-semibold transition-colors',
                        highlighted
                          ? 'bg-slate-900 text-white hover:bg-slate-700'
                          : 'border border-slate-300 text-mk-t2 hover:border-slate-400 hover:text-slate-900',
                      )}
                    >
                      Book a demo
                    </Link>
                  }
                />
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.2} className="mt-8 text-center">
          <Link
            href="/pricing"
            className="text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800"
          >
            See full pricing &amp; calculator →
          </Link>
          <p className="mt-2 text-xs text-mk-t4">
            Every plan includes watermarking, RBAC, audit trail, office preview, and cloud import.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 6. Closing CTA ──────────────────────────────────────────────────────────

function ClosingCta() {
  return (
    <section className="bg-slate-900 py-20" aria-labelledby="closing-heading">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <h2 id="closing-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            See your data room before you commit.
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-slate-400">
            A 30-minute guided walkthrough with a specialist — your use case, your questions, the
            real product. No trial accounts; every engagement starts with a working session.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/book-demo"
              className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
            >
              Book a live demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/book-demo#callback"
              className="inline-flex items-center rounded-md border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-400 hover:text-white"
            >
              Request a callback
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function MarketingHomeContent() {
  return (
    <MotionProvider>
      <HeroSection />
      <CredibilityBand />
      <ShowcaseSection />
      <TrustSection />
      <PricingTeaser />
      <ClosingCta />
    </MotionProvider>
  );
}
