import { TasksHeroLoader } from "@/components/marketing/tasks-hero-loader";
import { TasksHeroRolodex } from "@/components/marketing/tasks-hero-rolodex";

/**
 * Dev-only comparison page — not linked in any nav.
 * Shows both hero animations stacked so the operator can evaluate side by side.
 */
export default function HeroCompare() {
  return (
    <div style={{ background: "#fff" }}>

      {/* Label A */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "14px 32px",
        borderBottom: "1px solid rgba(17,17,17,.06)",
        fontFamily: "'Geist Mono', ui-monospace, monospace",
        fontSize: "11px",
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "#8c887e",
        background: "#fafaf9",
      }}>
        <span style={{ color: "#4f46e5", fontWeight: 600 }}>A</span>
        Split-flap departure board
        <span style={{ marginLeft: "auto", opacity: .5 }}>feat/tasks-hero-v2</span>
      </div>

      <div style={{ borderBottom: "2px solid rgba(17,17,17,.06)" }}>
        <TasksHeroLoader />
      </div>

      {/* Label B */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "14px 32px",
        borderBottom: "1px solid rgba(17,17,17,.06)",
        fontFamily: "'Geist Mono', ui-monospace, monospace",
        fontSize: "11px",
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "#8c887e",
        background: "#fafaf9",
      }}>
        <span style={{ color: "#4f46e5", fontWeight: 600 }}>B</span>
        Rolodex card flip
        <span style={{ marginLeft: "auto", opacity: .5 }}>new concept</span>
      </div>

      <TasksHeroRolodex />

    </div>
  );
}
