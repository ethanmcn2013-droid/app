"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSuiteContext } from "@/components/app/use-suite-context";
import { RailIcon } from "@/components/studio-bar/rail-icons";
import {
  PRODUCT_APP_PATHS,
  productIdFromAppPath,
  type ProductId,
} from "@/lib/product-urls";
import { withSuiteContext } from "@/lib/suite-context";

const PRODUCTS: readonly Readonly<{ id: ProductId; label: string }>[] =
  Object.freeze([
    { id: "notes", label: "Notes" },
    { id: "tasks", label: "Tasks" },
    { id: "timeline", label: "Timeline" },
    { id: "signal", label: "Signal" },
  ]);

/**
 * Mobile counterpart to the desktop product rail.
 *
 * Tasks already owns a task-specific mobile navigation bar, so this compact
 * suite rail appears only on the three sibling canvases. Tasks remains one
 * tap away and its account menu retains the cross-product escape hatch.
 */
export function MobileSuiteNav() {
  const pathname = usePathname() ?? "";
  const activeProduct = productIdFromAppPath(pathname);
  const suiteContext = useSuiteContext();

  if (activeProduct === "tasks") return null;

  return (
    <nav
      aria-label="Signal Studio products"
      /* Marks this as the rail that owns the foot of the mobile viewport, so
         floating chrome (the dev notice) can measure it and sit clear. */
      data-signal-bottom-nav="suite"
      className="z-40 flex flex-none border-t border-white/[0.08] bg-[var(--x-studio-chrome)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {PRODUCTS.map((product) => {
        const active = product.id === activeProduct;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={[
              "relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 outline-none transition-colors",
              active
                ? "text-[var(--x-studio-ink-strong)]"
                : "text-[var(--x-studio-ink-quiet)] hover:bg-white/[0.05] hover:text-[var(--x-studio-ink)]",
              "focus-visible:bg-white/[0.07] focus-visible:text-white",
            ].join(" ")}
            href={withSuiteContext(
              PRODUCT_APP_PATHS[product.id],
              suiteContext,
            )}
            key={product.id}
          >
            <RailIcon name={product.id} size={18} />
            <span className="text-[10px] font-medium leading-none">
              {product.label}
            </span>
            {active ? (
              <span
                aria-hidden="true"
                className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--x-studio-accent)]"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
