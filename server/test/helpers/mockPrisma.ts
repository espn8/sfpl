import { vi, type Mock } from "vitest";

/**
 * Proxy-backed Prisma client mock that auto-materializes a `vi.fn()` for any
 * `prisma.<model>.<method>(...)` call.
 *
 * This exists to prevent a specific class of drift: when a new Prisma model or
 * method gets added to a route handler (e.g. a new dedup service does
 * `prisma.prompt.findMany(...)` or a thumbnail queue does
 * `prisma.skill.findUnique(...)`), tests that previously hard-coded a shape
 * like `{ prompt: { findFirst: vi.fn() } }` would crash with
 * `TypeError: prisma.xxx.yyy is not a function` and the test author has to
 * manually extend the mock. With this helper, **every** method has a safe
 * resolved-value default, so the only thing a test needs to specify is the
 * data the assertion depends on.
 *
 * Defaults by Prisma method name:
 * - findFirst / findUnique / findFirstOrThrow / findUniqueOrThrow -> null
 * - findMany / groupBy                                            -> []
 * - count                                                         -> 0
 * - aggregate                                                     -> {}
 * - create / update / upsert / delete                             -> {}
 * - createMany / updateMany / deleteMany                          -> { count: 0 }
 * - $transaction                                                  -> []
 * - anything else                                                 -> undefined
 *
 * Usage:
 *
 *   const prismaMock = buildPrismaMock({
 *     prompt: {
 *       findFirst: vi.fn().mockResolvedValue({ id: 1, teamId: 1, ownerId: 1 }),
 *       findMany: vi.fn().mockResolvedValue([]),
 *     },
 *   });
 *
 *   vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));
 *
 *   // Later in a test, you can still access any auto-materialized mock:
 *   expect(prismaMock.prompt.update).toHaveBeenCalled();
 */

type AnyFn = (...args: unknown[]) => unknown;
export type PrismaMockOverrides = Record<string, Record<string, Mock | AnyFn>>;

const DEFAULT_RESULT_BY_METHOD: Record<string, () => unknown> = {
  findFirst: () => null,
  findUnique: () => null,
  findFirstOrThrow: () => null,
  findUniqueOrThrow: () => null,
  findMany: () => [],
  groupBy: () => [],
  count: () => 0,
  aggregate: () => ({}),
  create: () => ({}),
  update: () => ({}),
  upsert: () => ({}),
  delete: () => ({}),
  createMany: () => ({ count: 0 }),
  updateMany: () => ({ count: 0 }),
  deleteMany: () => ({ count: 0 }),
};

function makeDefaultFn(methodName: string): Mock {
  const factory = DEFAULT_RESULT_BY_METHOD[methodName];
  if (factory) {
    return vi.fn().mockResolvedValue(factory());
  }
  return vi.fn();
}

function wrapModelOverrides(
  modelName: string,
  overrides: Record<string, Mock | AnyFn> | undefined,
): Record<string, Mock> {
  const cache: Record<string, Mock> = {};
  if (overrides) {
    for (const [methodName, impl] of Object.entries(overrides)) {
      cache[methodName] = typeof (impl as Mock).mock === "object" ? (impl as Mock) : vi.fn(impl as AnyFn);
    }
  }

  return new Proxy(cache, {
    get(target, prop: string) {
      if (typeof prop !== "string") {
        return undefined;
      }
      if (!(prop in target)) {
        target[prop] = makeDefaultFn(prop);
      }
      return target[prop];
    },
    has(target, prop) {
      return typeof prop === "string" ? true : prop in target;
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
  }) as Record<string, Mock>;
}

export function buildPrismaMock(overrides: PrismaMockOverrides = {}): Record<string, unknown> {
  const modelCache: Record<string, Record<string, Mock>> = {};
  for (const [modelName, methodOverrides] of Object.entries(overrides)) {
    modelCache[modelName] = wrapModelOverrides(modelName, methodOverrides);
  }

  return new Proxy(
    {
      $transaction: vi.fn().mockResolvedValue([]),
      $connect: vi.fn().mockResolvedValue(undefined),
      $disconnect: vi.fn().mockResolvedValue(undefined),
    } as Record<string, unknown>,
    {
      get(target, prop: string) {
        if (typeof prop !== "string") {
          return undefined;
        }
        if (prop in target) {
          return target[prop];
        }
        if (!(prop in modelCache)) {
          modelCache[prop] = wrapModelOverrides(prop, undefined);
        }
        return modelCache[prop];
      },
    },
  );
}
