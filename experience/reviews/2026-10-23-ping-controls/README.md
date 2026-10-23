# Ping controls: capture receiving

This is a mechanical capture refresh, independently reviewed by a Sol 6.1
reviewer on 23 October 2026. It does not re-score an experience or claim a new
manual founder review.

Accepted baseline: `a60deb0c7abbd693c1dbd136ff890c4077fa37b3`.
Fresh capture source: `4371e67e1fd4f2d9290811c71ed031bd5e7532ec`, tree
`bbe3c5d998433226334bb5af9864f72213dbf7d8`.
The subsequent DATA-main integration `aebf3f22` has that identical tree.

[Capture run](https://github.com/ethanmcn2013-droid/app/actions/runs/39987943573)
received 188/188 expected passing outcomes across four viewports, with no skipped,
flaky or unexpected outcomes. Artifact `12518215330` SHA-256:
`e35716b3dc2fab96d19d3e67f57d38bd94b91d30ba9b25e8331f3f4b4df74e82`.

The 18 existing reviewed registry entries, source files, materiality pins, receipt
bytes and review metadata were unchanged from the accepted baseline. All 72
per-experience viewport outcome tuples matched their prior attestations. Only
the five Playwright pointer fields were refreshed; review dates, reviewers,
scores, coverage, source pins and screenshot bindings remain historical.

Independent bounded rebind review SHA-256:
`6878807887cc81a2f703ff9d1661546ade646f866294f1aef48ef03f3d6964cb`.
Proposal SHA-256:
`cdafe2c7d5ed32d8f5adb0d9d71cf0144d0c736f2fe43ee1ac134fc2156a8f64`.

The separate Ping assistant registry entry is not scored by this refresh.
Expanded-control UI receiving, provider-free backend checks, production migration
receiving and live application receiving are separate evidence boundaries. No
folder-provider effect, model quality score or production latency follows from
this capture.
