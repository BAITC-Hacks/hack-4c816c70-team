# Third-party components

Версии JavaScript-пакетов зафиксированы в `frontend/package-lock.json`, NuGet-пакетов — в `backend/CitySimulator.Api/CitySimulator.Api.csproj`. Frontend использует standalone-сборку Next.js. Ключи и внешний LLM для режима `mock` не требуются.

| Component | License | Purpose | Link |
| --- | --- | --- | --- |
| .NET 8 and ASP.NET Core | MIT | C# API runtime | https://github.com/dotnet/aspnetcore |
| Swashbuckle.AspNetCore 10.2.3 | MIT | OpenAPI and Swagger UI | https://github.com/domaindrivendev/Swashbuckle.AspNetCore |
| Next.js 16.3.6 | MIT | Frontend framework | https://github.com/vercel/next.js |
| React and React DOM 19.2.8 | MIT | User interface | https://github.com/facebook/react |
| TypeScript 5.x | Apache-2.0 | Frontend type checking | https://github.com/microsoft/TypeScript |
| ESLint 9.x and eslint-config-next | MIT | Frontend linting | https://github.com/eslint/eslint |
| create-next-app | MIT | Initial frontend scaffold | https://github.com/vercel/next.js/tree/canary/packages/create-next-app |
| Node.js 22, Docker image `node:22-alpine` | MIT | Frontend build and runtime container | https://github.com/nodejs/docker-node |
| .NET Docker images `dotnet/sdk:8.0-alpine`, `dotnet/aspnet:8.0-alpine` | MIT | Backend build and runtime container | https://github.com/dotnet/dotnet-docker |
| Alpine Linux (base of the images above) | Per package, mainly MIT and GPL-2.0 | Container base OS, used unmodified | https://alpinelinux.org |
| Docker Compose | Apache-2.0 | One-command launch (tool, not bundled) | https://github.com/docker/compose |
| Challenge task and synthetic district dataset | Provided by the organizers as task materials; license not specified | Requirements, districts, indicators, measures and scoring rules | `docs/reference/` |

Prepared before the hackathon (development tools, not part of the product): Codex settings (`AGENTS.md`, skills including `hackalem-readme` and `hackalem-compliance`, MCP configuration).
