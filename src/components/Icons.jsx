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
    default:
      return null
  }
}
