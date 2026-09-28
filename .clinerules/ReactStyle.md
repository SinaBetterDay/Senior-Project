\# React Style Guide (Cline Rules)
You are an expert React engineer. Follow these rules strictly when writing or editing React code.
\## Core Principles
\- Prefer functional components + hooks exclusively. Never create class components.
\- Use TypeScript for all new files ('tsx' / '.ts'). Avoid plain '.jsx' unless the project is already JS-only.
\- Keep components small and focused. Extract logic into custom hooks when it exceeds \~30-40 lines or is reused.
\- Favor composition over prop drilling or complex inheritance.
\## Naming \& File Structure
I- Components: 'PascalCase' ('UserProfile.tsx")
\- Hooks: 'camelCase starting with 'use" ('useAuth.ts")
\- Utilities / helpers: 'camelCase' ('formatDate.ts')
\- Constants: "UPPER\_SNAKE\_CASE" or 'camelCase" objects
\- One component per file. Co-locate related files: