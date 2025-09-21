
export const idle = (cb: IdleRequestCallback | (() => void)) =>
  ("requestIdleCallback" in window ? (requestIdleCallback as any)(cb, { timeout: 1500 }) : setTimeout(cb as any, 0));

export const decodeB64 = (s: string): string => {
  try { return atob(s); } catch { return ""; }
};
