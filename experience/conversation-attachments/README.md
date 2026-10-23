# Conversation files browser check

This uses the actual Project/DM/reply client in `/lab/project-conversation/live` against `scripts/conversations/preview-server.ts`. The proxy owns a fresh SQLite fixture and private temporary disk store. It never imports production identity, database or storage credentials.

The integration coordinator starts a credential-free development server and synthetic proxy in the final combined checkout, recording both owned PIDs and explicit free ports. Start a fresh proxy/database for each run: the audience case changes one synthetic membership.

Run with an explicit loopback proxy origin and output folder:

```
node experience/conversation-attachments/browser.mjs http://127.0.0.1:3189 C:/absolute/task/evidence/conversation-files
```

The runner refuses non-loopback origins. It seeds only the harness's named synthetic users/Project/DM and requires the server attachment slice. It captures desktop and phone screenshots plus a JSON receipt. It covers Project upload and exact download, scope navigation with staged files, root-pinned file-only reply, DM clipboard image/send/reload, receipt-first recovery after a withheld response without another send, and explicit reupload after audience change.

This is synthetic browser evidence. It does not establish production configuration, real account access, storage provider delivery, physical phone keyboards or migration execution. Root integration owns full suites, required CI and release authority.

The canonical CI entry point is `pnpm test:conversation-attachments:browser`. It starts a fresh credential-free client and synthetic proxy, runs the browser script above, and stops its own process trees. `CONVERSATION_ATTACHMENT_NEXT_PORT`, `CONVERSATION_ATTACHMENT_PROXY_PORT` and `CONVERSATION_ATTACHMENT_BROWSER_OUTPUT` select explicit unused ports and a fresh evidence destination. Required Design quality and candidate capture retain `experience/output/conversation-attachments`.
