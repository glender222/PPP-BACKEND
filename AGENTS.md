# AGENTS.md

## Documentation-first workflow
- `docs/` is the source of truth for project behavior. Start with `docs/index.md`; the authoritative backend documents are under `docs/backend/`.
- Before planning or modifying code, identify and read the relevant documentation: `00-scope.md` (scope), `01-domain-model.md` (data model), `02-authorization-matrix.md` (access), `03-state-machines.md` (flows), `04-api-contract.md` (HTTP contract), `05-architecture-decisions.md` (ADRs), and `06-implementation-plan.md` (phases, done criteria, verification).
- Respect the documented requirements, business rules, architecture, data models, flows, API contracts, and acceptance criteria. Do not turn example values into rules or invent undocumented requirements.
- If code conflicts with the relevant documentation, stop and report the exact inconsistency before modifying the code.
- Verify every functional change against its relevant documentation and update the affected documents when system behavior changes. Keep `docs/index.md` current when documentation is added, removed, or relocated.
- Do not consider work complete until the relevant documented acceptance criteria and required tests have been checked.
- In the final response, list the documents consulted, files changed, tests run, and documented requirements or acceptance criteria verified.

## Architecture
- This is a NestJS modular monolith. Put business behavior in `src/modules/<domain>/`; cross-cutting authorization belongs in `src/common/authorization/`, not in controllers.

## Commands and services
- Use Node 20+ and pnpm. If `pnpm` is not on PATH, use `corepack pnpm`.
- Start the development database before migrations, seed, or e2e tests: `docker compose up -d`. PostgreSQL is exposed on host port `5433`, not `5432`; `.env.example` has the matching local `DATABASE_URL`.
- Install with `corepack pnpm install`. Keep `pnpm-workspace.yaml`: pnpm 11 blocks dependency build scripts unless its `allowBuilds` entries approve Prisma.
- Create schema changes only with `corepack pnpm exec prisma migrate dev --name <name>`; never use `prisma db push` or a synchronize-style workflow. Run `corepack pnpm prisma:generate` after schema-only changes that do not run a migration.
- Run `corepack pnpm prisma:seed` after migrations. The seed is idempotent and provisions UPeU, Juliaca/Lima/Tarapoto, Systems, periods, and all dev-role users required by e2e tests.
- Validate with `corepack pnpm lint`, `corepack pnpm test`, `corepack pnpm test:e2e`, and `corepack pnpm build`. Focus a unit suite with `corepack pnpm test -- <file>.spec.ts` or e2e with `corepack pnpm test:e2e -- <file>.e2e-spec.ts`.
- E2E tests use the real development database and create `e2e.*@upeu.edu.pe` users plus `E2E-*` periods. Seed before running them; do not point e2e at shared or production data.

## Runtime and testing wiring
- `configureApp()` in `src/app.setup.ts` installs the `/api/v1` prefix, global validation, error envelope, Helmet/CORS, logger, and Scalar. Call it in every e2e Nest application or results will not match production.
- Keep API errors in the documented envelope: `statusCode`, `error`, `message`, optional `details` and `allowedTransitions`.
- Scalar is intentionally pinned to `@scalar/nestjs-api-reference` 0.5.x and mounted with `apiReference(...)`. Newer 1.x releases pull ESM rendering dependencies that break the current CommonJS `ts-jest` setup.
- Always decorate DTO class properties with `@ApiProperty({ example: '...', description: '...' })` or `@ApiPropertyOptional(...)` from `@nestjs/swagger` so OpenAPI / Scalar pre-populates interactive request JSON bodies with realistic default examples instead of empty `{}`.
- Use the singleton `Logger` from `nestjs-pino` for global infrastructure (for example, exception filters); `PinoLogger` is request-scoped and cannot be retrieved with `app.get()`.

## Authorization and audit invariants
- `AuthGuard`, `RolesGuard`, `PermissionsGuard`, and `ResourceAccessGuard` are global through `AuthModule`. Mark only truly public routes with `@Public()`; use `@CurrentUser()`, `@Roles()`, `@RequirePermission()`, and `@ResourceAccess()` instead of ad hoc header or role checks.
- Extend `PERMISSION_CATALOG` and `ScopePolicyService` for every new protected resource. `STUDENT` is owner-only, `SUPERVISOR` is active-assignment-only, `COORDINATOR`/`SECRETARY` require matching campus-school, `AUDITOR` is read-only across campuses, and `SYSTEM_ADMIN` manages platform data without inheriting business approvals.
- `User` never receives a role field. Roles and scopes live in `RoleAssignment`; validate campus-school roles against active `CampusSchool` rows.
- Revalidate ownership/campus/assignment inside domain services as well as guards. Cross-scope access is `403` unless the API contract explicitly requires a privacy-preserving `404`.
- Write each critical mutation and its `AuditEvent` in the same Prisma transaction. `AuditEvent` is append-only: do not add update/delete application paths.
- The only implemented authentication adapter is `DevAuthenticationProvider` behind `AuthenticationProviderPort`. It is allowed only outside production; production startup rejects it. Do not add Google, Microsoft, Lamb, or another institutional provider until the provider contract is approved.
