# Market Comps Data Assessment

## Bottom Line

There is evidence of an official NSW public property sales pathway, but it is not yet ready to be activated as a decision-grade automated comps module.

The correct current state is:

- `research confirmed`
- `integration not yet approved`
- `report module remains Not activated`

## What Was Confirmed

### 1. Public property sales interfaces exist

Confirmed public sources include:

- `Property sales enquiry` on the NSW Valuer General site
- `NSW land value and property sales web map`
- `Property Sales 3D`

The public web map explicitly states that users can access:

- property sales information for individual properties from 2001
- street and suburb-level sales information for the last five years
- sale date / contract date
- non-strata area information

### 2. There is likely an official underlying data path

The portal metadata suggests:

- property sales information exists in an official NSW public-facing map product
- a 3D property sales service exists
- a downloadable File Geodatabase is referenced in the portal metadata

This is materially better than relying only on private portals such as Domain or realestate.com.au.

## Why The Module Is Still Not Activated

### 1. Data structure is not yet verified enough

We have not yet confirmed, end-to-end, that the public property sales source provides:

- stable machine-readable comparable sales records
- fields suitable for ranking comps
- reliable parcel or address joins to our current precinct/site workflow

### 2. Terms and use constraints need care

The public web application terms explicitly restrict abusive automated access patterns.

That means we should not treat the visible web app as an automatically scrapeable comps API without further verification.

### 3. “Public sales info” is not the same as “decision-grade comps”

For a real development-facing comps layer we still need to validate:

- sales recency
- product-type similarity
- strata vs non-strata comparability
- multi-property sale handling
- address / parcel matching quality

Without those checks, the module would reduce report credibility.

## Correct Product Position Today

The second report can now legitimately include:

- planning controls
- parcel metrics
- frontage candidate
- assembly screening
- property / ownership proxy

But `market comps` should remain:

- `Not activated`

until the above data-quality and access questions are resolved.

## Recommended Next Steps

### Step 1

Verify the official NSW property sales data path at the dataset/service level rather than only the web app level.

### Step 2

Confirm whether a downloadable or queryable structured dataset is both:

- publicly accessible
- safe for automated use under its terms

### Step 3

Build a narrow pilot just for the standard hotspot universe, testing:

- address matching
- sale date quality
- basic comparability tags

### Step 4

Only activate `market comps` in the DevelopmentReport once:

- data structure is stable
- automation is legally and operationally acceptable
- comparability logic is documented

## Current Recommendation

Do not force a comps module into the weekly DevelopmentReport yet.

This is a case where restraint improves credibility.
