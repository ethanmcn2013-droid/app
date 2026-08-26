# Round 12 runsheet (prompts mode)

1. Run each seat-<key>.md in its own FRESH context (subagent if available;
   strictly one at a time otherwise), writing each seat's JSON to disk
   before the next seat begins. Never mention one seat's output to another.
2. For every finding across all seats, run refuter-template.md (fill the
   {placeholders}) in a fresh context. Default is REFUTED.
3. Fix every confirmed finding; verify each rendered; grow the behaviour
   gate; run both gates; append the round to panel.json; rebuild and
   republish both artifacts; push.
4. If seats ran sequentially in one shared context, record "degraded
   blindness" in the round entry.
