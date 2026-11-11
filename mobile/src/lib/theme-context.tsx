import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { vars } from 'nativewind';
import { C as lightC, darkC, inputStyle as baseInputStyle } from './theme';

export type ThemeMode = 'system' | 'light' | 'dark';
interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}
// Appearance is independent of kitchen/demo data, and survives signing out or resetting it.
const useAppearance = create<ThemeState>()(persist(
  (set) => ({ mode: 'system', setMode: (mode) => set({ mode }) }),
  { name: 'honey-appearance-v1', storage: createJSONStorage(() => AsyncStorage),
    partialize: ({ mode }) => ({ mode }),
    merge: (saved, current) => {
      const mode = (saved as Partial<ThemeState> | undefined)?.mode;
      return { ...current, mode: mode === 'light' || mode === 'dark' ? mode : 'system' };
    },
  },
));

function useResolvedTheme() {
  const systemScheme = useColorScheme();
  const mode = useAppearance((s) => s.mode);
  const setMode = useAppearance((s) => s.setMode);
  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  return useMemo(() => {
    const C = isDark ? darkC : lightC;
    const inputStyle = { ...baseInputStyle, fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'System', fontWeight: '500' as const, backgroundColor: C.paper, borderColor: C.hairline, color: C.ink };
    return { C, inputStyle, isDark, mode, setMode };
  }, [isDark, mode, setMode]);
}

type ThemeValue = ReturnType<typeof useResolvedTheme>;
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useResolvedTheme();
  const [hydrated, setHydrated] = useState<boolean>(() => useAppearance.persist.hasHydrated());
  useEffect(() => {
    const unsubscribe = useAppearance.persist.onFinishHydration(() => setHydrated(true));
    // Storage failures must not leave the splash visible forever.
    if (useAppearance.persist.hasHydrated()) setHydrated(true);
    else Promise.resolve(useAppearance.persist.rehydrate()).catch(() => {}).finally(() => setHydrated(true));
    return unsubscribe;
  }, []);
  if (!hydrated) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}

export function themeVariables(C: ThemeValue['C']) {
  return vars(Object.fromEntries(Object.entries(C)
    .filter(([, value]) => /^#[0-9a-f]{6}$/i.test(value))
    .map(([key, value]) => [`--color-${key}`, `${parseInt(value.slice(1, 3), 16)} ${parseInt(value.slice(3, 5), 16)} ${parseInt(value.slice(5, 7), 16)}`])));
}
