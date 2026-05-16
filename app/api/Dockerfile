FROM ruby:3.3.5-slim

ENV LANG=C.UTF-8 \
    TZ=Asia/Tokyo \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential \
      git \
      curl \
      libpq-dev \
      libyaml-dev \
      libffi-dev \
      pkg-config \
      tzdata && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile Gemfile.lock* ./
RUN bundle install || true

COPY . /app

EXPOSE 3000

CMD ["bash", "-c", "bundle exec rails s -b 0.0.0.0 -p 3000"]
