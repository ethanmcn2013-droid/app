/**
 * Browser-context measurement collector for the Timeline visual-QA harness.
 *
 * IMPORTANT: collectTimelineQaMeasurement is executed INSIDE the page via
 * Playwright page.evaluate(collectTimelineQaMeasurement). Playwright
 * serialises only the source text of this one function -- it does not
 * follow imports or sibling closures -- so every helper this function needs
 * is declared INSIDE it. Do not factor helpers out to module scope; they
 * would compile fine here and then throw ReferenceError in the browser at
 * runtime, silently, because the type checker cannot see across the
 * evaluate() boundary.
 *
 * What this file can prove versus cannot prove is written up in
 * experience/timeline-qa/README.md (Confidence tiers section). Read that
 * before trusting any one field blindly -- several are heuristic by
 * necessity (CSS module class names are not a stable public contract) and
 * are labelled as such in the return shape itself.
 */

export type RectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ClippedTextRecord = {
  /** ancestor-clip: cut by overflow: clip or hidden on an ancestor element,
   *  with no scrollbar and no ellipsis -- content is silently gone, always a
   *  defect. self-truncated: the leaf clips its own overflow (for example
   *  text-overflow: ellipsis, line-clamp) -- often deliberate; judge from the
   *  text and surrounding context. */
  kind: "ancestor-clip" | "self-truncated";
  text: string;
  leafSelector: string;
  leafRect: RectLike;
  clipperSelector: string;
  clipperOverflow: string;
  clipperRect: RectLike;
  /** Positive px means the amount hidden past that edge. */
  overhang: { top: number; right: number; bottom: number; left: number };
};

export type MilestoneCollision = {
  aIndex: number;
  aTitle: string;
  aState: string;
  bIndex: number;
  bTitle: string;
  bState: string;
  overlapWidthPx: number;
  overlapHeightPx: number;
};

export type TimelineQaMeasurement = {
  url: string;
  capturedAt: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  document: {
    scrollHeight: number;
    scrollWidth: number;
    clientHeight: number;
    clientWidth: number;
  };
  /** documentElement.scrollHeight less than or equal to clientHeight, with a
   *  1px rounding tolerance. */
  fitsWithoutVerticalScroll: boolean;
  verticalOverflowPx: number;
  /** documentElement.scrollWidth greater than clientWidth (plus 1px). Must
   *  be false everywhere. */
  horizontalOverflow: boolean;
  horizontalOverflowPx: number;
  /** Many owner/embedded surfaces scroll an INNER app-shell container,
   *  not the document itself -- documentElement.scrollHeight then reads
   *  a flat 1:1 match with the viewport even while real content (for
   *  example the footer) sits far below the fold. Found by walking up
   *  from the artifact root (or main, or body) for the nearest ancestor
   *  whose own overflow-y is auto/scroll AND whose scrollHeight exceeds
   *  its clientHeight. Null means no such container was found -- either
   *  the page truly has nothing to scroll, or it scrolls a container
   *  this heuristic did not walk through; cross-check the screenshot
   *  before concluding either way. */
  innerScrollContainer: {
    present: boolean;
    selector: string | null;
    scrollHeight: number | null;
    clientHeight: number | null;
    overflowPx: number | null;
  };
  footer: {
    present: boolean;
    /** Scoped to the footer inside [data-timeline-artifact] when the
     *  artifact is on the page; otherwise the first footer element found
     *  anywhere. */
    scopedToArtifact: boolean;
    withinFirstViewport: boolean | null;
    rect: RectLike | null;
    text: string | null;
  };
  artifact: {
    present: boolean;
    /** Count of [data-timeline-artifact] nodes. The redesign brief records a
     *  historical defect where the milestone list, and the artifact host
     *  itself in some surfaces, rendered more than once. A count above 1
     *  outside the phone-preview surface (which legitimately frames two) is
     *  worth a second look, not an automatic fail -- the harness reports the
     *  number rather than assuming which surfaces are exempt. */
    count: number;
    density: string | null;
    axisMode: string | null;
    titleLength: string | null;
    compact: boolean;
    embedded: boolean;
  };
  hero: {
    present: boolean;
    source: "artifact-h1" | "page-fallback-h1" | "none";
    text: string | null;
    fontSizePx: number | null;
    lineHeightPx: number | null;
    /** rect.height divided by lineHeightPx, rounded. Not exact (leading and
     *  first-line half-leading are not accounted for) but stable enough to
     *  catch a title that grew from one line to three between two runs. */
    estimatedLines: number | null;
    rect: RectLike | null;
  };
  metric: {
    present: boolean;
    mode: string | null;
    value: string | null;
    ariaLabel: string | null;
    isToggle: boolean;
  };
  progressbar: {
    present: boolean;
    ariaValueNow: string | null;
    ariaValueText: string | null;
    /** Read back from the inline transform style the component sets
     *  (scaleX / scaleY) on the two fill rails. Null when the rail markup is
     *  not the shape this harness expects -- treat null as could-not-confirm,
     *  not as zero. */
    fillScaleX: number | null;
    fillScaleY: number | null;
  };
  milestones: {
    present: boolean;
    count: number;
    labelledCount: number;
    statesCount: Record<string, number>;
    /** Computed background-color of the marker dot for each state (one
     *  sample per state, keyed by the first milestone found in that state,
     *  not an average). */
    stateDotColor: Record<string, string>;
    /** Rect overlap between two milestones whose text labels are both
     *  showing (data-labelled truthy on both). This is the milestone label
     *  collision the findings report asks about. */
    labelCollisions: MilestoneCollision[];
    /** Rect overlap between the marker buttons themselves, regardless of
     *  whether a label is showing. Informational -- small dots sitting close
     *  together are expected on a dense rail. */
    dotCollisions: MilestoneCollision[];
    minTouchTargetPx: number | null;
  };
  monthTicks: {
    present: boolean;
    total: number;
    quiet: number;
    tight: number;
    selectorConfidence: "class-name-heuristic";
  };
  axisNoteText: string | null;
  clippedText: ClippedTextRecord[];
  /** Leaves that overflow an overflow: auto or scroll ancestor. Not a defect
   *  by itself (that is what a scroll container is for -- for example the
   *  horizontal milestone rail on a 20-milestone plan) but counted so a
   *  reviewer can cross-check it against the screenshot. */
  scrollableOverflowLeafCount: number;
};

export function collectTimelineQaMeasurement(): TimelineQaMeasurement {
  const EPSILON = 1;

  function rectOf(el: Element): RectLike {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }

  function describe(el: Element | null): string {
    if (!el) return "";
    const id = el.id ? "#" + el.id : "";
    const dataAttrs = Array.from(el.attributes)
      .filter((a) => a.name.indexOf("data-") === 0)
      .map((a) => "[" + a.name + (a.value ? "=\"" + a.value + "\"" : "") + "]")
      .join("");
    return el.tagName.toLowerCase() + id + dataAttrs;
  }

  function textOf(el: Element | null): string | null {
    if (!el) return null;
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    return t.length ? t : null;
  }

  function findScrollContainer(start: Element | null): HTMLElement | null {
    let el = start as HTMLElement | null;
    while (el && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      const scrollable = cs.overflowY === "auto" || cs.overflowY === "scroll";
      if (scrollable && el.scrollHeight > el.clientHeight + EPSILON) return el;
      el = el.parentElement;
    }
    return null;
  }

  // ---- document-level geometry -----------------------------------------
  const docEl = document.documentElement;
  const scrollHeight = docEl.scrollHeight;
  const scrollWidth = docEl.scrollWidth;
  const clientHeight = docEl.clientHeight;
  const clientWidth = docEl.clientWidth;
  const verticalOverflowPx = Math.max(0, scrollHeight - clientHeight);
  const horizontalOverflowPx = Math.max(0, scrollWidth - clientWidth);

  // ---- inner (app-shell) scroll container, distinct from the document --
  const scrollAnchor =
    document.querySelector("[data-timeline-artifact]") ??
    document.querySelector("main") ??
    document.body;
  const innerScrollEl = findScrollContainer(scrollAnchor);
  const innerScrollContainer = {
    present: Boolean(innerScrollEl),
    selector: innerScrollEl ? describe(innerScrollEl) : null,
    scrollHeight: innerScrollEl ? innerScrollEl.scrollHeight : null,
    clientHeight: innerScrollEl ? innerScrollEl.clientHeight : null,
    overflowPx: innerScrollEl ? innerScrollEl.scrollHeight - innerScrollEl.clientHeight : null,
  };

  // ---- footer -------------------------------------------------------
  const artifactRoot = document.querySelector("[data-timeline-artifact]");
  const scopedFooter = artifactRoot ? artifactRoot.querySelector("footer") : null;
  const footerEl = scopedFooter ?? document.querySelector("footer");
  const footer = {
    present: Boolean(footerEl),
    scopedToArtifact: Boolean(scopedFooter),
    withinFirstViewport: footerEl
      ? footerEl.getBoundingClientRect().bottom <= clientHeight + EPSILON
      : null,
    rect: footerEl ? rectOf(footerEl) : null,
    text: textOf(footerEl),
  };

  // ---- artifact root attributes ------------------------------------
  const artifactNodes = document.querySelectorAll("[data-timeline-artifact]");
  const artifact = {
    present: artifactNodes.length > 0,
    count: artifactNodes.length,
    density: artifactRoot ? artifactRoot.getAttribute("data-density") : null,
    axisMode: artifactRoot ? artifactRoot.getAttribute("data-axis") : null,
    titleLength: artifactRoot ? artifactRoot.getAttribute("data-title-length") : null,
    compact: artifactRoot ? artifactRoot.getAttribute("data-compact") === "true" : false,
    embedded: artifactRoot ? artifactRoot.getAttribute("data-embedded") === "true" : false,
  };

  // ---- hero title -----------------------------------------------------
  const artifactH1 = artifactRoot ? artifactRoot.querySelector("h1") : null;
  const fallbackH1 = document.querySelector("h1");
  const heroEl = artifactH1 ?? fallbackH1 ?? null;
  const heroSource: "artifact-h1" | "page-fallback-h1" | "none" = artifactH1
    ? "artifact-h1"
    : fallbackH1
      ? "page-fallback-h1"
      : "none";
  let heroFontSizePx: number | null = null;
  let heroLineHeightPx: number | null = null;
  let heroEstimatedLines: number | null = null;
  let heroRect: RectLike | null = null;
  if (heroEl) {
    const cs = getComputedStyle(heroEl);
    heroFontSizePx = parseFloat(cs.fontSize) || null;
    const parsedLineHeight = parseFloat(cs.lineHeight);
    heroLineHeightPx = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : heroFontSizePx
        ? heroFontSizePx * 1.2
        : null;
    heroRect = rectOf(heroEl);
    heroEstimatedLines = heroLineHeightPx
      ? Math.max(1, Math.round(heroRect.height / heroLineHeightPx))
      : null;
  }

  // ---- metric (progress / countdown toggle) ----------------------------
  const metricEl = document.querySelector("[data-timeline-metric]");
  const metricValueEl = document.querySelector("[data-timeline-metric-value]");
  const metric = {
    present: Boolean(metricEl),
    mode: metricEl ? metricEl.getAttribute("data-metric-mode") : null,
    value: textOf(metricValueEl),
    ariaLabel: metricEl ? metricEl.getAttribute("aria-label") : null,
    isToggle: Boolean(document.querySelector("[data-timeline-metric-toggle]")),
  };

  // ---- progressbar / rail fill ------------------------------------------
  const progressEl = document.querySelector("[role=\"progressbar\"]");
  let fillScaleX: number | null = null;
  let fillScaleY: number | null = null;
  if (progressEl) {
    const children = Array.from(progressEl.children) as HTMLElement[];
    // Structural order from timeline-artifact.tsx: baseRail, completedRail
    // (horizontal fill, scaleX), completedRailVertical (stacked fill, scaleY).
    for (const child of children) {
      const transform = getComputedStyle(child).transform;
      if (!transform || transform === "none") continue;
      // matrix(a, b, c, d, tx, ty): a is scaleX, d is scaleY, for a pure scale.
      const match = /matrix\(([^,]+),([^,]+),([^,]+),([^,]+),/.exec(transform);
      if (!match) continue;
      const a = parseFloat(match[1]);
      const d = parseFloat(match[4]);
      if (Math.abs(a - 1) > 0.001 && a !== 0) fillScaleX = a;
      else if (a === 0 && fillScaleX === null) fillScaleX = a;
      if (Math.abs(d - 1) > 0.001 && d !== 0) fillScaleY = d;
      else if (d === 0 && fillScaleY === null) fillScaleY = d;
    }
  }
  const progressbar = {
    present: Boolean(progressEl),
    ariaValueNow: progressEl ? progressEl.getAttribute("aria-valuenow") : null,
    ariaValueText: progressEl ? progressEl.getAttribute("aria-valuetext") : null,
    fillScaleX,
    fillScaleY,
  };

  // ---- milestones: state, colour, collisions ---------------------------
  const milestoneLis = Array.from(
    document.querySelectorAll("[data-timeline-artifact] li[data-state]"),
  ) as HTMLElement[];
  const statesCount: Record<string, number> = {};
  const stateDotColor: Record<string, string> = {};
  const labelRects: Array<{ index: number; title: string; state: string; rect: DOMRect } | null> = [];
  const dotRects: Array<{ index: number; title: string; state: string; rect: DOMRect }> = [];
  let minTouchTargetPx: number | null = null;

  milestoneLis.forEach((li, index) => {
    const state = li.getAttribute("data-state") || "unknown";
    statesCount[state] = (statesCount[state] || 0) + 1;
    const button = li.querySelector("button");
    const title = button ? (button.getAttribute("aria-label") || "").split(".")[0] : "";
    if (button) {
      const btnRect = button.getBoundingClientRect();
      const smallestSide = Math.min(btnRect.width, btnRect.height);
      if (minTouchTargetPx === null || smallestSide < minTouchTargetPx) {
        minTouchTargetPx = smallestSide;
      }
      dotRects.push({ index, title, state, rect: btnRect });
      const dotSpan = button.children[0] as HTMLElement | undefined;
      if (dotSpan && !(state in stateDotColor)) {
        stateDotColor[state] = getComputedStyle(dotSpan).backgroundColor;
      }
      const labelled = li.getAttribute("data-labelled");
      const labelSpan = button.children[1] as HTMLElement | undefined;
      if ((labelled === "true" || labelled === "extra") && labelSpan) {
        labelRects.push({ index, title, state, rect: labelSpan.getBoundingClientRect() });
      } else {
        labelRects.push(null);
      }
    } else {
      labelRects.push(null);
    }
  });

  function overlap(
    a: { index: number; title: string; state: string; rect: DOMRect },
    b: { index: number; title: string; state: string; rect: DOMRect },
  ): MilestoneCollision | null {
    const left = Math.max(a.rect.left, b.rect.left);
    const right = Math.min(a.rect.right, b.rect.right);
    const top = Math.max(a.rect.top, b.rect.top);
    const bottom = Math.min(a.rect.bottom, b.rect.bottom);
    const w = right - left;
    const h = bottom - top;
    if (w > EPSILON && h > EPSILON) {
      return {
        aIndex: a.index,
        aTitle: a.title,
        aState: a.state,
        bIndex: b.index,
        bTitle: b.title,
        bState: b.state,
        overlapWidthPx: Math.round(w),
        overlapHeightPx: Math.round(h),
      };
    }
    return null;
  }

  const labelCollisions: MilestoneCollision[] = [];
  const definedLabelRects = labelRects.filter(Boolean) as Array<{
    index: number;
    title: string;
    state: string;
    rect: DOMRect;
  }>;
  for (let i = 0; i < definedLabelRects.length; i += 1) {
    for (let j = i + 1; j < definedLabelRects.length; j += 1) {
      const hit = overlap(definedLabelRects[i], definedLabelRects[j]);
      if (hit) labelCollisions.push(hit);
    }
  }

  const dotCollisions: MilestoneCollision[] = [];
  for (let i = 0; i < dotRects.length; i += 1) {
    for (let j = i + 1; j < dotRects.length; j += 1) {
      const hit = overlap(dotRects[i], dotRects[j]);
      if (hit) dotCollisions.push(hit);
    }
  }

  const milestones = {
    present: milestoneLis.length > 0,
    count: milestoneLis.length,
    labelledCount: definedLabelRects.length,
    statesCount,
    stateDotColor,
    labelCollisions,
    dotCollisions,
    minTouchTargetPx,
  };

  // ---- month ticks (best-effort: class-name substring, dev-mode only) --
  const tickNodes = document.querySelectorAll(
    "[data-timeline-artifact] [class*=\"monthTick\"]",
  );
  const tickEls = Array.from(tickNodes).filter(
    (el) => !el.className.toString().includes("monthTicks"),
  );
  const monthTicks = {
    present: tickEls.length > 0,
    total: tickEls.length,
    quiet: tickEls.filter((el) => el.getAttribute("data-quiet") === "true").length,
    tight: tickEls.filter((el) => el.getAttribute("data-tight") === "true").length,
    selectorConfidence: "class-name-heuristic" as const,
  };

  // ---- axis note (ordered-mode disclosure copy) -------------------------
  let axisNoteText: string | null = null;
  const candidateNotes = artifactRoot ? artifactRoot.querySelectorAll("p") : [];
  for (const p of Array.from(candidateNotes)) {
    const t = textOf(p);
    if (t && t.indexOf("These milestones are in order") === 0) {
      axisNoteText = t;
      break;
    }
  }

  // ---- clipped text: rect-vs-ancestor comparison -------------------------
  // overflow: clip (and hidden) create NO scroll container, so
  // scrollHeight/scrollWidth never reveal them. The only way to find this
  // class of defect is to compare a rendered text rect against every
  // clipping ancestor box, which is what this loop does.
  const clippedText: ClippedTextRecord[] = [];
  let scrollableOverflowLeafCount = 0;
  const candidates = Array.from(document.querySelectorAll("body *"));
  const leaves: Element[] = [];
  for (const el of candidates) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    let hasDirectText = false;
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim().length > 0) {
        hasDirectText = true;
        break;
      }
    }
    if (!hasDirectText) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    // Standard visually-hidden accessibility idiom (this component uses
    // exactly this pattern for .screenReaderOnly / .skipLink:
    // position:absolute; width:1px; height:1px; overflow:hidden). Not a
    // visual defect -- the element is deliberately never meant to be
    // seen, only reachable by assistive technology, so it is excluded
    // from this sighted-user clipping check.
    if (rect.width <= 2 && rect.height <= 2) continue;
    leaves.push(el);
  }

  for (const leaf of leaves) {
    const leafRect = leaf.getBoundingClientRect();

    // Self-truncation: the leaf hides its own overflow (ellipsis/line-clamp).
    const selfStyle = getComputedStyle(leaf);
    const selfClipX =
      (selfStyle.overflowX === "hidden" || selfStyle.overflowX === "clip") &&
      (leaf as HTMLElement).scrollWidth > (leaf as HTMLElement).clientWidth + EPSILON;
    const selfClipY =
      (selfStyle.overflowY === "hidden" || selfStyle.overflowY === "clip") &&
      (leaf as HTMLElement).scrollHeight > (leaf as HTMLElement).clientHeight + EPSILON;
    if (selfClipX || selfClipY) {
      clippedText.push({
        kind: "self-truncated",
        text: (leaf.textContent || "").trim().slice(0, 160),
        leafSelector: describe(leaf),
        leafRect,
        clipperSelector: describe(leaf) + " (self)",
        clipperOverflow: "x:" + selfStyle.overflowX + " y:" + selfStyle.overflowY,
        clipperRect: rectOf(leaf),
        overhang: {
          top: 0,
          right: selfClipX ? (leaf as HTMLElement).scrollWidth - (leaf as HTMLElement).clientWidth : 0,
          bottom: selfClipY
            ? (leaf as HTMLElement).scrollHeight - (leaf as HTMLElement).clientHeight
            : 0,
          left: 0,
        },
      });
    }

    let ancestor: HTMLElement | null = leaf.parentElement;
    while (ancestor && ancestor !== document.documentElement) {
      const cs = getComputedStyle(ancestor);
      const ox = cs.overflowX;
      const oy = cs.overflowY;
      const hardClipX = ox === "hidden" || ox === "clip";
      const hardClipY = oy === "hidden" || oy === "clip";
      const softClipX = ox === "auto" || ox === "scroll";
      const softClipY = oy === "auto" || oy === "scroll";

      // Axes are decided one at a time, because a single box can be hard on
      // one and scrollable on the other, and this walk used to hand the whole
      // element to whichever branch matched first.
      //
      // The case that made it matter, measured: the Timeline rail's
      // .stageViewport is `overflow-x: auto; overflow-y: hidden` and is a live
      // scroll container (scrollWidth 756 against clientWidth 644 at 768px).
      // Rail labels sitting past its right edge are reachable by scrolling the
      // rail — the edge fade even says so. The old order took the hard branch
      // because overflow-y was hidden, found no VERTICAL overhang, and fell
      // through without ever reaching the soft branch, so the artifact's own
      // `overflow: clip` two levels up was blamed for a horizontal overflow a
      // scroll container had already absorbed. That reported seven to nine
      // hard clips per viewport on both the owner route and the real public
      // bearer link, none of which cut a single character off anything a
      // viewer could not reach.
      //
      // Absorbed first, then clipped: an axis that scrolls and genuinely
      // overflows has taken the overflow, which is the conclusion the soft
      // branch below already drew — this only makes it reachable when the
      // other axis happens to be hidden. Hard clipping on the remaining axis
      // is still recorded, so a box that scrolls sideways and clips downward
      // (the long-milestone-title defect) is caught exactly as before.
      const scrollAbsorbsX =
        softClipX && ancestor.scrollWidth > ancestor.clientWidth + EPSILON;
      const scrollAbsorbsY =
        softClipY && ancestor.scrollHeight > ancestor.clientHeight + EPSILON;
      if (scrollAbsorbsX || scrollAbsorbsY) {
        scrollableOverflowLeafCount += 1;
        break;
      }

      if (hardClipX || hardClipY) {
        const aRect = ancestor.getBoundingClientRect();
        const overTop = hardClipY ? Math.max(0, aRect.top - leafRect.top) : 0;
        const overBottom = hardClipY ? Math.max(0, leafRect.bottom - aRect.bottom) : 0;
        const overLeft = hardClipX ? Math.max(0, aRect.left - leafRect.left) : 0;
        const overRight = hardClipX ? Math.max(0, leafRect.right - aRect.right) : 0;
        if (
          overTop > EPSILON ||
          overBottom > EPSILON ||
          overLeft > EPSILON ||
          overRight > EPSILON
        ) {
          clippedText.push({
            kind: "ancestor-clip",
            text: (leaf.textContent || "").trim().slice(0, 160),
            leafSelector: describe(leaf),
            leafRect,
            clipperSelector: describe(ancestor),
            clipperOverflow: "x:" + ox + " y:" + oy,
            clipperRect: rectOf(ancestor),
            overhang: { top: overTop, right: overRight, bottom: overBottom, left: overLeft },
          });
          break;
        }
      }
      ancestor = ancestor.parentElement;
    }
  }

  return {
    url: location.href,
    capturedAt: new Date().toISOString(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    document: { scrollHeight, scrollWidth, clientHeight, clientWidth },
    fitsWithoutVerticalScroll: verticalOverflowPx <= EPSILON,
    verticalOverflowPx,
    horizontalOverflow: horizontalOverflowPx > EPSILON,
    horizontalOverflowPx,
    innerScrollContainer,
    footer,
    artifact,
    hero: {
      present: Boolean(heroEl),
      source: heroSource,
      text: textOf(heroEl),
      fontSizePx: heroFontSizePx,
      lineHeightPx: heroLineHeightPx,
      estimatedLines: heroEstimatedLines,
      rect: heroRect,
    },
    metric,
    progressbar,
    milestones,
    monthTicks,
    axisNoteText,
    clippedText,
    scrollableOverflowLeafCount,
  };
}
