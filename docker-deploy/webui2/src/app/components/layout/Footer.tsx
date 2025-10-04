export const Footer = () => (
  <footer className="border-t border-slate-800/60 bg-slate-950/70">
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <p>© {new Date().getFullYear()} Miningcore WebUI 2. Built for resilient getwork + stratum mining.</p>
      <div className="flex flex-wrap gap-3 text-slate-400">
        <a className="transition hover:text-neutral-100" href="https://smartpoolmining.com/" target="_blank" rel="noreferrer">
          Inspiration
        </a>
        <a className="transition hover:text-neutral-100" href="https://github.com/coinfoundry/miningcore" target="_blank" rel="noreferrer">
          Miningcore
        </a>
        <a className="transition hover:text-neutral-100" href="mailto:support@cascadepool.local">
          Email support
        </a>
      </div>
    </div>
  </footer>
);

export default Footer;
