import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatCatalogUnavailable } from "./chat-catalog-unavailable";

test("catalog failures offer recovery without claiming the account has no Projects", () => {
  const html = renderToStaticMarkup(createElement(ChatCatalogUnavailable, { retrying: false, onRetry() {} }));
  assert.match(html, /Conversations are unavailable/); assert.match(html, />Try again<\/button>/); assert.doesNotMatch(html, /Add a Project|No Projects/);
  const pending = renderToStaticMarkup(createElement(ChatCatalogUnavailable, { retrying: true, onRetry() {} }));
  assert.match(pending, /disabled=""/); assert.match(pending, /Trying again/);
});
