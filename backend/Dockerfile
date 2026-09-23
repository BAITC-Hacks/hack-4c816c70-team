# Сборка .NET 8 API
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src
COPY CitySimulator.Api/CitySimulator.Api.csproj CitySimulator.Api/
RUN dotnet restore CitySimulator.Api/CitySimulator.Api.csproj
COPY CitySimulator.Api/ CitySimulator.Api/
RUN dotnet publish CitySimulator.Api/CitySimulator.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=true
COPY --from=build /app/publish .
EXPOSE 8080
USER app
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["dotnet", "CitySimulator.Api.dll"]
