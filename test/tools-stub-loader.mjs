const STUB = new URL('./tools-stub.mjs', import.meta.url).href

export async function resolve(specifier, context, next) {
  if (specifier === '@deepseek-ai/dsh-tools') return { url: STUB, shortCircuit: true }
  return next(specifier, context)
}
