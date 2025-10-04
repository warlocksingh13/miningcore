FROM mcr.microsoft.com/dotnet/sdk:6.0 as build
WORKDIR /src
COPY ./git/miningcore-bmns/ ./
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake clang ninja-build build-essential libssl-dev pkg-config \
    libboost-all-dev libsodium-dev libzmq5 libzmq3-dev golang-go \
    libgmp-dev libc++-dev zlib1g-dev git && \
    git config --global --add safe.directory /src || true && \
    cd src/Miningcore && dotnet publish -c Release --framework net6.0 -o /app

FROM mcr.microsoft.com/dotnet/aspnet:6.0-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libzmq5 libsodium23 curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
EXPOSE 4000 3333 5008 5108 6003 6103
CMD ["./Miningcore", "-c", "config.json"]
