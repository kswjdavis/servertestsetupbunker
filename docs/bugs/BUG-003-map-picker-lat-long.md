# BUG-003: Map Picker Not Populating Lat/Long Fields

**Status:** Open
**Severity:** Medium
**Component:** Frontend - Bunker Creation Form
**Discovered:** 2025-10-29 (Story 5.9 E2E Testing)
**Reporter:** Jeff Davis + Sarah (PO)

## Description

When creating a new bunker using the map picker (pin/marker on map), clicking on the map to select a location does not automatically populate the Latitude and Longitude input fields below the map.

## Steps to Reproduce

1. Login to dashboard (https://206.189.210.203)
2. Click "Create Bunker" blue button
3. Click/drag pin on the map to select a location
4. Observe the Latitude and Longitude input fields below the map

## Expected Behavior

When the user clicks on the map or drags the pin to a location, the Latitude and Longitude input fields should automatically update with the coordinates of the selected location.

## Actual Behavior

The Latitude and Longitude fields remain empty, even after selecting a location on the map. The user must manually type in the coordinates.

## Workaround

Manually enter latitude and longitude values into the input fields.

## Impact

- **User Experience:** Confusing - users expect the map picker to work
- **Data Quality:** Risk of typos when manually entering coordinates
- **Story Impact:** Does not block Story 5.9 acceptance, but degrades UX

## Related Components

- Component: Bunker creation form (likely `web/src/components/bunkers/BunkerForm.tsx` or similar)
- Related Story: Story 4.4 (Bunker CRUD Operations)
- Map library: Leaflet (Story 3.3)

## Suggested Fix

The map click/drag event handler should:
1. Capture the selected coordinates (lat, lng)
2. Update the form state for latitude and longitude fields
3. Ensure two-way binding between map picker and input fields

## Priority Justification

**Medium severity** because:
- ✅ Workaround exists (manual entry)
- ❌ Degrades user experience significantly
- ❌ May cause data entry errors
- ✅ Does not block critical functionality

## Testing Notes

This was discovered during comprehensive E2E testing (Story 5.9). The form validation works correctly once coordinates are manually entered.
