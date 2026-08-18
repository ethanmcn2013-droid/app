import io
p = 'docs/design/labs/notes-2026-08/notebook.js'
s = io.open(p, encoding='utf-8').read()
def sub(old, new, n=1):
    global s
    assert s.count(old) >= 1, "MISS: " + old[:110]
    s = s.replace(old, new, n)

sub("""  function openNote(id) {
    picked = null;
    nudge = null;
    openId = id;""",
"""  function openNote(id) {
    picked = null;
    nudge = null;
    /* Search is how you find a note, not where you read it: its desk is
       the field, so a note opened from a result had nowhere to appear.
       Opening a result leaves the search and lands on the note, which is
       what "Open that one" already did by hand for the near-miss case. */
    if (state === "search") {
      state = "notebook";
      query = "";
    }
    openId = id;""")

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print("js: opening a result leaves the search and lands on the note")
