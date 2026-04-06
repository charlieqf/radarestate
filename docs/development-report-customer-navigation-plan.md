# DevelopmentReport Customer Navigation Plan

## Why This Exists

The current `DevelopmentReport` bundle is already cleaner than the original mixed-output package, but the customer feedback is correct on one structural point: the exported bundle still reflects internal production layers more than the customer's decision path.

This plan records the scoped export-layer changes we want to make without destabilising the underlying report-generation pipeline.

## Feedback To Address

1. The customer path should be organised around decisions, not file types.
2. The customer-facing reading path should be short and obvious.
3. `client-output/` should become the clear primary path for customer use.
4. `reports/` should remain as a source/archive layer, not the main customer route.
5. Customer-visible labels should reduce product/internal language such as `dashboard` and `latest` where possible.
6. Site cards and deep dives should be grouped explicitly.

## Scope

This change is limited to the exported `DevelopmentReport` bundle.

We will not restructure the repo-wide production folders or rename the internal deterministic source files that support automation, diffing, and auditability.

## Planned Bundle Structure

Within `DevelopmentReport/client-output/`, create a customer-facing navigation layer with these groups:

1. `01-core`
2. `02-this-weeks-actions`
3. `03-site-cards`
4. `04-precinct-deep-dives`
5. `05-visual-summary`

Keep the rendered HTML source layer available, but demote it behind the grouped navigation so the customer no longer needs to browse a flat list of generated files.

## Planned Customer Reading Path

1. Weekly Full Report
2. Weekly Delta Report
3. This Week's Actions
4. Supporting Evidence
5. Visual Summary and Methodology

## Implementation Tasks

1. Update `generate_client_pack.mjs` to replace the long flat reading order with a short 5-step path and grouped deliverables.
2. Update `export_delivery_bundle.mjs` so the `DevelopmentReport` client portal is grouped by customer use, not by raw file type.
3. Add grouped index pages under `client-output/01-core`, `02-this-weeks-actions`, `03-site-cards`, `04-precinct-deep-dives`, and `05-visual-summary`.
4. Demote the raw rendered HTML layer behind a technical/source folder inside the exported client bundle.
5. Relabel customer-facing references from `dashboard` to customer-safe terms such as `Visual Summary` or `Opportunity Map`.
6. Regenerate the bundle and verify that the new structure still opens correctly from `DevelopmentReport/index.html`.

## Explicit Non-Goals

1. Do not rename the internal report-generation scripts or the repo-wide `reports/`, `dashboard/`, and `client-output/` folders.
2. Do not replace deterministic file naming at the source layer.
3. Do not split existing report sections into brand-new source reports unless there is a separate content need.

## Acceptance Checks

1. A customer can start from `DevelopmentReport/index.html` and follow a 5-step path without needing `reports/`.
2. `DevelopmentReport/client-output/` shows grouped customer folders rather than a single flat list as the main path.
3. Site cards and deep dives are grouped separately.
4. Customer-visible labels no longer require the customer to understand internal terms like `dashboard/latest` in order to navigate.
