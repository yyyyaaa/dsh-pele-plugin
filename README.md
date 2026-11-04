# dsh-pele-plugin

Mermaid diagrams as themeable SVG cards in the [DeepSeek Harness](https://www.deepseek.com/en/harness/) chat, rendered with [Pele](https://pele.run).

The model calls a `mermaid` tool with Mermaid source. The Host half validates that source with Pele before it reaches the browser, so a broken diagram comes back as a fixable error naming the line and column. The Client half draws it in the conversation with the same renderer, in the Harness's own theme.

Pele renders every diagram type built into Mermaid 12, ships no dependencies, and themes through CSS variables — this plugin maps those onto the Harness's design tokens, so light and dark follow the host.

## What you get

- A card per diagram in the conversation, with the diagram type, a title you can pass, and a copy-the-source action.
- The same diagram again at the end of the turn. A completed turn folds its process rows, so the card alone would disappear; the turn-tail copy is what stays visible.
- Zoom in, zoom out, and reset on every card, plus drag-to-pan, pinch, `+` / `-` / `0` / `Esc`, and a fullscreen view that opens above every column.
- Failures stay in the card: the tool error, including the position Pele reported.

## Requirements

- A DeepSeek Harness build with agent plugin profiles (the `conversation.chat.turnTail` and `shell.overlay` slots).
- Node 22 or newer, only to build from source. The published package ships built artifacts.

## Install

Install the bundle into your Harness profile by package name:

```
@phatg/dsh-pele
```

The bundle's `cordis.patch.yml` inserts its own plugin row, so selecting the bundle is the whole setup. There is no configuration to write: the plugin adds the `mermaid` tool and a short standing instruction telling models to call it for diagrams instead of writing a fenced block.

## Use

Ask for a diagram the way you would ask a person — "draw the request lifecycle through these services" — and the model calls the tool. Diagrams written as ```` ```mermaid ```` fences are plain code blocks; the plugin does not rewrite model output.

## Development

```sh
pnpm install
pnpm build        # dist/index.js, dist/client.js, dist/client.pele.js
pnpm typecheck
pnpm test         # Vitest: host in Node, client in real Chromium
pnpm check        # all three
```

The browser suite needs a headless browser once per machine:

```sh
pnpm exec playwright install chromium-headless-shell
```

`dist/` is build output and is not committed. A `link:` install into a Harness profile does not run `prepare`, so run `pnpm build` before reloading the Harness after a change.

## Releasing

`prepack` rebuilds `dist/`, so `pnpm pack` and `npm publish` always ship fresh artifacts. Pushing a `v*` tag runs `.github/workflows/release.yml`, which checks the package and publishes with provenance; it needs an `NPM_TOKEN` repository secret.

## License

MIT. Pele itself is MIT, by kepano.
