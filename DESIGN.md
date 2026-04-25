# Design System: Forest & Slate
### Golf Score Tracker — Visual Identity & Component Guidelines

---

## 1. Design Principles

| Principle | Description |
|-----------|-------------|
| **Professional & Premium** | Deep greens evoke the atmosphere of a well-kept course. Nothing feels cheap or amateur. |
| **Clarity First** | Data is the hero. The UI exists to surface information, not to impress. |
| **Consistent & Predictable** | Every screen follows the same rules. Users should never be surprised by a component behaving differently than expected. |
| **Accessible** | Minimum 4.5:1 contrast ratio for all text. Interactive targets are at minimum 44×44px. |

---

## 2. Colour Palette

### 2.1 Primary — Forest Green

Used for: primary actions, active nav states, brand elements, key data highlights.

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#1B5E20` | Buttons, active tabs, links |
| `on-primary` | `#FFFFFF` | Text/icons on primary surfaces |
| `primary-container` | `#E8F5E9` | Subtle backgrounds, chips, badges |
| `on-primary-container` | `#002106` | Text on primary-container |

**Tonal scale (for hover, pressed, disabled states):**

| State | Hex | Notes |
|-------|-----|-------|
| Hover | `#155218` | Darken primary by ~8% |
| Pressed | `#0F3D12` | Darken primary by ~16% |
| Disabled | `#A5C8A8` | 40% opacity equivalent |

### 2.2 Secondary — Slate

Used for: secondary actions, supporting UI chrome, inactive states.

| Token | Hex | Usage |
|-------|-----|-------|
| `secondary` | `#475569` | Secondary buttons, body text accents |
| `on-secondary` | `#FFFFFF` | Text/icons on secondary surfaces |
| `secondary-container` | `#F1F5F9` | Table rows, input backgrounds |
| `on-secondary-container` | `#1E293B` | Text on secondary-container |

### 2.3 Surfaces

Used for: backgrounds, cards, sheets, containers.

| Token | Hex | Usage |
|-------|-----|-------|
| `surface` | `#F8FAFC` | Page/app background |
| `surface-dim` | `#E2E8F0` | Dividers, pressed states, skeleton loaders |
| `surface-bright` | `#FFFFFF` | Cards, modals, elevated containers |
| `surface-container` | `#F1F5F9` | Input fields, table headers |

### 2.4 Semantic Colours

Used for: score indicators, alerts, validation states.

| Token | Hex | Usage |
|-------|-----|-------|
| `error` | `#DC2626` | Errors, destructive actions, double bogey+ |
| `on-error` | `#FFFFFF` | Text on error backgrounds |
| `success` | `#15803D` | Confirmations, birdie/eagle indicators |
| `warning` | `#D97706` | Cautions, approaching limits |
| `outline` | `#94A3B8` | Borders, input outlines, dividers |
| `outline-variant` | `#CBD5E1` | Subtle dividers, disabled borders |

### 2.5 Score Colour Coding

A consistent system for displaying hole scores across the app.

| Result | Background | Text | Border |
|--------|------------|------|--------|
| Eagle (−2) | `#14532D` | `#FFFFFF` | — |
| Birdie (−1) | `#BBF7D0` | `#14532D` | — |
| Par (E) | `#F1F5F9` | `#1E293B` | `#94A3B8` |
| Bogey (+1) | `#FEF3C7` | `#92400E` | — |
| Double (+2) | `#FEE2E2` | `#991B1B` | — |
| Triple+ | `#DC2626` | `#FFFFFF` | — |

---

## 3. Typography

**Font family:** [Lexend](https://fonts.google.com/specimen/Lexend) — a variable font designed to reduce visual stress and improve readability at screen sizes.

**Load via Google Fonts:**
```
https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap
```

### 3.1 Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `heading-xl` | 28px | 700 Bold | 1.2 | Screen titles, hero stats |
| `heading-l` | 22px | 600 Semibold | 1.3 | Section headings, card titles |
| `heading-m` | 18px | 600 Semibold | 1.35 | Sub-section headings |
| `body-m` | 16px | 400 Regular | 1.6 | Body copy, descriptions |
| `body-s` | 14px | 400 Regular | 1.5 | Secondary body, helper text |
| `label-m` | 14px | 500 Medium | 1.0 | Button labels, nav labels |
| `label-s` | 12px | 500 Medium | 1.0 | Chips, badges, captions |
| `mono` | 14px | 400 Regular | 1.0 | Score numbers, par values, stat figures |

### 3.2 Rules

- **Never go below 12px.** Use `label-s` as the floor.
- **Numbers and scores** use `mono` (or `font-variant-numeric: tabular-nums`) to keep columns aligned.
- **Sentence case** everywhere. No ALL CAPS. No Title Case For Every Word.
- **Colour:** Primary text `#1E293B`, secondary text `#475569`, disabled text `#94A3B8`.

---

## 4. Shape & Spacing

### 4.1 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Small chips, score badges, table cells |
| `radius-md` | 8px | Cards, buttons, inputs, modals *(default)* |
| `radius-lg` | 12px | Bottom sheets, large modals |
| `radius-full` | 9999px | Pills, avatar circles, toggle switches |

### 4.2 Spacing Scale

Base unit: **4px**. All spacing is a multiple of 4.

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Icon-to-label gap, tight insets |
| `space-2` | 8px | Internal component padding |
| `space-3` | 12px | Card inner padding (compact) |
| `space-4` | 16px | Standard card padding, list item height |
| `space-5` | 20px | Section gaps |
| `space-6` | 24px | Between major sections |
| `space-8` | 32px | Page-level vertical rhythm |
| `space-12` | 48px | Between content blocks |

### 4.3 Elevation & Shadows

Shadows are used sparingly — only to separate interactive surfaces from the background.

| Level | Value | Usage |
|-------|-------|-------|
| `shadow-none` | none | Flat elements (table rows, dividers) |
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Cards, input fields |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.10)` | Dropdowns, popovers |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | Modals, bottom sheets |

---

## 5. Components

### 5.1 Buttons

| Variant | Background | Text | Border | Usage |
|---------|------------|------|--------|-------|
| Primary | `primary` `#1B5E20` | `#FFFFFF` | — | Main CTA per screen |
| Secondary | `#FFFFFF` | `primary` | `1px outline` | Supporting actions |
| Ghost | Transparent | `primary` | — | Tertiary actions, in-list actions |
| Destructive | `error` `#DC2626` | `#FFFFFF` | — | Delete, remove round |

**Anatomy:**
- Height: **44px** (touch target minimum)
- Padding: `12px 20px`
- Font: `label-m` (14px/500)
- Radius: `radius-md` (8px)
- Icon (optional): 20px, 8px gap to label, leading or trailing

**States:** Normal → Hover (darken bg 8%) → Pressed (darken 16%) → Disabled (40% opacity, no pointer events)

### 5.2 Cards

Standard container for courses, rounds, and stat summaries.

- Background: `surface-bright` `#FFFFFF`
- Border: `1px solid outline-variant` `#CBD5E1`
- Radius: `radius-md` (8px)
- Padding: `space-4` (16px)
- Shadow: `shadow-sm`
- On hover (if tappable): border becomes `outline` `#94A3B8`, shadow becomes `shadow-md`

### 5.3 Input Fields

- Height: **44px**
- Background: `surface-container` `#F1F5F9`
- Border: `1px solid outline` `#94A3B8`
- Border on focus: `2px solid primary` `#1B5E20`
- Border on error: `2px solid error` `#DC2626`
- Radius: `radius-md` (8px)
- Font: `body-m` (16px/400)
- Label: `label-s` (12px/500), positioned above the field, colour `#475569`
- Helper text: `body-s` (14px), below field, colour `#94A3B8`

### 5.4 Navigation

- Style: **bottom navigation bar** (mobile) or **side rail** (tablet/desktop)
- Active item: `primary` icon + label, `primary-container` background pill behind icon
- Inactive item: `#94A3B8` icon + label
- Font: `label-s` (12px/500)
- Background: `surface-bright` with `shadow-sm` on top edge

Suggested nav items:
1. Dashboard / Overview
2. Rounds
3. Courses
4. Stats

### 5.5 Score Badge

Used inline on round lists, hole-by-hole views, and scorecards.

- Size: **28×28px** (min touch target wrapper: 44px)
- Radius: `radius-sm` (4px)
- Font: `mono`, 14px/500
- Colours: see **§2.5 Score Colour Coding** above

### 5.6 Data Tables (Scorecard view)

- Header row: background `surface-container`, font `label-s`, colour `#475569`
- Body rows: alternating `surface-bright` / `surface` (`#FFFFFF` / `#F8FAFC`)
- Row height: **44px**
- Cell padding: `8px 12px`
- Border: `1px solid outline-variant` on rows only (no vertical borders)
- Sticky first column (hole number) on horizontal scroll
- Score cells: centred, use score badge component

### 5.7 Stat Cards

Used on the stats/dashboard screen for summary figures (handicap, rounds played, avg score).

- Layout: label above, large number below
- Label: `label-s` (12px/500), colour `#475569`
- Number: `heading-xl` (28px/700), colour `primary` `#1B5E20` for positive stats, `#1E293B` for neutral
- Background: `primary-container` `#E8F5E9` for highlight stat, `surface-container` for supporting stats
- Radius: `radius-md`, padding `space-4`

---

## 6. Icons

- **Style:** Outlined, thin stroke (1.5–2px). Recommended set: [Lucide](https://lucide.dev/) or [Phosphor](https://phosphoricons.com/) (Thin / Regular weight).
- **Sizes:** 20px (UI), 24px (nav), 16px (inline/label)
- **Colour:** Inherits from context. Active/brand: `primary`. Secondary/muted: `#94A3B8`.
- **Never mix styles** — pick one icon set and use it throughout.

---

## 7. Motion & Interaction

| Property | Value |
|----------|-------|
| Duration (micro) | 100ms — immediate feedback (button press) |
| Duration (standard) | 200ms — most transitions |
| Duration (expressive) | 300ms — screen transitions, modals |
| Easing (standard) | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Easing (enter) | `cubic-bezier(0, 0, 0.2, 1)` |
| Easing (exit) | `cubic-bezier(0.4, 0, 1, 1)` |

Animate only: `opacity`, `transform`. Never animate `height`, `width`, or `background-color` directly (use opacity/transform instead for performance).

---

## 8. Responsive Breakpoints

| Name | Min Width | Layout |
|------|-----------|--------|
| Mobile | 0px | Single column, bottom nav |
| Tablet | 600px | Two-column content, side nav rail |
| Desktop | 1024px | Expanded side nav, three-column grid for stats |

---

## 9. Do / Don't

| Do | Don't |
|----|-------|
| Use `primary` green only for the most important action per screen | Use green on decorative elements that aren't interactive |
| Keep score colour coding consistent across every view | Invent new score colours for special cases |
| Use `shadow-sm` on cards to lift them from the background | Stack multiple shadows |
| Maintain 44px minimum touch targets | Make tappable elements smaller for aesthetic reasons |
| Use `label-s` as the smallest text | Go below 12px for any reason |
| Use Lexend throughout | Mix in a second typeface |
| Align all numerical data with tabular nums | Let score columns shift width per row |
