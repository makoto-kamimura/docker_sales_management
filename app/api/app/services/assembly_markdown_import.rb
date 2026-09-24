# 1つの Markdown ファイルから「必要な部品・工具」と組み立て手順を取り出す。
#
#   ## 必要な部品・工具        ← 「部品」「工具」「材料」などを含む見出しの下 → assembly_notes
#   - M3 ネジ 4本
#   ## 組み立て手順            ← 「手順」「組み立て」などを含む見出し
#   ### STEP 1: 土台を置く     ← その下の小見出しが1つずつ手順 (見出し = title、下の文章 = body)
#   ...
#
# - 手順の見出しに小見出しがなければ、番号付き / 箇条書きの項目を1つずつ手順にする
# - 手順の見出しがなければ、部品・工具以外の見出しをそれぞれ手順にする (唯一の # 見出しはタイトルとして無視)
# - 「STEP 1」「1.」などの番号は見出しから外す。コードブロック内の # は見出しとみなさない
class AssemblyMarkdownImport
  class Error < StandardError; end

  PARTS_TITLE = /部品|工具|材料|用意するもの|必要なもの|\bparts?\b|\btools?\b|\bmaterials?\b/i
  STEPS_TITLE = /手順|組み?立て|組立|作り方|ステップ|\bsteps?\b|\binstructions?\b|\bhow to\b/i
  NUMBER_PREFIX = /\A(?:(?:step|ステップ)\s*\d+\s*[.)．:：、\-–—]?|\d+\s*[.)．。:：、])\s*|\A[①-⑳]\s*/i
  MAX_BYTES = 1.megabyte
  MAX_STEPS = 100
  TITLE_MAX_LENGTH = 200

  Heading = Struct.new(:level, :title, :lines, keyword_init: true)
  Step = Struct.new(:title, :body, keyword_init: true)
  Result = Struct.new(:assembly_notes, :steps, :warnings, keyword_init: true)

  def self.parse(markdown)
    new(markdown).parse
  end

  def initialize(markdown)
    text = markdown.to_s.dup.force_encoding(Encoding::UTF_8)
    raise Error, "UTF-8 の Markdown ファイルを選択してください" unless text.valid_encoding?

    @text = text.delete_prefix("\uFEFF").gsub(/\r\n?/, "\n")
  end

  def parse
    @headings = split_headings
    warnings = []
    parts = @headings.index { |h| h.level.positive? && h.title.match?(PARTS_TITLE) }
    notes = parts && content(parts)
    steps = extract_steps(parts, warnings).reject { |s| s.title.blank? && s.body.blank? }
    if steps.size > MAX_STEPS
      warnings << "手順が多すぎるため、最初の #{MAX_STEPS} 件だけ取り込みます"
      steps = steps.first(MAX_STEPS)
    end
    if notes.blank? && steps.empty?
      raise Error, "取り込める部品・工具や手順が見つかりませんでした。見出し (## 必要な部品・工具 / ## 組み立て手順 など) を確認してください"
    end

    Result.new(assembly_notes: notes.presence, steps: steps, warnings: warnings)
  end

  private

  # 見出しごとに分ける。最初の見出しより前の文章は level 0 の塊にする
  def split_headings
    headings = [Heading.new(level: 0, title: "", lines: [])]
    each_line_outside_code(@text.split("\n")) do |line, in_code|
      if !in_code && (m = line.match(/\A {0,3}(\#{1,6})\s+(.*?)\s*#*\s*\z/))
        headings << Heading.new(level: m[1].size, title: m[2].strip, lines: [])
      else
        headings.last.lines << line
      end
    end
    headings
  end

  # 行ごとに、コードブロック (``` / ~~~) の中かどうかを添えて渡す
  def each_line_outside_code(lines)
    fence = nil
    lines.each do |line|
      if (m = line.match(/\A {0,3}(`{3,}|~{3,})/))
        fence = fence.nil? ? m[1][0] : (fence == m[1][0] ? nil : fence)
        yield line, true
      else
        yield line, !fence.nil?
      end
    end
  end

  def extract_steps(parts, warnings)
    container = (1...@headings.size).find { |i| i != parts && !inside?(i, parts) && @headings[i].title.match?(STEPS_TITLE) }
    if container
      children = descendants(container)
      return steps_from_list(@headings[container].lines) if children.empty?

      level = children.map { |i| @headings[i].level }.min
      return children.select { |i| @headings[i].level == level }.map { |i| step_from(i) }
    end

    candidates = (1...@headings.size).reject { |i| i == parts || inside?(i, parts) }
    # 唯一の # 見出しはモデル名などのタイトルとみなす
    candidates.shift if candidates.any? && @headings[candidates.first].level == 1 && @headings.count { |h| h.level == 1 } == 1
    return [] if candidates.empty?

    warnings << "「手順」の見出しがないため、見出しごとに手順として取り込みます"
    level = candidates.map { |i| @headings[i].level }.min
    candidates.select { |i| @headings[i].level == level }.map { |i| step_from(i) }
  end

  # 小見出しがない「手順」は、番号付き / 箇条書きの項目を1つずつ手順 (本文) にする
  def steps_from_list(lines)
    items = []
    each_line_outside_code(lines) do |line, in_code|
      if !in_code && (m = line.match(/\A(?:\d+[.)]|[-*+])\s+(.*)\z/))
        items << [m[1]]
      elsif items.any?
        items.last << line.sub(/\A {1,4}/, "") # 項目の続きはインデントを1段外す
      end
    end
    items.map { |item_lines| Step.new(title: "", body: tidy(item_lines)) }
  end

  def step_from(index)
    Step.new(title: clean_title(@headings[index].title), body: content(index))
  end

  # 見出しの本文と、その下の小見出し (より深いレベル) をまとめた Markdown
  def content(index)
    lines = @headings[index].lines.dup
    descendants(index).each do |i|
      h = @headings[i]
      lines << "#{'#' * h.level} #{h.title}"
      lines.concat(h.lines)
    end
    tidy(lines)
  end

  def descendants(index)
    level = @headings[index].level
    ((index + 1)...@headings.size).take_while { |i| @headings[i].level > level }
  end

  def inside?(index, ancestor)
    ancestor && index > ancestor && descendants(ancestor).include?(index)
  end

  def clean_title(title)
    cleaned = title.sub(NUMBER_PREFIX, "").strip
    (cleaned.presence || title)[0, TITLE_MAX_LENGTH]
  end

  def tidy(lines)
    lines.join("\n").gsub(/\A\s*\n/, "").rstrip
  end
end
