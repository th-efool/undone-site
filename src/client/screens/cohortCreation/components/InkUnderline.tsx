/** Same two-stroke flourish as the homepage asset, stretched to the heading's width. */
export function InkUnderline({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 160 16" preserveAspectRatio="none" fill="none" aria-hidden="true">
    <path d="M3 10.5C28 13.2 58 14.5 88 11.5C118 8.5 142 5.5 157 7.2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    <path d="M14 13.2C44 15 76 14.8 106 12.2C128 10.2 146 7.8 155 9.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
  </svg>;
}
