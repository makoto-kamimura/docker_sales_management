# 組み立て説明書 PDF に埋め込む画像の制約 (Prawn が扱える PNG / JPEG、サイズ上限)
module PdfEmbeddableImage
  extend ActiveSupport::Concern

  CONTENT_TYPES = %w[image/png image/jpeg].freeze
  MAX_BYTES = 5.megabytes

  class_methods do
    def validates_pdf_image(name)
      validate do
        attachment = public_send(name)
        next unless attachment.attached?

        errors.add(name, "は PNG または JPEG にしてください") unless CONTENT_TYPES.include?(attachment.blob.content_type)
        errors.add(name, "は #{MAX_BYTES / 1.megabyte}MB 以下にしてください") if attachment.blob.byte_size > MAX_BYTES
      end
    end
  end
end
