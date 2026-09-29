/** 3Dモデル管理で扱う種別 (API の ModelAsset::KINDS と揃える)。版・写真・組み立て手順・販売の仕組みは共通 */
export type ModelKind = "model" | "blueprint";

export type ModelKindConfig = {
  /** 画面の見出し・ボタンの名前 (例: 3Dモデルを登録) */
  label: string;
  /** 管理画面の一覧のパス */
  path: string;
  /** 登録できるファイル形式 (API の Product::MODEL_FILE_EXTENSIONS / BLUEPRINT_FILE_EXTENSIONS と揃える) */
  accept: string;
  /** 登録フォームに出す形式の説明 */
  formats: string;
  /** プレビュー欄の見出し */
  previewTitle: string;
  /** ブラウザでプレビューできる形式の説明 */
  previewableFormats: string;
  /** 一覧の説明 */
  description: string;
  /** 販売先のショップのカテゴリ名 */
  shopCategory: string;
  /** 版の変更内容の入力例 */
  notePlaceholder: string;
  /** 版にまとめるファイルの例 */
  filesExample: string;
};

export const MODEL_KINDS: Record<ModelKind, ModelKindConfig> = {
  model: {
    label: "3Dモデル",
    path: "/admin/models",
    accept: ".stl,.3mf,.obj,.step,.stp,.zip",
    formats: "STL / 3MF / OBJ / STEP / ZIP",
    previewTitle: "3Dプレビュー",
    previewableFormats: "STL / OBJ / 3MF",
    description: "モデルファイルを版ごとに保存し、3Dプレビュー・組み立て方法・販売をまとめて管理します。",
    shopCategory: "3Dモデルデータ",
    notePlaceholder: "変更内容 (例: 穴径を 3.2mm に)",
    filesExample: "パーツごとの STL など",
  },
  blueprint: {
    label: "DIY設計図",
    path: "/admin/blueprints",
    accept: ".pdf,.png,.jpg,.jpeg,.svg,.dxf,.dwg,.jww,.stl,.obj,.3mf",
    formats: "PDF / PNG / JPG / SVG / DXF / DWG / JWW、完成品の3Dデータ STL / OBJ / 3MF",
    previewTitle: "図面・3Dプレビュー",
    previewableFormats: "PDF / PNG / JPG / SVG / DXF / STL / OBJ / 3MF",
    description: "図面ファイル (PDF・画像・CAD) と完成品の3Dデータを版ごとに保存し、プレビュー・作り方・販売をまとめて管理します。",
    shopCategory: "DIY設計図",
    notePlaceholder: "変更内容 (例: 棚板を 1 枚追加)",
    filesExample: "全体図の PDF・部材ごとの DXF・完成品の STL など",
  },
};

/** デジタル商品の配布ファイルとして登録できる形式 (API の Product::DIGITAL_FILE_EXTENSIONS と揃える) */
export const DIGITAL_FILE_ACCEPT = [...new Set([MODEL_KINDS.model.accept, MODEL_KINDS.blueprint.accept].join(",").split(","))].join(",");
