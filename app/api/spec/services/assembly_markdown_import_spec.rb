require "rails_helper"

RSpec.describe AssemblyMarkdownImport do
  it "部品・工具の見出しと、手順の見出しの下の小見出しを取り出す (番号は外し、コードブロック内の # は見出しにしない)" do
    result = described_class.parse(<<~MD)
      \uFEFF# ギアボックス
      はじめの説明

      ## 必要な部品・工具
      - M3×10 ネジ 4本
      - 六角レンチ

      ## 組み立て手順

      ### STEP 1: 土台に軸を差し込む
      ベースに**奥まで**差し込む
      ```
      # これは見出しではない
      ```

      ### 2. ギアをはめる
      1. 小ギア
      2. 大ギア

      #### 注意
      向きに注意

      ### 3Dプリントしたカバーを閉じる
      ネジで固定
    MD

    expect(result.assembly_notes).to eq("- M3×10 ネジ 4本\n- 六角レンチ")
    expect(result.steps.map(&:title)).to eq(%w[土台に軸を差し込む ギアをはめる 3Dプリントしたカバーを閉じる])
    expect(result.steps[0].body).to eq("ベースに**奥まで**差し込む\n```\n# これは見出しではない\n```")
    expect(result.steps[1].body).to eq("1. 小ギア\n2. 大ギア\n\n#### 注意\n向きに注意")
    expect(result.warnings).to be_empty
  end

  it "「手順」の見出しがなければ、タイトル以外の見出しをそれぞれ手順にする" do
    result = described_class.parse("# ミニプランター\n## 用意するもの\n- PLA フィラメント\n## 本体を出力する\n0.2mm で出力\n## 底を貼り付ける\n接着剤で固定\n")
    expect(result.assembly_notes).to eq("- PLA フィラメント")
    expect(result.steps.map(&:to_h)).to eq([{ title: "本体を出力する", body: "0.2mm で出力" }, { title: "底を貼り付ける", body: "接着剤で固定" }])
    expect(result.warnings.first).to include("見出しごと")
  end

  it "手順に小見出しがなければ、リストの項目を1つずつ手順にする" do
    result = described_class.parse("## 手順\n1. 軸を差し込む\n   奥まで押し込む\n2. ギアをはめる\r\n")
    expect(result.assembly_notes).to be_nil
    expect(result.steps.map(&:to_h)).to eq([{ title: "", body: "軸を差し込む\n奥まで押し込む" }, { title: "", body: "ギアをはめる" }])
  end

  it "取り込めるものがない・UTF-8 でないときはエラー" do
    expect { described_class.parse("ただの文章です") }.to raise_error(described_class::Error, /見つかりませんでした/)
    expect { described_class.parse("\xFF\xFE\x00".b) }.to raise_error(described_class::Error, /UTF-8/)
  end
end
