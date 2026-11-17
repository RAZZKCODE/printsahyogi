# Project folder blueprint

## Source ownership

| Folder | Put here | Examples |
| --- | --- | --- |
| `src/app/` | Routes, layouts, metadata, global styles | Landing route, sitemap |
| `src/app/app/` | Routes under the public `/app` URL | Dashboard, `[slug]`, editor, sheet |
| `src/components/shared/` | Reusable interface and application shell | Providers, sidebar, uploads |
| `src/components/landing/` | Public marketing interface | Landing content and header |
| `src/components/editor/` | Photo editing interface | Crop, filters, background removal |
| `src/components/sheet/` | Sheet composition interface | Workspace, joint photo dialog |
| `src/components/card-crop/` | Card processing interface | Card crop tool |
| `src/components/tools/` | Other tool interfaces | Collage, compressor, PDF tools |
| `src/tools/<feature>/` | Feature calculations, types, state and exports | `sheet/layout.ts`, `editor/filter-engine.ts` |
| `src/lib/` | Code shared across features | IndexedDB, navigation, common utilities |
| `src/messages/` | Locale dictionaries | `en.json`, `hi.json` |
| `docs/` | Developer documentation | This blueprint |
| Project root | Package manifests and framework configuration | Next, TypeScript, Tailwind, PostCSS |

## Dependency rules

- Keep route files small: resolve route parameters and render feature components.
- Await dynamic route `params` and `searchParams` in server routes.
- Components may use feature logic and shared utilities. Keep pure layout calculations independent of React and browser APIs.
- Import application code through `@/`, which maps to `src/`. Tests may use relative imports.
- Place regression tests beside the calculations they exercise.
- Add a feature to `src/lib/navigation.ts` when it needs a dashboard or sidebar entry.
- Add static assets under root `public/` when needed; reference them with paths starting at `/`.

## Validation

Run `npm run test:layout`, `npm run typecheck`, and `npm run build` sequentially. Build regenerates `.next/types`, so running it alongside type checking can cause missing generated-type errors.

Do not commit `.next/`, `node_modules/`, local environment secrets, or TypeScript build caches. Existing `src/app/app/` nesting is intentional: it preserves `/app` routes.
