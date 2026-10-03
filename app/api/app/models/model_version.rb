require "zip"

# 3Dモデル・DIY設計図のファイルの版。1つの版に複数のファイル (パーツごとの STL、図面ごとの PDF など) をまとめて保存できる。
# number (次に minor) が大きいものが最新版。過去の版もファイルごと残す。
# 版のファイルは後から変えない。最新版にファイルを足すときは、ファイルを引き継いだ枝番の版 (v3 → v3.1) を作る。
# ファイルにはカテゴリ (オールインワン / 分割 / その他) を付けられる。カテゴリはファイルへのラベルなので後から変えられる
class ModelVersion < ApplicationRecord
  MAX_FILES = 20
  # 1つの版のファイル合計。複数ファイルは ZIP にまとめて商品の配布ファイルにするため、配布ファイルと同じ上限にする
  MAX_TOTAL_BYTES = Product::MODEL_FILE_MAX_BYTES
  # ファイルのカテゴリ。ラベルは ZIP のフォルダ名にも使う。other は file_categories に保存しない (未分類の既存ファイルも other)
  FILE_CATEGORIES = { "all_in_one" => "オールインワン", "parts" => "分割", "other" => "その他" }.freeze
  OTHER_CATEGORY = "other"

  belongs_to :model_asset, inverse_of: :versions, touch: true
  belongs_to :created_by, class_name: "User", optional: true
  has_many_attached :files
  has_one_attached :bundle # 複数ファイルの版をまとめた ZIP (配布・一括ダウンロード時に初めて作る)

  validates :number, numericality: { only_integer: true, greater_than: 0 }, uniqueness: { scope: %i[model_asset_id minor] }
  validates :minor, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :files_must_be_model_data
  validate :file_categories_must_be_valid

  before_validation :assign_next_number, on: :create

  def self.format_of(attachment)
    File.extname(attachment.filename.to_s).delete_prefix(".").upcase
  end

  # カテゴリ付きのファイルで版を作る。entries: [[添付するもの (アップロード / blob), カテゴリ], ...]
  # カテゴリは blob_id で持つので、保存して blob が決まってから付ける (添付は渡した順に作られる)
  def self.create_with_categories!(entries:, **attrs)
    transaction do
      version = create!(files: entries.map(&:first), **attrs)
      categories = version.files.attachments.sort_by(&:id).zip(entries.map(&:last))
                          .to_h { |attachment, category| [attachment.blob_id.to_s, category.to_s] }
                          .reject { |_, category| category == OTHER_CATEGORY }
      version.update!(file_categories: categories) if categories.any?
      version
    end
  end

  def category_of(attachment)
    file_categories[attachment.blob_id.to_s] || OTHER_CATEGORY
  end

  # その他以外のカテゴリのファイルがあるか (なければ ZIP はフラットのまま)
  def categorized?
    file_categories.any?
  end

  # ファイルのカテゴリを変える ({ 添付ID => カテゴリ })。ファイル自体は変えない。
  # ZIP はフォルダ分けが変わるので作り直す (販売中の商品が同じ blob を配布していても、他から添付されている blob は消えない)
  def recategorize!(categories)
    updated = file_categories.dup
    categories.each do |attachment_id, category|
      blob_id = files.find(attachment_id).blob_id.to_s
      category = category.to_s
      category == OTHER_CATEGORY ? updated.delete(blob_id) : updated[blob_id] = category
    end
    transaction do
      update!(file_categories: updated)
      bundle.purge_later if bundle.attached?
    end
  end

  # ブラウザでプレビューできる形式か (種別ごと。STEP / DWG / ZIP などはダウンロードのみ)
  def previewable?(attachment)
    model_asset.kind_config.previewable_formats.include?(self.class.format_of(attachment))
  end

  # 表示用の版番号 (3 / 3.1)
  def label
    minor.zero? ? number.to_s : "#{number}.#{minor}"
  end

  def total_byte_size
    files.sum { |f| f.blob.byte_size }
  end

  # 購入者に配布するファイル: 1つならそのまま、複数なら ZIP
  def distribution_blob
    files.size == 1 ? files.first.blob : bundle_blob!
  end

  # 版のファイルは後から変わらないので、一度作った ZIP を使い回す
  def bundle_blob!
    return bundle.blob if bundle.attached?

    Tempfile.create(["model_version_#{id}", ".zip"]) do |tmp|
      Zip::OutputStream.open(tmp.path) do |zip|
        used = Hash.new(0)
        files.each do |attachment|
          zip.put_next_entry(unique_entry_name(entry_path(attachment), used))
          attachment.blob.open { |io| IO.copy_stream(io, zip) }
        end
      end
      # attach(io:) だとアップロードが外側のトランザクションのコミット後まで遅れ、その時には一時ファイルが消えている。
      # 先に blob としてアップロードしてから添付する
      blob = File.open(tmp.path, "rb") do |io|
        ActiveStorage::Blob.create_and_upload!(io: io, filename: "#{model_asset.name}_v#{label}.zip", content_type: "application/zip")
      end
      bundle.attach(blob)
    end
    bundle.blob
  end

  private

  def assign_next_number
    self.number ||= (ModelVersion.where(model_asset_id: model_asset_id).maximum(:number) || 0) + 1
  end

  # カテゴリ付きの版は「オールインワン/」「分割/」のフォルダに分ける (その他はルート)
  def entry_path(attachment)
    category = category_of(attachment)
    name = attachment.filename.to_s
    categorized? && category != OTHER_CATEGORY ? "#{FILE_CATEGORIES.fetch(category)}/#{name}" : name
  end

  # 同じ名前のファイルは ZIP 内で name_2.stl のようにずらす
  def unique_entry_name(name, used)
    used[name] += 1
    return name if used[name] == 1

    ext = File.extname(name)
    "#{File.basename(name, ext)}_#{used[name]}#{ext}"
  end

  # 種別ごとの形式 (商品の配布ファイルとして受け付ける形式の一部)。1ファイルずつと合計にサイズ上限
  def files_must_be_model_data
    return errors.add(:files, "を1つ以上選択してください") unless files.attached?

    errors.add(:files, "は #{MAX_FILES} 個までにしてください") if files.size > MAX_FILES
    kind = model_asset.kind_config
    files.each do |f|
      ext = File.extname(f.filename.to_s).delete_prefix(".").downcase
      unless kind.extensions.include?(ext)
        errors.add(:files, "#{f.filename} は#{kind.label}として登録できません (#{kind.extensions.join('/')} のいずれかにしてください)")
      end
    end
    if total_byte_size > MAX_TOTAL_BYTES
      errors.add(:files, "の合計は #{MAX_TOTAL_BYTES / 1.megabyte}MB 以下にしてください")
    end
  end

  def file_categories_must_be_valid
    invalid = file_categories.values - (FILE_CATEGORIES.keys - [OTHER_CATEGORY])
    errors.add(:file_categories, "は #{FILE_CATEGORIES.keys.join('/')} のいずれかにしてください") if invalid.any?
  end
end
