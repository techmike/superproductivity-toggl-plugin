# Changelog

All notable changes to this plugin are documented here, along with the Super
Productivity (SP) versions each release was tested against.

## Compatibility matrix

| Plugin version | Tested with SP version(s) | Should work with                         | Notes |
|-----------------|---------------------------|-------------------------------------------|-------|
| 1.1.1           | 18.9.1                    | Same as 1.1.0                             | Safety fix — see below. No SP-compatibility change. |
| 1.1.0           | 18.9.1                    | SP versions whose `currentTaskChange` hook delivers `{ current, previous }` | Fixes the payload-shape regression below. Untested against SP < 18.9.1; if your SP version still sends the task object directly (not wrapped), use 1.0.x instead. |
| 1.0.0           | Pre-18.x (raw task payload) | SP versions whose `currentTaskChange` hook delivers the task object directly | Initial release. Breaks on SP versions that wrap the payload in `{ current, previous }` (see 1.1.0). |

## [1.1.1]

### Fixed

- **Safety:** `stopEntry` and `stopCurrentRunningEntry` now fetch the target
  Toggl entry first and refuse to stop it unless its description starts with
  `[SP]`, so the plugin can never stop a timer it didn't create.
- **Safety:** `startEntry` now prefixes every entry it creates with `[SP]`
  (description was previously the bare task title), so the plugin's own
  entries are recognized by the guard above. Without this, the plugin could
  no longer stop the very entries it started.
- Added a test that starts an entry via `startEntry` and confirms `stopEntry`
  recognizes it as plugin-owned, verifying the two halves work together.

## [1.1.0]

### Fixed

- `currentTaskChange` hook handling: Super Productivity now delivers
  `{ current, previous }` to the hook instead of the raw task object. The
  plugin was reading `task.id`/`task.title` directly off this wrapper,
  which made every field resolve to `undefined` and broke both starting
  and stopping of Toggl entries. `onCurrentTaskChange` now unwraps
  `payload.current` before acting on it.
- `CurrentTaskPayload` type renamed to `CurrentTaskChangePayload` and
  updated to reflect the `{ current, previous }` shape.

### Compatibility

- Tested against **Super Productivity 18.9.1**.
- `manifest.json#minSupVersion` raised to `18.9.1` to reflect the minimum
  version confirmed to work with this release's payload handling.

## [1.0.0]

### Added

- Initial release: one-way sync of SP task timers to Toggl Track
  (start/stop time entries, project mapping by name, optional tag and
  billable flag, optional "stop other running timer" behavior).
- Tested against the SP plugin API version current at the time, where the
  `currentTaskChange` hook delivered the task object directly (not
  wrapped in `{ current, previous }`).
