# Default recipe
default:
    @just --list

# Install all dependencies
install:
    bun install

# Run web dev server
dev:
    bun run --filter @apps/web dev

# Build web
build:
    bun run --filter @apps/web build

# Database commands
[working-directory: 'packages/database']
db-generate:
    bun run db:generate

[working-directory: 'packages/database']
db-migrate:
    bun run db:migrate

# Typecheck database
[working-directory: 'packages/database']
typecheck:
    bun run typecheck

# Clean build artifacts
clean:
    rm -rf node_modules
    rm -rf apps/*/node_modules
    rm -rf packages/*/node_modules
    rm -rf apps/*/.svelte-kit
    rm -rf packages/*/dist
