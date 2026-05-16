require "faraday"
require "faraday/retry"

class DifyClient
  class Error < StandardError; end

  def initialize(base_url: ENV.fetch("DIFY_API_BASE", "http://dify-api:5001/v1"),
                 api_key: ENV.fetch("DIFY_API_KEY", ""))
    @base_url = base_url
    @api_key  = api_key
  end

  # 同期型チャット (本実装は SSE blocking でも streaming でも可。
  # ここでは blocking モードで完成済みレスポンスを返す)
  def chat(query:, inputs: {}, user:, conversation_id: nil)
    body = {
      query: query,
      inputs: inputs,
      response_mode: "blocking",
      user: user,
      conversation_id: conversation_id
    }
    res = conn.post("chat-messages", body.to_json)
    raise Error, "Dify error #{res.status}: #{res.body}" unless res.success?
    data = JSON.parse(res.body)
    {
      answer: data["answer"].to_s,
      conversation_id: data["conversation_id"],
      message_id: data["id"]
    }
  end

  # ナレッジベース (商品RAG) 用テキスト分割アップロード
  def add_document_to_dataset(dataset_id:, name:, text:)
    res = conn.post("datasets/#{dataset_id}/document/create_by_text",
                    { name: name, text: text, indexing_technique: "high_quality",
                      process_rule: { mode: "automatic" } }.to_json)
    raise Error, "Dify dataset error #{res.status}: #{res.body}" unless res.success?
    JSON.parse(res.body)
  end

  private

  def conn
    @conn ||= Faraday.new(url: @base_url) do |f|
      f.request :retry, max: 2, interval: 0.2, backoff_factor: 2
      f.headers["Content-Type"] = "application/json"
      f.headers["Authorization"] = "Bearer #{@api_key}" if @api_key.present?
      f.options.timeout = 60
    end
  end
end
