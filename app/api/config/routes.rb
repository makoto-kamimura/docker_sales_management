Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # 認証 (要件3)
      namespace :auth do
        post :register
        post :login
        post :refresh
      end

      # マイページ (要件3)
      resource :me, only: %i[show update], controller: "me" do
        resources :addresses, except: %i[new edit]
        resources :payment_methods, only: %i[index create destroy]
      end

      # 商品検索 (要件5)
      resources :products, only: %i[index show] do
        collection { get :search }
      end
      resources :categories, only: %i[index]

      # カート / 注文 (要件1)
      resource :cart, only: %i[show] do
        resources :items, only: %i[create update destroy], controller: "cart_items"
      end
      resources :orders, only: %i[index show create] do
        resources :tips, only: %i[create destroy] # 投げ銭 (0円の商品を含む注文)
      end

      # 購入済み3Dモデルデータのダウンロード (:id = product_id)
      resources :downloads, only: %i[index show] do
        member { get :assembly } # 組み立て説明書 PDF の期限付きURL
      end
      get "assembly_pdfs/:token", to: "assembly_pdfs#show", as: :assembly_pdf # 期限付きリンク (ログイン不要)

      # サブスク (要件6)
      resources :subscription_plans, only: %i[index show]
      resources :subscriptions, except: %i[new edit] do
        member { post :skip }
      end

      # 問い合わせ / オーダーメイド制作依頼
      resources :service_requests, only: %i[index show create]

      # AIコンシェルジュ (要件4)
      namespace :ai_concierge do
        resources :conversations, only: %i[create show] do
          resources :messages, only: %i[create]
        end
      end

      # 管理。コントローラごとに 販売 / 制作 / 注文 の権限が必要 (管理者はすべて)
      namespace :admin do
        # --- 注文 (注文権限)
        resources :orders, only: %i[index show update]            # 注文管理 (ステータス・発送)
        resources :tips, only: %i[index update]                   # 投げ銭 (入金確認・取り消し)

        # --- 販売 (販売権限)
        resources :products, except: %i[new edit] do
          member do
            post :image, action: :upload_image
            post :model_file, action: :upload_model_file # 3Dモデルデータ (デジタル商品の配布ファイル)
          end
          resource :materials, only: %i[show update], controller: "product_materials" # レシピ (使用材料・制作権限)
        end
        resources :inventories, only: %i[update], param: :product_id
        namespace :dashboard do                                    # 売上・分析
          get :sales
        end

        # --- 制作 (制作権限)
        resources :production, only: %i[index update], controller: "production" # 制作ボード (Kanban)
        resources :staff, only: %i[index], controller: "staff"                  # 製作担当の候補 (制作・注文権限)
        resources :materials, only: %i[index create update destroy] do         # 材料管理
          member { post :adjust }
        end
        resources :model_assets, except: %i[new edit] do                        # 3Dモデル (ファイル・プレビュー画像・販売フラグ・組み立て方法)
          member do
            post :preview
            get :assembly_pdf
            post :assembly_import # Markdown ファイルから部品・工具と手順を取り込む
          end
          resources :versions, only: %i[create], controller: "model_versions" do # 版管理
            member do
              post :restore
              get :file   # 版の中の1ファイル (file_id)
              get :bundle # まとめてダウンロード (複数なら ZIP)
            end
          end
          resources :assembly_steps, only: %i[create update destroy]
          resources :photos, only: %i[create update destroy], controller: "model_photos" # 実モデル画像・実利用画像
        end

        # --- 顧客 (注文権限)
        resources :customers, only: %i[index show update]
        resources :service_requests, only: %i[index show update]  # 問い合わせ・オーダーメイド依頼

        # --- 権限設定 (管理者のみ)
        resources :users, only: %i[index update]
      end
    end
  end
end
