export interface BrowserTab {
  key: number;
  history: string[];
  idx: number;
}

export interface InitialTabSession {
  tabs: BrowserTab[];
  activeKey: number;
  homeOpen: boolean;
}

export interface CloseTabResult {
  tabs: BrowserTab[];
  activeKey: number;
  closedTab: BrowserTab | null;
  returnedHome: boolean;
}

/**
 * Starts on a clean Homescreen with zero preset tabs (no Neuron / Mars / Jensen tabs).
 * Only mounts the Jensen Huang briefing tab when explicitly entering the direct `/news/jensen-huang` route.
 */
export function createInitialTabSession(newsRoute: boolean, newsEntry: string): InitialTabSession {
  if (newsRoute) {
    return {
      tabs: [{ key: 1, history: [newsEntry], idx: 0 }],
      activeKey: 1,
      homeOpen: false,
    };
  }
  return {
    tabs: [],
    activeKey: 0,
    homeOpen: true,
  };
}

/**
 * Closes a tab and returns `returnedHome: true` when the last remaining tab is closed
 * so the app glides cleanly back to the centered Homescreen prompt box.
 */
export function closeTabInSession(
  tabs: BrowserTab[],
  activeKey: number,
  targetKey: number,
): CloseTabResult {
  const index = tabs.findIndex((t) => t.key === targetKey);
  const closedTab = index >= 0 ? tabs[index] : null;
  if (!closedTab) {
    return { tabs, activeKey, closedTab: null, returnedHome: tabs.length === 0 };
  }

  const nextTabs = tabs.filter((t) => t.key !== targetKey);
  if (nextTabs.length === 0) {
    return {
      tabs: [],
      activeKey: 0,
      closedTab,
      returnedHome: true,
    };
  }

  const nextActiveKey =
    targetKey === activeKey ? nextTabs[Math.max(0, index - 1)].key : activeKey;

  return {
    tabs: nextTabs,
    activeKey: nextActiveKey,
    closedTab,
    returnedHome: false,
  };
}
