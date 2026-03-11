export type SceneId = string;

export interface Choice {
  text: string;
  nextSceneId: SceneId;
  isImportant?: boolean;
}

export interface Dialogue {
  character: string;
  text: string;
  onEnter?: () => void;
}

export interface Scene {
  id: SceneId;
  background: 'forest' | 'city' | 'room' | 'road';
  dialogues: Dialogue[];
  choices?: Choice[];
  nextSceneId?: SceneId;
}

export interface GameState {
  currentSceneId: SceneId;
  currentDialogueIndex: number;
  history: SceneId[];
}
