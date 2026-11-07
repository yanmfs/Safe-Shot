export function Logo({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <rect width="100" height="100" rx="22" fill="#0F1520" />
      <rect x="22" y="25" width="40" height="9" rx="4.5" fill="#E8ECF4" />
      <rect x="22" y="45" width="56" height="9" rx="4.5" fill="#E8ECF4" opacity=".4" />
      <rect x="16" y="40" width="68" height="19" rx="4" fill="#F0B100" />
      <rect x="22" y="66" width="30" height="9" rx="4.5" fill="#E8ECF4" />
    </svg>
  );
}
