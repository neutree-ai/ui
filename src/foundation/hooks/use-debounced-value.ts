import { useEffect, useState } from "react";

const DEFAULT_DELAY_MS = 300;

// Trails `value` by `delay`, so a value driven by typing can be used as a query
// key without firing a request per keystroke.
export function useDebouncedValue<T>(value: T, delay = DEFAULT_DELAY_MS) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
