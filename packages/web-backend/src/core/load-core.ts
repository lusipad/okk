import { createInMemoryCore } from "./in-memory-core.js";
import type { LoadCoreOptions, OkkCore } from "./types.js";

type CoreFactory = (options?: Record<string, unknown>) => Promise<OkkCore> | OkkCore;

function pickFactory(moduleNamespace: Record<string, unknown>): CoreFactory | null {
  const candidates = [
    moduleNamespace.createCore,
    moduleNamespace.createOkkCore,
    moduleNamespace.default,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "function") {
      return candidate as CoreFactory;
    }
  }

  return null;
}

export async function loadCore(options: LoadCoreOptions): Promise<OkkCore> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<Record<string, unknown>>;

  const allowInMemoryFallback = options.allowInMemoryFallback ?? false;
  const factoryOptions: Record<string, unknown> = {
    ...options.createCoreOptions,
    logger: options.logger,
  };

  try {
    const moduleNamespace = await dynamicImport("@okk/core");
    const factory = pickFactory(moduleNamespace);
    if (!factory) {
      const message = "detected @okk/core, but no createCore factory is exported";
      if (!allowInMemoryFallback) {
        throw new Error(message);
      }
      options.logger.warn("core_factory_missing_fallback_to_in_memory", { message });
      return createInMemoryCore();
    }

    options.logger.info("core_factory_loaded", {
      source: "@okk/core",
      allowInMemoryFallback,
    });
    return await factory(factoryOptions);
  } catch (error) {
    if (!allowInMemoryFallback) {
      throw error;
    }
    options.logger.warn("core_module_load_failed_fallback_to_in_memory", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return createInMemoryCore();
  }
}
