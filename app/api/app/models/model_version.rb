require "zip"

# 3Dモデル・DIY設計図のファイルの版。1つの版に複数のファイル (パーツごとの STL、図面ごとの PDF など) をまとめて保存できる。
# number (次に minor) が大きいものが最新版。過去の版もファイルごと残す。
# 版のファイルは後から変えない。最新版にファイルを足すときは、ファイルを引き継いだ枝番の版 (v3 → v3.1) を作る
class ModelVersion < ApplicationRecord
  MAX_FILES = 20
  # 1つの版のファイル合計。複数ファイルは ZIP にまとめて商品の配布ファイルにするため、配布ファイルと同じ上限にする
  MAX_TOTAL_BYTES = Product::MODEL_FILE_MAX_BYTES

  belongs_to :model_asset, inverse_of: :versions, touch: true
  belongs_to :created_by, class_name: "User", optional: true
  has_many_attached :files
  has_one_attached :bundle # 複数ファイルの版をまとめた ZIP (配布・一括ダウンロード時に初めて作る)

  validates :number, numericality: { only_integer: true, greater_than: 0 }, uniqueness: { scope: %i[model_asset_id minor] }
  validates :minor, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :files_must_be_model_data

  before_validation :assign_next_number, on: :create

  def self.format_of(attachment)
    File.extname(attachment.filename.to_s).delete_prefix(".").upcase
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
          zip.put_next_entry(unique_entry_name(attachment.filename.to_s, used))
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
end
