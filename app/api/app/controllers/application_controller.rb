class ApplicationController < ActionController::API
  class AuthError < StandardError; end
  class ForbiddenError < StandardError; end
  class NotFoundError < StandardError; end

  rescue_from ActiveRecord::RecordNotFound, with: :not_found
  rescue_from ActiveRecord::RecordInvalid, with: :unprocessable
  rescue_from ActionController::ParameterMissing, with: :bad_request
  rescue_from AuthError, with: :unauthorized
  rescue_from ForbiddenError, with: :forbidden
  rescue_from NotFoundError, with: :not_found

  def current_user
    @current_user ||= authenticate_user
  end

  def authenticate!
    raise AuthError, "未ログイン" unless current_user
  end

  def require_admin!
    authenticate!
    raise ForbiddenError, "管理者権限が必要です" unless current_user.admin?
  end

  private

  def authenticate_user
    header = request.headers["Authorization"]
    return nil if header.blank?

    token = header.to_s.sub(/^Bearer\s+/i, "")
    payload = JsonWebToken.decode(token)
    return nil unless payload && payload[:type] == "access"

    User.find_by(id: payload[:sub])
  end

  def render_error(code:, message:, status:)
    render json: { error: { code: code, message: message } }, status: status
  end

  def not_found(e)
    render_error(code: "not_found", message: e.message, status: :not_found)
  end

  def unprocessable(e)
    msg = e.respond_to?(:record) ? e.record.errors.full_messages.join(", ") : e.message
    render_error(code: "unprocessable", message: msg, status: :unprocessable_entity)
  end

  def bad_request(e)
    render_error(code: "bad_request", message: e.message, status: :bad_request)
  end

  def unauthorized(e)
    render_error(code: "unauthorized", message: e.message, status: :unauthorized)
  end

  def forbidden(e)
    render_error(code: "forbidden", message: e.message, status: :forbidden)
  end

  def pagination_params
    page = (params[:page] || 1).to_i.clamp(1, 10_000)
    per  = (params[:per]  || 20).to_i.clamp(1, 100)
    [page, per]
  end

  def set_pagination_headers(scope, page:, per:)
    response.set_header("X-Total-Count", scope.count.to_s)
    response.set_header("X-Page", page.to_s)
    response.set_header("X-Per-Page", per.to_s)
  end
end
