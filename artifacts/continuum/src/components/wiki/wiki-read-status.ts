/** A refresh failure must not discard a successful response for this query. */
export function wikiReadStatus(data: unknown, isError: boolean) {
  const hasData = data !== undefined && data !== null;
  return {
    showError: isError && !hasData,
    showRefreshError: isError && hasData,
  };
}
