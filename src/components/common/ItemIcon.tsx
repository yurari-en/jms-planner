import { useState } from 'react';
import type { EquipSlotKind } from '../../data/types';

export interface ItemIconProps {
  itemId: number | null;
  kind: EquipSlotKind;
  /** 代替テキスト(装備名) */
  alt?: string;
  size?: number;
  className?: string;
}

/** 部位ごとのプレースホルダーの短い表示(2文字まで) */
const KIND_GLYPH: Record<EquipSlotKind, string> = {
  hat: '帽子',
  top: '上着',
  bottom: '下着',
  overall: '全身',
  shoes: '靴',
  gloves: '手袋',
  cape: 'マン',
  belt: 'ベル',
  shoulder: '肩',
  face: '顔',
  eye: '目',
  earrings: '耳',
  ring: '指輪',
  pendant: 'ペン',
  emblem: 'エム',
  pocket: 'ポケ',
  shield: '盾',
  secondary: '補助',
  weapon: '武器',
};

function Placeholder({ kind, size, label }: { kind: EquipSlotKind; size: number; label: string }) {
  const glyph = KIND_GLYPH[kind] ?? '装備';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={label}
      className="shrink-0 text-muted"
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="5"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeDasharray="3 2"
      />
      <text
        x="16"
        y="16"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={glyph.length > 1 ? 10 : 14}
        fill="currentColor"
      >
        {glyph}
      </text>
    </svg>
  );
}

/** 装備アイコン(同一オリジンの public/icons/items/{id}.png)。無ければ部位のプレースホルダー */
export default function ItemIcon({
  itemId,
  kind,
  alt = '',
  size = 32,
  className = '',
}: ItemIconProps) {
  const [failedId, setFailedId] = useState<number | null>(null);
  if (itemId === null || failedId === itemId) {
    return <Placeholder kind={kind} size={size} label={alt || KIND_GLYPH[kind]} />;
  }
  return (
    <img
      src={`${import.meta.env.BASE_URL}icons/items/${itemId}.png`}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`shrink-0 object-contain [image-rendering:pixelated] ${className}`}
      onError={() => setFailedId(itemId)}
    />
  );
}
