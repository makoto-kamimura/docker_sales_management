require "rails_helper"

RSpec.describe ConciergeChat do
  describe ".extract_cta" do
    let(:user) { create(:user) }

    def extract(answer, user: nil)
      described_class.extract_cta(answer, user: user)
    end

    it "末尾の CTA を本文から切り出す" do
      create(:category, :custom)
      expect(extract("オーダーメイドは依頼制です。\n[CTA: open_custom_request]")).to eq(["オーダーメイドは依頼制です。", "open_custom_request"])
      expect(extract("お問い合わせください。[cta:open_contact]  \n")).to eq(["お問い合わせください。", "open_contact"])
    end

    it "CTA がなければ本文をそのまま返す" do
      expect(extract("送料は500円です。\n\n5,000円以上で無料です。")).to eq(["送料は500円です。\n\n5,000円以上で無料です。", nil])
    end

    it "知らない CTA は捨て、本文には残さない" do
      expect(extract("こちらです。\n[CTA: open_admin]")).to eq(["こちらです。", nil])
    end

    it "複数あるときは最後の 1 つを使う" do
      create(:category, :custom)
      expect(extract("[CTA: open_contact]\n依頼もできます。\n[CTA: open_custom_request]")).to eq(["依頼もできます。", "open_custom_request"])
    end

    it "CTA だけの応答でも本文を空にしない" do
      text, cta = extract("[CTA: view_requests]", user: user)
      expect(text).to be_present
      expect(cta).to eq("view_requests")
    end

    it "商品へのリンクは店頭に並んでいる商品のときだけ残す" do
      on_sale = create(:product)
      hidden = create(:product, published_at: nil)

      expect(extract("[CTA: view_product:#{on_sale.id}]").last).to eq("view_product:#{on_sale.id}")
      expect(extract("[CTA: view_product:#{hidden.id}]").last).to be_nil
      expect(extract("[CTA: view_product]").last).to be_nil
    end

    it "オーダーメイドの依頼は受付中のときだけ、ログインが要る画面は会員のときだけ残す" do
      expect(extract("[CTA: open_custom_request]").last).to be_nil
      create(:category, :custom)
      expect(extract("[CTA: open_custom_request]").last).to eq("open_custom_request")

      expect(extract("[CTA: view_requests]").last).to be_nil
      expect(extract("[CTA: view_requests]", user: user).last).to eq("view_requests")
    end

    it "注文へのリンクは本人の注文のときだけ残す" do
      mine = create(:order, user: user)
      others = create(:order)

      expect(extract("[CTA: view_order:#{mine.id}]", user: user).last).to eq("view_order:#{mine.id}")
      expect(extract("[CTA: view_order: #{mine.id}]", user: user).last).to eq("view_order:#{mine.id}")
      expect(extract("[CTA: view_order:#{others.id}]", user: user).last).to be_nil
      expect(extract("[CTA: view_order:#{mine.id}]").last).to be_nil
      expect(extract("[CTA: view_order:abc]", user: user).last).to be_nil
      expect(extract("[CTA: view_order]", user: user).last).to be_nil
    end
  end
end
