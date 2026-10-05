/**
 * The Console while it loads: the same tabs, figures and rows as the settled
 * view, so nothing jumps when the real ones arrive. No client code.
 */

import c from "./project-console.module.css";

const TAB_WIDTHS = [44, 104, 92, 76];

export function ProjectConsoleSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={c.frame}>
      <div className={c.root}>
        <div className={c.tabsWrap}>
          <div className={c.tabs}>
            {TAB_WIDTHS.map((width, index) => (
              <span key={index} className={c.skelTab} style={{ width }} />
            ))}
          </div>
        </div>
        <div className={c.cards} data-count="4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={c.card} data-skeleton="">
              <span className={c.skelLine} style={{ width: "46%" }} />
              <span className={c.skelBig} />
              <span className={c.skelBar} />
              <span className={c.skelLine} style={{ width: "72%" }} />
            </div>
          ))}
        </div>
        <div className={c.list}>
          <div className={c.groups}>
            <div className={c.group}>
              <span className={c.skelLine} style={{ width: 110, height: 12, margin: "30px 0 12px" }} />
              {Array.from({ length: rows }, (_, index) => (
                <div key={index} className={c.row} data-skeleton="">
                  <span className={c.rowLink}>
                    <span className={c.skelLine} style={{ width: "70%" }} />
                    <span className={c.skelLine} style={{ width: "40%", marginTop: 8 }} />
                  </span>
                  {[0, 1, 2].map((cell) => (
                    <div key={cell} className={c.cell}>
                      <span className={c.skelLine} style={{ width: "80%" }} />
                      <span className={c.skelBar} />
                      <span className={c.skelLine} style={{ width: "60%" }} />
                    </div>
                  ))}
                  <div className={c.lead}>
                    <span className={c.skelDot} />
                    <span className={c.skelLine} style={{ width: 64 }} />
                  </div>
                  <div className={c.actions} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
