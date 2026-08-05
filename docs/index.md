# Documentation Index

`docs/` is the source of truth for project behavior. Read the documents relevant to a task before planning or modifying code.

## Backend Source Documents

| Area | Document | Use before changing |
|---|---|---|
| Scope and authority | [00-scope.md](backend/00-scope.md) | Scope, source precedence, roles, exclusions, accepted values. |
| Domain and data | [01-domain-model.md](backend/01-domain-model.md) | Entities, aggregates, invariants, derived values, and persistence model. |
| Authorization | [02-authorization-matrix.md](backend/02-authorization-matrix.md) | Role, campus, ownership, assignment, and cross-scope response rules. |
| Workflows | [03-state-machines.md](backend/03-state-machines.md) | Explicit transitions, guards, idempotency, and audit requirements. |
| API | [04-api-contract.md](backend/04-api-contract.md) | Routes, DTOs, error envelope, status codes, pagination, and idempotency headers. |
| Architecture | [05-architecture-decisions.md](backend/05-architecture-decisions.md) | Accepted ADRs for modularity, storage, authentication, auditing, and scope isolation. |
| Delivery and verification | [06-implementation-plan.md](backend/06-implementation-plan.md) | Phase order, schema sequence, definition of done, and verification criteria. |

## Related Sources

- [Product_Backlog_PPP_MVP_Completo.xlsx](../Product_Backlog_PPP_MVP_Completo.xlsx) supplies the backlog, permissions, rules, and states at the precedence defined by [00-scope.md](backend/00-scope.md).

## Maintenance Rules

- Update the affected source document whenever a functional change alters documented behavior, API, data model, authorization, workflow, architecture, or acceptance criteria.
- Add new documentation to this index when it becomes a project source of truth; do not relocate the existing `docs/backend/` documents without updating their inbound references.
