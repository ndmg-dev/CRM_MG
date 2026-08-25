import { useEffect, useState } from "react";

/** Devolve `value` com atraso — usado para não disparar uma requisição por
 * tecla em campos de busca que consultam o servidor. */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
