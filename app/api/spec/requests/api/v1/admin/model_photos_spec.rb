require "rails_helper"

RSpec.describe "Admin 3D model photos (実モデル画像 / 実利用画像)", type: :request do
  let(:producer) { create(:user, :staff) }
  let!(:category) { create(:category, name: "3Dモデルデータ", slug: "3d-models") }
  let(:model) do
    post "/api/v1/admin/model_assets", params: { name: "ギアボックス", files: [stl_upload("gear.stl")] }, headers: auth_headers(producer)
    ModelAsset.find(response.parsed_body["id"])
  end
  let(:path) { "/api/v1/admin/model_assets/#{model.id}/photos" }

  def body
    response.parsed_body
  end

  def upload(kind, *names)
    post path, params: { kind: kind, files: names.map { |n| png_upload(n) } }, headers: auth_headers(producer)
    body
  end

  it "制作権限がないと 403" do
    post path, params: { kind: "real_model", files: [png_upload] }, headers: auth_headers(create(:user, role: "staff", permissions: %w[sales]))
    expect(response).to have_http_status(:forbidden)
  end

  it "種類ごとに複数枚登録でき、プレビュー表示は先に登録した3枚まで自動で付く" do
    upload("real_model", "a.png", "b.png")
    expect(response).to have_http_status(:created)
    detail = upload("in_use", "c.png", "d.png")
    photos = detail["photos"]
    expect(photos.map { |p| p.values_at("kind", "position", "featured") })
      .to eq([["real_model", 1, true], ["real_model", 2, true], ["in_use", 1, true], ["in_use", 2, false]])
    expect(photos.first).to include("kind_label" => "実モデル画像", "caption" => "")
    expect(photos.first["url"]).to start_with("/rails/active_storage/blobs/")
    expect(detail["preview_photos"].size).to eq(3)
    expect(detail["photos_count"]).to eq(4)

    fourth = photos.last
    patch "#{path}/#{fourth['id']}", params: { featured: true }, headers: auth_headers(producer), as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    expect(body.dig("error", "message")).to include("3 枚まで")

    patch "#{path}/#{photos.first['id']}", params: { featured: false }, headers: auth_headers(producer), as: :json
    patch "#{path}/#{fourth['id']}", params: { featured: true, caption: "机の上で使っている様子 ー 実例" }, headers: auth_headers(producer), as: :json
    expect(body["preview_photos"].map { |p| p["id"] }).to eq([photos[1]["id"], photos[2]["id"], fourth["id"]])
    expect(body["photos"].find { |p| p["id"] == fourth["id"] }["caption"]).to eq("机の上で使っている様子 ー 実例")
  end

  it "並び替え・種類の変更・削除で並び順を詰め直す" do
    photos = upload("real_model", "a.png", "b.png", "c.png")["photos"]

    patch "#{path}/#{photos.last['id']}", params: { position: 1 }, headers: auth_headers(producer), as: :json
    expect(body["photos"].map { |p| p["id"] }).to eq([photos[2]["id"], photos[0]["id"], photos[1]["id"]])

    patch "#{path}/#{photos[0]['id']}", params: { kind: "in_use" }, headers: auth_headers(producer), as: :json
    expect(body["photos"].map { |p| p.values_at("id", "kind", "position") })
      .to eq([[photos[2]["id"], "real_model", 1], [photos[1]["id"], "real_model", 2], [photos[0]["id"], "in_use", 1]])

    delete "#{path}/#{photos[2]['id']}", headers: auth_headers(producer)
    expect(body["photos"].map { |p| p.values_at("id", "position") }).to eq([[photos[1]["id"], 1], [photos[0]["id"], 1]])
  end

  it "画像以外・種類の指定なしは 422" do
    post path, params: { kind: "real_model", files: [stl_upload("x.stl")] }, headers: auth_headers(producer)
    expect(response).to have_http_status(:unprocessable_entity)
    post path, params: { files: [png_upload] }, headers: auth_headers(producer)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(model.photos.count).to eq(0)
  end

  it "販売中はプレビュー表示の1枚目を商品画像にし、ショップの商品詳細にプレビュー写真を返す" do
    patch "/api/v1/admin/model_assets/#{model.id}", params: { for_sale: true, price_cents: 500 }, headers: auth_headers(producer), as: :json
    product = model.reload.product
    photos = upload("in_use", "use.png")["photos"]
    expect(product.reload.image_url).to eq(photos.first["url"])

    get "/api/v1/products/#{product.id}"
    expect(body["photos"]).to eq([{ "id" => photos.first["id"], "url" => photos.first["url"], "kind" => "in_use",
                                    "kind_label" => "実利用画像", "caption" => "" }])
  end
end
