import { useState } from 'react';

type Theme = 'dark' | 'light';

const UI_KEY = 'jmsplanner:v1:ui';

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(UI_KEY, JSON.stringify({ version: 1, theme }));
  } catch {
    // localStorage が使えない環境(プライベートモード等)では保存しない
  }
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <h1 className="text-base font-bold sm:text-lg">JMS 装備強化順序プランナー</h1>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={theme === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}
        >
          {theme === 'dark' ? 'ライト' : 'ダーク'}
        </button>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <p className="text-muted">準備中です。</p>
      </main>
    </div>
  );
}
