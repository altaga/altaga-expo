// Lets Node resolve the app's extensionless relative imports the way Metro does.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".")) {
      return next(`${specifier}.js`, context);
    }
    throw error;
  }
}
