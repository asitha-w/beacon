Beacon is a reliability operations console. It watches a customer's cloud estate, investigates what breaks, shows the evidence, and asks before it changes anything. Everything in this system exists to make a finding readable in ten seconds and an approval decidable in thirty.

## Content fundamentals

- Write to the engineer on call at 02:00. Short sentences. The fact first, the explanation second. "Disk on web-01 is 94% full. It has grown 3 GB in 40 minutes."
- Name the resource, the service and the time window in the first line of every finding.
- Separate what was observed from what is inferred. Observed facts are stated. Hypotheses are introduced with "Likely" or "Possible" and carry their evidence beside them.
- Never show a model's confidence as a percentage. Use the three words Verified, Likely and Unverified, and say what each rests on.
- Every proposed action states its blast radius in one plain sentence: "Restarting nginx drops in-flight requests for about two seconds."
- Beacon speaks as "Beacon", never "I". Buttons say what happens: Approve restart, Deny, Open evidence. A toast confirms in the past tense: Restart approved.
- Sentence case everywhere. No exclamation marks. No emoji in the product.
- Identifiers, metric names, hostnames and timestamps are always set in `data` so they can be copied and never mistaken for prose.

## Visual foundations

### Colour

- Dark is the first theme. Light is designed with the same care, not inverted. Every token carries both values.
- The ground is `surface`. Cards and the thread sit on `surface-raised`. Evidence windows, code and the ask box sit in `surface-sunken`. Three levels, never more.
- `beam` is the only accent. It marks the active nav item, links, the primary button and the probe-online dot. It never carries a status meaning.
- Status colours are semantic and each has a soft ground: `critical`, `warning`, `info`, `ok`. A status is always a colour plus a word or a chip label, never colour alone.
- `approve` belongs to one state only: an action waiting for a human. The approval card border, the awaiting chip and the approvals count in the nav use it. Nothing else does.
- Text pairs: `ink` and `ink-muted` on `surface`, `surface-raised` and `surface-sunken`; each status colour on its own soft ground or on the surfaces. `ink-faint` is for placeholders and disabled labels only.
- Borders do the separating. Use `line` for hairlines and card edges, `line-strong` where the edge carries meaning. `shadow-raise` is one hair of lift; `shadow-overlay` is for dialogs only.

### Type

- One family for reading, one for data. Set all prose in the `sans` family and every identifier, id, metric and timestamp in `mono`.
- The scale: `display` for the page title and the finding headline, `title` for sections, `heading` inside cards, `body` for prose, `body-sm` for tables and metadata, `label` for eyebrows and column headers in uppercase, `data` for identifiers, `numeral` for the one number a tile is about.
- Keep prose at 65 characters or fewer per line. Tables and the thread may run wider inside their own scroll container.
- Digits in tables, the stat row and tiles use tabular figures.

### Spacing and radius

- The scale is 4, 8, 12, 16, 24, 32, 48. Cards pad `space-4`. Sections separate with `space-5`. Pages pad `space-6` on desktop and `space-4` on a phone.
- Radii are small and few: `radius-sm` on chips and code, `radius-md` on buttons, inputs and cards, `radius-lg` on panels and the approval card. Only the status dot and the probe pill are round.

### States

- Focus is a solid 2px `focus` ring with a 2px offset, on every interactive element, in both themes.
- Hover on a row tints it `beam-soft`. Hover on a quiet button draws its `line-strong` border.
- Disabled controls drop to `ink-faint` text and keep their border. They do not fade.
- Loading uses a text line, "Collecting evidence…", not a spinner alone.

### Layout

- The console is a left rail of 232px and a content column. The rail holds Findings, Investigations, Approvals, Services, Connections, Responders, Consumption, Settings. Findings is the home.
- The investigation page is one thread: trigger, evidence, hypotheses, verdict, approval, verification, in that order, top to bottom.
- Tables have a `label` header row on `surface-raised`, `line` rules between rows, and never zebra stripes.

## Iconography

- Beacon ships no icon set of its own and no logo. The name is set in `display` weight in plain type.
- Where an icon is needed, use a 16px, 1.5px-stroke glyph from Lucide, inline as SVG with `stroke="currentColor"`, so it takes the text colour of its context. Icons never stand alone; each has a label or an accessible name.
- Status dots are 8px discs in the status colour. The probe pill is a dot plus the word online, stale or no probe.

## Components

- `Button`: primary for the one main action on a page, quiet for the rest, danger only for an action that cannot be undone. One primary button per view.
- `SeverityChip` and `StatusChip`: the colour and the word together. Never restyle a chip's colour by hand.
- `StatRow`: the line under a finding headline. Time to finding, sources read, run id. Three to five items, separated by a middle dot.
- `EvidenceTable`: one row per claim. Left, the source kind in `label`; middle, the claim in `body-sm`; right, the pointer in `data`, which is a link into the evidence window.
- `CausalChain`: timestamped boxes in order, joined by arrows in `line-strong`. The last box is the symptom and carries the finding's severity ground.
- `ApprovalCard`: what was found, the proposed action, the blast-radius sentence, then Approve and Deny. Bordered in `approve`. Only administrators see the buttons enabled.
- `CapabilityList`: one row per capability a connection can provide, with its state: available, missing permission, not offered by provider.
