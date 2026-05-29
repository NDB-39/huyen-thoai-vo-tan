export interface ChatEntry {
  id: string;
  role: "user" | "storyteller" | "system";
  text: string;
  imageUrl?: string;
}

export type Difficulty = "easy" | "normal" | "hard";
export type GameMode = "game" | "story" | "hybrid";

export interface GameSettings {
  textModelsList: string[];
  imageModelsList: string[];
  currentTextModel: string;
  currentImageModel: string;
  imageRatio: string;
}

export interface GameState {
  history: ChatEntry[];
  difficulty: Difficulty;
  mode: GameMode;
  settings: GameSettings;
}

