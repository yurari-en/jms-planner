import { useDataStore } from '../../store/data';
import { useSettingsStore } from '../../store/settings';
import Button from '../common/Button';
import Collapsible from '../common/Collapsible';
import ConversionSettings from './ConversionSettings';
import CubeSettings from './CubeSettings';
import DisplaySettings from './DisplaySettings';
import { UNRESOLVED_ITEMS, sameValue } from './settingsText';
import StarforceSettings from './StarforceSettings';

function UnresolvedNotes() {
  return (
    <Collapsible id="settings.unresolved" title="未確定事項と前提">
      <ul className="space-y-2">
        {UNRESOLVED_ITEMS.map((u) => (
          <li key={u.item} className="min-w-0 rounded-md border border-border/60 p-2 text-sm">
            <p className="font-bold">{u.item}</p>
            <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs">
              <dt className="text-muted">既定の扱い</dt>
              <dd className="min-w-0 break-words">{u.handling}</dd>
              <dt className="text-muted">変更手段</dt>
              <dd className="min-w-0 break-words">{u.change}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </Collapsible>
  );
}

/** 設定タブ(DESIGN.md §7.4 / §5.3 / §11) */
export default function SettingsTab() {
  const settings = useSettingsStore((s) => s.settings);
  const defaults = useSettingsStore((s) => s.defaults);
  const resetAll = useSettingsStore((s) => s.resetAll);
  const data = useDataStore((s) => s.data);

  if (!settings || !defaults || !data) {
    return <p className="text-sm text-muted">設定を読み込み中…</p>;
  }
  const allDefault = sameValue(settings, defaults);
  const props = { s: settings, d: defaults, data };

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-muted">
          設定はすべてのキャラ共通で、自動で保存されます。
        </p>
        <Button
          size="sm"
          variant="danger"
          disabled={allDefault}
          onClick={() => {
            if (window.confirm('すべての設定を既定値に戻します。よろしいですか?')) resetAll();
          }}
        >
          すべて既定に戻す
        </Button>
      </div>
      <StarforceSettings {...props} />
      <CubeSettings {...props} />
      <ConversionSettings {...props} />
      <DisplaySettings {...props} />
      <UnresolvedNotes />
      <section aria-label="計算基準" className="space-y-1 text-xs text-muted">
        <p>
          <span className="font-bold">計算基準(スターフォース):</span> {data.starforce.meta.basis}
        </p>
        <p>
          <span className="font-bold">計算基準(キューブ):</span> {data.cubes.meta.note}
        </p>
        <p>
          <span className="font-bold">計算基準(追加オプション):</span> {data.flame.meta.basis}
        </p>
      </section>
    </div>
  );
}
