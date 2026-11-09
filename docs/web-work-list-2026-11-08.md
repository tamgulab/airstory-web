# AirStory Web — Work List

**Date:** November 8, 2026
**Repo:** `tamgulab/airstory-web`

---

## Priority 0, do this first

**Check `feature/session-level-grouping` for conflicts and merge it.**

Two commits pushed Aug 15, never merged. Three months of `origin/dev` has
landed since, so expect conflicts. It fixes the Raw Data session splitting
and changes how Analysis and Heat Map average, so the other Raw Data work
sits on top of it.

```
cd /Users/jooeunshim/tamgulab/airstory-web
git fetch origin
git log --oneline origin/dev..origin/feature/session-level-grouping
git log --oneline origin/feature/session-level-grouping..origin/dev
git merge-base --is-ancestor origin/dev origin/feature/session-level-grouping; echo $?
```

What that branch contains:

- `85b1324` groups Raw Data rows by session instead of by minute. A 90-second
  mobile recording was appearing as three separate sessions, split on
  wall-clock minute boundaries.
- `3551f80` weights Analysis, Heat Map and Workspace averages by reading
  count, since a session became one row regardless of whether it held 3
  readings or 300. Box plots and best/worst location switched to individual
  readings from `detailedData`.

---

## Heat Map

- Verify the map centers on the school set in the workspace when it opens
- Make the heatmap layer an on/off toggle
- When Hanoi is selected, center on Olympia School

## Raw Data

- Photo attachment per session, up to 5 images of the surroundings (app side
  needs matching work later)
- Collapse all and Expand all buttons, left of the Clear button
- `src/utils/importedData.js` still minute-buckets the web CSV import path.
  Once the branch above merges, a CSV imported through the web will split by
  minute while a mobile upload does not. Same table, two behaviors.
- The session lookup SQL at import omits `location` from its WHERE clause
  while the cache key includes it. Two uploads differing only in location can
  match a session the cache key treats as distinct.

## Analysis

- Larger font sizes on graphs (students will be on smaller laptop screens)
- `detectOutliers` runs IQR over daily means while box plots read individual
  readings. Different populations, so a reading can fall outside the whiskers
  without being flagged. Decide which population is correct.
- `npm run build` fails on `react-map-gl/maplibre` not resolving. Broken at
  `origin/dev` too, so nobody on any branch can get a build signal.

## Accounts and classes

- A My Class page for student mode to replace Manage Classes
- Add a teacher name field on the web, separate from Class (Instructor).
  No class-level instructor column exists. `workspaces` has only `id`, `name`,
  `kind`, `school_id`, `created_by`, `created_at`. A student's
  `user_profiles.instructor` is inserted empty at invite-accept and never
  filled, so every uploaded session carries an empty instructor in its key,
  permanently. Proposed `workspaces.instructor_name`, mirroring how school
  works.
- Add G0 for teacher data uploads. Teachers do not belong to a group. The app
  now hides Period and Group for teachers, which means a teacher with no
  stored placement cannot upload at all, since History requires both.
- `pickMembership` honors a persisted workspace id from localStorage with no
  kind check. A teacher who once clicks into the school or Public workspace
  stays parked there on every load afterward. Public scope filters
  `visibility = 'public'`, so class sessions become invisible and Raw Data
  looks completely empty.
- Switching workspaces does not refetch Raw Data. A manual page reload is
  required.
- The workspace list response orders by `w.created_at` without selecting it,
  so clients cannot sort by it.
- No range validation on period or group at `PATCH /auth/me/profile` or at
  session import. A bad value in a session key is permanent.

## Infrastructure

- Retire the dead `air-sensor-api` Render service
- The live backend runs with `NODE_ENV=development`, leaving CORS open to all
  origins. Required before Hanoi.

---

## Future

- Multi-user editing per group in Analysis, like Google Docs or Slides, with
  changes saved in real time. This needs state synchronization design,
  conflict resolution, and presence. Larger than everything above combined.
