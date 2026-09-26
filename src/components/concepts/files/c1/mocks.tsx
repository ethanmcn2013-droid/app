"use client";

import { motion } from "motion/react";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { Body, FileItem, MenuItem, QuoteLine, RunRow, Version } from "./data";
import { PEOPLE } from "./data";
import { Icon } from "./glyphs";
import { PhotoScene, SignArt } from "./scenes";
import s from "./mocks.module.css";

const eur = (n: number) => `€${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** Everything a body needs to render one version, with the previous one for diffs. */
export type MockProps = { file: FileItem; version: Version; prev?: Version; showChanges: boolean };

export function Mock({ file, version, prev, showChanges }: MockProps) {
  const body = version.body;
  const pb = showChanges ? prev?.body : undefined;
  switch (body.t) {
    case "runsheet":
      return <RunSheet rows={body.rows} prev={pb?.t === "runsheet" ? pb.rows : undefined} version={version} />;
    case "quote":
      return <Quote refNo={body.ref} lines={body.lines} prev={pb?.t === "quote" ? pb.lines : undefined} />;
    case "invoice":
      return <Invoice />;
    case "letter":
      return <Letter body={body} />;
    case "menu":
      return <Menu items={body.items} prev={pb?.t === "menu" ? pb.items : undefined} />;
    case "grid":
      if (file.locked) return <Locked file={file} />;
      return (
        <Sheet
          title={body.title}
          cols={body.cols}
          rows={body.rows}
          align={body.align}
          prev={pb?.t === "grid" ? pb.rows : undefined}
          editor={PEOPLE[version.by].short}
          tabs={file.source === "drive" ? ["Sheet1"] : ["Numbers"]}
          drive={file.source === "drive"}
        />
      );
    case "seating": {
      const cols = body.tables.map((t) => t.name);
      const rows = body.tables[0].seats.map((_, i) => body.tables.map((t) => t.seats[i] ?? ""));
      const prevRows = pb?.t === "seating" ? pb.tables[0].seats.map((_, i) => pb.tables.map((t) => t.seats[i] ?? "")) : undefined;
      return (
        <Sheet
          title="Seating plan, final"
          cols={cols}
          rows={rows}
          prev={prevRows}
          rowLabels={rows.map((_, i) => `Seat ${i + 1}`)}
          editor={PEOPLE[version.by].short}
          tabs={["Tables", "Dietary", "Top table"]}
          drive
        />
      );
    }
    case "photo":
      return (
        <figure className={cx(s.fit, s.photo)} style={{ "--ar": body.w / body.h } as CSSProperties}>
          <div className={s.photoFrame}>
            <PhotoScene scene={body.scene} />
          </div>
          <figcaption className={s.caption}>{body.caption}</figcaption>
        </figure>
      );
    case "sign":
      return (
        <div className={cx(s.fit, s.photo)} style={{ "--ar": 400 / 560 } as CSSProperties}>
          <div className={s.photoFrame}>
            <SignArt look={body.look} />
          </div>
        </div>
      );
    case "swatches":
      return <Swatches />;
    case "link":
      return <LinkCard body={body} />;
    case "logo":
      return <LogoBoard round={body.round} />;
    case "slide":
      return <Slide />;
    case "mood":
      return <Mood />;
    case "none":
      return <NoPreview file={file} ext={body.ext} what={body.what} />;
  }
}

/* ── Paper documents ─────────────────────────────────────────────────── */

function Paper({ children, className, pages, more }: { children: ReactNode; className?: string; pages?: string; more?: ReactNode }) {
  return (
    <div className={s.paperWrap}>
      <article className={cx(s.paper, className)}>{children}</article>
      {more ? (
        <>
          <p className={s.pageNote}>Page 1 of 2</p>
          <article className={cx(s.paper, s.paperNext, className)}>{more}</article>
          <p className={s.pageNote}>Page 2 of 2</p>
        </>
      ) : pages ? (
        <p className={s.pageNote}>{pages}</p>
      ) : null}
    </div>
  );
}

const CONTACTS = [
  { who: "Orla Byrne", role: "Venue lead, on the day", tel: "087 412 6630" },
  { who: "Dev Mehta", role: "Bar and suppliers", tel: "086 208 1147" },
  { who: "Niamh Kelly", role: "Flowers and signage", tel: "085 771 0392" },
  { who: "Tom, Hireco Marquees", role: "Marquee build and strike", tel: "01 456 2210" },
  { who: "The Hollow Pines", role: "Band, soundcheck 18:30", tel: "083 990 4521" },
];

const SUPPLIER_TIMES = [
  { time: "Fri 08:00", what: "Hireco build the marquee on the terrace lawn" },
  { time: "Sat 10:00", what: "Wildflower & Co dress the barn and the arch" },
  { time: "Sat 12:30", what: "Welcome sign goes up at the orchard gate" },
  { time: "Sat 18:30", what: "Band load in through the side door of the barn" },
  { time: "Sun 10:00", what: "Strike: Hireco take the marquee down" },
];

function RunSheetPage2() {
  return (
    <>
      <header className={s.docHead}>
        <div>
          <p className={s.kicker}>Mara &amp; Finn · The Orchard</p>
          <h3 className={s.docTitle}>Suppliers and contacts</h3>
        </div>
      </header>
      <ol className={s.runList}>
        {SUPPLIER_TIMES.map((r) => (
          <li key={r.time} className={cx(s.runRow, s.runRowWide)}>
            <span className={s.runTime}>{r.time}</span>
            <span className={s.runWhat}>
              <span className={s.runTitle}>{r.what}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className={s.contacts}>
        {CONTACTS.map((c) => (
          <div key={c.who} className={s.contact}>
            <strong>{c.who}</strong>
            <span>{c.role}</span>
            <span className={s.tel}>{c.tel}</span>
          </div>
        ))}
      </div>
      <footer className={s.docFoot}>
        <p>If anything changes on the day, tell Orla first. She keeps this sheet current.</p>
      </footer>
    </>
  );
}

function RunSheet({ rows, prev, version }: { rows: RunRow[]; prev?: RunRow[]; version: Version }) {
  const prevById = new Map(prev?.map((r) => [r.id, r]));
  return (
    <Paper more={<RunSheetPage2 />}>
      <header className={s.docHead}>
        <div>
          <p className={s.kicker}>Mara &amp; Finn · The Orchard</p>
          <h3 className={s.docTitle}>Run-sheet, Saturday 17 October</h3>
        </div>
        <div className={s.docStamp}>
          <span>Version {version.n}</span>
          <span>{PEOPLE[version.by].short}, {version.ago}</span>
        </div>
      </header>
      <ol className={s.runList}>
        {rows.map((r) => {
          const was = prevById.get(r.id);
          const added = prev && !was;
          const timeChanged = was && was.time !== r.time;
          const textChanged = was && was.title !== r.title;
          const changed = added || timeChanged || textChanged;
          return (
            <motion.li
              layout="position"
              key={r.id}
              className={cx(s.runRow, changed && s.changed)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <span className={cx(s.runTime, timeChanged && s.changedText)}>{r.time}</span>
              <span className={s.runWhat}>
                <span className={s.runTitle}>{r.title}</span>
                <span className={s.runWhere}>{r.where}</span>
              </span>
              {changed ? (
                <span className={s.diffTag}>{added ? "New" : timeChanged ? `Was ${was?.time}` : "Reworded"}</span>
              ) : null}
            </motion.li>
          );
        })}
      </ol>
      <footer className={s.docFoot}>
        <p>
          <strong>On the day</strong> Orla, venue lead · Dev, bar and suppliers · Niamh, flowers and signage
        </p>
        <p>Wet weather: ceremony moves to the barn, drinks under the marquee.</p>
      </footer>
    </Paper>
  );
}

function Quote({ refNo, lines, prev }: { refNo: string; lines: QuoteLine[]; prev?: QuoteLine[] }) {
  const total = lines.reduce((a, l) => a + l.amount, 0);
  const prevTotal = prev?.reduce((a, l) => a + l.amount, 0);
  const prevById = new Map(prev?.map((l) => [l.id, l]));
  return (
    <Paper pages="Page 1 of 1">
      <header className={s.letterhead}>
        <span className={s.hirecoMark} aria-hidden>
          <svg viewBox="0 0 24 24" width="100%" height="100%">
            <path d="M2 20 12 5l10 15Z" fill="#1d3b53" />
            <path d="M7 20 12 12l5 8Z" fill="#f2c14e" />
          </svg>
        </span>
        <div>
          <p className={s.brandName}>Hireco Marquees</p>
          <p className={s.muted}>Unit 4, Ballymount · hireco.ie</p>
        </div>
        <div className={s.docStamp}>
          <span>Quote {refNo}</span>
          <span>Valid 30 days</span>
        </div>
      </header>
      <p className={s.addressee}>
        For The Orchard, events · Mara &amp; Finn wedding, Saturday 17 October 2026
      </p>
      <div className={s.qTable} role="table" aria-label="Quote lines">
        <div className={cx(s.qRow, s.qHead)} role="row">
          <span role="columnheader">Item</span>
          <span role="columnheader">Amount</span>
        </div>
        {lines.map((l) => {
          const was = prevById.get(l.id);
          const changed = prev && (!was || was.amount !== l.amount || was.item !== l.item);
          return (
            <motion.div layout="position" key={l.id} className={cx(s.qRow, changed && s.changed)} role="row">
              <span role="cell">
                <span className={s.qItem}>{l.item}</span>
                <span className={s.qDetail}>{l.detail}</span>
              </span>
              <span role="cell" className={s.qAmt}>
                {changed && was ? <s className={s.was}>{eur(was.amount)}</s> : null}
                {eur(l.amount)}
              </span>
            </motion.div>
          );
        })}
        <div className={cx(s.qRow, s.qTotal, prevTotal !== undefined && prevTotal !== total && s.changed)} role="row">
          <span role="cell">Total, including VAT at 23%</span>
          <span role="cell" className={s.qAmt}>
            {prevTotal !== undefined && prevTotal !== total ? <s className={s.was}>{eur(prevTotal)}</s> : null}
            {eur(total)}
          </span>
        </div>
      </div>
      <footer className={s.docFoot}>
        <p>Build Friday 16 October from 08:00. Strike Sunday 18 October from 10:00. Weather call 72 hours before.</p>
      </footer>
    </Paper>
  );
}

function Invoice() {
  return (
    <Paper pages="Page 1 of 1">
      <header className={s.letterhead}>
        <span className={s.orchardMark} aria-hidden>
          O
        </span>
        <div>
          <p className={s.brandName}>The Orchard</p>
          <p className={s.muted}>Kilmacanogue, Co. Wicklow</p>
        </div>
        <div className={s.docStamp}>
          <span>Invoice ORC-0917</span>
          <span>Issued 2 Sep 2026</span>
        </div>
      </header>
      <div className={s.billTo}>
        <p className={s.muted}>Billed to</p>
        <p>Mara Quinn and Finn Doyle</p>
      </div>
      <div className={s.qTable} role="table" aria-label="Invoice lines">
        <div className={cx(s.qRow, s.qHead)} role="row">
          <span role="columnheader">Description</span>
          <span role="columnheader">Amount</span>
        </div>
        <div className={s.qRow} role="row">
          <span role="cell">
            <span className={s.qItem}>Venue deposit, 30%</span>
            <span className={s.qDetail}>Exclusive use, Saturday 17 October 2026</span>
          </span>
          <span role="cell" className={s.qAmt}>€4,500</span>
        </div>
        <div className={cx(s.qRow, s.qTotal)} role="row">
          <span role="cell">Total due</span>
          <span role="cell" className={s.qAmt}>€4,500</span>
        </div>
      </div>
      <div className={s.paidStamp} aria-label="Paid on 12 September">
        Paid
        <small>12 Sep 2026</small>
      </div>
      <footer className={s.docFoot}>
        <p>Balance of €10,500 due Friday 21 August 2026. Thank you both.</p>
      </footer>
    </Paper>
  );
}

function Letter({ body }: { body: Extract<Body, { t: "letter" }> }) {
  return (
    <Paper>
      <header className={s.docHead}>
        <div>
          <p className={s.kicker}>{body.kicker}</p>
          <h3 className={s.docTitle}>{body.heading}</h3>
        </div>
      </header>
      <div className={s.prose}>
        {body.blocks.map((b, i) =>
          b.h ? (
            <h4 key={i}>{b.h}</h4>
          ) : b.list ? (
            <ul key={i}>
              {b.list.map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{b.p}</p>
          ),
        )}
      </div>
    </Paper>
  );
}

function Menu({ items, prev }: { items: MenuItem[]; prev?: MenuItem[] }) {
  const prevById = new Map(prev?.map((m) => [m.id, m]));
  return (
    <Paper className={s.menuPaper}>
      <header className={s.menuHead}>
        <p className={s.menuBrand}>Harbour Bakery</p>
        <p className={s.menuSub}>On the quay from Saturday 10 October · 07:00 until sold out</p>
      </header>
      <ul className={s.menuList}>
        {items.map((m) => {
          const was = prevById.get(m.id);
          const added = prev && !was;
          const priceChanged = was && was.price !== m.price;
          return (
            <motion.li layout="position" key={m.id} className={cx(s.menuItem, (added || priceChanged) && s.changed)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className={s.menuName}>
                {m.name}
                {added ? <span className={s.diffTag}>New</span> : null}
              </span>
              <span className={s.menuDots} aria-hidden />
              <span className={s.menuPrice}>
                {priceChanged ? <s className={s.was}>{was?.price}</s> : null}
                {m.price}
              </span>
              <span className={s.menuNote}>{m.note}</span>
            </motion.li>
          );
        })}
      </ul>
      <footer className={s.menuFoot}>Everything baked here, overnight. Ask us about allergens.</footer>
    </Paper>
  );
}

/* ── Sheets ──────────────────────────────────────────────────────────── */

const LETTERS = "ABCDEFGHIJ";

function Sheet({
  title,
  cols,
  rows,
  prev,
  align,
  rowLabels,
  editor,
  tabs,
  drive,
}: {
  title: string;
  cols: string[];
  rows: string[][];
  prev?: string[][];
  align?: ("l" | "r")[];
  rowLabels?: string[];
  editor: string;
  tabs: string[];
  drive?: boolean;
}) {
  const changedCells: [number, number][] = [];
  if (prev) {
    rows.forEach((r, ri) =>
      r.forEach((c, ci) => {
        if (prev[ri]?.[ci] !== c) changedCells.push([ri, ci]);
      }),
    );
  }
  const isChanged = (ri: number, ci: number) => changedCells.some(([a, b]) => a === ri && b === ci);
  const first = changedCells[0];
  const focusCell = first ? rows[first[0]][first[1]] : rows[0]?.[0] ?? "";
  const lead = rowLabels ? 1 : 0;
  const colCount = cols.length + lead;
  return (
    <div className={s.sheetWrap}>
      <div className={s.sheetWin}>
        <div className={s.sheetBar}>
          <span className={s.sheetIcon} aria-hidden />
          <span className={s.sheetTitle}>{title}</span>
          <span className={s.sheetApp}>{drive ? "Google Sheets" : "Excel workbook"}</span>
        </div>
        <div className={s.formula}>
          <span className={s.fx}>fx</span>
          <span>{focusCell}</span>
        </div>
        <div className={s.grid} style={{ "--cols": colCount } as CSSProperties} role="table" aria-label={title}>
          <span className={s.corner} aria-hidden />
          {Array.from({ length: colCount }, (_, i) => (
            <span key={i} className={s.colHead} aria-hidden>
              {LETTERS[i]}
            </span>
          ))}
          <span className={s.rowNum} aria-hidden>
            1
          </span>
          {rowLabels ? <span className={cx(s.cell, s.headCell)} role="columnheader" /> : null}
          {cols.map((c, i) => (
            <span key={i} className={cx(s.cell, s.headCell, align?.[i] === "r" && s.right)} role="columnheader">
              {c}
            </span>
          ))}
          {rows.map((r, ri) => (
            <div key={ri} className={s.gridRow} role="row">
              <span className={s.rowNum} aria-hidden>
                {ri + 2}
              </span>
              {rowLabels ? (
                <span className={cx(s.cell, s.labelCell)} role="rowheader">
                  {rowLabels[ri]}
                </span>
              ) : null}
              {r.map((c, ci) => {
                const ch = isChanged(ri, ci);
                const isFirst = first && first[0] === ri && first[1] === ci;
                return (
                  <span
                    key={ci}
                    role="cell"
                    className={cx(s.cell, align?.[ci] === "r" && s.right, ch && s.cellChanged, isFirst && s.cellFocus, r[0] === "Total" && s.totalCell)}
                  >
                    {c}
                    {isFirst ? <span className={s.editorFlag}>{editor}</span> : null}
                  </span>
                );
              })}
            </div>
          ))}
          {Array.from({ length: Math.max(0, 9 - rows.length) }, (_, i) => (
            <div key={`e${i}`} className={s.gridRow} aria-hidden>
              <span className={s.rowNum}>{rows.length + 2 + i}</span>
              {Array.from({ length: colCount }, (_, j) => (
                <span key={j} className={s.cell} />
              ))}
            </div>
          ))}
        </div>
        <div className={s.sheetTabs}>
          {tabs.map((t, i) => (
            <span key={t} className={cx(s.sheetTab, i === 0 && s.sheetTabOn)}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Locked({ file }: { file: FileItem }) {
  const owner = PEOPLE[file.locked ?? "mara"];
  return (
    <div className={s.lockedWrap}>
      <div className={s.lockedGhost} aria-hidden>
        {Array.from({ length: 48 }, (_, i) => (
          <span key={i} style={{ width: `${40 + ((i * 37) % 50)}%` }} />
        ))}
      </div>
      <LockedCard owner={owner.short} name={file.name} />
    </div>
  );
}

function LockedCard({ owner, name }: { owner: string; name: string }) {
  return (
    <div className={s.honest}>
      <span className={s.honestIcon}>
        <Icon name="lock" size={20} />
      </span>
      <h3>This sheet is in {owner}&apos;s Google Drive</h3>
      <p>
        {name} is linked to this project, but {owner} hasn&apos;t shared it with you yet. Ask once and we&apos;ll tell you when you&apos;re in.
      </p>
      <AskButton owner={owner} />
    </div>
  );
}


function AskButton({ owner }: { owner: string }) {
  const [asked, setAsked] = useState(false);
  return asked ? (
    <p className={s.asked} role="status">
      <Icon name="check" size={14} /> Asked {owner}. You&apos;ll see it here once they share it.
    </p>
  ) : (
    <button type="button" className={s.primary} onClick={() => setAsked(true)}>
      Ask {owner} for access
    </button>
  );
}

function NoPreview({ file, ext, what }: { file: FileItem; ext: string; what: string }) {
  return (
    <div className={s.noPrevWrap}>
      <div className={s.honest}>
        <span className={s.extBadge}>.{ext}</span>
        <h3>No preview for .{ext} files</h3>
        <p>
          {file.name} is {what}. We can&apos;t draw it here yet, so open it in AutoCAD or the free DWG TrueView.
        </p>
        <div className={s.honestActions}>
          <button type="button" className={s.primary}>
            <Icon name="download" size={14} /> Download, {file.size}
          </button>
          <button type="button" className={s.secondary}>
            Ask Dev for a PDF export
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Mood board: the florist's PDF ────────────────────────────────────── */

const MOOD = [
  { id: "hip", caption: "Rosehips, for the buttonholes" },
  { id: "dahlia", caption: "Dahlias the colour of the barn doors" },
  { id: "grass", caption: "Grasses, left long to move" },
  { id: "apple", caption: "Crab apples down the long tables" },
  { id: "jar", caption: "Jam jars, nothing tall" },
  { id: "meadow", caption: "A hanging meadow over the top table" },
] as const;

const HIPS: [number, number][] = [
  [48, 56],
  [56, 46],
  [66, 30],
  [38, 72],
  [74, 20],
  [26, 88],
];

const APPLES: [number, number, string][] = [
  [22, 72, "#c4452b"],
  [36, 74, "#d98a2b"],
  [50, 70, "#b8321c"],
  [64, 74, "#e2a33a"],
  [78, 71, "#c4452b"],
  [44, 62, "#d0692d"],
  [60, 62, "#b8321c"],
];

function MoodArt({ id }: { id: (typeof MOOD)[number]["id"] }) {
  const box = { viewBox: "0 0 100 120", width: "100%", height: "100%", preserveAspectRatio: "xMidYMid slice", "aria-hidden": true } as const;
  switch (id) {
    case "hip":
      return (
        <svg {...box}>
          <rect width="100" height="120" fill="#efe6d6" />
          <path d="M8 104C30 80 44 62 58 40s22-30 34-34" stroke="#5b4a32" strokeWidth="2.2" fill="none" />
          <path d="M40 66c-8-2-14 2-16 8 8 2 13-1 16-8ZM62 34c6-6 13-6 17-2-6 6-12 6-17 2ZM30 84c-7 1-11 6-11 12 7-1 10-5 11-12Z" fill="#6f7d4c" />
          {HIPS.map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx="5.2" ry="6.6" fill="#b3321f" />
              <ellipse cx={x - 1.6} cy={y - 2.2} rx="1.4" ry="2" fill="#e0715a" />
              <path d={`M${x - 2} ${y - 6.5}l2-2.6 2 2.6`} stroke="#3e3222" strokeWidth="1" fill="none" />
            </g>
          ))}
        </svg>
      );
    case "dahlia":
      return (
        <svg {...box}>
          <rect width="100" height="120" fill="#3b2a24" />
          <g transform="translate(50 58)">
            {Array.from({ length: 16 }, (_, i) => (
              <ellipse key={`a${i}`} rx="7" ry="26" fill="#a8442b" transform={`rotate(${i * 22.5}) translate(0 -18)`} />
            ))}
            {Array.from({ length: 12 }, (_, i) => (
              <ellipse key={`b${i}`} rx="6" ry="16" fill="#c9623d" transform={`rotate(${i * 30 + 15}) translate(0 -11)`} />
            ))}
            {Array.from({ length: 8 }, (_, i) => (
              <ellipse key={`c${i}`} rx="4" ry="8" fill="#e08a5c" transform={`rotate(${i * 45}) translate(0 -5)`} />
            ))}
            <circle r="4" fill="#f2c28b" />
          </g>
        </svg>
      );
    case "grass":
      return (
        <svg {...box}>
          <rect width="100" height="120" fill="#e9e1cc" />
          {Array.from({ length: 14 }, (_, i) => {
            const x = 10 + i * 6;
            const lean = ((i * 7) % 11) - 5;
            const top = 30 + ((i * 13) % 20);
            const tx = x + lean * 2.4;
            return (
              <g key={i}>
                <path d={`M${x} 120C${x} 90 ${x + lean} 60 ${tx} ${top + 4}`} stroke={i % 3 ? "#9c8a5a" : "#7c8a57"} strokeWidth="1.3" fill="none" />
                <ellipse cx={tx} cy={top} rx="2.2" ry="7" fill="#c7b27b" transform={`rotate(${lean * 4} ${tx} ${top})`} />
              </g>
            );
          })}
        </svg>
      );
    case "apple":
      return (
        <svg {...box}>
          <rect width="100" height="120" fill="#f3ecdf" />
          <rect y="78" width="100" height="42" fill="#8b6a48" />
          <rect y="78" width="100" height="3" fill="#6e5236" />
          {APPLES.map(([x, y, c], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="7.5" fill={c} />
              <circle cx={x - 2.5} cy={y - 2.5} r="2" fill="#fff" opacity="0.35" />
              <path d={`M${x} ${y - 7}q1-4 4-5`} stroke="#4a3a24" strokeWidth="1" fill="none" />
            </g>
          ))}
        </svg>
      );
    case "jar":
      return (
        <svg {...box}>
          <rect width="100" height="120" fill="#dfe3d6" />
          <path d="M34 60h32v42a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6Z" fill="#ffffff" opacity="0.55" stroke="#8fa08a" strokeWidth="1.2" />
          <rect x="32" y="55" width="36" height="6" rx="2" fill="#b9c2ae" />
          <path d="M34 86h32v16a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6Z" fill="#a8c0b8" opacity="0.6" />
          <path d="M44 56C42 44 36 36 30 30M50 56V26M56 56c2-12 8-20 14-24M47 56c-2-8-8-12-12-14M53 56c3-8 6-10 10-11" stroke="#6f7d4c" strokeWidth="1.3" fill="none" />
          <circle cx="30" cy="29" r="4" fill="#c9623d" />
          <circle cx="50" cy="25" r="5" fill="#e8d7b5" />
          <circle cx="70" cy="31" r="4" fill="#b3321f" />
          <circle cx="35" cy="41" r="3" fill="#d6a0a6" />
          <circle cx="63" cy="44" r="3" fill="#e2a33a" />
        </svg>
      );
    case "meadow":
      return (
        <svg {...box}>
          <rect width="100" height="120" fill="#2f2a26" />
          <rect x="0" y="16" width="100" height="7" fill="#6b5037" />
          {Array.from({ length: 11 }, (_, i) => {
            const x = 6 + i * 9;
            const len = 36 + ((i * 17) % 40);
            return (
              <g key={i}>
                <path d={`M${x} 23c2 ${len / 3} -2 ${len / 1.6} 1 ${len}`} stroke="#7c8a57" strokeWidth="1.4" fill="none" />
                <circle cx={x + 1} cy={23 + len} r="3" fill={["#e8d7b5", "#c9623d", "#d6a0a6", "#b3321f"][i % 4]} />
                <circle cx={x - 1} cy={23 + len * 0.6} r="2" fill="#a3b07a" />
              </g>
            );
          })}
        </svg>
      );
  }
}

function Mood() {
  return (
    <Paper pages="Page 1 of 3">
      <header className={s.docHead}>
        <div>
          <p className={s.kicker}>Wildflower &amp; Co for Mara &amp; Finn</p>
          <h3 className={cx(s.docTitle, s.moodTitle)}>Autumn barn, a mood</h3>
        </div>
        <div className={s.docStamp}>
          <span>Wildflower &amp; Co</span>
          <span>Sent 90 min ago</span>
        </div>
      </header>
      <div className={s.moodGrid}>
        {MOOD.map((t) => (
          <figure key={t.id} className={s.moodTile}>
            <span className={s.moodArt}>
              <MoodArt id={t.id} />
            </span>
            <figcaption>{t.caption}</figcaption>
          </figure>
        ))}
      </div>
      <div className={s.moodPalette}>
        <span className={s.moodChips} role="img" aria-label="Palette: rust, hip red, oat, sage and plum">
          {["#a8442b", "#b3321f", "#e8d7b5", "#7c8a57", "#6d3b4a"].map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </span>
        <p>Hedgerow and orchard, nothing from a glasshouse. Estimate on request once numbers are final.</p>
      </div>
    </Paper>
  );
}

/* ── Other kinds ─────────────────────────────────────────────────────── */

const GLAZES = [
  { name: "Tidewater", code: "G-12", a: "#5e8e96", b: "#2f5a63" },
  { name: "Oat", code: "G-03", a: "#efe4cd", b: "#cdb993" },
  { name: "Ember", code: "G-21", a: "#c7683e", b: "#86391e" },
  { name: "Moss", code: "G-17", a: "#8a9a62", b: "#56653a" },
  { name: "Slate", code: "G-08", a: "#5c6570", b: "#2f353c" },
  { name: "Bone", code: "G-01", a: "#f6f1e6", b: "#dcd2bf" },
];

function Swatches() {
  return (
    <div className={cx(s.fit, s.photo)} style={{ "--ar": 1.25 } as CSSProperties}>
      <div className={cx(s.photoFrame, s.swatchBoard)} role="img" aria-label="Six glaze test tiles">
        {GLAZES.map((g) => (
          <div key={g.name} className={s.swatch}>
            <span className={s.tile} style={{ background: `radial-gradient(120% 90% at 30% 20%, ${g.a}, ${g.b})` }} />
            <span className={s.swName}>{g.name}</span>
            <span className={s.swCode}>{g.code}, cone 6</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkCard({ body }: { body: Extract<Body, { t: "link" }> }) {
  return (
    <div className={s.linkWrap}>
      <div className={s.browser}>
        <div className={s.browserBar}>
          <span className={s.dots} aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className={s.urlPill}>
            <Icon name="lock" size={11} />
            <span className={s.urlDomain}>{body.domain}</span>
            <span className={s.urlPath}>{body.path}</span>
          </span>
        </div>
        <div className={s.siteHero} style={{ background: body.tint }}>
          <span className={s.siteNav}>
            <span className={s.favicon}>{body.favicon}</span>
            <span>{body.site}</span>
          </span>
          <p className={s.siteHeadline}>{body.title}</p>
        </div>
        <div className={s.siteBody}>
          <p>{body.desc}</p>
          <div className={s.siteLines} aria-hidden>
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
      <p className={s.linkMeta}>
        <span className={s.okDot} aria-hidden /> Link checked 10 min ago · opens in a new tab
      </p>
    </div>
  );
}

function LogoBoard({ round }: { round: 1 | 2 }) {
  return (
    <div className={s.canvasWrap}>
      <div className={s.canvas}>
        <p className={s.frameLabel}>{round === 1 ? "Round one, three directions" : "Round two, the arch"}</p>
        <div className={s.frames}>
          {round === 1 ? (
            <>
              <div className={s.frame}>
                <span className={s.markCircle}>K</span>
                <span className={s.wordSans}>Kiln &amp; Co</span>
              </div>
              <div className={s.frame}>
                <span className={s.markArch}>
                  <span>K</span>
                </span>
                <span className={s.wordSerif}>Kiln &amp; Co</span>
              </div>
              <div className={s.frame}>
                <span className={s.markStamp}>K&amp;C</span>
                <span className={s.wordSans}>Kiln and Company</span>
              </div>
            </>
          ) : (
            <>
              <div className={cx(s.frame, s.frameHero)}>
                <span className={cx(s.markArch, s.markArch2)}>
                  <span>K</span>
                </span>
                <span className={cx(s.wordSerif, s.wordSerif2)}>
                  Kiln <em>&amp;</em> Co
                </span>
              </div>
              <div className={cx(s.frame, s.frameDark)}>
                <span className={cx(s.markArch, s.markArch2, s.markInverse)}>
                  <span>K</span>
                </span>
              </div>
              <div className={s.frame}>
                <span className={s.stampRound}>Made in Thomastown</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Slide() {
  return (
    <div className={cx(s.fit, s.photo)} style={{ "--ar": 16 / 9 } as CSSProperties}>
      <div className={cx(s.photoFrame, s.slide)}>
        <div className={s.slideText}>
          <p className={s.slideKicker}>For stockists, autumn 2026</p>
          <p className={s.slideTitle}>Stoneware for everyday tables</p>
          <p className={s.slideSub}>Fired twice in Thomastown. Used every day, everywhere.</p>
        </div>
        <div className={s.slideArt} aria-hidden>
          <span className={s.pot1} />
          <span className={s.pot2} />
          <span className={s.pot3} />
        </div>
        <span className={s.slideNum}>1 / 14</span>
      </div>
    </div>
  );
}
