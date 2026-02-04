# Default recipe
default:
    @just --list

# Install all dependencies
install:
    bun install

# Run web dev server
[working-directory: 'apps/web']
dev:
    bunx --bun vite dev

# Build web
[working-directory: 'apps/web']
build:
    bunx --bun vite build

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
