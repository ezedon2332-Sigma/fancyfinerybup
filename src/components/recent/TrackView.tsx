"use client";

import { useEffect } from "react";

import { useRecentlyViewed, type RecentItem } from "./RecentlyViewedProvider";

/** Records the current product as recently viewed (renders nothing). */
export function TrackView({ item }: { item: RecentItem }) {
  const { track } = useRecentlyViewed();
  useEffect(() => {
    track(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.productId]);
  return null;
}
