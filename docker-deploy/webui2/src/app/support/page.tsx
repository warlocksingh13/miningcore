'use client';

import Link from 'next/link';

const SUPPORT_CHANNELS = [
  {
    title: 'Open a support ticket',
    description:
      'Submit a request with your wallet address, miner type, and last known good timestamp. We respond within business hours.',
    action: {
      label: 'Create ticket',
      href: 'mailto:support@cascadepool.local?subject=Support%20request',
    },
  },
  {
    title: 'View decisions log',
    description:
      'Track configuration changes, deployments, and troubleshooting steps in real time via the decisions dashboard.',
    action: {
      label: 'Open decisions UI',
      href: 'http://192.168.2.100/decisions/',
    },
  },
  {
    title: 'Join Discord',
    description: 'Collaborate with other operators, share tuning tips, and get notified of maintenance windows.',
    action: {
      label: 'Launch Discord',
      href: 'https://discord.gg/your-pool',
    },
  },
];

const CHECKLIST = [
  'Time of issue and miner type (Jasminer X4, etc).',
  'Wallet address and worker name(s) impacted.',
  'Latency readings from the Connect page (green/amber/red).',
  'Relevant log excerpts from Miningcore or the getwork bridge.',
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-800/60 bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.28),_transparent_60%)] p-8">
        <h1 className="text-3xl font-semibold text-white">We are here when your hashrate drops</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-200">
          Provide the right telemetry up front and we will help you restore healthy shares fast. Our team has direct access to
          Miningcore logs, the getwork bridge, and node telemetry for rapid triage.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {SUPPORT_CHANNELS.map((channel) => (
          <div key={channel.title} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-5">
            <h2 className="text-base font-semibold text-white">{channel.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{channel.description}</p>
            <Link
              href={channel.action.href}
              className="mt-5 inline-flex items-center justify-center rounded-xl border border-rose-500/60 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
            >
              {channel.action.label}
            </Link>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Checklist before you open a ticket</h2>
        <p className="mt-2 text-sm text-slate-400">
          Gather the following so we can reproduce the issue and roll out a fix quickly.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {CHECKLIST.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          For urgent outages, message the on-call contact listed in <code className="rounded bg-slate-800/80 px-1">decisions.md</code> and mirror details via email.
        </p>
      </section>
    </div>
  );
}
