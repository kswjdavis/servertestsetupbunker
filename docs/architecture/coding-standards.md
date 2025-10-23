# Coding Standards

## Critical Fullstack Rules

- **Type Sharing:** Generate TypeScript types from FastAPI OpenAPI spec using `openapi-typescript` - never duplicate type definitions manually

- **API Calls:** Frontend must use service layer functions, never make direct axios calls from components

- **Environment Variables:** Access via config objects (`import.meta.env` in Vite, `Config` class in FastAPI), never `process.env` directly

- **Error Handling:** All FastAPI routes use HTTPException for errors; frontend displays user-friendly messages

- **State Updates:** React state updates use setState/hooks, never direct mutation

- **Async/Await:** Always use async/await for asynchronous operations, avoid `.then()` chains

- **Database Transactions:** Repository methods commit or rollback within method scope, don't leak transactions

## Naming Conventions

| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Components | PascalCase | - | `UserProfile.tsx` |
| Hooks | camelCase with 'use' | - | `useAuth.ts` |
| Services | camelCase | snake_case | `authService.ts` / `auth_service.py` |
| API Routes | - | kebab-case | `/api/bunkers/{bunker-id}` |
| Database Tables | - | snake_case | `time_window_overrides` |
| TypeScript Interfaces | PascalCase | - | `interface BunkerStatus` |
| Pydantic Models | PascalCase | - | `class BunkerCreate` |
