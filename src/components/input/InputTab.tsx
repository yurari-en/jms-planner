import { EQUIP_SLOTS, type EquipSlot } from '../../domain/character';
import { useCharactersStore } from '../../store/characters';
import { useUiStore } from '../../store/ui';
import Collapsible from '../common/Collapsible';
import CharacterForm from './CharacterForm';
import EquipEditor from './EquipEditor';
import EquipGrid from './EquipGrid';
import StatsForm from './StatsForm';

function isSlot(s: string | null): s is EquipSlot {
  return s !== null && (EQUIP_SLOTS as readonly string[]).includes(s);
}

function EquipSection() {
  const selected = useUiStore((s) => s.selectedSlot);
  const slot = isSlot(selected) ? selected : null;
  return (
    <Collapsible id="input.equips" title="装備">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start">
        <div className="min-w-0 md:w-1/2 lg:w-3/5">
          <EquipGrid />
        </div>
        <div className="min-w-0 rounded-md border border-border bg-bg/40 p-3 md:sticky md:top-2 md:w-1/2 lg:w-2/5">
          {slot ? (
            <EquipEditor key={slot} slot={slot} />
          ) : (
            <p className="text-sm text-muted">部位のカードを押すと、ここで編集できます。</p>
          )}
        </div>
      </div>
    </Collapsible>
  );
}

/** キャラ・装備入力タブ(DESIGN.md §7.2) */
export default function InputTab() {
  const hasActive = useCharactersStore((s) => s.activeId !== null && !!s.characters[s.activeId]);
  if (!hasActive) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm">
        キャラが選択されていません。上の「キャラ」から追加・選択してください。
      </p>
    );
  }
  return (
    <div className="min-w-0 space-y-3">
      <p className="text-xs text-muted">入力は自動で保存されます。</p>
      <Collapsible id="input.basic" title="基本情報">
        <CharacterForm />
      </Collapsible>
      <Collapsible id="input.stats" title="ステータス">
        <StatsForm />
      </Collapsible>
      <EquipSection />
    </div>
  );
}
