"use client";

import Link from "next/link";
import { forwardRef, useState, type ComponentPropsWithoutRef } from "react";

type LinkProps = ComponentPropsWithoutRef<typeof Link>;
type Props = Omit<LinkProps, "prefetch">;
type Intent = { destination: string; pointer: boolean; keyboard: boolean };

// Sidebar hrefs are strings today. The object form remains supported; including
// all fields also resets intent when a caller changes its query or fragment.
function destinationKey(href: LinkProps["href"]): string {
  return typeof href === "string" ? href : JSON.stringify(href);
}

/** Same anchor and navigation contract as Link; only speculative work changes. */
export const SidebarIntentLink = forwardRef<HTMLAnchorElement, Props>(
  function SidebarIntentLink(
    { href, onPointerEnter, onPointerLeave, onFocus, onBlur, ...props },
    ref,
  ) {
    const destination = destinationKey(href);
    const [intent, setIntent] = useState<Intent>({
      destination,
      pointer: false,
      keyboard: false,
    });

    // Forget the old destination as well as disabling this render. Otherwise
    // changing A -> B -> A without another pointer event could revive A's intent.
    if (intent.destination !== destination) {
      setIntent({ destination, pointer: false, keyboard: false });
    }

    const update = (kind: "pointer" | "keyboard", active: boolean) => {
      setIntent((previous) => ({
        ...(previous.destination === destination
          ? previous
          : { destination, pointer: false, keyboard: false }),
        [kind]: active,
      }));
    };

    // A changed href is disabled during the render itself, before effects could
    // run. A previously hovered destination cannot arm its replacement.
    const active = intent.destination === destination &&
      (intent.pointer || intent.keyboard);

    return (
      <Link
        {...props}
        ref={ref}
        href={href}
        prefetch={active ? null : false}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          if (!event.defaultPrevented && event.pointerType !== "touch") {
            update("pointer", true);
          }
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          update("pointer", false);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          if (!event.defaultPrevented && event.currentTarget.matches(":focus-visible")) {
            update("keyboard", true);
          }
        }}
        onBlur={(event) => {
          onBlur?.(event);
          update("keyboard", false);
        }}
      />
    );
  },
);
