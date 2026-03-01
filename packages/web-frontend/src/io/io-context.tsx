import { createContext, useContext } from 'react';
import type { IOProvider } from './types';

export const IOContext = createContext<IOProvider | undefined>(undefined);

export function useIO(): IOProvider {
  const value = useContext(IOContext);
  if (!value) {
    throw new Error('useIO must be used within IOContext.Provider');
  }
  return value;
}
