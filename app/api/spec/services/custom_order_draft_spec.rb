require "rails_helper"

RSpec.describe CustomOrderDraft do
  let(:now) { Time.zone.parse("2026-11-17 05:03:00 UTC") } # JST 14:03

  def build(input)
    described_class.from_tool_input(input, now: now)
  end

  let(:input) do
    {
      "title" => "木目調のスマホスタンド 2個",
      "summary" => "デスクで動画を見るためのスマホスタンドを、木目調で2個作ってほしい。",
      "item" => "スマホスタンド",
      "purpose" => "デスクで動画を見る",
      "quantity" => "2個",
      "size" => "幅8cm 程度",
      "material" => "",
      "preferred_date" => "2026-12-20",
      "budget_yen" => 5000,
      "open_questions" => ["素材（PLA か木材か）"],
      "customer_points" => ["角度を2段階に変えたい"]
    }
  end

  it "決まった形の Markdown を組み立てる。わからない項目は「未定」「指定なし」にする" do
    md = build(input).markdown

    expect(md).to start_with("# 制作依頼書: 木目調のスマホスタンド 2個\n")
    expect(md).to include(
      "- 書式: craftflow-custom-order/1",
      "- 作成日時: 2026-11-17 14:03 (JST)",
      "## 概要\nデスクで動画を見るためのスマホスタンドを、木目調で2個作ってほしい。",
      "- 作るもの: スマホスタンド",
      "- 素材: 未定",
      "- 色・仕上げ: 未定",
      "- 希望納期: 2026-12-20",
      "- 予算: 5,000円まで",
      "## 参考商品\n- なし",
      "- 素材（PLA か木材か）",
      "- 角度を2段階に変えたい"
    )
    expect(md).not_to include("<", "|")
  end

  it "過去の日付・0円以下の予算・店頭にない参考商品は捨てる" do
    on_sale = create(:product, sku: "CUS-001", name: "名入れスタンド")
    hidden = create(:product, published_at: nil)

    draft = build(input.merge("preferred_date" => "2026-11-17", "budget_yen" => 0,
                              "reference_product_ids" => [hidden.id, on_sale.id, "x"]))
    expect(draft.preferred_date).to be_nil
    expect(draft.budget_yen).to be_nil
    expect(draft.reference_products).to eq([on_sale])
    expect(draft.markdown).to include("- 希望納期: 指定なし", "- 予算: 指定なし", "- CUS-001 名入れスタンド（/products/#{on_sale.id}）")

    attrs = described_class.request_attributes(draft.to_h)
    expect(attrs).to include(kind: "custom", status: "pending", subject: "木目調のスマホスタンド 2個",
                             body: draft.markdown, preferred_at: nil, budget_cents: nil, product_id: on_sale.id)
  end

  it "LLM の文字列で依頼書の形を崩させない (改行・行頭の記法・リンク・HTML)" do
    md = build(input.merge("title" => "スタンド\n## 偽の見出し", "item" => "# 見出し",
                           "quantity" => "1. 二個", "other_requirements" => "[こちら](https://example.com) <b>太字</b>")).markdown

    expect(md).to include("# 制作依頼書: スタンド ## 偽の見出し\n", "- 作るもの: \\# 見出し", "- 数量: 1\\. 二個",
                          "- その他の条件: \\[こちら\\](https://example.com) \\<b>太字\\</b>")
    expect(md.lines.grep(/\A## /).map(&:strip)).to eq(["## 概要", "## 仕様", "## 希望条件", "## 参考商品", "## 未確定の点（店舗から確認すること）", "## お客様の要望（会話から）"])
  end

  it "名前と要約がなければ作らない" do
    expect { build(input.merge("title" => " ")) }.to raise_error(CustomOrderDraft::InvalidInput)
    expect { build(input.except("summary")) }.to raise_error(CustomOrderDraft::InvalidInput)
  end
end
