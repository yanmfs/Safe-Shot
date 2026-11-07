export function Logo({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <rect width="100" height="100" rx="22" fill="#F5B700" />
      <rect x="22" y="26" width="34" height="9" rx="4.5" fill="#111316" />
      <rect x="22" y="44" width="56" height="9" rx="4.5" fill="#111316" opacity=".35" />
      <rect x="18" y="60" width="64" height="16" rx="4" fill="#111316" />
    </svg>
  );
}
