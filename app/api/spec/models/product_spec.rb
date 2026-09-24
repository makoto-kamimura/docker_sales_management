require "rails_helper"

RSpec.describe Product, type: :model do
  describe "#in_stock?" do
    it "デジタル商品は在庫数ではなく配布ファイルの有無で判定する" do
      expect(create(:product, :digital).in_stock?).to be true
      expect(create(:product, is_digital: true).in_stock?).to be false
    end

    it "物販品は在庫数で判定する" do
      expect(create(:product).in_stock?).to be false
      expect(create(:product, :stocked).in_stock?(10)).to be true
    end
  end

  describe "validations" do
    it "デジタル商品はサブスク対象にできない" do
      product = build(:product, :digital, is_subscribable: true)
      expect(product).not_to be_valid
      expect(product.errors[:is_subscribable]).to be_present
    end

    it "対応外の拡張子の配布ファイルは不可" do
      product = build(:product, is_digital: true)
      product.model_file.attach(io: StringIO.new("x"), filename: "model.exe")
      expect(product).not_to be_valid
      expect(product.errors[:model_file]).to be_present
    end

    it "STL/3MF 等は可。形式は拡張子から返す" do
      product = create(:product, :digital)
      expect(product.model_file_format).to eq("STL")
    end
  end
end
