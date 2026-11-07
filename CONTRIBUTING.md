# Contributing

Bug reports and pull requests are welcome.

1. Install Node.js (LTS), pnpm, Rust (stable) and, on macOS, the Xcode Command Line Tools.
2. `pnpm install`
3. `pnpm check` runs typecheck, lint and tests. In `src-tauri/`, run `cargo fmt --check`, `cargo clippy -- -D warnings` and `cargo test`.
4. `pnpm tauri dev` starts the app.

A new detector goes in `src/core/detect/detectors.ts` with at least five positive and five negative cases in `tests/detect.test.ts`. A missed detection is best reported with the (fictional) text the OCR read and what you expected.

Keep commits small, with a short message in English in the imperative (`Fix date parsing for WhatsApp names`). Use made-up data in tests and fixtures; never real documents.
