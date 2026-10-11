import type { PotGrade } from '../../domain/character';
import { GRADE_LABEL_JA, GRADE_SHORT_JA } from './inputHelpers';

const GRADE_CLASS: Record<Exclude<PotGrade, 'none'>, string> = {
  rare: 'border-sky-400/60 bg-sky-400/15 text-sky-500 dark:text-sky-300',
  epic: 'border-effPurple/60 bg-effPurple/15 text-effPurple',
  unique: 'border-effYellow/60 bg-effYellow/15 text-effYellow',
  legendary: 'border-effGreen/60 bg-effGreen/15 text-effGreen',
};

/** 潜在/アディの等級バッジ(色+文字。色だけに頼らない) */
export default function GradeBadge({ prefix, grade }: { prefix: string; grade: PotGrade }) {
  if (grade === 'none') return null;
  return (
    <span
      title={`${prefix === '潜' ? '潜在能力' : 'アディショナル'}: ${GRADE_LABEL_JA[grade]}`}
      className={`inline-flex shrink-0 items-center rounded border px-1 text-[10px] leading-4 ${GRADE_CLASS[grade]}`}
    >
      {prefix}:{GRADE_SHORT_JA[grade]}
    </span>
  );
}
