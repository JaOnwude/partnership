"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
const lagosYear = () =>
  Number(new Intl.DateTimeFormat("en", { timeZone: "Africa/Lagos", year: "numeric" }).format(new Date()));

// Pages are pre-rendered, so the year is read in the browser (Lagos time) rather than
// baked in at build time. Renders nothing until then.
export function CurrentYear({ since }: { since: number }) {
  const year = useSyncExternalStore(noSubscribe, lagosYear, () => null);
  if (year === null) return <>{since}</>;
  return <>{year > since ? `${since}–${year}` : since}</>;
}
