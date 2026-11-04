/**
 * The plugin's entire visual surface.
 *
 * One stylesheet is installed for the plugin, not one `<style>` per card: a
 * conversation can hold dozens of diagrams, and repeating the same sheet inside
 * every card wastes nodes and leaves the fullscreen overlay unstyled. Rules use
 * only `--dsw-*` theme tokens, so light and dark follow the host.
 */
const STYLE_ATTRIBUTE = 'data-plugin-css'
const STYLE_ID = 'mermaid-pele'

const PLUGIN_CSS = `
.dsh-mermaid-scope{--pele-bg:var(--dsw-alias-bg-base,#fff);--pele-fg:var(--dsw-alias-label-primary,#1f1f1f);--pele-muted:var(--dsw-alias-label-secondary,#6e6e6e);--pele-line:var(--dsw-alias-label-secondary,#1f1f1f);--pele-surface:var(--dsw-alias-bg-layer-2,#f3f3f3);--pele-surface-alt:var(--dsw-alias-bg-layer-2,#e6e4d9);--pele-border:var(--dsw-alias-border-l2,#8a8a8a);--pele-accent:var(--dsw-alias-brand-primary,#5b7bd5);--pele-critical:var(--dsw-alias-state-error-primary,#e45756);--pele-error:var(--dsw-alias-state-error-primary,#e45756)}
.dsh-mermaid-card{display:flex;flex-direction:column;gap:6px;margin:4px 0;padding:8px 10px 10px;box-sizing:border-box;max-width:100%;font-family:inherit;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary)}
.dsh-mermaid-panel{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:8px;padding:12px 14px 14px;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dsh-mermaid-head{display:flex;align-items:center;gap:6px;min-width:0;min-height:20px;color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:20px}
.dsh-mermaid-icon{flex:none;display:block}
.dsh-mermaid-title{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-mermaid-chip{flex:none;padding:0 6px;border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary))}
.dsh-mermaid-actions{margin-left:auto;flex:none;display:inline-flex;align-items:center;gap:2px}
.dsh-mermaid-action{display:inline-flex;align-items:center;gap:4px;flex:none;padding:2px 6px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;line-height:16px;cursor:pointer}
.dsh-mermaid-action:hover{background:var(--dsw-alias-interactive-bg-hover-solid,rgba(127,127,127,.12))}
.dsh-mermaid-copy{opacity:0;transition:opacity .1s}
.dsh-mermaid-card:hover .dsh-mermaid-copy,.dsh-mermaid-card:focus-within .dsh-mermaid-copy{opacity:1}
.dsh-mermaid-body{overflow:auto;overscroll-behavior:contain;max-width:100%}
.dsh-mermaid-body svg{display:block;margin:0 auto}
.dsh-mermaid-body-fill{flex:1 1 auto;min-height:0;overflow:hidden;display:flex}
.dsh-mermaid-body-fill>svg,.dsh-mermaid-body-fill>div{flex:1 1 auto;min-height:0}
.dsh-mermaid-note{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:20px}
.dsh-mermaid-note-error{color:var(--dsw-alias-state-error-primary)}
.dsh-mermaid-error{margin:0;color:var(--dsw-alias-state-error-primary);font:var(--dsw-font-markdown-code-block-small,12px/18px monospace);white-space:pre-wrap;overflow-wrap:anywhere}
.dsh-mermaid-overlay{position:fixed;inset:0;z-index:1000;box-sizing:border-box;padding:clamp(12px,3vh,32px);display:flex;flex-direction:column;background:color-mix(in srgb,var(--dsw-alias-bg-base) 88%,transparent);backdrop-filter:blur(8px)}
.dsh-mermaid-zoom button:hover{background:var(--dsw-alias-interactive-bg-hover-solid,rgba(127,127,127,.12))}
@media (prefers-reduced-motion:reduce){.dsh-mermaid-copy{transition:none}}
`.trim()

/**
 * Install the stylesheet once for the document.
 * @param doc - the browser document the plugin renders into.
 * @returns the disposer that removes this plugin's sheet.
 */
export function installStyles(doc: Document): () => void {
  if (doc.querySelector(`style[${STYLE_ATTRIBUTE}="${STYLE_ID}"]`) !== null) return () => {}
  const style = doc.createElement('style')
  style.dataset.plugin = '@phatg/dsh-pele'
  style.dataset.pluginCss = STYLE_ID
  style.textContent = PLUGIN_CSS
  doc.head.append(style)
  return () => {
    style.remove()
  }
}
