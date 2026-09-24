module Api
  module V1
    module Admin
      # 3Dモデル (ModelAsset) の JSON。3Dモデル・版・組み立て手順のコントローラで共通に使う
      module ModelAssetJson
        MODEL_PRELOAD = [
          :product, :created_by, { preview_image_attachment: :blob },
          { versions: [:created_by, { files_attachments: :blob }, { bundle_attachment: :blob }] },
          { assembly_steps: { image_attachment: :blob } },
          { photos: { image_attachment: :blob } }
        ].freeze

        private

        def find_model_asset(id)
          ModelAsset.includes(*MODEL_PRELOAD).find(id)
        end

        def model_asset_summary(m)
          current = m.current_version
          {
            id: m.id, name: m.name, for_sale: m.for_sale, price_cents: m.price_cents, updated_at: m.updated_at,
            preview_image_url: blob_path(m.preview_image),
            preview_photos: m.preview_photos.map { |ph| photo_json(ph) }, photos_count: m.photos.size,
            current_version: current && {
              number: current.number, files_count: current.files.size,
              formats: current.files.map { |f| ModelVersion.format_of(f) }.uniq
            },
            versions_count: m.versions.size, assembly_steps_count: m.assembly_steps.size,
            product: m.product && {
              id: m.product.id, sku: m.product.sku,
              published: m.product.published_at.present? && m.product.published_at <= Time.current
            }
          }
        end

        def model_asset_detail(m)
          current = m.current_version
          model_asset_summary(m).merge(
            description: m.description, license: m.license, assembly_notes: m.assembly_notes, created_at: m.created_at,
            created_by: user_ref(m.created_by),
            versions: m.versions.map { |v| version_json(v, current: v == current) },
            photos: m.photos.map { |ph| photo_json(ph) },
            assembly_steps: m.assembly_steps.map { |s|
              { id: s.id, position: s.position, title: s.title, body: s.body, image_url: blob_path(s.image) }
            }
          )
        end

        def version_json(v, current:)
          {
            id: v.id, number: v.number, note: v.note, current: current, byte_size: v.total_byte_size,
            files: v.files.map { |f|
              { id: f.id, filename: f.filename.to_s, format: ModelVersion.format_of(f), byte_size: f.blob.byte_size,
                previewable: ModelVersion.previewable?(f) }
            },
            created_at: v.created_at, created_by: user_ref(v.created_by)
          }
        end

        def photo_json(ph)
          { id: ph.id, kind: ph.kind, kind_label: ph.kind_label, caption: ph.caption, featured: ph.featured,
            position: ph.position, url: blob_path(ph.image) }
        end

        # multipart の files[] (複数) または file (1つ)
        def uploaded_files
          list = params[:files]
          list = list.values if list.is_a?(ActionController::Parameters)
          files = Array(list).select { |f| f.respond_to?(:original_filename) }
          files = [params[:file]].select { |f| f.respond_to?(:original_filename) } if files.empty?
          raise ActionController::ParameterMissing, :files if files.empty?

          files
        end

        def user_ref(user)
          user && { id: user.id, name: user.name }
        end

        def blob_path(attachment)
          return nil unless attachment.attached?

          Rails.application.routes.url_helpers.rails_blob_path(attachment, only_path: true)
        end
      end
    end
  end
end
