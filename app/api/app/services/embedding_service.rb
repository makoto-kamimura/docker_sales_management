require "faraday"

# OpenAI互換 (Dify 内蔵 or 他LLMプロバイダ) でテキスト → vector(1536)
# 開発時は OPENAI_API_KEY 未設定なら mock vector を返す。
class EmbeddingService
  DIMS = 1536
  MODEL = ENV.fetch("EMBEDDING_MODEL", "text-embedding-3-small")
  API   = ENV.fetch("EMBEDDING_API",   "https://api.openai.com/v1")
  KEY   = ENV.fetch("OPENAI_API_KEY",  "")

  def self.embed(text)
    if KEY.blank?
      # 開発用 deterministic mock embedding
      seed = text.to_s.bytes.sum
      rng  = Random.new(seed)
      Array.new(DIMS) { rng.rand(-1.0..1.0) }
    else
      res = Faraday.post("#{API}/embeddings",
                         { input: text, model: MODEL }.to_json,
                         { "Authorization" => "Bearer #{KEY}", "Content-Type" => "application/json" })
      raise "embedding error #{res.status}" unless res.success?
      JSON.parse(res.body).dig("data", 0, "embedding")
    end
  end
end
