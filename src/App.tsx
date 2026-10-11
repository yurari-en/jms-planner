import { useEffect } from 'react';
import InputTab from './components/input/InputTab';
import AppHeader from './components/layout/AppHeader';
import CharacterHeader from './components/layout/CharacterHeader';
import DataGate from './components/layout/DataGate';
import FirstRun from './components/layout/FirstRun';
import { panelId, tabId } from './components/layout/tabDefs';
import Tabs from './components/layout/Tabs';
import Toasts from './components/layout/Toasts';
import PlanTab from './components/plan/PlanTab';
import SettingsTab from './components/settings/SettingsTab';
import { useCharactersStore } from './store/characters';
import { consumeRecoveredKeys } from './store/persist';
import { useToastStore } from './store/toast';
import { useUiStore } from './store/ui';

export default function App() {
  const tab = useUiStore((s) => s.tab);
  const hasCharacters = useCharactersStore((s) => Object.keys(s.characters).length > 0);

  // 読めなかった保存データを退避した場合に知らせる
  useEffect(() => {
    for (const r of consumeRecoveredKeys()) {
      useToastStore
        .getState()
        .push(
          r.backupKey
            ? `保存データ(${r.key})の一部が読めなかったため、${r.backupKey} に退避して初期化しました。`
            : `保存データ(${r.key})の一部が読めなかったため初期化しました。`,
          'warn',
        );
    }
  }, []);

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-bg text-text">
      <AppHeader />
      <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 space-y-3 px-3 py-3 sm:px-4">
        {hasCharacters ? <CharacterHeader /> : <FirstRun />}
        <Tabs />
        <div
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          tabIndex={0}
          className="min-w-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <DataGate>
            {tab === 'plan' && <PlanTab />}
            {tab === 'input' && <InputTab />}
            {tab === 'settings' && <SettingsTab />}
          </DataGate>
        </div>
      </main>
      <Toasts />
    </div>
  );
}
