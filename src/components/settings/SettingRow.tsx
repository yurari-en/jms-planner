import type { ReactNode } from 'react';
import Button from '../common/Button';

export interface SettingRowProps {
  /** 既定値に戻すボタンの読み上げ用(項目名) */
  name: string;
  children: ReactNode;
  /** 補足説明 */
  description?: ReactNode;
  /** 既定値と同じか */
  isDefault: boolean;
  /** 既定値の表示(例: '1.0') */
  defaultText: string;
  onReset: () => void;
}

/** 設定1項目: 操作部品 + 説明 + 「既定: x」 + 既定に戻す */
export default function SettingRow({
  name,
  children,
  description,
  isDefault,
  defaultText,
  onReset,
}: SettingRowProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-b border-border/60 py-2 last:border-b-0 sm:flex-row sm:items-start sm:gap-3">
      <div className="min-w-0 flex-1">
        {children}
        {description && <div className="mt-1 text-xs text-muted">{description}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
        {!isDefault && <span className="text-xs text-muted">既定: {defaultText}</span>}
        <Button
          size="sm"
          variant="ghost"
          disabled={isDefault}
          aria-label={`${name}を既定に戻す`}
          onClick={onReset}
        >
          既定に戻す
        </Button>
      </div>
    </div>
  );
}
