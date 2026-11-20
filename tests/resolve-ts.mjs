const src = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, next) {
  const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), src).href : specifier;
  try {
    return await next(target, context);
  } catch (error) {
    const local = target.startsWith(".") || target.startsWith("file:");
    if (local && !/\.[cm]?[jt]sx?$/.test(target)) return next(`${target}.ts`, context);
    throw error;
  }
}
