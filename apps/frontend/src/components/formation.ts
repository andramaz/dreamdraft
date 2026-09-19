import {
  FORMATION_NAMES,
  formationOf,
  type Player,
  type Tactic,
} from '@dreamdraft/shared';

/** How one participant has arranged their squad on the pitch. */
export interface FormationChoice {
  formation: string;
  tactic: Tactic;
  /** Slot index -> player id the user placed there by hand. */
  pinned: Record<number, number>;
}

export function defaultChoice(squad: readonly Player[]): FormationChoice {
  return {
    // Open on the shape the squad already fills, when it fills one.
    formation: formationOf(squad) ?? FORMATION_NAMES[0]!,
    tactic: 'balanced',
    pinned: {},
  };
}
