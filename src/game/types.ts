// Shared constants and small types of the game engine (see docs/engine-api.md).

/** Directions: 0 = N (away from the camera), 1 = NW, 2 = W, 3 = SW, 4 = S (towards the camera), 5 = SE, 6 = E, 7 = NE. */
export type Dir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const DIR_N = 0, DIR_NW = 1, DIR_W = 2, DIR_SW = 3, DIR_S = 4, DIR_SE = 5, DIR_E = 6, DIR_NE = 7;

/** Click verbs as the scene handlers get them (FUN_0046a3d0): 1 = plain click (walk), 2 = MOUTH (tala), 3 = HAND (ta), 4 = EYE (titta). */
export type Verb = 1 | 2 | 3 | 4;
export const VERB_WALK = 1, VERB_MOUTH = 2, VERB_HAND = 3, VERB_EYE = 4;
/** Hotspot dispatcher verb index (FUN_0046dbb0): 0 = MOUTH, 1 = HAND, 2 = EYE. */
export type DispatchVerb = 0 | 1 | 2;

/** Scene names (SCURR scene objects); numeric ids as in gVar 0x4cf8c8. */
export const SCENES = {
  SKALLEPERSRUM: 0x1001, LOVISMATTISRUM: 0x1002, STORASALEN: 0x1003, KOKET: 0x1004, BORGGARDEN: 0x1005,
  VAPENHUS: 0x1006, HELVETESGAPET: 0x1007, TORNET: 0x1008, UTSIKTSKOGEN: 0x1009, KAELLARE: 0x100a,
  FANGELSEHALOR: 0x100b, BORGPORTEN: 0x100c, SKOGEN: 0x100d, KAELLAN: 0x100e, GLAENTAN: 0x100f,
  GLUPAFALLET: 0x1010, TJAERNEN: 0x1011, GROTTANUTE: 0x1012, GROTTANINNE: 0x1013, LABYRINT: 0x1014, BRAEDSPEL: 0x1015,
} as const;
export type SceneName = keyof typeof SCENES;
export const SCENE_NAMES = Object.keys(SCENES) as SceneName[];
export const sceneNameById = (id: number): SceneName | undefined => SCENE_NAMES.find((n) => SCENES[n] === id);

/** The 49 SCURR objects, objId = index + 1. */
export const OBJECT_NAMES = [
  'RONJA', 'BIRK', 'MATTIS', 'LOVIS', 'BERATTAREN', 'SKALLEPER', 'LILLKLIPPEN', 'FJOSOK', 'STURKAS', 'TJEGGE', 'LABAS',
  'BORKA', 'BORKAROV', 'ASKEN', 'BRODKAKA', 'DJUR1', 'DJUR2', 'DJUR3', 'ELDSTAL', 'ELD1', 'ELD2', 'ELD3', 'ELD4', 'FACKLA',
  'FISKNAT', 'FLINTA', 'FNOSKE', 'GRADVARG', 'HINDER', 'KARTAN', 'KISTLOCK', 'KNIV', 'KOTTE', 'LAX', 'MOROTTER', 'NYCKEL',
  'OST', 'RATTA', 'RATTBUR', 'REM', 'RUMPNISSE', 'SKUMTROLL', 'SNOBOLL', 'STEGE', 'TARNING', 'UNDERJORD', 'VATTENKARL',
  'VITMOSSA', 'VILDVITTRA',
] as const;
export type ObjName = (typeof OBJECT_NAMES)[number];

/** setTrack flags (FUN_00455990). Loop count n+1 plays: `((n << 4) & 0xf0) | TF_LOOP`; TF_LOOP alone = forever. */
export const TF_LOOP = 0x01;
export const TF_HIDE_AT_END = 0x02;
export const TF_PRELOAD = 0x04;
export const TF_PORTAL = 0x100;
export const TF_SOUND = 0x200;
export const TF_LIPSYNC = 0x400;
export const TF_KEEP_CB = 0x800;
/** Voice line talk tracks: sound + lip sync loop + dialogue marker. */
export const TF_TALK = 0x700;

/** Track hook event codes (FUN_00451b20). */
export const HOOK_START = 0x100000;
export const HOOK_END = 0x200000;
export const hookKey = (n: number) => 0x400000 | n;

/** busy bits (DAT_004ee744): any bit set = invisible cursor, clicks ignored. */
export const BUSY_PORTAL = 1;
export const BUSY_SYNC = 2;
export const BUSY_FISH = 0x10;
export const BUSY_STURKAS = 0x80;

export const SCREEN_W = 640, SCREEN_H = 480;
