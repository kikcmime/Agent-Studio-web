import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSibling = (fileName) =>
  readFile(new URL(fileName, import.meta.url), "utf8");

test("flow run callbacks keep stable identities", async () => {
  const source = await readSibling("./use-flow-run-state.ts");

  assert.match(source, /const resetRunState = useCallback\(\(\) => \{/);
  assert.match(source, /const runCurrentFlow = useCallback\(async \(\) => \{/);
});

test("graph callbacks passed to React Flow keep stable identities", async () => {
  const source = await readSibling("./use-flow-graph-editor.ts");

  for (const callbackName of [
    "updateSelectedNode",
    "onConnect",
    "addNode",
    "openNodeSelectorFromNode",
    "deleteNodeById",
    "deleteSelectedNode",
  ]) {
    assert.match(source, new RegExp(`const ${callbackName} = useCallback\\(`));
  }
});

test("selector effect does not depend on the whole props object", async () => {
  const source = await readSibling("./flow-canvas.tsx");

  assert.doesNotMatch(source, /\}, \[props\]\);/);
  assert.match(source, /\}, \[anchor, onClose\]\);/);
});
