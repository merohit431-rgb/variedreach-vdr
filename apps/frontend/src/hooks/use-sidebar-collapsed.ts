import { useEffect, useState } from 'react';

const STORAGE_KEY = 'vdr.sidebar-collapsed';

export function useSidebarCollapsed() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsCollapsed(window.localStorage.getItem(STORAGE_KEY) === 'true');
    setIsHydrated(true);
  }, []);

  function toggle() {
    setIsCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  // Avoid a flash of the collapsed rail before localStorage is read on mount.
  return { isCollapsed: isHydrated ? isCollapsed : false, toggle };
}
