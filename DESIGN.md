---
name: Rota
description: A warm-paper weekly schedule, with today marked in brand ink.
colors:
  brand: "#2b5bff"
  brand-hover: "#214fe0"
  on-brand: "#ffffff"
  brand-soft: "#e7edff"
  brand-soft-dark: "#243056"
  brand-text: "#1438c9"
  brand-text-dark: "#d6e2ff"
  focus: "#2b5bff"
  focus-dark: "#7aa2ff"
  page: "#f4f0e6"
  page-dark: "#1c1917"
  paper: "#ebe4d6"
  paper-dark: "#241f1c"
  card: "#fffdf8"
  card-dark: "#261f1b"
  ink: "#1c1917"
  ink-dark: "#faf6f0"
  ink-soft: "#44403c"
  ink-soft-dark: "#e7e0d6"
  muted: "#57534e"
  muted-dark: "#d4cdc2"
  subtle: "#5f584f"
  subtle-dark: "#b7aea2"
  line: "#e6dfd2"
  line-dark: "#433c36"
  field-line: "#6b6458"
  field-line-dark: "#9a9084"
  well: "#f3eee4"
  well-dark: "#342e29"
  track: "#e7e0d2"
  track-dark: "#161311"
  chip: "#ffffff"
  chip-dark: "#3a342c"
  scroll-thumb: "#d4cbbd"
  scroll-thumb-dark: "#433c36"
  ok-soft: "#dcfce7"
  ok-text: "#166534"
  ok-soft-dark: "#12372a"
  ok-text-dark: "#86efac"
  warn-soft: "#fef3c7"
  warn-softer: "#fffbeb"
  warn-line: "#f59e0b"
  warn-text: "#92400e"
  warn-soft-dark: "#3b2f12"
  warn-softer-dark: "#30270f"
  warn-line-dark: "#b7861f"
  warn-text-dark: "#fcd34d"
  danger-soft: "#ffe4e6"
  danger-softer: "#fff1f2"
  danger-line: "#fda4af"
  danger-text: "#9f1239"
  danger-soft-dark: "#4a1d2a"
  danger-softer-dark: "#3a1820"
  danger-line-dark: "#be4a5e"
  danger-text-dark: "#fda4af"
  shift-morning: "#d97706"
  shift-afternoon: "#2563eb"
  shift-night: "#7c3aed"
  shift-morning-dark: "#f59e0b"
  shift-afternoon-dark: "#60a5fa"
  shift-night-dark: "#a78bfa"
  slot-morning: "#fff7e8"
  slot-afternoon: "#ebf3ff"
  slot-night: "#f2eeff"
  slot-morning-dark: "#3a3428"
  slot-afternoon-dark: "#243044"
  slot-night-dark: "#322e46"
  violet-soft: "#ede9fe"
  violet-text: "#5b21b6"
  violet-soft-dark: "#2e2650"
  violet-text-dark: "#c4b5fd"
typography:
  display:
    fontFamily: 'Heebo, "Avenir Next", "Segoe UI", sans-serif'
    fontSize: "3.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  headline:
    fontFamily: 'Heebo, "Avenir Next", "Segoe UI", sans-serif'
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "2rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: 'Heebo, "Avenir Next", "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  body:
    fontFamily: 'Heebo, "Avenir Next", "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: 'Heebo, "Avenir Next", "Segoe UI", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0em"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "{colors.on-brand}"
  button-quiet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.card}"
    textColor: "{colors.danger-text}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "36px"
  button-small:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "32px"
  button-icon:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.lg}"
    height: "36px"
    width: "36px"
  field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "16px"
  tab-selected:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "36px"
  logo-plate:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
---

# Design System: Rota

## Overview

**Creative North Star: "The Paper Week"**

Rota reads as a warm paper week. The page is a light sheet, cards are a slightly brighter cream, and the type is near-black. Heebo carries Hebrew and Latin, so both languages share one size, weight, and color. A solid brand bar holds the existing wordmark on a paper chip and the site control. Under the bar, a standard tab strip sits on the paper. The week itself is a row of seven columns.

Today is the only column drawn in brand ink, with a brand tick under the day name. The other days keep ordinary ink and a hairline tick. On the employee home the clock is the large figure, and an open shift turns that clock to brand text. Morning, afternoon, and night keep their own colors. Controls stay ordinary buttons, tabs, fields, selects, and tables. A press scales to 0.97 and eases out. The same chrome means the same thing for an owner, a manager, and an employee.

The dark theme turns the page to the near-black of light-theme ink, lifts cards one warm step, and sets type in a warm off-white. Brand blue stays the same blue. Brand text lightens so today and an open clock stay readable on the night card. The confirmed rejection is a grey page with a single blue button: the bar is brand, and the page stays paper.

**Key Characteristics:**

- Warm paper page, cream cards, and near-black ink, with a dark theme that swaps those roles
- A solid brand bar, and the existing wordmark on a paper chip
- Today's weekday column, and an open attendance clock, are the brand-ink signatures
- Morning, afternoon, and night stay data colors
- Standard buttons, tabs, fields, selects, and tables, with an 8px corner and a 0.97 press

## Colors

The palette is warm paper, near-black ink, and one brand blue. Light values are the default theme. Each `*-dark` token replaces its pair when the dark theme is on. Brand blue and its pressed state stay the same in both themes.

### Primary

- **Brand Blue** (#2b5bff): the solid shell bar, primary buttons, today's column tick, the light-theme focus ring, the text caret, and checkbox accent. Unchanged in the dark theme.
- **Brand Pressed** (#214fe0): the primary button hover, in both themes.
- **On Brand** (#ffffff): text on brand fills, including primary buttons and the filled calendar day.
- **Brand Wash** (#e7edff; dark #243056): a selected account row, the current week in the date picker, and text selection behind brand ink.
- **Brand Ink** (#1438c9; dark #d6e2ff): text on the wash, today's weekday column, and an open attendance clock. This is a text color. It is a different value in the dark theme, so the light hex is not reused on night cards.
- **Focus** (#2b5bff; dark #7aa2ff): the 2px focus ring. In the light theme it matches brand blue. In the dark theme it lightens.

### Neutral

- **Warm Paper** (#f4f0e6; dark #1c1917): the page. The dark page uses the same hex as light-theme ink.
- **Paper** (#ebe4d6; dark #241f1c): the sunken paper step, also the scrollbar track.
- **Cream Card** (#fffdf8; dark #261f1b): raised cards, fields, quiet buttons, the selected tab, and the wordmark chip.
- **Near-Black Ink** (#1c1917; dark #faf6f0): primary text. Dark-theme type is a warm off-white.
- **Soft Ink** (#44403c; dark #e7e0d6): secondary labels and icon buttons.
- **Muted** (#57534e; dark #d4cdc2): hints, unselected tabs, and supporting copy.
- **Subtle** (#5f584f; dark #b7aea2): placeholders, closed-day notes, and dates that are not today.
- **Hairline** (#e6dfd2; dark #433c36): card, tab-track, and quiet-button borders.
- **Field Line** (#6b6458; dark #9a9084): input borders, and the 1px tick under every weekday that is not today.
- **Well** (#f3eee4; dark #342e29): quiet hover fills, and read-only fields.
- **Track** (#e7e0d2; dark #161311): the segmented tab track. The dark track is darker than the page.
- **Chip** (#ffffff; dark #3a342c): an assigned person on a shift cell.
- **Scroll Thumb** (#d4cbbd; dark #433c36): the pill scrollbar thumb. The dark thumb matches the dark hairline.

### Semantic

- **Ok** (wash #dcfce7, text #166534; dark wash #12372a, text #86efac): a clock that checks out, and a saved punch.
- **Warn** (wash #fef3c7, lighter wash #fffbeb, line #f59e0b, text #92400e; dark wash #3b2f12, lighter wash #30270f, line #b7861f, text #fcd34d): read-only and caution banners. The banner uses the lighter wash and a softened warn line.
- **Danger** (wash #ffe4e6, hover wash #fff1f2, line #fda4af, text #9f1239; dark wash #4a1d2a, hover wash #3a1820, line #be4a5e, text #fda4af): destructive buttons, form errors, and a clock that fails its check. Danger text in the dark theme uses the light theme's danger line.

### Data

- **Morning** (dot #d97706, cell #fff7e8; dark dot #f59e0b, cell #3a3428): the morning shift dot and the morning cell fill.
- **Afternoon** (dot #2563eb, cell #ebf3ff; dark dot #60a5fa, cell #243044): the afternoon shift dot and cell fill.
- **Night** (dot #7c3aed, cell #f2eeff; dark dot #a78bfa, cell #322e46): the night shift dot and cell fill.
- **Suggestion** (wash #ede9fe, text #5b21b6; dark wash #2e2650, text #c4b5fd): model suggestions and the violet insight tag. Suggestions are not brand.

### Named Rules

**The Today Column Rule.** Only the current weekday column is set in brand ink, with a brand tick under the name. Every other day keeps ordinary ink and a 1px field-line tick.

**The Open Clock Rule.** An open attendance clock is set in brand text. A closed clock stays in ink.

**The Data Color Rule.** Morning, afternoon, and night keep their shift dot and slot fill. Brand blue is not a shift color.

## Typography

**Display Font:** Heebo (with Avenir Next, Segoe UI, sans-serif)
**Body Font:** Heebo (with Avenir Next, Segoe UI, sans-serif)

**Character:** One humanist sans for Hebrew and Latin, loaded with both subsets. A Hebrew sentence and an English sentence share weight and measure. The clock is the only display size, set tight, with tabular numerals.

### Hierarchy

- **Display** (600, 3.75rem, line-height 1, tracking -0.04em, tabular numerals): the attendance clock, and nothing else. An open shift uses brand text; a closed clock uses ink.
- **Headline** (700, 1.5rem, line-height 2rem, tracking -0.025em): sign-in, signup, and other short screen titles.
- **Title** (600, 1rem, line-height 1.5, tracking -0.025em): card titles. The week control's date is a close cousin at 15px, semibold, with the same tight tracking.
- **Body** (400, 1rem, line-height 1.5): the page default. Running copy inside cards, banners, and hints drops to 0.875rem with a 1.5rem line.
- **Label** (500, 0.875rem, line-height 1.25): buttons, fields, tabs, and form labels. Day names and shift names step down to 0.75rem semibold. Status pills are 0.75rem medium.

### Named Rules

**The One Face Rule.** Heebo sets Hebrew and Latin at the same sizes and weights. Clock times and shift hours use tabular numerals.

## Layout

The app is one centered measure. The brand bar, the tab band, and the work area share a maximum width of 1440px. Side padding is 16px, and 24px from the 640px breakpoint. The header sticks to the top. The brand bar is solid. Under it, a paper band at 85% opacity with a backdrop blur and a bottom hairline holds the tab strip. The work area stacks in 24px gaps with 24px of vertical padding.

The week is seven fixed columns in a table whose minimum width is 840px, so a narrow viewport scrolls the row and keeps today in view. The employee tab strip is three equal columns on a phone and an inline track from 640px up. The manager tab strip scrolls as one row until that same breakpoint, then sits inline. Controls sit on a 4px grid and are 32, 36, or 40px tall. The attendance punch grows to 48px. Hebrew is the document default, right to left. English flips the same chrome to left to right.

**The Shared Measure Rule.** The shell, the tab strip, and the work area share one centered measure, 1440px, with 16px of side padding that becomes 24px from the small breakpoint.

**The Clock Direction Rule.** Clock times, shift hours, and time fields stay left to right on a Hebrew page, so the digits do not mirror.

## Elevation & Depth

Depth is tonal first, then a soft shadow biased downward. The page, the paper track, and the cream card are three steps. Cards, quiet buttons, the selected tab, and person chips also carry the low shadow at rest. Popovers, the date picker, settings, and the sign-in card use the higher shadow; several of those panels are a translucent card with a backdrop blur. Light shadows are tinted with the ink. Dark shadows are black and heavier, and the higher dark shadow drops 12px rather than 10px.

### Shadow Vocabulary

- **Card** (`box-shadow: 0 1px 2px rgb(28 25 23 / 0.05), 0 8px 16px -10px rgb(28 25 23 / 0.18)`; dark `0 1px 2px rgb(0 0 0 / 0.35), 0 8px 16px -10px rgb(0 0 0 / 0.45)`): cards, primary and quiet buttons, the selected tab, the week board, and person chips, at rest.
- **Pop** (`box-shadow: 0 10px 28px -8px rgb(28 25 23 / 0.28)`; dark `0 12px 28px -8px rgb(0 0 0 / 0.55)`): menus, the date picker, settings, and the sign-in card.

### Named Rules

**The Soft Shadow Rule.** Depth is a warm tonal step plus a soft downward shadow. Shadows are blurred and ink-tinted in light, black and heavier in dark.

## Shapes

The shared corner is gently rounded, 8px, on buttons, fields, cards, tabs, the week board, and the menus that follow the chrome. The wordmark chip, person chips, and small inline marks use the tighter 6px corner. Status pills, shift dots, and the calendar's today are circles. The day tick is a centered rule, 32px wide and 1px tall. Scrollbars are thin pills, 12px, with the paper track and the scroll-thumb color. Trade cards, the export menu, calendar cells, and some segmented tracks use a 12px corner; that radius stays on those surfaces. New controls and cards use 8px.

**The Eight-Pixel Rule.** Buttons, fields, cards, tabs, and the week board use an 8px corner. Status chips are pills. The wordmark chip is the tighter 6px corner.

## Components

Controls are ordinary. They share the 8px corner, the label size, and the press.

### Buttons

- **Shape:** 8px corner. Primary, quiet, danger, and icon buttons are 36px tall. The small button is 32px tall. The attendance punch is the primary treatment at 48px tall, with 16px type and 32px of horizontal padding.
- **Primary:** brand fill, on-brand text, 16px of horizontal padding, label size, medium weight, and the card shadow. Hover uses brand pressed. Disabled drops to 50% opacity and keeps the brand fill.
- **Quiet:** card fill, ink text, a 1px hairline, and the card shadow. Hover moves the border to the field line and the fill to the well.
- **Danger:** card fill, danger text, a 1px danger line, no rest shadow. Hover fills with the danger hover wash.
- **Small:** card fill, ink text, hairline border, 12px horizontal padding, 12px type.
- **Icon:** a 36px square, card fill, soft-ink icon, hairline, card shadow. Hover uses the well and full ink.
- **List action:** a full-width brand fill, on-brand text, 12px type, padding 8px 12px, aligned to the start of the line.
- **Hover / Focus:** color, background, border, shadow, opacity, and transform run for 140ms on cubic-bezier(0.23, 1, 0.32, 1). Focus is a 2px ring in the focus color, 2px outside the control. Press scales to 0.97. Reduced motion removes the scale and keeps the color change.

### Chips

- **Status pill:** a full circle, 12px medium type, padding 2px 10px. Ok, warn, danger, and suggestion each use their wash and text.
- **Person chip:** 6px corner, chip fill, 1px hairline, 12px medium type, and the card shadow. Hover moves the border to the field line.

### Cards / Containers

- **Corner Style:** 8px.
- **Background:** the cream card, on the warm paper page.
- **Shadow Strategy:** the card shadow at rest. The sign-in card uses the pop shadow.
- **Border:** a 1px hairline.
- **Internal Padding:** 16px, and 20px from the 640px breakpoint. The week board is the same surface with 6px of padding, 8px from that breakpoint. Card titles use the title style. Hints sit 4px under the title, in muted 0.875rem copy with a 1.5rem line.

### Inputs / Fields

- **Style:** 40px tall, 8px corner, card fill, 1px field line, 12px of horizontal padding, label size. The placeholder is subtle. A select is the same field with 32px of padding at the end for the native arrow.
- **Focus:** the ring sits on the border, with no extra offset, and the border takes the focus color. The caret is brand blue.
- **Read-only:** hairline border and well fill. A disabled control is 50% opacity with no pointer.

### Navigation

The shell is a solid brand bar, sticky, with 10px of vertical padding. The wordmark chip sits at the start. The site select and quiet actions sit at the end, in on-brand surroundings, so those controls stay the quiet button. Under the bar, the tab strip is a track with 4px of padding and a 4px gap. The selected tab is a cream card, semibold ink, with the card shadow. Unselected tabs are muted and pick up a half-strength card fill on hover. The date picker marks the calendar day as a brand-filled circle with on-brand type. That circle is the picker. It is separate from the weekday column rule.

### Logo plate

The existing wordmark, the light file and the dark file, sits on a cream chip with a 6px corner and padding of 4px 8px. The chip is what keeps the mark whole on the brand bar. The mark is 32px tall in the shell.

**The Paper Chip Rule.** The shell is a solid brand bar. The wordmark sits on a card-colored chip so the mark stays whole.

### Week columns

Seven day headers, 12px semibold. Today's name and date are brand ink, and the tick under them is brand blue, 32px by 1px. Every other name is ink, its date is subtle, and its tick is the field line.

### Attendance clock

The clock is the display size, tabular, left to right, centered on a card. Open uses brand text. Closed uses ink. The punch under it is the large primary button.

### Named Rules

**The Press Rule.** A pressed control scales to 0.97 and eases with cubic-bezier(0.23, 1, 0.32, 1) over 140ms. Reduced motion drops the scale and keeps the color change.

## Do's and Don'ts

### Do:

- **Do** keep the shell a solid brand bar and set the existing wordmark on a card-colored chip.
- **Do** mark only today's weekday column in brand text, with a brand tick, and give every other day a 1px field-line tick.
- **Do** set an open attendance clock in brand text and a closed clock in ink.
- **Do** set Hebrew and Latin in Heebo, and set clock times and shift hours in tabular numerals that stay left to right.
- **Do** use the 8px corner on buttons, fields, cards, tabs, and the week board, and the soft card and pop shadows.
- **Do** scale a press to 0.97 over 140ms with cubic-bezier(0.23, 1, 0.32, 1), and drop only the scale when motion is reduced.
- **Do** keep morning, afternoon, and night on their shift dot and slot fill.

### Don't:

- **Don't** make the page a neutral grey with brand blue used only on one button.
- **Don't** color a morning, afternoon, or night shift with brand blue.
- **Don't** redraw the wordmark. The existing mark sits on the paper chip.
- **Don't** set every weekday column in brand ink.
- **Don't** use a hard, unblurred offset shadow. Shadows stay the soft card and pop shadows.
- **Don't** scale a press when the user prefers reduced motion.
