---
name: Brindle
description: A dispatcher's job board on cool white sheets and service navy; hi-vis orange appears only where work is at risk or where "today" is.
colors:
  surface-page: "#f4f6f8"
  surface: "#ffffff"
  surface-sunken: "#eef1f4"
  ink: "#13283d"
  ink-secondary: "#4a5a6a"
  line: "#d5dce3"
  line-strong: "#b9c4cf"
  line-control: "#7a8896"
  rail: "#13283d"
  rail-deep: "#0f2236"
  rail-active: "#1f3b57"
  rail-line: "#2a4561"
  rail-text: "#e8eef4"
  rail-muted: "#9fb3c8"
  action: "#13283d"
  action-hover: "#1f3b57"
  focus-ring: "#1d5fb8"
  focus-ring-on-rail: "#8dbbff"
  signal: "#e8590c"
  signal-ink: "#b4420b"
  signal-on-rail: "#ff8a3d"
  signal-tint: "#fff1e8"
  danger: "#b42318"
  danger-tint: "#fef0ee"
  warning: "#a64b00"
  success: "#066a42"
  status-open: "#3f4d5c"
  status-open-tint: "#eef1f4"
  status-progress: "#1849a9"
  status-progress-tint: "#eaf1fd"
  status-blocked: "#8a3a0a"
  status-blocked-tint: "#fef3e2"
  status-completed: "#066a42"
  status-completed-tint: "#e8f7ee"
  status-cancelled: "#5a6573"
  status-cancelled-tint: "#f2f4f7"
typography:
  display:
    fontFamily: "Schibsted Grotesk, system-ui, Arial, sans-serif"
    fontSize: "clamp(2.75rem, 1.6rem + 3.4vw, 4.75rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  display-2:
    fontFamily: "Schibsted Grotesk, system-ui, Arial, sans-serif"
    fontSize: "clamp(2rem, 1.35rem + 2.4vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  h1:
    fontFamily: "Schibsted Grotesk, system-ui, Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Schibsted Grotesk, system-ui, Arial, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  wordmark:
    fontFamily: "Schibsted Grotesk, system-ui, Arial, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  table:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.5
  caption:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  micro:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.25
rounded:
  control: "4px"
  panel: "6px"
  sheet: "10px"
  full: "9999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "14": "56px"
  "16": "64px"
  "20": "80px"
  "24": "96px"
  "28": "112px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "#ffffff"
    typography: "{typography.table}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.table}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-sunken}"
  button-inverse:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    typography: "{typography.table}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "48px"
  text-link:
    textColor: "{colors.ink}"
    typography: "{typography.table}"
    height: "44px"
  rail:
    backgroundColor: "{colors.rail}"
    width: "240px"
    padding: "20px 12px"
  nav-item:
    textColor: "{colors.rail-text}"
    typography: "{typography.table}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  nav-item-current:
    backgroundColor: "{colors.rail-active}"
    textColor: "#ffffff"
  status-badge:
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  risk-chip:
    backgroundColor: "{colors.signal-tint}"
    textColor: "{colors.signal-ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  board-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
  board-row-overdue:
    backgroundColor: "{colors.signal-tint}"
    padding: "12px 20px"
  contact-pending:
    textColor: "{colors.ink-secondary}"
    typography: "{typography.table}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
---

# Design System: Brindle

## Overview

**Creative North Star: "The Signal Board"**

Brindle is dispatch-board paper: cool white sheets ruled with hairlines on a cool grey field, deep service-navy ink and navy bands, and one hi-vis safety orange that appears only where work is at risk or where "today" sits. Headlines are set in Schibsted Grotesk, heavy and tight; references, dates, times, and due labels are set in JetBrains Mono; everything you read at length is the system UI stack. The result is calm by default and loud only for risk.

Two surfaces share one world. The public landing page (Persuade) leads with a heavy navy headline beside a large white board sheet, a working sample board whose rows are synthetic and labeled "Sample data · illustrative"; dragging the sample day re-derives every due label and re-sorts rows by risk. The application (Operate) is a 240px navy rail and a single column of open text on the grey field, ruled by hairlines rather than boxed in cards. Sign-in is a split screen: a navy brand panel (with a compact sample board on large screens) beside the form.

Every state is honest. Unbuilt areas (dashboard, work-order list, analytics) say so in words and list what is planned, with no sample data, numbers, skeletons, or controls in their place. Sample content on the landing page and sign-in panel is always labeled as sample data. Status and risk always pair an icon or mark with words. The product rejects decorative cards around every item, excessive gradients, glass, 3D, and heavy animation (PRODUCT.md).

**Key Characteristics:**
- Navy is both the ink and the frame: text, primary buttons, the rail, the workflow band, the contact band, and the sign-in panel.
- Cool grey field, white sheets, 1px hairline rules; content is ruled lists and open text, not card grids.
- One hi-vis orange, reserved for risk (overdue) and the current/today marker, including the brand mark's "today" line.
- Three families with fixed jobs: Schibsted Grotesk for headings, JetBrains Mono for references and time, system UI for body.
- One soft shadow, only for sheets that sit on a field.
- Status is always icon plus text; status tints are pale and the text carries the meaning.

## Colors

A low-chroma navy-and-grey world with a single hi-vis orange for risk, a blue used only for focus, and red only for errors.

### Primary
- **Service Navy** (`ink`, `rail`, `action`): one value with three jobs. As ink it is all primary text and headings; as rail it is the app rail, mobile top bar, landing workflow band, and sign-in brand panel; as action it fills primary buttons ("Sign in"). Hover lifts to **Lit Navy** (`action-hover`).

### Secondary
- **Deep Navy** (`rail-deep`): the darker contact band at the foot of the landing page, activity-trail entry panels, and the avatar disc in the user panel.
- **Lit Navy** (`rail-active`): the current navigation item's fill, nav hover at 60%, and dividers inside the rail.
- **Rail Seam** (`rail-line`): hairlines and borders on navy (the activity-trail spine, entry panels, the contact band's top rule, the avatar ring, the pending-contact border on navy).
- **Rail Frost** (`rail-text`) and **Rail Haze** (`rail-muted`): body and secondary text on navy. Headings and the current item on navy are pure white.

### Tertiary
- **Hi-Vis Orange** (`signal`): marks and fills only, never text (3.58:1). The sample board's "today" marker on the day ruler, flag-icon fills on overdue labels, the bars of a Critical priority icon, and the "today" line in the brand mark.
- **Signal Ink** (`signal-ink`): orange as text on light surfaces: overdue due labels, the overdue count, the "Overdue 1 day" chip.
- **Signal on Navy** (`signal-on-rail`): the 3px current-location indicator on the rail (nav items and the profile link).
- **Risk Wash** (`signal-tint`): the fill of overdue rows on the sample board and of risk chips.
- **Focus Blue** (`focus-ring`) and **Sky Focus** (`focus-ring-on-rail`): the 2px focus outline on light and on navy, plus the text caret and the selection wash (20% blue in white). Blue has no other job.
- **Error Red** (`danger`) on **Error Blush** (`danger-tint`): the sign-in error summary (blush fill, red text and icon, red border at 30%), inline field errors, and invalid-input borders. Nothing else.

### Status and due tones
Five status pairs (`status-open`, `status-progress`, `status-blocked`, `status-completed`, `status-cancelled`, each with a `-tint`) color the status badges on the sample board: pale tint fill, darker text, always with an icon and the word. Due labels on the sample board take a tone by risk: Signal Ink when overdue, `warning` amber for "Due today", ink for soon, Slate Ink for later, `success` green for done. `warning-tint`, `success-tint`, and the `h3` size are defined in `globals.css` but no built component uses them.

### Neutral
- **Cool Field** (`surface-page`): the page background everywhere, and the day-ruler strip (at 60%) inside the sample board.
- **Sheet White** (`surface`): the sample board, principle proof sheets, inputs, and the secondary button.
- **Sunken Grey** (`surface-sunken`): secondary and inverse button hover, the "Sample data" pill, and loading blocks.
- **Slate Ink** (`ink-secondary`): descriptions, hints, metadata, "(required)", placeholders, and definition terms.
- **Hairline** (`line`): row dividers, the page-header rule, and sheet borders.
- **Strong Rule** (`line-strong`): the outer rule of ruled lists (planned items, principles, profile), the day-ruler baseline, and text-link underlines at rest.
- **Control Edge** (`line-control`): input and secondary-button borders, the pending-contact dashed border, and future ticks on the day ruler.

### Named Rules
**The Orange Means Risk Rule.** Hi-vis orange marks only overdue risk, Critical priority, and the current/today position (the day-ruler marker, the rail's current indicator, the brand mark's "today" line). It never decorates or emphasizes anything else.

**The Navy Is Ink Rule.** Primary actions are filled with the same navy as the text and the frame. There is no separate brand accent color.

**The Blue Is Focus Rule.** Blue is reserved for focus, caret, and selection (and the In-progress status pair). It is never an action or link color.

**The Red Means Error Rule.** Red appears only for errors, always with an icon and words.

## Typography

**Display Font:** Schibsted Grotesk (variable, self-hosted latin subset; falls back to system-ui, Arial)
**Body Font:** system UI stack (`system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`)
**Label/Mono Font:** JetBrains Mono (variable, self-hosted latin subset; falls back to ui-monospace, Menlo)

**Character:** A heavy, tightly tracked grotesk does the shouting, a native UI sans does the reading, and a mono carries anything that is a record: references, dates, times, and due labels. Fonts are served from the app's own origin with no third-party requests.

### Hierarchy
- **Display** (800, fluid 44 to 76px, line-height 0.98, -0.035em): the landing hero headline only.
- **Display 2** (800, fluid 32 to 56px, 1.02, -0.035em): landing section headings, the sign-in panel headline, the contact band, and the "Page not found" heading.
- **H1** (700, 36px, 1.08, -0.02em): app page titles and the sign-in heading; at 800 for the principle titles and the "Something went wrong." heading.
- **H2** (800, 26px, 1.2, -0.02em): honest-state headings ("No work orders yet", "You don't have access to this page."); at 700 for workflow step names on navy.
- **Wordmark** (700, 21px, line-height 1, -0.02em): "Brindle" beside the mark.
- **Lead** (400, 19px, 1.55): the hero promise from 640px up (body size below).
- **Body** (400, 16px, 1.5): descriptions, planned-item lists, inputs, profile values; descriptions cap at 40 to 60ch.
- **Table** (14px): buttons and links (600), nav labels (500), board row titles (600), longer captions on navy.
- **Label** (600, 13px): field labels, list headings such as "Planned for this area", definition terms; at 400 for hints and inline errors.
- **Caption** (400, 12px): footnotes ("Examples use sample data."), board metadata, badges (600), the role line in the rail.
- **Mono** (12 to 13px): references (WO-000118), dates and times, due labels (600), activity-trail entries, the "Sample data · illustrative" pill, the error reference code. **Micro** mono (11px) is used only for weekday ticks on the day ruler.

### Named Rules
**The Three Jobs Rule.** Schibsted Grotesk is for headings and the wordmark; JetBrains Mono is for things that are records (references, dates, times, due labels, codes); the system stack is for everything read as prose or operated as UI. Families never swap jobs.

**The Heavy-and-Tight Rule.** Grotesk headings are 700 or 800 with negative tracking (-0.02em headings, -0.035em display) and balanced wrapping.

## Layout

- **Container:** public pages use one 1152px (`max-w-6xl`) container with 16 / 24 / 32px side padding at phone / 640px / 1024px; the header, every section, and the footer share it so the wordmark aligns with content.
- **Landing hero (1024px and up):** a 6:7 two-column grid; promise top left, actions bottom left, the board sheet spanning both rows on the right and bleeding 64px past the container edge. Below 1024px the DOM order puts the board directly after the promise so it lands in the first viewport. Sections breathe at 80px vertical padding (112px at 1024px).
- **Bands:** full-bleed navy (workflow) and deep navy (contact) bands break the grey field; the workflow band is a 4:8 split with a sticky intro column and a vertical activity-trail spine.
- **Principles:** a ruled list, each row a 6:5 split of heading and text beside its proof sheet.
- **App shell (768px and up):** a sticky full-height 240px navy rail (wordmark, role-aware nav, user panel pinned to the bottom) and a content column with 48px padding, centered at 1024px max, 32px between blocks.
- **App shell (below 768px):** a 56px navy top bar with the wordmark and a "Menu" button; the menu expands in place (in flow, not an overlay). Content padding is 16px sides, 32px vertical.
- **Honest state:** a 5:7 split at 768px and up; the explanation on the left, a ruled "Planned for this area" list on the right.
- **Profile:** a ruled definition list, stacked on phones, a 224px term column at 640px and up.
- **Sign-in:** two equal columns at 1024px and up (navy panel, form centered at 384px max); below that the panel collapses to a navy band holding only the wordmark.
- **Rhythm:** 4px base; the steps in use are listed in the `spacing` tokens.

### Named Rules
**The Ruled-Not-Boxed Rule.** Content inside the app and the landing page is organized by hairline rules and open space. Boxes are reserved for sheets that are objects in their own right (the board, proof sheets, trail entries, the form's error summary).

## Elevation & Depth

Depth is mostly tonal: navy frame against the grey field, white sheets on grey with a 1px Hairline border. One soft shadow exists, for sheets that sit on a field like paper on a desk. Nothing in the app shell casts a shadow.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 2px rgb(15 34 54 / 0.06), 0 12px 32px -12px rgb(15 34 54 / 0.18)`): the sample board (landing hero and sign-in panel), the principle proof sheets, the day-ruler's "today" knob, and the focused skip link.

### Named Rules
**The Paper-On-A-Desk Rule.** Only a sheet that represents a document or board gets the Sheet shadow. Controls, panels, and app content stay flat.

## Shapes

Three radii plus pills. **Control** (4px) for buttons, inputs, links' focus shape, nav items, and the error summary. **Panel** (6px) for small sheets: principle proofs and activity-trail entries. **Sheet** (10px) for the board sheet and the large loading block. Fully round for status badges, the risk chip, the "Sample data" pill, the avatar, trail nodes, and the 3px current-location indicator. All borders are 1px except the 2px text-link underline, the 2px trail-node ring, and the dashed pending-contact outline. The brand mark is a 24px navy (or white on navy) tile with a 5px corner holding two job bars crossed by the orange "today" line.

### Named Rules
**The Size-Sets-Radius Rule.** 4px for things you operate, 6px for small sheets, 10px for the board. Pills are for badges and chips only.

## Components

Restrained, heavy where it speaks, quiet where it works.

### Buttons
- **Shape:** 4px corner, 44px minimum height, 20px horizontal padding, 14px semibold label; icons sit 8px from the label.
- **Primary:** Service Navy fill, white text ("Sign in"); hover lifts to Lit Navy.
- **Secondary:** Sheet White fill, Control Edge border, ink text ("Try again"); hover fills Sunken Grey.
- **Inverse:** white fill, navy text, for use on navy bands (used by the contact action once a destination is configured).
- **Hover / Focus:** 150ms color transition; the global 2px Focus Blue outline at 2px offset (Sky Focus on navy).
- **Disabled / Pending:** 60% opacity, not-allowed cursor; pending labels change words ("Signing in…") with a spinning loader icon.

### Chips (status, priority, risk)
- **Status badge:** pill, pale status tint fill, status text color, 12px semibold, 14px line icon plus the word (Open, In progress, Blocked, Completed, Cancelled).
- **Priority label:** a four-bar signal icon (filled bars in ink; orange for Critical) plus the word; High and Critical in ink, lower priorities in Slate Ink.
- **Risk chip / due label:** mono, semibold, Signal Ink text with an orange-filled flag icon ("Overdue 1 day"); as a chip it sits on Risk Wash in a pill.

### Cards / Containers
- **Board sheet:** 10px corner, Sheet White, 1px Hairline, Sheet shadow; a header row (title plus "Sample data · illustrative" pill), a day-ruler strip, column labels, and ruled rows.
- **Proof sheet:** 6px corner, Sheet White, Hairline, Sheet shadow, 16px padding, mono content.
- **Trail entry (on navy):** 6px corner, Deep Navy fill, Rail Seam border, mono caption text.
- Containers are never nested decoratively and are never wrapped around list items in the app.

### Inputs / Fields
- **Style:** label above (13px semibold) with "(required)" in Slate Ink; Sheet White field, 1px Control Edge border, 4px corner, 48px tall, 14px padding, 16px text.
- **Hover:** border darkens to ink. **Focus:** the global 2px Focus Blue outline.
- **Error:** border turns Error Red; an inline 13px red message with a 14px alert icon, linked by `aria-describedby`. A form-level error summary (blush fill, red text and icon) receives focus.

### Navigation
- **Rail items:** 44px tall, 12px padding, 18px line icon plus 14px medium label in Rail Frost; hover fills Lit Navy at 60%.
- **Current item:** Lit Navy fill, white label, `aria-current="page"`, and the 3px Signal-on-Navy indicator on the left edge. The profile link uses the same treatment.
- **User panel:** pinned to the bottom of the rail above a Lit Navy divider: a 32px Deep Navy initials disc, name (14px semibold white, truncated), role line (12px Rail Haze), then a "Sign out" row styled like a nav item. Sign-out failure is announced in text.
- **Mobile:** 56px navy top bar; the "Menu" button (icon plus word, icon switches to a close mark) expands the panel in place; Escape closes it and returns focus; navigating closes it.
- **Public header:** wordmark left; on 768px and up, section links (14px medium Slate Ink, ink on hover); a primary "Sign in" button. Translucent Cool Field background over a Hairline.

### Text Link
Standalone links: 14px semibold ink with a 2px Strong Rule underline offset 6px that turns ink on hover; 44px tall touch target. On navy: white text with a Rail Haze underline.

### Page Header
Heavy H1 title with an optional 16px Slate Ink description (60ch max), closed by a 1px Hairline rule with 24px below.

### Sample Board (signature)
A working board on the landing hero, driven by the product's real due-date rules over synthetic rows. A native range input lies transparently over an eight-day ruler, so pointer, touch, and keyboard work as a standard slider; the orange "today" marker slides 200ms between ticks; a polite live region reads out the day and the overdue count. Rows show title, mono reference, area and assignee, status and priority, and a fixed-width mono due column; overdue rows take the Risk Wash and rise to the top. On re-sort, rows glide to their new positions (420ms FLIP, `cubic-bezier(0.16, 1, 0.3, 1)`); under reduced motion the FLIP is skipped entirely. A compact variant (three rows, no ruler, no status column) sits on the sign-in panel.

### Activity Trail
The landing workflow as one job's append-only trail on navy: a 1px Rail Seam spine, round nodes (solid ring for recorded steps, dashed for the planned "Review" step), step name, who does it, and a mono trail entry. All entries are sample data and the band says so.

### Honest State
Empty data: a dashed-outline sheet with an H3 ("No work orders yet" or "No matches for these filters"), one sentence, and the next action ("New work order" or "Clear filters"); metrics with no data show "—" with a sentence, never 0%. Forbidden: an H2 "You don't have access to this page.", a sentence naming the server check, and one text link. Unexpected error: an 800-weight H1, an explanation, a reference code set in mono when available, and a secondary "Try again" button. Not found uses the public header over the same open-text pattern with two text links. Loading: Sunken Grey pulse blocks shaped like the page header and one sheet, no placeholder data.

### Contact Action
Built state: the contact destination is not configured (`src/config/contact.ts`), so the landing hero and contact band show a non-clickable "Contact details coming soon" notice: a 44px dashed-outline box with a clock icon (Control Edge and Slate Ink on light; Rail Seam and Rail Frost on navy). How the component works once configured: a valid `mailto:` or `https:` destination turns it into a "Request a demo" button (primary on light, inverse on navy) with an outbound-arrow icon and an accessible description of the destination. No contact channel is live.

### App screens (built 2026-10-09)
- **Work-order list:** a filter sheet (GET form, state in the URL) above a table on desktop and stacked cards under `md`; references and due labels in mono; status badges and priority signal bars as on the sample board.
- **Work-order detail:** mono reference, H1 title, status/priority/due line, a Status section of secondary buttons (Mark completed is primary), a native modal dialog for notes and cancellation reasons, a description, and a history timeline of icon dots on a hairline with attributed entries and quoted notes; a details sheet on the right.
- **Forms:** 48px inputs, selects, and text areas with "(required)", hints, inline errors, and the focused error summary; success messages are announced status text, not toasts.
- **Dashboard and analytics:** KPI sheets with a display numeral, a "View these N" link, and a "How is this calculated?" disclosure; tables first, with decorative bars beside the numbers.

### Named Rules
**The Icon Plus Words Rule.** Every status, priority, risk label, error, and nav item pairs an icon or mark with text. Color alone never carries meaning.

**The Labeled Sample Rule.** Sample content appears only on public surfaces as proof of the rules, and every instance is labeled as sample data. Inside the app, every row and number comes from stored records; empty data shows an empty state, never sample data.

**The 44px Rule.** Buttons, links, nav items, the menu button, the sign-out row, and the contact notice are at least 44px tall; inputs are 48px.

**The Calm Motion Rule.** UI transitions are 150ms color changes; the sample board's 200ms marker slide and 420ms re-sort are the only movement. The global reduced-motion rule shortens all transitions and animations, and the board skips its re-sort animation entirely.

## Do's and Don'ts

### Do:
- **Do** take every color from the semantic tokens in `globals.css`; components never use raw hex values.
- **Do** fill primary actions with Service Navy and keep blue for focus, caret, and selection.
- **Do** reserve hi-vis orange for overdue risk, Critical priority, and the current/today marker; use Signal Ink when orange is text.
- **Do** set headings in Schibsted Grotesk at 700 or 800 with negative tracking, and set references, dates, times, due labels, and codes in JetBrains Mono.
- **Do** organize content with hairline rules and open space; use the Sheet shadow only for board and proof sheets.
- **Do** label every piece of sample content as sample data.
- **Do** pair every status, priority, risk, and error with an icon and words.
- **Do** keep controls at least 44px tall and keep the visible 2px focus ring (Sky Focus on navy).

### Don't:
- **Don't** use orange for emphasis, decoration, or anything that is not risk or the current position.
- **Don't** use blue as an action or link color, or red for anything but errors.
- **Don't** wrap items in decorative cards, nest containers, or build hero-metric tiles.
- **Don't** use excessive gradients, glass, 3D, or heavy animation.
- **Don't** show sample data, invented numbers, skeleton data, or disabled controls in place of an unbuilt app area.
- **Don't** present a contact channel, form, or link that does not exist; show the pending notice until a destination is configured.
- **Don't** set body text or UI labels in the display or mono family.
