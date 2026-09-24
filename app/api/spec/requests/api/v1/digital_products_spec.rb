require "rails_helper"

# 3Dプリンタ用モデルデータ (デジタル商品) と 3Dプリント品 (物販) の販売フロー
RSpec.describe "Digital products (3D model data)", type: :request do
  let(:user) { create(:user) }
  let(:model_data) { create(:product, :digital, price_cents: 800) }
  let(:printed) { create(:product, :stocked, price_cents: 2_800) }

  def add_to_cart(product, quantity: 1, as: user)
    post "/api/v1/cart/items", params: { product_id: product.id, quantity: quantity }, headers: auth_headers(as), as: :json
  end

  def place_order(params = {})
    post "/api/v1/orders", params: params, headers: auth_headers(user), as: :json
  end

  describe "商品詳細" do
    it "デジタル属性を返し、配布ファイルのURLは公開しない" do
      get "/api/v1/products/#{model_data.id}"
      body = response.parsed_body
      expect(body).to include("is_digital" => true, "in_stock" => true, "file_format" => "STL", "license" => "個人利用のみ")
      expect(body).not_to have_key("stock")
      expect(response.body).not_to include("active_storage")
    end
  end

  describe "カート" do
    it "デジタル商品の数量は常に 1" do
      add_to_cart(model_data, quantity: 3)
      expect(response.parsed_body["quantity"]).to eq(1)
      add_to_cart(model_data, quantity: 2)
      expect(response.parsed_body["quantity"]).to eq(1)

      get "/api/v1/cart", headers: auth_headers(user)
      expect(response.parsed_body["requires_shipping"]).to be false
      expect(response.parsed_body["items"].first["is_digital"]).to be true
    end
  end

  describe "注文" do
    it "デジタル商品のみなら住所なしで注文でき、送料・配送は発生しない" do
      add_to_cart(model_data)
      place_order
      expect(response).to have_http_status(:created)
      order = Order.find(response.parsed_body["id"])
      expect(order.address).to be_nil
      expect(order.shipping_cents).to eq(0)
      expect(order.total_cents).to eq(880) # 800 + 税10%
      expect(order.shipment).to be_nil
    end

    it "3Dプリント品を含む注文は住所必須で、在庫を引き当てる" do
      add_to_cart(model_data)
      add_to_cart(printed, quantity: 2)
      place_order
      expect(response).to have_http_status(:unprocessable_entity)

      place_order(address_id: create(:address, user: user).id)
      expect(response).to have_http_status(:created)
      order = Order.find(response.parsed_body["id"])
      expect(order.shipment).to be_present
      expect(printed.inventory.reload.reserved).to eq(2)
      expect(model_data.inventory.reload.reserved).to eq(0)
    end
  end

  describe "ダウンロード" do
    let!(:order) do
      add_to_cart(model_data)
      place_order
      Order.find(response.parsed_body["id"])
    end

    it "支払い前はダウンロードできない" do
      get "/api/v1/downloads/#{model_data.id}", headers: auth_headers(user)
      expect(response).to have_http_status(:not_found)
      get "/api/v1/downloads", headers: auth_headers(user)
      expect(response.parsed_body).to eq([])
    end

    context "支払い済み" do
      before { OrderWorkflow.new(order).transition!("paid") } # デジタルのみの注文は自動で完了になる

      it "ライブラリに表示され、期限付きURLからファイルを取得できる" do
        get "/api/v1/downloads", headers: auth_headers(user)
        expect(response.parsed_body.map { |d| d["product_id"] }).to eq([model_data.id])

        get "/api/v1/downloads/#{model_data.id}", headers: auth_headers(user)
        expect(response).to have_http_status(:ok)
        body = response.parsed_body
        expect(body).to include("filename" => "cube.stl", "expires_in" => 300)

        get body["url"]
        expect(response).to have_http_status(:redirect)
        get response.location
        expect(response.body).to include("solid cube")
      end

      it "署名付きURLは期限切れで無効になる" do
        get "/api/v1/downloads/#{model_data.id}", headers: auth_headers(user)
        url = response.parsed_body["url"]
        travel 6.minutes do
          get url
          expect(response).to have_http_status(:not_found)
        end
      end

      it "他のユーザーはダウンロードできない" do
        get "/api/v1/downloads/#{model_data.id}", headers: auth_headers(create(:user))
        expect(response).to have_http_status(:not_found)
      end

      it "購入済みのデータは再度カートに入れられない" do
        add_to_cart(model_data)
        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body.dig("error", "code")).to eq("already_purchased")
      end

      it "注文詳細でダウンロード可能と分かる" do
        get "/api/v1/orders/#{order.id}", headers: auth_headers(user)
        expect(response.parsed_body["downloadable"]).to be true
        expect(response.parsed_body["items"].first["is_digital"]).to be true
      end
    end
  end

  describe "POST /api/v1/admin/products/:id/model_file" do
    let(:admin) { create(:user, :admin) }
    let(:product) { create(:product, is_digital: true) }

    def upload(target, filename, as: admin)
      file = Rack::Test::UploadedFile.new(StringIO.new("solid x\nendsolid x\n"), "application/octet-stream",
                                          original_filename: filename)
      post "/api/v1/admin/products/#{target.id}/model_file", params: { model_file: file }, headers: auth_headers(as)
    end

    it "管理者は3Dモデルデータを登録でき、販売可能になる" do
      expect(product.in_stock?).to be false
      upload(product, "mount.3mf")
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("file_format" => "3MF", "file_name" => "mount.3mf")
      expect(product.reload.in_stock?).to be true
    end

    it "対応外の形式は 422" do
      upload(product, "virus.exe")
      expect(response).to have_http_status(:unprocessable_entity)
      expect(product.reload.model_file).not_to be_attached
    end

    it "物販品には登録できない" do
      upload(create(:product), "mount.stl")
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "一般会員は 403" do
      upload(product, "mount.stl", as: user)
      expect(response).to have_http_status(:forbidden)
    end
  end
end
