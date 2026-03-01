# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## RateMyProfessors summary workflow

- Copy `.env.example` to `.env` and fill in your OpenAI credentials (and any overrides) before starting the helper. The file keeps secrets out of version control.
- Start the Express helper with `npm run server` (it reads `OPENAI_API_KEY` from the environment) so `/api/reviews/summary` can scrape with `RMPScraper.py` and summarize reviews via OpenAI.
- In a second terminal run `npm run dev` to start Vite. The homepage now exposes a “Generate summary” button that submits a RateMyProfessors professor URL to the API and renders the paragraph GPT creates from every review.
- The Vite dev server proxies `/api/*` to `http://localhost:4000` (see `vite.config.js`), so keep both servers running while developing.
