// Ícones de traço fino (24×24), desenhados à mão para combinar com o visual editorial.
const PATHS = {
  passport: <><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="10" r="3.2" /><path d="M8.8 10h6.4M12 6.8c1 1 1 5.4 0 6.4M12 6.8c-1 1-1 5.4 0 6.4M9 17h6" /></>,
  syringe: <><path d="M18 3l3 3M16.5 4.5l3 3M19 6l-9.5 9.5-3-3L16 3" /><path d="M7.5 13.5l-3 3 3 3 3-3M4.5 16.5L3 21M11 9l1.5 1.5M9 11l1.5 1.5" /></>,
  school: <><path d="M2.5 9L12 4.5 21.5 9 12 13.5z" /><path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11M21.5 9v5" /></>,
  home: <><path d="M3.5 11L12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20" /></>,
  shield: <><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" /><path d="M9 12l2 2 4-4" /></>,
  folder: <><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></>,
  phone: <path d="M5 4h3.5l1.5 4-2 1.3a11 11 0 006.2 6.2L15.5 13.5l4 1.5V18.5a1.5 1.5 0 01-1.6 1.5C10 19.5 4.5 14 4 6.1A1.5 1.5 0 015 4z" />,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></>,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  plane: <path d="M10.5 13.5L3 11l1.5-1.5 7.5 1L16.5 6c1-1 2.8-1.6 3.3-1.1.5.5-.1 2.3-1.1 3.3L14 12.7l1 7.5-1.5 1.5-2.5-7.5-3.5 3.3.3 2.5-1.3 1.2-1.4-3.4L1.7 16.4 3 15.1l2.5.3z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  cart: <><path d="M3 4h2.5l2.2 11h10.6l2-8H6.6" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  pill: <><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M9.5 9.5l5 5" /></>,
  cross: <><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" /></>,
  badge: <><path d="M12 3l2.4 1.8 3-.3.8 2.9 2.5 1.7-1.1 2.9 1.1 2.9-2.5 1.7-.8 2.9-3-.3L12 21l-2.4-1.8-3 .3-.8-2.9-2.5-1.7 1.1-2.9-1.1-2.9 2.5-1.7.8-2.9 3 .3z" /><path d="M12 8.5l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" /></>,
  route: <><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8 18h7a3 3 0 000-6H9a3 3 0 010-6h7" /></>,
  fork: <path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M16.5 21V3c-2 1.5-3 4-3 7.5h3" />,
  glass: <path d="M6 4h12l-6 8zM12 12v8M8.5 20h7M7.5 6h9" />,
  music: <><path d="M9 18V5.5l10-2V16" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  wifi: <><path d="M3.5 9.5a12 12 0 0117 0M6.5 12.7a7.5 7.5 0 0111 0M9.4 15.8a3.2 3.2 0 015.2 0" /><circle cx="12" cy="18.8" r="1" /></>,
  star: <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  dumbbell: <><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></>,
  swap: <path d="M7 4v16M7 4L4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  walk: <><circle cx="13" cy="4.5" r="1.8" /><path d="M10 21l2-6 2.5 2.5V21M8 12l2-4.5 3.5.5 2 3 2.5 1M12 15l-1-4" /></>,
  car: <><path d="M4 16v-4l2-5h12l2 5v4z" /><path d="M4 12h16" /><circle cx="7.5" cy="16.5" r="1.5" /><circle cx="16.5" cy="16.5" r="1.5" /></>,
  bus: <><rect x="5" y="3.5" width="14" height="14" rx="2.5" /><path d="M5 11h14M8 17.5V20M16 17.5V20" /><circle cx="8.5" cy="14.3" r=".6" /><circle cx="15.5" cy="14.3" r=".6" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  map: <path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6zM9 4v14M15 6v14" />,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
}

export default function Icon({ name, size = 22, stroke = 1.5, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] || PATHS.folder}
    </svg>
  )
}
