export function Footer() {
  return (
    <footer className="relative border-t border-terminal-border py-4">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 font-mono text-xs text-terminal-text-dim">
        <span className="flex items-center gap-1.5">
          <span className="net-dot animate-pulse" />
          ghost-terminal — don't look at your keyboard
        </span>
        <span className="flex items-center gap-3">
          <span>
            <kbd className="kbd">tab</kbd> restart
          </span>
          <span>
            <kbd className="kbd">enter</kbd> next test
          </span>
          <span>
            <kbd className="kbd">esc</kbd> restart
          </span>
        </span>
      </div>
    </footer>
  )
}
