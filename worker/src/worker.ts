/**
 * The Worker's entry point, and nothing else.
 *
 * Once a Durable Object class is among a module's exports, the runtime reads
 * every export of the main module as an entrypoint and refuses to start if
 * one is not a handler or a class -- `index.ts` exports its error strings and
 * helpers for the frontend and the tests, and was refused with "Incorrect type
 * for map entry 'DAILY_QUOTA_EXCEEDED'". So `wrangler.toml` points here.
 */
export { UsageCounter } from './usage-counter'
export { default } from './index'
