import { useEffect, useRef, useState } from "react";

export function useLocalStorage(key, initialValue) {
  const isFirst = useRef(true);

  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === key) {
        try {
          setValue(e.newValue !== null ? JSON.parse(e.newValue) : initialValue);
        } catch {
          setValue(initialValue);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, initialValue]);

  return [value, setValue];
}
