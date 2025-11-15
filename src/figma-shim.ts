// This shim is used during web builds where `figma:react` is not available.
// For the Figma plugin build, set the `FIGMA_PLUGIN=true` environment variable
// and the Vite config will not alias `figma:react` to this file, so the
// real module will be available in the plugin runtime.

export function defineProperties(component: any, props?: any) {
  // No-op in web runtime. In the Figma plugin build, the real `figma:react`
  // module will be used instead, which implements this function.
  // Keep it synchronous here so it is safe to call during module init.
  return;
}

export default {
  defineProperties
};
