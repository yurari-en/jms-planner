import { useRef, useState } from 'react';
import Popover from './Popover';
import { focusRing } from './styles';

export interface HelpTipProps {
  /** 説明文 */
  text: string;
  /** 読み上げ用のラベル(既定: 'ヘルプ') */
  label?: string;
}

/** ⓘ ボタン。ホバーで title、押すと説明のポップオーバー */
export default function HelpTip({ text, label = 'ヘルプ' }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        title={text}
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-xs leading-none text-muted hover:text-accent ${focusRing}`}
      >
        ⓘ
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} label={label}>
        <p className="max-w-xs whitespace-pre-wrap text-xs leading-relaxed">{text}</p>
      </Popover>
    </>
  );
}
