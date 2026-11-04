/** Namespace the dictionaries are registered under, and the `locale` slot option. */
export const NS = 'mermaid-pele'

/** Locales this plugin ships. */
type Locale = 'en' | 'zh'

/**
 * One row per message, one column per locale.
 *
 * The locale service looks a key up verbatim and falls back to the key itself, so
 * keys stay flat and dotted. Keeping both locales on the same row means a message
 * cannot exist in one language only, which two parallel dictionaries would allow.
 */
const MESSAGES: Record<string, Record<Locale, string>> = {
  'card.title': { en: 'Mermaid diagram', zh: 'Mermaid 图表' },
  'card.preparing': { en: 'Preparing diagram…', zh: '正在准备图表…' },
  'card.rendererLoading': { en: 'Loading diagram renderer…', zh: '正在加载图表渲染器…' },
  'card.rendererFailed': { en: 'The diagram renderer could not load.', zh: '图表渲染器加载失败。' },
  'card.copy': { en: 'Copy Mermaid source', zh: '复制 Mermaid 源码' },
  'card.copied': { en: 'Copied', zh: '已复制' },
  'card.error': { en: 'Diagram failed', zh: '图表渲染失败' },
  'card.fullscreen': { en: 'Open fullscreen', zh: '全屏查看' },
  'card.exitFullscreen': { en: 'Close fullscreen', zh: '关闭全屏' },
  'zoom.in': { en: 'Zoom in', zh: '放大' },
  'zoom.out': { en: 'Zoom out', zh: '缩小' },
  'zoom.reset': { en: 'Reset zoom', zh: '重置缩放' },
}

/**
 * Project the message table onto one locale.
 * @param locale - the locale to read.
 * @returns the flat dictionary the locale service registers.
 */
function dictionary(locale: Locale): Record<string, string> {
  const entries = Object.entries(MESSAGES).map(([key, messages]) => [key, messages[locale]])
  return Object.fromEntries(entries)
}

export const en = dictionary('en')
export const zh = dictionary('zh')
