export function CursorSvg({ color }: { color: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      style={{
        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.18))",
      }}
    >
      <path
        d="M5 3.2L19 10.6L11.6 12.6L9.4 20L5 3.2Z"
        fill={color}
        stroke="white"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
