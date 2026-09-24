# 3Dモデルの組み立て手順。position の順に並べ、組み立て説明書 PDF に出力する
class AssemblyStep < ApplicationRecord
  include PdfEmbeddableImage

  belongs_to :model_asset, inverse_of: :assembly_steps, touch: true
  has_one_attached :image

  validates :position, numericality: { only_integer: true, greater_than: 0 }
  validate :title_or_body_present
  validates_pdf_image :image

  before_validation :append_to_end, on: :create

  # 並び順を変える (1 始まり。範囲外は端に寄せる)
  def move_to!(new_position)
    steps = model_asset.assembly_steps.reload.to_a
    steps.delete(self)
    steps.insert((new_position - 1).clamp(0, steps.size), self)
    steps.each.with_index(1) { |s, i| s.update_columns(position: i) unless s.position == i }
  end

  private

  def append_to_end
    self.position ||= (AssemblyStep.where(model_asset_id: model_asset_id).maximum(:position) || 0) + 1
  end

  def title_or_body_present
    errors.add(:base, "手順の見出しか説明を入力してください") if title.blank? && body.blank?
  end
end
