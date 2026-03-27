/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Participant {
  id: string;
  name: string;
}

export interface Match {
  id: string;
  round: number;
  position: number; // Vertical position in the round
  participant1Id: string | null;
  participant2Id: string | null;
  score1?: string;
  score2?: string;
  winnerId: string | null;
  loserId?: string | null;
  bracketType: 'winners' | 'losers' | 'grand-finals';
}

export interface Tournament {
  id: string;
  name: string;
  participants: Participant[];
  matches: Match[];
}
