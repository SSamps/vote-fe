# Vote — Visual Design

This document defines the visual language for the Vote application. All UI work should follow these guidelines to produce a consistent, polished result.

See [`front-end-guidelines.md`](front-end-guidelines.md) for the technical implementation of these decisions (CSS Modules, custom properties, etc.).

---

## Design principles

- **Minimal and focused** — teams open this during a meeting. The UI should be immediately comprehensible with zero learning curve.
- **Clear state** — at a glance, participants should know: what stage are we in, who has voted, what have I selected.
- **Low distraction** — neutral palette, no decorative elements, no animation beyond functional feedback.

---

## Colour palette

All colours are defined as CSS custom properties in `src/index.css`.

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#f5f5f5` | Page background |
| `--color-surface` | `#ffffff` | Cards, input backgrounds, sidebar |
| `--color-border` | `#e0e0e0` | Borders on cards, inputs, dividers |
| `--color-text` | `#1a1a1a` | Body text, labels |
| `--color-text-muted` | `#666666` | Secondary text, descriptions, placeholders |
| `--color-primary` | `#2563eb` | Primary buttons, focus rings, selected vote button |
| `--color-primary-hover` | `#1d4ed8` | Primary button hover state |
| `--color-success` | `#16a34a` | Voted indicator (checkmark) |
| `--color-error` | `#dc2626` | Inline error messages |

The palette is intentionally limited. Do not introduce additional colours without updating this document.

---

## Typography

**Font family:** System font stack — `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

No custom font is loaded. The system stack renders sharply on all platforms and requires no network request.

**Type scale:**

| Token | Size | Weight | Usage |
|---|---|---|---|
| — | `2.5rem` | 700 | App title on landing page |
| — | `1.25rem` | 600 | Card headings, section headings |
| — | `1rem` | 400 | Body text |
| — | `0.95rem` | 400/500 | Inputs, buttons |
| — | `0.875rem` | 400 | Secondary/descriptive text |
| — | `0.8rem` | 400 | Compact labels (e.g. sidebar participant names) |

**Line height:** `1.5` for body text; `1.2` for headings.

---

## Spacing

Base unit: `4px`. Use multiples of this unit for all margins, padding, and gaps.

| Value | Typical usage |
|---|---|
| `4px (0.25rem)` | Icon gaps, tight inline spacing |
| `8px (0.5rem)` | Gap between form label and input |
| `12px (0.75rem)` | Gap between list items |
| `16px (1rem)` | Standard gap, inner padding for compact elements |
| `24px (1.5rem)` | Card padding, section gaps |
| `32px (2rem)` | Larger section separation |
| `48px (3rem)` | Page-level vertical rhythm |

---

## Shape and shadow

- **Border radius:** `8px` for cards, inputs, and buttons. Use `50%` only for circular avatar-style elements (not currently in the design).
- **Borders:** `1px solid var(--color-border)` on cards and inputs.
- **Box shadow:** Subtle only — `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)`. Applied to cards, not buttons.
- **No elevation layers** — there is no overlay/modal system in the current design.

---

## Buttons

Two button variants:

### Primary button

- Background: `var(--color-primary)`
- Text: white, `0.95rem`, weight 500
- Hover: `var(--color-primary-hover)`
- Disabled: `opacity: 0.6`
- Padding: `0.7rem 1.25rem`
- Full width when it is the sole action in a card.

### Secondary / outline button

- Background: `var(--color-surface)`
- Border: `1px solid var(--color-border)`
- Text: `var(--color-text)`
- Hover background: `var(--color-bg)`
- Same padding and font as primary.
- Used for lower-priority actions alongside a primary button (e.g. Join alongside an input field), or for the Reset action.

### Facilitator action buttons (End voting, Reset)

These sit in the facilitator toolbar. Use the **secondary** style for Reset (destructive but reversible) and **primary** for End voting.

---

## Vote buttons

Vote buttons are the core interaction surface. They must be immediately recognisable and satisfying to use.

- **Size:** minimum `64px × 64px`, ideally `72px × 72px` on desktop.
- **Number label:** `1.25rem`, weight 700, centred.
- **Unselected state:** white background, `var(--color-border)` border, `var(--color-text)` label.
- **Hover (unselected):** border colour shifts to `var(--color-primary)`, light blue tint background (`rgba(37,99,235,0.06)`).
- **Selected state:** `var(--color-primary)` background, white label, no border shadow.
- **Disabled (review stage):** the selected button shows a muted/greyed version; unselected buttons are faded and non-interactive.
- **Transition:** `background 0.1s, border-color 0.1s` — fast enough to feel snappy, not instant.
- **Gap between buttons:** `12px`.
- **Layout:** the five buttons sit in a horizontal row, centred in the voting area.

---

## Participant list

Each participant row in the sidebar shows:

- **Name** (adjective-animal, `0.875rem`, normal weight, `var(--color-text)`)
- **Status indicator** (right-aligned):
  - Voted: `✓` in `var(--color-success)`, weight 600
  - Not yet voted: `–` in `var(--color-text-muted)`

Row height: `36px`. Rows are separated by a `4px` gap, not borders.

The sidebar has a left border (`1px solid var(--color-border)`) separating it from the voting area.

---

## Results display (review stage)

When the facilitator ends voting, results replace the vote buttons in the main area:

- **Average vote** shown as a large number: `3rem`, weight 700.
- Label below the number: "Average" in `var(--color-text-muted)`, `0.875rem`.
- Future stats (distribution, median, mode) will appear here once designed.

---

## Room layout

```
┌─────────────────────────────────────────────────────┐
│  Facilitator toolbar (full width, 48px tall)         │
│  [Stage indicator]              [End voting / Reset] │
├───────────────────────────────────┬─────────────────┤
│                                   │                 │
│   Voting area (flex: 1)           │  Sidebar 240px  │
│                                   │                 │
│   [ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]  Participants  │
│                                   │  ─────────────  │
│   or: results when in review      │  gentle-otter ✓ │
│                                   │  radiant-fox  – │
│                                   │                 │
│   [Your name — bottom left]       │                 │
└───────────────────────────────────┴─────────────────┘
```

- **Facilitator toolbar:** `48px` tall, `var(--color-surface)` background, bottom border, horizontal padding `24px`. Participants who are not facilitators do not see this bar.
- **Voting area:** fills available space (`flex: 1`). Voting buttons are centred vertically and horizontally.
- **Sidebar:** fixed `240px` wide, full height of the content area, left border. Scrolls independently if participant count overflows.
- **Your name tag:** positioned bottom-left of the voting area, muted style.

---

## Landing page layout

Centred, single-column. Max content width `420px`.

```
        Vote
  Fast, anonymous voting for your team

  ┌──────────────────────────────────┐
  │  Start a session                 │
  │  Create a room and share the     │
  │  link with your team.            │
  │                                  │
  │  [ Start a session ]             │
  └──────────────────────────────────┘

               — or —

  ┌──────────────────────────────────┐
  │  Join a session                  │
  │  Enter a room code or paste the  │
  │  link from your facilitator.     │
  │                                  │
  │  [room code or URL…]  [ Join ]   │
  └──────────────────────────────────┘
```

---

## Responsive behaviour

Single breakpoint at `640px`.

- **Below 640px:** The room layout collapses to a single column — sidebar moves below the voting area.
- **Facilitator toolbar** stacks its label and button vertically below `640px` if needed.
- **Vote buttons** remain `64px` minimum, row wraps if necessary.
- The landing page is already single-column and needs no changes.

---

## What to avoid

- Gradients, drop shadows on interactive elements, or decorative imagery.
- Colour as the sole differentiator for state — always pair with a text/icon indicator.
- Animations beyond `0.1–0.15s` transitions on interactive states.
- Custom scrollbars.
- More than two font weights on a single screen.
