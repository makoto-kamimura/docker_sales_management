require "rails_helper"
require "zip"

RSpec.describe "Admin 3D models (制作権限)", type: :request do
  let(:producer) { create(:user, :staff) }
  let!(:category) { create(:category, name: "3Dモデルデータ", slug: "3d-models") }

  def body
    response.parsed_body
  end

  def create_model(files: [stl_upload("gear.stl")], **params)
    post "/api/v1/admin/model_assets",
         params: { name: "ギアボックス", description: "減速ギア", files: files }.merge(params),
         headers: auth_headers(producer)
    body
  end

  def zip_entries(blob)
    # rubyzip はエントリ名をバイナリで返すので UTF-8 として読む
    Zip::File.open_buffer(blob.download).entries.map { |e| e.name.dup.force_encoding(Encoding::UTF_8) }
  end

  it "制作権限がないと 403" do
    get "/api/v1/admin/model_assets", headers: auth_headers(create(:user, role: "staff", permissions: %w[sales orders]))
    expect(response).to have_http_status(:forbidden)
  end

  describe "モデルファイルの保存と版管理" do
    it "複数ファイルの版を登録し、新しい版の追加・過去の版に戻す・ファイルごと/まとめてのURL発行ができる" do
      model = create_model(files: [stl_upload("本体.stl"), stl_upload("cover.3mf")])
      expect(response).to have_http_status(:created)
      expect(model).to include("name" => "ギアボックス",
                               "current_version" => { "number" => 1, "files_count" => 2, "formats" => %w[STL 3MF] })
      id = model["id"]

      post "/api/v1/admin/model_assets/#{id}/versions", params: { files: [stl_upload("gear_v2.obj")], note: "歯数を変更" },
                                                        headers: auth_headers(producer)
      versions = body["versions"]
      expect(versions.map { |v| [v["number"], v["current"], v["files"].map { |f| [f["filename"], f["format"], f["previewable"]] }] })
        .to eq([[2, true, [["gear_v2.obj", "OBJ", true]]], [1, false, [["本体.stl", "STL", true], ["cover.3mf", "3MF", true]]]])
      expect(versions.first).to include("note" => "歯数を変更", "created_by" => { "id" => producer.id, "name" => producer.name })

      v1 = versions.last
      post "/api/v1/admin/model_assets/#{id}/versions/#{v1['id']}/restore", headers: auth_headers(producer)
      expect(body["current_version"]).to include("number" => 3, "files_count" => 2)
      expect(ModelAsset.find(id).current_version.files.blobs.map(&:id)).to match_array(ModelVersion.find(v1["id"]).files.blobs.map(&:id))

      cover = v1["files"].last
      get "/api/v1/admin/model_assets/#{id}/versions/#{v1['id']}/file", params: { file_id: cover["id"], disposition: "inline" },
                                                                        headers: auth_headers(producer)
      expect(body["url"]).to start_with("/rails/active_storage/blobs/")
      expect(body["filename"]).to eq("cover.3mf")

      get "/api/v1/admin/model_assets/#{id}/versions/#{v1['id']}/bundle", headers: auth_headers(producer)
      expect(body["filename"]).to eq("ギアボックス_v1.zip")
      expect(zip_entries(ModelVersion.find(v1["id"]).bundle.blob)).to eq(%w[本体.stl cover.3mf])
    end

    it "1ファイル (file) でも登録でき、同じ名前のファイルは ZIP 内で名前をずらす" do
      post "/api/v1/admin/model_assets", params: { name: "単品", file: stl_upload("part.stl") }, headers: auth_headers(producer)
      expect(body["current_version"]).to include("files_count" => 1)

      post "/api/v1/admin/model_assets/#{body['id']}/versions", params: { files: [stl_upload("part.stl"), stl_upload("part.stl")] },
                                                                 headers: auth_headers(producer)
      version = ModelVersion.find(body["versions"].first["id"])
      expect(zip_entries(version.distribution_blob)).to eq(%w[part.stl part_2.stl])
    end

    it "モデルデータ以外が混ざると 422 で、モデルも作られない" do
      create_model(files: [stl_upload("ok.stl"), Rack::Test::UploadedFile.new(StringIO.new("x"), "text/plain", original_filename: "memo.txt")])
      expect(response).to have_http_status(:unprocessable_entity)
      expect(body.dig("error", "message")).to include("memo.txt")
      expect(ModelAsset.count).to eq(0)
    end
  end

  describe "3Dプレビュー画像と販売フラグ" do
    it "オンで最新版を配布ファイルにした商品を公開し (複数ファイルは ZIP)、版の追加に追従し、オフ・削除で非公開にする" do
      id = create_model["id"]
      post "/api/v1/admin/model_assets/#{id}/preview", params: { image: png_upload }, headers: auth_headers(producer)
      preview_url = body["preview_image_url"]
      expect(preview_url).to start_with("/rails/active_storage/blobs/")

      # 0円 (無料配布) でも販売できる
      patch "/api/v1/admin/model_assets/#{id}", params: { for_sale: true, price_cents: 0 }, headers: auth_headers(producer), as: :json
      expect(body["product"]).to include("published" => true)
      expect(Product.find(body["product"]["id"]).price_cents).to eq(0)

      patch "/api/v1/admin/model_assets/#{id}", params: { for_sale: true, price_cents: 1_200, license: "個人利用のみ" },
                                                headers: auth_headers(producer), as: :json
      expect(body["product"]).to include("sku" => "MDL-#{id}", "published" => true)
      product = Product.find(body["product"]["id"])
      expect(product).to have_attributes(name: "ギアボックス", price_cents: 1_200, is_digital: true, license: "個人利用のみ",
                                         category: category, image_url: preview_url)
      expect(product.model_file.filename.to_s).to eq("gear.stl")
      expect(Product.published).to include(product)

      post "/api/v1/admin/model_assets/#{id}/versions", params: { files: [stl_upload("base.stl"), stl_upload("lid.stl")] },
                                                        headers: auth_headers(producer)
      product.reload
      expect(product.model_file.filename.to_s).to eq("ギアボックス_v2.zip")
      expect(product.model_file.content_type).to eq("application/zip")
      expect(zip_entries(product.model_file.blob)).to eq(%w[base.stl lid.stl])

      patch "/api/v1/admin/model_assets/#{id}", params: { for_sale: false }, headers: auth_headers(producer), as: :json
      expect(body["product"]["published"]).to be(false)

      patch "/api/v1/admin/model_assets/#{id}", params: { for_sale: true }, headers: auth_headers(producer), as: :json
      delete "/api/v1/admin/model_assets/#{id}", headers: auth_headers(producer)
      expect(response).to have_http_status(:no_content)
      expect(Product.published).not_to include(product)
      expect(product.reload.model_file).to be_attached # 購入者への配布ファイルは残る
    end
  end

  describe "組み立て方法と PDF" do
    let!(:model) { ModelAsset.find(create_model["id"]) }
    let(:steps_path) { "/api/v1/admin/model_assets/#{model.id}/assembly_steps" }

    it "Markdown の手順の追加・並び替え・削除ができ、画像つきの PDF を出力できる" do
      markdown = <<~MD
        ベースに**軸**を差し込む (`3mm`)
        改行もそのまま

        ## 注意
        - M3 ネジ
          - ワッシャー
        1. 仮止め
        2. 本締め

        > 締めすぎ注意 ~~強く~~

        ```
        G28 <home>
        ```

        | 部品 | 数 |
        |---|---|
        | ネジ | 4 |

        ---
        [動画](https://example.com/a'b) / [悪い](javascript:alert(1)) <b>HTML</b> ![図](x.png)
      MD
      post steps_path, params: { title: "土台", body: markdown, image: png_upload }, headers: auth_headers(producer)
      post steps_path, params: { title: "ギア", body: "ギアをはめる" }, headers: auth_headers(producer)
      post steps_path, params: { title: "カバー", body: "カバーを閉じる" }, headers: auth_headers(producer)
      steps = body["assembly_steps"]
      expect(steps.map { |s| s["title"] }).to eq(%w[土台 ギア カバー])
      expect(steps.first["image_url"]).to be_present
      expect(steps.first["body"]).to eq(markdown)

      patch "#{steps_path}/#{steps.last['id']}", params: { position: 1 }, headers: auth_headers(producer), as: :json
      expect(body["assembly_steps"].map { |s| s.values_at("position", "title") }).to eq([[1, "カバー"], [2, "土台"], [3, "ギア"]])

      patch "/api/v1/admin/model_assets/#{model.id}", params: { assembly_notes: "- M3ネジ ×4\n- **六角レンチ**" },
                                                      headers: auth_headers(producer), as: :json
      get "/api/v1/admin/model_assets/#{model.id}/assembly_pdf", headers: auth_headers(producer)
      expect(response.media_type).to eq("application/pdf")
      expect(response.body).to start_with("%PDF")
      expect(response.headers["Content-Disposition"]).to include("attachment")

      delete "#{steps_path}/#{steps.first['id']}", headers: auth_headers(producer)
      expect(body["assembly_steps"].map { |s| s.values_at("position", "title") }).to eq([[1, "カバー"], [2, "ギア"]])

      post steps_path, params: { title: "", body: "" }, headers: auth_headers(producer)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "Markdown ファイルから部品・工具と手順を取り込める (プレビュー / 追加 / 置き換え)" do
      model.assembly_steps.create!(title: "既存", body: "前からある手順")
      markdown = "# ギア\n## 必要な部品\n- ネジ\n\n## 組み立て手順\n### 1. 軸\n差し込む\n### ギア\nはめる\n"
      upload = -> { Rack::Test::UploadedFile.new(StringIO.new(markdown), "text/markdown", original_filename: "guide.md") }
      path = "/api/v1/admin/model_assets/#{model.id}/assembly_import"

      post path, params: { file: upload.call, dry_run: "true" }, headers: auth_headers(producer)
      expect(body).to eq("assembly_notes" => "- ネジ", "warnings" => [],
                         "steps" => [{ "title" => "軸", "body" => "差し込む" }, { "title" => "ギア", "body" => "はめる" }])
      expect(model.assembly_steps.count).to eq(1)

      post path, params: { file: upload.call, mode: "append" }, headers: auth_headers(producer)
      expect(body["assembly_steps"].map { |s| s.values_at("position", "title") }).to eq([[1, "既存"], [2, "軸"], [3, "ギア"]])
      expect(body["assembly_notes"]).to eq("- ネジ")

      post path, params: { file: upload.call, mode: "replace" }, headers: auth_headers(producer)
      expect(body["assembly_steps"].map { |s| s.values_at("position", "title") }).to eq([[1, "軸"], [2, "ギア"]])

      post path, params: { file: Rack::Test::UploadedFile.new(StringIO.new("ただの文章"), "text/markdown", original_filename: "x.md") },
                 headers: auth_headers(producer)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(body.dig("error", "code")).to eq("import_failed")
    end

    it "購入者は期限付きリンクで PDF を受け取れる (未購入は 404)" do
      model.assembly_steps.create!(title: "組み立て", body: "はめ込む")
      model.update!(for_sale: true, price_cents: 800)
      ModelListing.new(model).sync!
      product = model.reload.product
      buyer = create(:user)
      order = create(:order, user: buyer, product: product)
      OrderWorkflow.new(order).transition!("paid")

      get "/api/v1/downloads", headers: auth_headers(buyer)
      expect(body.first).to include("product_id" => product.id, "has_assembly" => true)
      get "/api/v1/orders/#{order.id}", headers: auth_headers(buyer)
      expect(body["items"].first["has_assembly"]).to be(true)

      get "/api/v1/downloads/#{product.id}/assembly", headers: auth_headers(buyer)
      url = body["url"]
      expect(url).to start_with("/api/v1/assembly_pdfs/")
      get url
      expect(response.body).to start_with("%PDF")

      travel 6.minutes do
        get url
        expect(response).to have_http_status(:not_found)
      end

      get "/api/v1/downloads/#{product.id}/assembly", headers: auth_headers(create(:user))
      expect(response).to have_http_status(:not_found)
    end
  end
end
