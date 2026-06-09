module AuthHelpers
  # JWT アクセストークンを Authorization ヘッダにして返す
  def auth_headers(user)
    token = JsonWebToken.encode_access(user_id: user.id)
    { "Authorization" => "Bearer #{token}" }
  end
end
