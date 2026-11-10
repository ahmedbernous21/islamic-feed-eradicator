import type { ReactNode } from 'react';
import type { SiteId } from '../shared/sites/types';

const ICONS: Record<SiteId, { label: string; className: string; svg: ReactNode }> = {
  youtube: {
    label: 'YouTube',
    className: 'site-youtube',
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 8.2v7.6L17 12 10 8.2z" fill="#fff" />
      </svg>
    ),
  },
  instagram: {
    label: 'Instagram',
    className: 'site-instagram',
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.2" cy="6.8" r="1.1" />
      </svg>
    ),
  },
  facebook: {
    label: 'Facebook',
    className: 'site-facebook',
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-1c0-.6.4-1 1-1z" fill="#fff" />
      </svg>
    ),
  },
  linkedin: {
    label: 'LinkedIn',
    className: 'site-linkedin',
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.5 9.5H4.8v9.7h2.7V9.5zM6.15 4.2c-.9 0-1.65.75-1.65 1.65S5.25 7.5 6.15 7.5 7.8 6.75 7.8 5.85 7.05 4.2 6.15 4.2zM19.2 12.3c0-2.4-1.3-3.5-3.05-3.5-1.4 0-2.05.78-2.4 1.32V9.5H11.1c.04.8 0 9.7 0 9.7h2.65v-5.4c0-.3.02-.58.11-.79.23-.58.77-1.18 1.66-1.18 1.17 0 1.64.89 1.64 2.2v5.17H19.2V12.3z" fill="#fff" />
      </svg>
    ),
  },
};

export function SiteIcon({ id }: { id: SiteId }) {
  const icon = ICONS[id];
  return (
    <span className={`site-mark ${icon.className}`} title={icon.label}>
      {icon.svg}
    </span>
  );
}
