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
      resources :orders, only: %i[index show create]

      # サブスク (要件6)
      resources :subscription_plans, only: %i[index show]
      resources :subscriptions, except: %i[new edit] do
        member { post :skip }
      end

      # 整備の予約 / システムの開発依頼
      resources :service_requests, only: %i[index show create]

      # AIコンシェルジュ (要件4)
      namespace :ai_concierge do
        resources :conversations, only: %i[create show] do
          resources :messages, only: %i[create]
        end
      end

      # 販売管理 (要件2, admin)
      namespace :admin do
        resources :orders, only: %i[index show update]
        resources :products, except: %i[new edit] do
          member { post :image, action: :upload_image }
        end
        resources :service_requests, only: %i[index show update]
        resources :inventories, only: %i[update], param: :product_id
        namespace :dashboard do
          get :sales
        end
      end
    end
  end
end
