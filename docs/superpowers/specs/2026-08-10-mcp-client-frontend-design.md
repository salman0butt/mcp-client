# MCP Client Frontend Design

## Goal

Create a polished React + Tailwind CSS frontend for the existing MCP client in a standalone `client/` directory. This first pass is a frontend shell with realistic local state and mock transport boundaries; it must not modify the current CLI runtime.

## Product direction

The interface is a Claude Code–inspired developer workspace: quiet warm-dark surfaces, soft cream text, terracotta accents, restrained borders, and dense but breathable information hierarchy. It should feel like a focused MCP workbench rather than a generic chat app.

## Layout

- A left navigation rail contains the MCP Client identity, New chat action, conversation search, recent conversations, and utility actions.
- The center pane contains the runtime header, scrollable conversation, tool-call activity cards, and a bottom message composer.
- A right inspector contains the current connection state, MCP server metadata, available tools, and recent activity.
- On narrow screens, the inspector collapses first and the navigation becomes a drawer; the center conversation remains the primary surface.

## Visual system

- Base surfaces use near-black brown/espresso tones instead of pure black.
- Primary text uses a warm off-white; secondary text uses muted taupe.
- Terracotta/orange is reserved for primary actions, active states, status dots, and tool accents.
- Borders are low-contrast and rounded corners are used consistently for panels and controls.
- Typography uses a clean system sans stack with a compact monospace treatment for tool names, server paths, and JSON payloads.
- Icons come from `lucide-react` and must be paired with accessible labels or visible text.

## Interactions

- New chat resets the active conversation to an empty state.
- Conversation search filters the recent conversation list by title.
- Sending a message appends the user message, then inserts a local simulated assistant response with an MCP tool-call card.
- Tool-call cards expand and collapse their input/output details.
- The right inspector can be toggled without losing conversation state.
- A connection control toggles between connected and disconnected presentation states.
- Buttons, controls, and inputs provide keyboard focus styles and accessible labels.

## Frontend architecture

The new `client/` app uses Vite, React, TypeScript, Tailwind CSS, and `lucide-react`. The app is organized around a single page shell with focused presentational components and a small typed state model. The mock message submission boundary lives in the client layer so it can later be replaced by an HTTP or WebSocket transport without rewriting the visual components.

## Non-goals for this pass

- No browser process spawning for `.js` or `.py` MCP servers.
- No changes to `src/index.ts` or the existing MCP/Gemini CLI flow.
- No authentication, persistence, multi-user support, or deployment configuration.
- No image assets are required; the visual language is generated from layout, color, typography, and iconography.

## Verification

- The client must install and build from its own directory.
- The root TypeScript project must continue to build unchanged.
- The UI must render at desktop and narrow viewport widths without horizontal overflow.
- Core local interactions must be exercisable without a backend connection.
