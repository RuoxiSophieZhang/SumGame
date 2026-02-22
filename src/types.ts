
export type GameMode = 'classic' | 'time';

export interface Block {
  id: string;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
}

export interface GameState {
  grid: Block[];
  selectedIds: string[];
  targetSum: number;
  score: number;
  highScore: number;
  isGameOver: boolean;
  mode: GameMode;
  timeLeft: number;
  combo: number;
}
