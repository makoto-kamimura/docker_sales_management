require "rails_helper"

RSpec.describe ConciergeTools do
  let(:tools) { described_class.new }
  let(:models) { create(:category, name: "3Dモデルデータ", slug: "3d-models") }
  let(:prints) { create(:category, name: "3Dプリント品", slug: "3d-prints", active: false) }

  def call(name, input)
    JSON.parse(tools.call(name, input))
  end

  it "店頭に並んでいる商品だけを探す (非公開・販売を止めたカテゴリは出さない)" do
    stand = create(:product, :digital, category: models, name: "スマホスタンドのデータ", license: "個人利用のみ")
    create(:product, :digital, category: models, name: "非公開のスタンド", published_at: nil)
    create(:product, category: prints, name: "スマホスタンド (完成品)")

    result = call("search_products", { "query" => "スタンド" })
    expect(result["products"].map { |p| p["id"] }).to eq([stand.id])
    expect(result["products"].first).to include("kind" => "ダウンロード販売", "page" => "/products/#{stand.id}")

    expect(call("search_products", { "query" => "", "category_slug" => "3d-prints" })["count"]).to eq(0)
    expect(call("search_products", { query: "" })["count"]).to eq(1)
  end

  it "商品の詳細を返す。店頭にない商品は見つからない" do
    stand = create(:product, :digital, category: models, name: "スタンド", description: "PETG 推奨", license: "個人利用のみ")
    hidden = create(:product, category: prints)

    detail = call("get_product", { "product_id" => stand.id })
    expect(detail["product"]).to include("description" => "PETG 推奨", "license" => "個人利用のみ", "file_format" => "STL")
    expect(call("get_product", { "product_id" => hidden.id })).to include("found" => false)
    expect { tools.call("get_product", { "product_id" => "1; drop" }) }.to raise_error(ConciergeTools::InvalidInput)
    expect { tools.call("delete_everything", {}) }.to raise_error(ConciergeTools::InvalidInput)
  end

  describe "propose_custom_order" do
    let(:input) { { "title" => "スマホスタンド", "summary" => "木目調のスタンドを2個" } }

    it "オーダーメイドの受付中は下書きを作って残す" do
      create(:category, :custom)
      result = call("propose_custom_order", input)
      expect(result).to include("created" => true, "title" => "スマホスタンド")
      expect(tools.order_draft.markdown).to start_with("# 制作依頼書: スマホスタンド")
    end

    it "受付を休止しているときと、入力が足りないときは作らない" do
      expect { tools.call("propose_custom_order", input) }.to raise_error(ConciergeTools::InvalidInput, /休止/)
      create(:category, :custom)
      expect { tools.call("propose_custom_order", { "title" => "スタンド" }) }.to raise_error(ConciergeTools::InvalidInput)
      expect(tools.order_draft).to be_nil
    end
  end
end
