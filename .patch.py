import io
p = 'docs/design/labs/notes-2026-08/notebook.js'
s = io.open(p, encoding='utf-8').read()

PEEL = """    if (isPeeling) {
      /* The product's signature promise is that the note never leaves and
         only the words you pick cross. It was drawn properly exactly once,
         in the review hand, and flattened into a share sidebar in the room
         where most people will meet it — same shadowless rectangle, same
         column, no edge of its own. It is a second sheet on the desk now,
         with its own paper and a notch pointing back at the note it was
         taken off. */
      return deskOf(
        `<div class="top" data-two>
          <div class="deskWrite"><p class="readBody" tabindex="0" role="group" aria-label="The note. Pick the words that should cross, with the arrow keys.">${bodyHtml}</p></div>
          ${aside}
        </div>`,
        { behind: 1, label: `Turning a note into a task: ${note.title}`, under: peelPanel(note) },
      );
    }
    /* Everything that is true ABOUT the note lives beside it, not above
       it: the desk was a thousand pixels wide doing five hundred of work,
       and the facts were stacked on one line over the writing. */
"""
ASIDE_START = """    const aside = `
      <div class="deskAside">"""

assert s.count(PEEL) == 1
i = s.index(PEEL)
j = s.index(ASIDE_START, i)
k = s.index("</div>`;\n", j) + len("</div>`;\n")
aside_block = s[j:k]

# the facts are built before either branch can ask for them
s = s[:i] + """    /* Everything that is true ABOUT the note lives beside it, not above
       it: the desk was a thousand pixels wide doing five hundred of work,
       and the facts were stacked on one line over the writing. */
""" + aside_block + PEEL.replace("""    /* Everything that is true ABOUT the note lives beside it, not above
       it: the desk was a thousand pixels wide doing five hundred of work,
       and the facts were stacked on one line over the writing. */
""", "") + s[k:]

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print("the note's facts are built once, before any branch asks for them")
