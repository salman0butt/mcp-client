# MCP Client Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone React + Tailwind CSS MCP workspace in `client/` with a Claude Code–inspired visual system and realistic local interactions.

**Architecture:** Keep the existing Bun/TypeScript CLI under `src/` unchanged. Add a Vite-powered React app under `client/`, with typed mock data and state in `src/data.ts` and `src/types.ts`, a shell state controller in `App.tsx`, and focused layout components for navigation, conversation, composer, and inspector. The message submission boundary will be a local function that can later be replaced with HTTP or WebSocket transport.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS v4 via `@tailwindcss/vite`, and `lucide-react`.

## Global Constraints

- Keep the existing `src/index.ts` CLI runtime unchanged.
- Create the frontend in `client/`, not `web/`.
- Use warm espresso/charcoal surfaces, cream text, muted taupe, and terracotta accents.
- Use `lucide-react` icons with visible labels or accessible `aria-label` values.
- Do not add image assets or backend process spawning in this pass.
- The client must build independently and the root TypeScript project must continue to build.

## File map

- Create `client/package.json`: client scripts and runtime/build dependencies.
- Create `client/tsconfig.json`, `client/tsconfig.node.json`, `client/vite.config.ts`: Vite and TypeScript configuration.
- Create `client/index.html`: browser entry document and app title.
- Create `client/src/main.tsx`: React root mounting.
- Create `client/src/index.css`: Tailwind import, color tokens, global scrollbar/focus styles, and small reusable CSS primitives.
- Create `client/src/types.ts`: message, tool, conversation, and connection types.
- Create `client/src/data.ts`: initial conversations, tool catalog, server metadata, and sample messages.
- Create `client/src/App.tsx`: page-level state, mock send flow, and three-pane composition.
- Create `client/src/components/Sidebar.tsx`: brand, new-chat button, search, filtered conversations, and utility actions.
- Create `client/src/components/ChatHeader.tsx`: active model/runtime header and inspector toggle.
- Create `client/src/components/ConversationView.tsx`: message list, empty state, and auto-scrolling conversation surface.
- Create `client/src/components/MessageBubble.tsx`: user/assistant message styling and metadata.
- Create `client/src/components/ToolCallCard.tsx`: expandable MCP call presentation.
- Create `client/src/components/Composer.tsx`: multiline message form, action controls, connection state, and submit behavior.
- Create `client/src/components/Inspector.tsx`: connection card, server metadata, tools, and activity list.

---

### Task 1: Scaffold the standalone React client

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/tsconfig.node.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/index.css`

**Interfaces:**
- Produces a `client` package with `dev`, `build`, `preview`, and `typecheck` scripts.
- Mounts `<App />` from `client/src/main.tsx` into `#root`.

- [ ] **Step 1: Add the client package manifest**

Create `client/package.json` with React runtime dependencies, Vite/Tailwind development dependencies, and scripts:

```json
{
  "name": "mcp-client-ui",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --pretty false"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "@tailwindcss/vite": "latest",
    "lucide-react": "latest",
    "react": "latest",
    "react-dom": "latest",
    "tailwindcss": "latest",
    "typescript": "latest",
    "vite": "latest"
  },
  "devDependencies": {
    "@types/react": "latest",
    "@types/react-dom": "latest"
  }
}
```

- [ ] **Step 2: Add TypeScript and Vite configuration**

Configure strict TypeScript and React JSX, then configure Vite with the React plugin and Tailwind Vite plugin. `tsconfig.node.json` must include `vite.config.ts`; `tsconfig.json` must reference both configs.

- [ ] **Step 3: Add the HTML shell and React mount**

Set the document title to `MCP Client`, add a dark color-scheme meta tag, create `<div id="root"></div>`, and mount the app with `StrictMode` from `main.tsx`.

- [ ] **Step 4: Add initial global styling**

Import Tailwind with `@import "tailwindcss";`, set the espresso background and warm sans/mono font stacks, define CSS variables for the approved palette, style scrollbars, and add a visible `:focus-visible` outline.

- [ ] **Step 5: Install dependencies and verify the scaffold**

Run from `client/`:

```bash
bun install
bun run typecheck
```

Expected: dependency installation completes and typecheck reports no errors. `vite build` may still fail until `App.tsx` exists; complete it in Task 2 before treating the full build as green.

---

### Task 2: Define the typed local model and page state

**Files:**
- Create: `client/src/types.ts`
- Create: `client/src/data.ts`
- Create: `client/src/App.tsx`

**Interfaces:**
- `Message`, `ToolCall`, `Conversation`, `ServerTool`, and `ServerInfo` are exported from `types.ts`.
- `data.ts` exports `initialMessages`, `recentConversations`, `availableTools`, and `serverInfo`.
- `App.tsx` owns `messages`, `draft`, `searchQuery`, `showInspector`, `isConnected`, and `isResponding` state.

- [ ] **Step 1: Write the typed model**

Define:

```ts
export type MessageRole = "user" | "assistant";
export type ToolCallStatus = "running" | "success" | "error";

export interface ToolCall {
  id: string;
  name: string;
  summary: string;
  status: ToolCallStatus;
  duration: string;
  input: string;
  output: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  toolCall?: ToolCall;
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  time: string;
  tone: "orange" | "blue" | "green";
}

export interface ServerTool {
  name: string;
  description: string;
  category: string;
}

export interface ServerInfo {
  name: string;
  path: string;
  transport: string;
  version: string;
}
```

- [ ] **Step 2: Add realistic initial data**

Create a sample conversation about finding recent product feedback, including a user request, assistant answer, and one successful `search_feedback` tool call. Add at least five recent conversation rows and five available tools (`search_feedback`, `list_projects`, `get_issue`, `create_note`, `summarize_thread`) so the shell reads as a real MCP workbench.

- [ ] **Step 3: Add the page state and mock send flow**

In `App.tsx`, initialize the typed state from `data.ts`. `handleSend` must ignore blank drafts, append a user message, clear the draft, set `isResponding`, and after a short timeout append an assistant message with a successful `search_feedback` card. Use `crypto.randomUUID()` when available with a timestamp fallback so every appended item has a stable id.

- [ ] **Step 4: Compose the page shell**

Render a full-height flex layout with `<Sidebar />`, a center column containing `<ChatHeader />`, `<ConversationView />`, and `<Composer />`, plus an optional `<Inspector />`. Pass state and callbacks through explicit props rather than using a global store.

---

### Task 3: Build navigation and workspace chrome

**Files:**
- Create: `client/src/components/Sidebar.tsx`
- Create: `client/src/components/ChatHeader.tsx`

**Interfaces:**
- `Sidebar` consumes `conversations`, `searchQuery`, `onSearchChange`, `onNewChat`, and `onSelectConversation`.
- `ChatHeader` consumes `isConnected`, `onToggleConnection`, `onToggleInspector`, and `showInspector`.

- [ ] **Step 1: Build the sidebar structure**

Use a fixed desktop width around `17rem`, a subtle right border, brand mark, `New chat` button, search field with `Search` icon, filtered recent conversation list, and bottom utility rows. Every icon-only control must include an `aria-label`.

- [ ] **Step 2: Style conversation rows and active states**

Use low-contrast hover states, a warm terracotta active row, title/preview truncation, relative time labels, and small colored status dots. The list must render the filtered result directly from `searchQuery`; when there are no matches, show a compact empty message.

- [ ] **Step 3: Build the runtime header**

Show the MCP Client title, a connected/disconnected dot with text, the current model label `gemini-2.5-flash`, and an inspector toggle button. Add a connection toggle control that updates its label and dot color.

- [ ] **Step 4: Verify keyboard and responsive behavior**

Use semantic `nav`, `header`, buttons, and inputs. Add breakpoint classes so the sidebar becomes a fixed overlay/drawer affordance on narrow screens while preserving the center pane’s minimum usable width.

---

### Task 4: Build the conversation, tool activity, and composer

**Files:**
- Create: `client/src/components/ConversationView.tsx`
- Create: `client/src/components/MessageBubble.tsx`
- Create: `client/src/components/ToolCallCard.tsx`
- Create: `client/src/components/Composer.tsx`

**Interfaces:**
- `ConversationView` consumes `messages` and `isResponding`.
- `MessageBubble` consumes one `Message`.
- `ToolCallCard` consumes one `ToolCall`.
- `Composer` consumes `draft`, `onDraftChange`, `onSubmit`, `isResponding`, and `isConnected`.

- [ ] **Step 1: Render message states**

Render a centered conversation column with a compact assistant avatar, role labels, timestamps, user message card, assistant prose, and a loading row while `isResponding` is true. Preserve readable line lengths and use `whitespace-pre-wrap` for message content.

- [ ] **Step 2: Add the expandable MCP tool card**

Render the tool name in monospace, status icon, duration, summary, and a chevron button. Keep details collapsed by default; clicking the header toggles a details region showing `input` and `output` in dark code blocks. Use `aria-expanded` and `aria-controls`.

- [ ] **Step 3: Build the composer**

Use a rounded bordered form anchored at the bottom of the center column. Include a textarea, attachment/action buttons, a connection label, model selector label, and terracotta submit button. Submit on `Ctrl+Enter`/`Cmd+Enter` while preserving ordinary Enter for newlines; disable submit for blank drafts or while a response is running.

- [ ] **Step 4: Make the conversation scroll naturally**

Use a scrollable center region, keep the composer visible, and scroll to the newest message when `messages` changes using a bottom sentinel ref. Ensure long tool payloads wrap or scroll inside their code block without creating page-level horizontal overflow.

---

### Task 5: Build the MCP inspector and finish responsive polish

**Files:**
- Create: `client/src/components/Inspector.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/index.css`

**Interfaces:**
- `Inspector` consumes `isConnected`, `serverInfo`, `availableTools`, and `onClose`.

- [ ] **Step 1: Build the connection card**

Show `Connected`/`Disconnected`, server name, path, transport, version, and a small green/orange status indicator. Add a close button for narrow layouts.

- [ ] **Step 2: Render the available tools catalog**

Render all five typed tools with category labels and descriptions, using compact cards that reinforce the same surface/border system as tool calls in the conversation.

- [ ] **Step 3: Add recent activity and inspector transitions**

Add a small activity list using realistic timestamps and status icons. Apply subtle enter/exit/opacity transitions where useful, but keep the app usable with reduced-motion preferences.

- [ ] **Step 4: Verify desktop and narrow layout contracts**

Confirm the three-pane desktop layout, inspector collapse, drawer sidebar, and no horizontal overflow at narrow widths. Add only the CSS needed for these behaviors; do not introduce a new component library.

---

### Task 6: Verify the complete frontend and existing CLI

**Files:**
- Modify only if verification finds a type/style issue in `client/`.

- [ ] **Step 1: Build and typecheck the client**

Run:

```bash
cd client
bun run typecheck
bun run build
```

Expected: both commands exit 0 and produce `client/dist/`.

- [ ] **Step 2: Build the existing root project**

Run from the repository root:

```bash
bun run build
```

Expected: the existing TypeScript sources compile successfully; no root source file is changed by the frontend work.

- [ ] **Step 3: Inspect the rendered app**

Run `cd client && bun run dev -- --host 127.0.0.1`, open the local Vite URL, and check the approved desktop and narrow layouts. Exercise New chat, search, send, tool expand/collapse, connection toggle, and inspector toggle.

- [ ] **Step 4: Record verification**

Because the workspace is not a Git repository, do not attempt a commit. Report the exact build/typecheck commands run and any manual UI checks completed.

---

## Plan self-review

- Spec coverage: layout is covered by Tasks 3–5; visual system by Tasks 1, 3, and 5; interactions by Tasks 2–5; non-goals by the unchanged root project and no backend work; verification by Task 6.
- Placeholder scan: no `TBD`, `TODO`, or undefined implementation step remains.
- Type consistency: component prop names and exported model names are defined in the file map and reused consistently in later tasks.
- Scope: the plan covers one frontend subsystem with a local mock transport boundary; backend wiring remains intentionally out of scope.
