---
name: hero-redesign
description: >-
  Redesigns a landing page hero and first screen without inventing content. Use when
  the site works but the first viewport looks generic, or the user asks to redesign
  the hero, above-the-fold, or landing first screen.
---
# Hero redesign

## Steps
1. Gather: current file/path or screenshot, business, audience, primary CTA, 3 tone adjectives, preferred stack. Prefer 1–2 reference sites.
2. Optionally propose 3 visual directions; lock one before coding.
3. Run:

```
Redesign the hero and landing page in [FILE/PATH] without changing content meaning or functionality.
Context: [business], audience [who], primary action [CTA], tone [3 adjectives].
Visual direction: background [#hex], text [#hex], single accent [#hex]; display font [X], body font [Y].
Layout (desktop): [e.g. asymmetric split — headline 7/12 left, visual 5/12 right overlapping section edge]. Mobile: stacked, CTA visible without scroll.
Hierarchy: headline 56–72px desktop / 36–40px mobile, line-height 1.05; subhead max 60ch; one primary CTA + one ghost secondary.
Add one entrance sequence: headline, subhead, CTA, visual staggered 80ms, 600ms, cubic-bezier(0.16,1,0.3,1).
Stack: [Next.js/Tailwind/etc.]. Reuse existing tokens in [tailwind.config / globals.css].
Do not invent names, numbers, testimonials or logos — mark placeholders as [TODO].
Finish with a list of what changed and why.
```

4. Do a mobile pass next; change one thing per follow-up prompt.
5. Never invent testimonials, metrics, or logos.
