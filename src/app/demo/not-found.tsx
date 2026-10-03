import Link from "next/link";
import { DemoShell } from "@/components/concepts/demo/shell";
import styles from "@/components/concepts/demo/demo.module.css";

/** A missing address stays inside the product, with a way back. */
export default function DemoNotFound() {
  return (
    <DemoShell>
      <div className={styles.missing}>
        <h1>Nothing lives at this address</h1>
        <p>It may have moved, or the link was mistyped. Everything else is where you left it.</p>
        <Link href="/demo" className={styles.missingLink}>
          Go to Home
        </Link>
      </div>
    </DemoShell>
  );
}
