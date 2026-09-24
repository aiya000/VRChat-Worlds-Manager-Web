/**
 * Stands in for `cloudflare:workers`, which exists only inside the Workers
 * runtime, so that modules importing it can be loaded by Vitest under Node.
 * The tests drive the counting through `countUse` and a fake namespace, never
 * through a real Durable Object.
 */
export class DurableObject {
  constructor(
    protected ctx: unknown,
    protected env: unknown,
  ) {}
}
