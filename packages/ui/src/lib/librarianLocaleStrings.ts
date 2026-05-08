import type { LibrarianLanguageCode } from "./librarianApiTypes";

export type LibrarianLocaleKey =
  | "title"
  | "placeholder"
  | "submit"
  | "statusIdle"
  | "statusAsking"
  | "statusErrorPrefix"
  | "detectedLabel"
  | "localeLabel"
  | "localeToggleAria"
  | "rhythmTitle"
  | "rhythmImeHold"
  | "rhythmImeNormalized"
  | "rhythmServerIme"
  | "answerRegion"
  | "canonChip"
  | "inferenceChip"
  | "viewSourceAria"
  | "drawerTitle"
  | "drawerClose"
  | "drawerDoc"
  | "drawerType"
  | "drawerMatch"
  | "drawerChunkId"
  | "drawerOriginal"
  | "drawerFootnote"
  | "drawerEmpty";

const T: Record<LibrarianLanguageCode, Record<LibrarianLocaleKey, string>> = {
  en: {
    title: "Lore Librarian",
    placeholder: "Ask about your canon…",
    submit: "Ask Librarian",
    statusIdle: "Ready — rhythm is monitored locally for HAL alignment.",
    statusAsking: "Querying the library…",
    statusErrorPrefix: "Request failed:",
    detectedLabel: "Detected answer language",
    localeLabel: "Interface & request locale",
    localeToggleAria: "Writing locale",
    rhythmTitle: "Rhythm monitor",
    rhythmImeHold: "Kanji / IME hold — not scored as hesitation",
    rhythmImeNormalized: "Composition committed — rhythm normalized",
    rhythmServerIme: "HAL: IME session active",
    answerRegion: "Librarian answer",
    canonChip: "Source truth",
    inferenceChip: "AI reasoning",
    viewSourceAria: "View source chunk for this canon bullet",
    drawerTitle: "Source chunk",
    drawerClose: "Close",
    drawerDoc: "Document",
    drawerType: "Type",
    drawerMatch: "Match",
    drawerChunkId: "Chunk id",
    drawerOriginal: "Original text",
    drawerFootnote:
      "Shown as stored in your library (may differ in language from the answer above).",
    drawerEmpty: "No chunk available.",
  },
  es: {
    title: "Bibliotecaria de lore",
    placeholder: "Pregunta sobre tu canon…",
    submit: "Preguntar",
    statusIdle: "Lista — el ritmo se supervisa aquí para alinearlo con HAL.",
    statusAsking: "Consultando la biblioteca…",
    statusErrorPrefix: "Error:",
    detectedLabel: "Idioma de respuesta detectado",
    localeLabel: "Idioma de interfaz y petición",
    localeToggleAria: "Idioma de escritura",
    rhythmTitle: "Monitor de ritmo",
    rhythmImeHold: "Pausa IME / kanji — no cuenta como vacilación",
    rhythmImeNormalized: "Composición confirmada — ritmo normalizado",
    rhythmServerIme: "HAL: sesión IME activa",
    answerRegion: "Respuesta del bibliotecario",
    canonChip: "Verdad fuente",
    inferenceChip: "Razonamiento IA",
    viewSourceAria: "Ver fragmento fuente de este bullet canónico",
    drawerTitle: "Fragmento fuente",
    drawerClose: "Cerrar",
    drawerDoc: "Documento",
    drawerType: "Tipo",
    drawerMatch: "Coincidencia",
    drawerChunkId: "Id del fragmento",
    drawerOriginal: "Texto original",
    drawerFootnote:
      "Mostrado tal como está en tu biblioteca (puede diferir del idioma de la respuesta).",
    drawerEmpty: "Sin fragmento disponible.",
  },
  ja: {
    title: "ロア司書",
    placeholder: "設定や正史について質問…",
    submit: "司書に聞く",
    statusIdle: "待機中 — 入力リズムをローカルで監視し HAL と整合します。",
    statusAsking: "書庫を検索しています…",
    statusErrorPrefix: "失敗:",
    detectedLabel: "検出された回答言語",
    localeLabel: "UI・リクエスト言語",
    localeToggleAria: "執筆ロケール",
    rhythmTitle: "リズム・モニター",
    rhythmImeHold: "漢字変換中 — ためらいとして減点されません",
    rhythmImeNormalized: "確定済み — リズムを正規化しました",
    rhythmServerIme: "HAL: IME セッション中",
    answerRegion: "司書の回答",
    canonChip: "正史（ソース）",
    inferenceChip: "科学的推論",
    viewSourceAria: "この正史箇条のソースチャンクを表示",
    drawerTitle: "ソースチャンク",
    drawerClose: "閉じる",
    drawerDoc: "文書",
    drawerType: "種別",
    drawerMatch: "一致度",
    drawerChunkId: "チャンク ID",
    drawerOriginal: "原文",
    drawerFootnote: "ライブラリに保存されている表記です（上の回答言語と異なる場合があります）。",
    drawerEmpty: "チャンクがありません。",
  },
};

export function librarianT(
  locale: LibrarianLanguageCode,
  key: LibrarianLocaleKey
): string {
  return T[locale]?.[key] ?? T.en[key] ?? key;
}
