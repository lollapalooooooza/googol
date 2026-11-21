import { strict as assert } from "node:assert";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { wikiReadStatus } from "./wiki-read-status.ts";

test("a first-load failure still shows an explicit error", () => {
  assert.deepEqual(wikiReadStatus(undefined, true), { showError: true, showRefreshError: false });
});
test("loading and successful responses do not show failure notices", () => {
  for (const data of [undefined, { title: "Plant cell" }, []]) {
    assert.deepEqual(wikiReadStatus(data, false), { showError: false, showRefreshError: false });
  }
});
test("an empty successful search remains visible after a refresh failure", () => {
  assert.deepEqual(wikiReadStatus([], true), { showError: false, showRefreshError: true });
});
test("cached article content stays visible through a failed refresh and a successful retry", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const article = { title: "Plant cell", html: "<p>Previously loaded article</p>", sections: [{ anchor: "Structure" }] };
  const key = ["wiki-article", "Plant cell"];
  let fail = false;
  const observer = new QueryObserver(client, {
    queryKey: key,
    enabled: false,
    queryFn: async () => { if (fail) throw new Error("Temporary network failure"); return article; },
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    fail = true;
    const failed = await observer.refetch();
    // Reproduces the user's screenshot: valid data AND an error state.
    assert.equal(failed.isError, true);
    assert.equal(failed.data, article);
    assert.deepEqual(wikiReadStatus(failed.data, failed.isError), { showError: false, showRefreshError: true });
    fail = false;
    const recovered = await observer.refetch();
    assert.equal(recovered.data, article);
    assert.deepEqual(wikiReadStatus(recovered.data, recovered.isError), { showError: false, showRefreshError: false });
    assert.equal(wikiReadStatus(client.getQueryData(["wiki-article", "Neuron"]), true).showError, true);
  } finally {
    unsubscribe(); observer.destroy(); client.clear();
  }
});
