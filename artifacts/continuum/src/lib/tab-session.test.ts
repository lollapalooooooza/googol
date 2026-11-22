import assert from "node:assert/strict";
import test from "node:test";
import { closeTabInSession, createInitialTabSession } from "./tab-session";

test("default Homescreen session starts with zero preset tabs and homeOpen=true", () => {
  const session = createInitialTabSession(false, "/news/jensen-huang");
  assert.equal(session.homeOpen, true);
  assert.equal(session.tabs.length, 0);
  assert.equal(session.activeKey, 0);
});

test("direct news route opens only the requested briefing tab", () => {
  const session = createInitialTabSession(true, "/news/jensen-huang");
  assert.equal(session.homeOpen, false);
  assert.equal(session.tabs.length, 1);
  assert.equal(session.tabs[0].history[0], "/news/jensen-huang");
  assert.equal(session.activeKey, 1);
});

test("closing the last open tab returns cleanly to Homescreen", () => {
  const tabs = [{ key: 11, history: ["chrome:plantcell"], idx: 0 }];
  const res = closeTabInSession(tabs, 11, 11);
  assert.equal(res.returnedHome, true);
  assert.equal(res.tabs.length, 0);
  assert.equal(res.activeKey, 0);
  assert.equal(res.closedTab?.key, 11);
});

test("closing one of multiple tabs keeps browser open and selects adjacent tab", () => {
  const tabs = [
    { key: 11, history: ["chrome:plantcell"], idx: 0 },
    { key: 12, history: ["Plant cell"], idx: 0 },
  ];
  const res = closeTabInSession(tabs, 12, 12);
  assert.equal(res.returnedHome, false);
  assert.equal(res.tabs.length, 1);
  assert.equal(res.activeKey, 11);
});
