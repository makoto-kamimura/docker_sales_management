require "rails_helper"
require "zip"

# DIY設計図 (3Dモデル管理の種別 blueprint)。版・写真・手順・販売の仕組みは3Dモデルと共通なので、種別で変わる部分を確認する
RSpec.describe "Admin DIY blueprints (制作権限)", type: :request do
  let(:producer) { create(:user, :staff) }
  let!(:model_category) { create(:category, name: "3Dモデルデータ", slug: "3d-models") }
  let!(:plan_category) { create(:category, name: "DIY設計図", slug: "diy-plans") }

  def body
    response.parsed_body
  end

  def create_asset(kind:, files:, name: "ウッドラック")
    post "/api/v1/admin/model_assets", params: { kind: kind, name: name, files: files }, headers: auth_headers(producer)
    body
  end

  def dwg_upload(filename = "rack.dwg")
    Rack::Test::UploadedFile.new(StringIO.new("AC1032"), "application/octet-stream", original_filename: filename)
  end

  it "図面 PDF・画像・CAD を版として保存でき、ブラウザでプレビューできる形式が分かる" do
    blueprint = create_asset(kind: "blueprint", files: [pdf_upload("全体図.pdf"), dxf_upload("側板.dxf"), dwg_upload, png_upload("完成.png")])
    expect(response).to have_http_status(:created)
    expect(blueprint).to include("kind" => "blueprint", "kind_label" => "DIY設計図",
                                 "current_version" => { "number" => 1, "minor" => 0, "label" => "1", "files_count" => 4,
                                                        "formats" => %w[PDF DXF DWG PNG] })
    files = blueprint["versions"].first["files"]
    expect(files.to_h { |f| [f["format"], f["previewable"]] }).to eq("PDF" => true, "DXF" => true, "DWG" => false, "PNG" => true)

    post "/api/v1/admin/model_assets/#{blueprint['id']}/versions", params: { files: [pdf_upload("全体図_v2.pdf")], note: "棚板を追加" },
                                                                   headers: auth_headers(producer)
    expect(body["current_version"]).to include("number" => 2, "formats" => %w[PDF])
  end

  it "完成品の3Dデータ (STL / OBJ / 3MF) を図面と同じ版に登録でき、3Dでプレビューできる" do
    blueprint = create_asset(kind: "blueprint", files: [pdf_upload("全体図.pdf"), stl_upload("完成品.stl"), stl_upload("棚板.3mf")])
    expect(response).to have_http_status(:created)
    files = blueprint["versions"].first["files"]
    expect(files.map { |f| [f["filename"], f["format"], f["previewable"]] })
      .to eq([["全体図.pdf", "PDF", true], ["完成品.stl", "STL", true], ["棚板.3mf", "3MF", true]])
  end

  it "種別ごとに登録できる形式が違う (設計図に STEP、3Dモデルに PDF は 422)" do
    create_asset(kind: "blueprint", files: [stl_upload("part.step")])
    expect(response).to have_http_status(:unprocessable_entity)
    expect(body.dig("error", "message")).to include("part.step", "DIY設計図")

    create_asset(kind: "model", files: [pdf_upload])
    expect(response).to have_http_status(:unprocessable_entity)
    expect(ModelAsset.count).to eq(0)

    create_asset(kind: "unknown", files: [pdf_upload])
    expect(response).to have_http_status(:unprocessable_entity)
  end

  it "一覧は種別で絞り込み (省略時は3Dモデル)、種別は後から変えられない" do
    model_id = create_asset(kind: "model", files: [stl_upload], name: "ギア")["id"]
    plan_id = create_asset(kind: "blueprint", files: [pdf_upload])["id"]
    # 種別を送らない (以前の画面・API) 場合は3Dモデルとして登録する
    post "/api/v1/admin/model_assets", params: { name: "旧形式", files: [stl_upload] }, headers: auth_headers(producer)
    legacy_id = body["id"]
    expect(body["kind"]).to eq("model")

    get "/api/v1/admin/model_assets", params: { kind: "blueprint" }, headers: auth_headers(producer)
    expect(body.map { |m| m["id"] }).to eq([plan_id])
    get "/api/v1/admin/model_assets", headers: auth_headers(producer)
    expect(body.map { |m| m["id"] }).to contain_exactly(model_id, legacy_id)

    patch "/api/v1/admin/model_assets/#{plan_id}", params: { kind: "model", name: "ウッドラック改" }, headers: auth_headers(producer), as: :json
    expect(body).to include("kind" => "blueprint", "name" => "ウッドラック改")
    expect(ModelAsset.find(plan_id).kind).to eq("blueprint")
  end

  describe "販売" do
    let(:buyer) { create(:user) }

    it "オンで DIY設計図カテゴリの商品 (SKU DIY-<id>) を公開し、購入者は図面をダウンロードできる" do
      id = create_asset(kind: "blueprint", files: [pdf_upload("rack.pdf")])["id"]
      patch "/api/v1/admin/model_assets/#{id}", params: { for_sale: true, price_cents: 500 }, headers: auth_headers(producer), as: :json
      expect(body["product"]).to include("sku" => "DIY-#{id}", "published" => true)
      product = Product.find(body["product"]["id"])
      expect(product).to have_attributes(category: plan_category, is_digital: true, model_file_format: "PDF")

      # 複数ファイルの版は ZIP にまとめて配布する (完成品の3Dデータも購入者に配る)
      post "/api/v1/admin/model_assets/#{id}/versions",
           params: { files: [pdf_upload("rack.pdf"), dxf_upload("rack.dxf"), stl_upload("rack.stl")] }, headers: auth_headers(producer)
      expect(product.reload.model_file.filename.to_s).to eq("ウッドラック_v2.zip")
      entries = Zip::File.open_buffer(product.model_file.download).entries.map(&:name)
      expect(entries).to eq(%w[rack.pdf rack.dxf rack.stl])

      post "/api/v1/cart/items", params: { product_id: product.id, quantity: 1 }, headers: auth_headers(buyer), as: :json
      post "/api/v1/orders", headers: auth_headers(buyer), as: :json
      OrderWorkflow.new(Order.find(body["id"])).transition!("paid")

      get "/api/v1/downloads/#{product.id}", headers: auth_headers(buyer)
      expect(response).to have_http_status(:ok)
      expect(body).to include("filename" => "ウッドラック_v2.zip")
    end

    it "販売先のカテゴリがなければ 422" do
      plan_category.destroy!
      id = create_asset(kind: "blueprint", files: [pdf_upload])["id"]
      patch "/api/v1/admin/model_assets/#{id}", params: { for_sale: true }, headers: auth_headers(producer), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(body.dig("error", "message")).to include("diy-plans")
    end
  end
end
