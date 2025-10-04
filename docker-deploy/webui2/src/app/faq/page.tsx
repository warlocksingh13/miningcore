'use client';

import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const FAQ_ENTRIES = [
  {
    question: 'How often does the pool update hashrate statistics?',
    answer:
      'Miningcore aggregates share data every few seconds. The WebUI refreshes the API every 30 seconds and can subscribe to WebSocket pushes when enabled.',
  },
  {
    question: 'Can I keep using my Ethproxy / getwork-only miners?',
    answer:
      'Yes. The pool runs a dedicated getwork bridge that authenticates wallets, forwards work to Miningcore, and keeps per-miner accounting intact. Use the low-diff port while validating new hardware.',
  },
  {
    question: 'Where do I find payout details and transaction hashes?',
    answer:
      'Open the Pools dashboard and scroll to “Recent payouts” or query your wallet under the Miners page. Each payout entry includes the transaction hash and timestamp.',
  },
  {
    question: 'How can I get alerted when a worker goes offline?',
    answer:
      'Email and webhook notifications are on the roadmap. For now, bookmark the Miners page with your wallet query and enable browser notifications for quick checks.',
  },
  {
    question: 'Does this UI expose API keys or require authentication?',
    answer:
      'Read-only statistics are public. Miner-specific details require knowing the wallet address. Admin operations remain secured within your existing Miningcore deployment.',
  },
];

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.34em] text-slate-300">FAQ</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Everything you need to keep miners online</h1>
        <p className="mt-3 text-sm text-slate-400">
          Answers to the most common questions about payouts, monitoring, and connection tuning. Still stuck? Reach out via the
          support page.
        </p>
      </div>

      <div className="space-y-3">
        {FAQ_ENTRIES.map((item) => (
          <Disclosure key={item.question}>
            {({ open }) => (
              <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60">
                <Disclosure.Button className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-slate-200">
                  <span>{item.question}</span>
                  <ChevronDownIcon
                    className={`h-5 w-5 transition-transform ${open ? 'rotate-180 text-neutral-300' : 'text-slate-500'}`}
                  />
                </Disclosure.Button>
                <Disclosure.Panel className="border-t border-slate-800/70 px-5 py-4 text-sm text-slate-400">
                  {item.answer}
                </Disclosure.Panel>
              </div>
            )}
          </Disclosure>
        ))}
      </div>
    </div>
  );
}
