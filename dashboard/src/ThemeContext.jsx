import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({ mode: 'light', toggleMode: () => {} });

export function ThemeProvider({ children }) {
  // Read initial mode from localStorage (or default to light)
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('ecg_theme_mode');
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Apply theme via data-theme attribute on <html>
  // CSS variables in index.css automatically swap based on this attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('ecg_theme_mode', mode);
  }, [mode]);

  const toggleMode = () => setMode(m => m === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}