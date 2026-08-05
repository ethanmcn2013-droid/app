/**
 * One icon family for Notes: 16px box, 1.5 stroke, round caps and joins,
 * currentColor only. Drawn here rather than pulled from a library so the
 * weight matches the product rail beside it and nothing new ships to the
 * browser to draw eleven small shapes.
 */

type IconProps = { className?: string };

function Icon({ children, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Written in the composer. Three ruled lines, the shortest last. */
export function TypedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.75 4.25h10.5M2.75 8h10.5M2.75 11.75h6.5" />
    </Icon>
  );
}

export function VoiceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="1.75" width="4" height="7.5" rx="2" />
      <path d="M3.75 7.25a4.25 4.25 0 0 0 8.5 0M8 11.5v2.75" />
    </Icon>
  );
}

export function PhotoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.75" y="3.75" width="12.5" height="9.5" rx="1.75" />
      <circle cx="5.75" cy="7.25" r="1.1" />
      <path d="m2.25 11.5 3.1-2.6a1.2 1.2 0 0 1 1.6.05L10 12" />
    </Icon>
  );
}

export function EmailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.75" />
      <path d="m2.5 5 5.5 4 5.5-4" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1.75" />
      <path d="M2.25 6.5h11.5M5.5 1.75v2.5M10.5 1.75v2.5" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.25" y="7" width="9.5" height="7" rx="1.75" />
      <path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" />
    </Icon>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="3.25" cy="8" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="12.75" cy="8" r="1.05" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7.25" cy="7.25" r="4.5" />
      <path d="m10.75 10.75 2.5 2.5" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Icon>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.75 3.5 5.25 8l4.5 4.5" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m3 8.5 3.25 3.25L13 5" />
    </Icon>
  );
}

export function TaskIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="2" />
      <path d="m5.5 8 1.75 1.75L10.75 6.5" />
    </Icon>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.25" y="4.25" width="7.5" height="7.5" rx="1.25" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function RotateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.25 6.5A5.5 5.5 0 1 0 13 9.75" />
      <path d="M13.25 2.75v3.75H9.5" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3.5v9M3.5 8h9" />
    </Icon>
  );
}

export function RestoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.75 6.5A5.5 5.5 0 1 1 3 9.75" />
      <path d="M2.75 2.75V6.5H6.5" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 5v3.5M8 10.75v.01" />
    </Icon>
  );
}

const SOURCE_ICONS = {
  typed: TypedIcon,
  voice: VoiceIcon,
  photo: PhotoIcon,
  email: EmailIcon,
  calendar: CalendarIcon,
} as const;

export function SourceIcon({
  source,
  className,
}: {
  source: keyof typeof SOURCE_ICONS;
  className?: string;
}) {
  const Component = SOURCE_ICONS[source] ?? TypedIcon;
  return <Component className={className} />;
}
