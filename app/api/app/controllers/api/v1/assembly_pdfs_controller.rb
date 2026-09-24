module Api
  module V1
    # 組み立て説明書 PDF の配布 (購入者向け)。DownloadsController#assembly が払い出す期限付きリンクで開く
    class AssemblyPdfsController < BaseController
      def show
        model = AssemblyGuidePdf.find_by_token(params[:token])
        raise NotFoundError, "リンクの有効期限が切れています。もう一度ダウンロードしてください" unless model

        guide = AssemblyGuidePdf.new(model)
        send_data guide.render, filename: guide.filename, type: "application/pdf", disposition: "attachment"
      end
    end
  end
end
