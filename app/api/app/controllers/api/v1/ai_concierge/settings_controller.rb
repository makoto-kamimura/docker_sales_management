module Api
  module V1
    module AiConcierge
      # AIコンシェルジュが使えるか (Claude の API キーの有無)。使えなければ、画面はチャットを出さない。
      # 無効のときも答えるので、AiConcierge::BaseController (無効なら 503) は継がない
      class SettingsController < Api::V1::BaseController
        def show
          render json: { enabled: ClaudeConcierge.enabled?, max_content_length: ConciergeChat::MAX_CONTENT_LENGTH }
        end
      end
    end
  end
end
