import { useDataStore } from '../../store/data';
import { useUiStore } from '../../store/ui';
import Button from '../common/Button';

/** 上部ヘッダー: アプリ名・テーマ切替・データの版と時点 */
export default function AppHeader() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const data = useDataStore((s) => s.data);

  const asOf = data
    ? [
        `★ ${data.starforce.meta.asOf}`,
        `キューブ ${data.cubes.meta.asOf}`,
        `確率表 ${data.cubeTables.meta.asOf}`,
        data.items.meta.asOf ? `装備 ${data.items.meta.asOf}` : null,
      ]
        .filter((x): x is string => !!x)
        .join(' / ')
    : null;

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl min-w-0 items-center justify-between gap-3 px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold sm:text-lg">JMS 装備強化順序プランナー</h1>
          {data && (
            <p className="truncate text-[11px] text-muted" title={asOf ?? undefined}>
              データ版 {data.manifest.version.slice(0, 7)}
              {asOf ? `(${asOf})` : ''}
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'ライトテーマにする' : 'ダークテーマにする'}
          title={theme === 'dark' ? 'ライトテーマにする' : 'ダークテーマにする'}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          <span>{theme === 'dark' ? 'ライト' : 'ダーク'}</span>
        </Button>
      </div>
    </header>
  );
}
