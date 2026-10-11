import { useEffect, useRef, type ReactNode } from 'react';
import { useDataStore } from '../../store/data';
import { useToastStore } from '../../store/toast';
import Button from '../common/Button';
import Skeleton from '../common/Skeleton';

/** マスタの読み込みを待つ。読み込み中は骨組み、失敗時は再読み込みボタン。注意はトーストで1回だけ出す */
export default function DataGate({ children }: { children: ReactNode }) {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const warnings = useDataStore((s) => s.warnings);
  const load = useDataStore((s) => s.load);
  const shown = useRef(new Set<string>());

  useEffect(() => {
    for (const w of warnings) {
      if (shown.current.has(w)) continue;
      shown.current.add(w);
      useToastStore.getState().push(w, 'warn');
    }
  }, [warnings]);

  if (status === 'error') {
    return (
      <div role="alert" className="rounded-lg border border-effRed/60 bg-surface p-4">
        <p className="font-bold">データの読み込みに失敗しました。</p>
        {error && (
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-muted">
            {error}
          </pre>
        )}
        <Button className="mt-3" variant="primary" onClick={() => void load()}>
          再読み込み
        </Button>
      </div>
    );
  }

  if (status !== 'ready') {
    return (
      <div aria-busy="true" className="space-y-3">
        <p className="sr-only" role="status">
          データを読み込んでいます…
        </p>
        <Skeleton className="h-8 w-1/2" />
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {Array.from({ length: 16 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
        <Skeleton lines={3} />
      </div>
    );
  }

  return <>{children}</>;
}
