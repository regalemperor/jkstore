export default function SiteFooter() {
  return (
    <footer className="border-t border-black/10 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <p className="text-lg font-black tracking-[-0.04em]">JKSTORE</p>
          <p className="mt-1 text-sm text-black/50">Built for modern shopping.</p>
        </div>
        <p className="text-xs text-black/40">© {new Date().getFullYear()} JKSTORE</p>
      </div>
    </footer>
  );
}