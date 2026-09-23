/** Original mark: five district columns, Baiterek's sphere and a river line. */
export function BrandMark({ className }: { readonly className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="46" height="46" rx="12" fill="#006B60" />
    <path d="M9 31V25M16 31V20M24 31V21M32 31V20M39 31V25" stroke="#F8FAF5" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M19 18L24 23L29 18" stroke="#F8FAF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="24" cy="12" r="4.5" fill="#E8BF72" />
    <path d="M9 38C15 34 19 41 25 38S34 35 39 37" stroke="#E8BF72" strokeWidth="2.5" strokeLinecap="round" />
  </svg>;
}
