# Development Feasibility Memo Spec

## Purpose

Define the separate, higher-value report that developers actually care about when moving from “interesting precinct” to “should we pursue this site?”

This is a separate, automated site-level report layer that sits above the weekly radar scope.

## Report Type

`Site-level development feasibility memo`

## Trigger

This report should only be produced when one of these is true:

- a client requests it for a named site
- a validated shortlist item survives weekly review
- a target precinct contains a candidate parcel that crosses the current qualification threshold

## Required Sections

## 1. Site Snapshot

- address
- site area
- frontage / shape
- current use
- brief location context

## 2. Planning Controls

- zoning
- permissible uses
- height limit
- FSR
- overlays / key planning controls
- relevant planning proposal or recent control change

## 3. Constraint Review

- flood
- bushfire
- biodiversity / ecology
- heritage
- airport / noise / corridor issues
- major red flags and unknowns

## 4. Assembly Feasibility

- single lot vs multi-lot
- likely assembly count
- shape and access issues
- whether neighbouring lots appear strategically necessary

## 5. Ownership Context

- ownership type if obtainable
- apparent fragmentation risk
- whether likely contact strategy is simple or complex

## 6. Market Context

- nearby project examples
- relevant sales or product comps
- broad demand and supply context

## 7. Indicative Development Logic

- likely product type
- rough development envelope
- broad residual logic or price logic
- explicit assumptions

## 8. Recommendation

- pursue
- watch
- drop
- key next diligence step

## Data Dependency Levels

## Public-data only

Can support:

- planning controls at a basic level
- proposal context
- some risk screening
- broad site logic

Cannot reliably support at high quality:

- ownership certainty
- strong comps
- robust residual pricing

## Licensed / enhanced data

Needed for stronger versions of:

- ownership
- sales comps
- land value context
- residual model inputs

## Product Tiers

## Tier A: Light Site Screening Memo

- planning controls
- obvious constraints
- assembly logic
- basic recommendation

Good for:

- initial screening

## Tier B: Development Feasibility Memo

- Tier A plus
- better market context
- indicative residual logic
- stronger recommendation

Good for:

- serious shortlist decisions

## Tier C: Decision Support Memo

- Tier B plus
- stronger site-level verification
- stronger comps / ownership / pricing inputs

Good for:

- pre-offer or pre-engagement work

## Automation Strategy

### Automate first

- site control sheet template
- proposal history pull
- basic risk summary
- nearby application context
- memo skeleton generation

### Add stronger model or QA layers later

- ownership verification
- assembly confidence scoring
- comp ranking
- residual sensitivity logic

## Short Version

The higher-value developer report should be treated as a separate product because:

- it is site-level, not precinct-level
- it carries higher trust expectations
- it depends on harder data and more explicit validation logic

That is exactly why it deserves separate pricing.
