\# Unit Testing Rule for New Code
Whenever you create or significantly modify code, you \*\*must\*\* also create or update corresponding unit tests.
\## Core Requirements
\- Write unit tests for every new function, component, hook, or module.
\- Prefer testing \*\*behavior and public API\*\* over implementation details.
\- Tests should be readable, focused, and deterministic.
\- Aim for meaningful coverage of the happy path + important edge cases and error states.
\## Preferred Stack (React projects)
\- \*\*Test runner\*\*: Vitest (preferred) or Jest
\- |*|*Component testing\*\*: React Testing Library ('@testing-library/react)
\- |*|*User interactions|*|*: '@testing-library/user-event"
\- |*|*Assertions\*|*: Vitest/Jest matchers + '@testing-library/jest-dom'
\## Test File Conventions
\- Place test files next to the source file when possible: