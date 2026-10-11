import { EQUIP_SLOTS } from '../../domain/character';
import EquipCard from './EquipCard';

/** 全部位のカード一覧(360px で2列、広い画面ではもっと) */
export default function EquipGrid() {
  return (
    <ul
      aria-label="装備部位"
      className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3"
    >
      {EQUIP_SLOTS.map((slot) => (
        <li key={slot} className="min-w-0">
          <EquipCard slot={slot} />
        </li>
      ))}
    </ul>
  );
}
