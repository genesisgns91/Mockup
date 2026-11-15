/*
  Ícones de traço usados no app (mesmo desenho no celular e no desktop).
*/
export function Icon({ name, size = 22 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  switch (name) {
    case 'cube':
      return (
        <svg {...common}>
          <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
          <path d="M4 7.5 12 12l8-4.5M12 12v9" />
        </svg>
      )
    case 'image':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m4 17 5-4.5 3.5 3L16 12l4 4.5" />
        </svg>
      )
    case 'palette':
      return (
        <svg {...common}>
          <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.3-1.6-1.3-2.8 0-1 .8-1.7 1.8-1.7H17a3.5 3.5 0 0 0 3.5-3.5C20.5 6.9 16.7 3.5 12 3.5Z" />
          <circle cx="7.8" cy="11" r=".9" fill="currentColor" />
          <circle cx="10.2" cy="7.6" r=".9" fill="currentColor" />
          <circle cx="14.4" cy="7.6" r=".9" fill="currentColor" />
        </svg>
      )
    case 'layers':
      return (
        <svg {...common}>
          <path d="m12 3.5 8.5 4.7L12 13 3.5 8.2 12 3.5Z" />
          <path d="m3.5 12.2 8.5 4.8 8.5-4.8" />
          <path d="m3.5 16.2 8.5 4.8 8.5-4.8" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 4v11" />
          <path d="m7.5 11 4.5 4.5 4.5-4.5" />
          <path d="M5 19.5h14" />
        </svg>
      )
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.8" />
        </svg>
      )
    case 'eye-off':
      return (
        <svg {...common}>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.7c.45-.1.9-.2 1.4-.2 6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.5 7.2A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-.95" />
          <path d="M9.9 9.9a2.8 2.8 0 0 0 4.2 3.7" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...common}>
          <path d="m7 10 5 5 5-5" />
        </svg>
      )
    case 'expand':
      return (
        <svg {...common}>
          <path d="m7 14 5-5 5 5" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'external':
      return (
        <svg {...common}>
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      )
    case 'reset':
      return (
        <svg {...common}>
          <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
          <path d="M3.5 4.5v4.2h4.2" />
        </svg>
      )
    case 'arrow-right':
      return (
        <svg {...common}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )
    case 'arrow-left':
      return (
        <svg {...common}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      )
    case 'arrow-down':
      return (
        <svg {...common}>
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      )
    case 'undo':
      return (
        <svg {...common}>
          <path d="M9 7 4.5 11.5 9 16" />
          <path d="M4.5 11.5H15a4.5 4.5 0 0 1 0 9h-3" />
        </svg>
      )
    case 'redo':
      return (
        <svg {...common}>
          <path d="m15 7 4.5 4.5L15 16" />
          <path d="M19.5 11.5H9a4.5 4.5 0 0 0 0 9h3" />
        </svg>
      )
    case 'ruler':
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="8" rx="2" />
          <path d="M7 8v3M11 8v4M15 8v3M19 8v2" />
        </svg>
      )
    case 'sliders':
      return (
        <svg {...common}>
          <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
          <circle cx="15" cy="7" r="2" />
          <circle cx="9" cy="17" r="2" />
        </svg>
      )
    case 'sheet':
      return (
        <svg {...common}>
          <path d="M7 3.5h7l4 4v13H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
          <path d="M14 3.5V8h4" />
          <path d="M9 12.5h6M9 16h4" />
        </svg>
      )
    case 'flip':
      return (
        <svg {...common}>
          <path d="M12 3v18" strokeDasharray="2 3" />
          <path d="M8.5 7 4 12l4.5 5V7Z" />
          <path d="m15.5 7 4.5 5-4.5 5V7Z" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l.8 12.5h9.4L17.5 7" />
        </svg>
      )
    case 'upload':
      return (
        <svg {...common}>
          <path d="M12 16V5M7.5 9 12 4.5 16.5 9" />
          <path d="M5 19.5h14" />
        </svg>
      )
    case 'back':
      return (
        <svg {...common}>
          <path d="m14.5 5-7 7 7 7" />
        </svg>
      )
    case 'rotate-cw':
      return (
        <svg {...common}>
          <path d="M20 5v5h-5" />
          <path d="M19.5 10A8 8 0 1 0 20 13" />
        </svg>
      )
    case 'rotate-ccw':
      return (
        <svg {...common}>
          <path d="M4 5v5h5" />
          <path d="M4.5 10A8 8 0 1 1 4 13" />
        </svg>
      )
    case 'copy':
      return (
        <svg {...common}>
          <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
          <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
        </svg>
      )
    case 'to-front':
      return (
        <svg {...common}>
          <rect x="3.5" y="9" width="11" height="11" rx="2" />
          <path d="M9.5 15V5.5a2 2 0 0 1 2-2H18a2.5 2.5 0 0 1 2.5 2.5v6.5a2 2 0 0 1-2 2H15" />
        </svg>
      )
    case 'to-back':
      return (
        <svg {...common}>
          <rect x="9" y="3.5" width="11" height="11" rx="2" />
          <path d="M14.5 9H6a2.5 2.5 0 0 0-2.5 2.5V18A2.5 2.5 0 0 0 6 20.5h6.5a2 2 0 0 0 2-2V15" />
        </svg>
      )
    case 'step-up':
      return (
        <svg {...common}>
          <path d="M12 19V6M6.5 11 12 5.5 17.5 11" />
        </svg>
      )
    case 'step-down':
      return (
        <svg {...common}>
          <path d="M12 5v13M6.5 13 12 18.5 17.5 13" />
        </svg>
      )
    case 'minus':
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      )
    case 'fit':
      return (
        <svg {...common}>
          <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </svg>
      )
    case 'unlock':
      return (
        <svg {...common}>
          <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
          <path d="M8 10.5V8a4 4 0 0 1 7.5-1.9" />
        </svg>
      )
    case 'flip-h':
      return (
        <svg {...common}>
          <path d="M12 3.5v17" strokeDasharray="2 3" />
          <path d="M9 7 4.5 12 9 17V7ZM15 7l4.5 5L15 17V7Z" />
        </svg>
      )
    case 'flip-v':
      return (
        <svg {...common}>
          <path d="M3.5 12h17" strokeDasharray="2 3" />
          <path d="M7 9 12 4.5 17 9H7ZM7 15l5 4.5 5-4.5H7Z" />
        </svg>
      )
    case 'align-left':
      return (
        <svg {...common}>
          <path d="M4.5 4v16" />
          <rect x="8" y="6" width="11" height="4.5" rx="1" />
          <rect x="8" y="13.5" width="7" height="4.5" rx="1" />
        </svg>
      )
    case 'align-center-x':
      return (
        <svg {...common}>
          <path d="M12 4v16" />
          <rect x="5" y="6" width="14" height="4.5" rx="1" />
          <rect x="7.5" y="13.5" width="9" height="4.5" rx="1" />
        </svg>
      )
    case 'align-right':
      return (
        <svg {...common}>
          <path d="M19.5 4v16" />
          <rect x="5" y="6" width="11" height="4.5" rx="1" />
          <rect x="9" y="13.5" width="7" height="4.5" rx="1" />
        </svg>
      )
    case 'align-top':
      return (
        <svg {...common}>
          <path d="M4 4.5h16" />
          <rect x="6" y="8" width="4.5" height="11" rx="1" />
          <rect x="13.5" y="8" width="4.5" height="7" rx="1" />
        </svg>
      )
    case 'align-center-y':
      return (
        <svg {...common}>
          <path d="M4 12h16" />
          <rect x="6" y="5" width="4.5" height="14" rx="1" />
          <rect x="13.5" y="7.5" width="4.5" height="9" rx="1" />
        </svg>
      )
    case 'align-bottom':
      return (
        <svg {...common}>
          <path d="M4 19.5h16" />
          <rect x="6" y="5" width="4.5" height="11" rx="1" />
          <rect x="13.5" y="9" width="4.5" height="7" rx="1" />
        </svg>
      )
    case 'warning':
      return (
        <svg {...common}>
          <path d="M12 4 2.8 19.5h18.4L12 4Z" />
          <path d="M12 10v4.5M12 17.2v.1" />
        </svg>
      )
    case 'arrange':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'move':
      return (
        <svg {...common}>
          <path d="M12 3v18M3 12h18" />
          <path d="m8.5 6.5 3.5-3.5 3.5 3.5M8.5 17.5l3.5 3.5 3.5-3.5M6.5 8.5 3 12l3.5 3.5M17.5 8.5 21 12l-3.5 3.5" />
        </svg>
      )
    default:
      return null
  }
}
