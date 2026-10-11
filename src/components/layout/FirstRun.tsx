import { useState } from 'react';
import { useCharactersStore } from '../../store/characters';
import { parseImportText } from '../../store/io';
import { useToastStore } from '../../store/toast';
import { useUiStore } from '../../store/ui';
import Button from '../common/Button';

/** キャラが1件も無いときの案内 */
export default function FirstRun() {
  const addCharacter = useCharactersStore((s) => s.addCharacter);
  const importCharacters = useCharactersStore((s) => s.importCharacters);
  const setActive = useCharactersStore((s) => s.setActive);
  const setTab = useUiStore((s) => s.setTab);
  const push = useToastStore((s) => s.push);
  const [busy, setBusy] = useState(false);

  const loadSample = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sample/sample-character.json`, {
        cache: 'no-cache',
      });
      if (!res.ok) {
        push('サンプルがまだありません', 'warn');
        return;
      }
      const r = parseImportText(await res.text());
      if (!r.ok) {
        push(`サンプルを読み込めませんでした: ${r.error}`, 'error');
        return;
      }
      const ids = importCharacters(r.characters, 'overwrite');
      const first = ids[0];
      if (first) setActive(first);
      push('サンプルのキャラを読み込みました。', 'info');
    } catch {
      push('サンプルがまだありません', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const createEmpty = () => {
    addCharacter();
    setTab('input');
  };

  return (
    <section
      aria-labelledby="first-run-title"
      className="min-w-0 rounded-lg border border-accent/50 bg-surface p-4"
    >
      <h2 id="first-run-title" className="text-base font-bold">
        はじめに
      </h2>
      <div className="mt-2 space-y-1 text-sm text-muted">
        <p>
          キャラクターと装備の現状を入力すると、かけたメルに対して戦闘力が最も伸びる強化の順番を表示します。
        </p>
        <p>
          入力したデータは<strong className="text-text">このブラウザの中だけ</strong>
          に保存され、外部には送信されません。別の端末で使うときは「JSON書き出し/読み込み」を使ってください。
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={createEmpty}>
          空のキャラを作る
        </Button>
        <Button onClick={() => void loadSample()} disabled={busy} aria-busy={busy}>
          サンプルを読み込む
        </Button>
      </div>
    </section>
  );
}
