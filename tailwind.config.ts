import type { Config } from 'tailwindcss';

// 色は CSS 変数("R G B" 形式)から取る。<alpha-value> で bg-accent/20 のような透過指定が使える。
const token = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        surface2: token('surface2'),
        border: token('border'),
        text: token('text'),
        muted: token('muted'),
        accent: token('accent'), // #8b7cf6
        accentStrong: token('accent-strong'), // #6452e6(主ボタンの背景。白文字で 4.5:1 以上)
        effGreen: token('eff-green'), // #34d399
        effPurple: token('eff-purple'), // #a78bfa
        effYellow: token('eff-yellow'), // #fbbf24
        effRed: token('eff-red'), // #f87171
      },
    },
  },
  plugins: [],
} satisfies Config;
