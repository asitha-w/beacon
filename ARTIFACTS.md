# Beacon artifacts

All three are private claude.ai artifacts owned by asitha.weerasinghe@ditio.no. Share from each page's Share menu.

| Artifact | URL | Local source | Published version |
|---|---|---|---|
| Beacon Design System | https://claude.ai/artifact/4EMsnjCNeDeA497oz6CR6X | `design-system/project/` | v2, 2026-10-29 |
| Beacon Console (clickable prototype) | https://claude.ai/artifact/XVUSdPoAo2hTtajJ4LWqSC | `prototype/beacon-console.html` (frozen; the live app lives in `web/`) | v3, 2026-10-29 |
| Beacon Traffic Map (connections diagram) | https://claude.ai/artifact/Tp9wjGK9TTBpUC69fDhqT8 | `traffic-map/beacon-traffic-map.html` | v1, 2026-10-29 |

## How to republish from this folder

- **Design system.** It is an artifact made from the Design System type. Publish only files under `project/`, with `root` = `design-system/` and `file_path` = `design-system/project/design-system.json` sent last; `files` maps `project/<path>` to `project/<path>`. `index.d.ts` must be sent with contentType `text/plain`. Never pass the type URL again.
- **Prototype.** Publish `prototype/beacon-console.html` with `url` = the console URL above. It declares the `sample` capability; omit `capabilities` to keep it.
- **Traffic map.** Publish `traffic-map/beacon-traffic-map.html` with `url` = the traffic map URL above.

## Design system facts a future session needs

- Namespace `Beacon`, no libraries, components are plain DOM factories on `window.Beacon`.
- Themes: `dark` first, then `light`. Fonts are Google-hosted IBM Plex Sans and IBM Plex Mono, no font files.
- Components: Button, SeverityChip, StatusChip, StatRow, EvidenceTable, CausalChain, ApprovalCard, CapabilityList, plus the Cover.
- The prototype inlines `bundle.css` and `bundle.js` from the system; when the system changes, copy them into the prototype's `<style>` and first `<script>`.

## Prototype facts

- Hash routes: `#login`, `#setup-tenant`, `#setup-connect`, `#findings`, `#investigations`, `#inv/inv-00a7`, `#approvals`, `#services`, `#connections`, `#responders`, `#consumption`.
- State lives in the viewer's browser under localStorage key `beacon-proto-v1`. The demo bar's Reset clears it.
- One scripted scenario, `disk-fill` on the Azure VM web-01, arrays `SC` (trigger to approval) and `AFTER` (approve to verified). New journeys are added as further arrays in the same shape.
- Ask Beacon uses the runtime's `sample` capability when granted and falls back to scripted answers.

## Note, 2026-10-30

The live console in `web/` was restyled to the shadcn/ui look (zinc neutrals, Geist, 8px radius, icon sidebar, light and dark). The published design system artifact still shows the earlier IBM Plex look; `web/css/beacon.css` is now the source of truth for the console and the design system should be re-published from it when the screens settle.
