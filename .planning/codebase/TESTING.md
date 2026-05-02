# Testing

## Frameworks
- **Zero test coverage setup**: Neither the frontend nor the backend specifies an active testing framework (e.g., Jest, Vitest, Mocha, etc.).

## Command State
- Running `npm test` in both `frontend/` and `backend/` will result in the default `"Error: no test specified"`.

## Recommendations for Code Quality
- Given the monolithic nature of the backend (`server.js`), functional unit tests will be hard to assert. E2E component tests or integration tests with specific REST endpoints would prove beneficial.  
- Vitest would integrate cleanly with the existing Vite toolchain on the frontend.
