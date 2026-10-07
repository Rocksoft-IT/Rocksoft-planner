<!-- preview-link -->

**What this delivers:** When your theme choice cannot be saved, the app now tells you with a clear message instead of silently switching back to dark. The message disappears when you close it or try again. Choices that save correctly behave as before.

**Please check on the preview:**
- Switch to light, reload the page, and sign in on another browser: it should stay light.
- If you see the "could not be saved" message, tell us, because it means the database still needs a setup step.
- Confirm that accounts that never picked a theme still start in dark, sign-in screens stay dark, and the timeline looks and works as before.

**Your decision is needed on:**
- The most likely reason the theme went back to dark is that a one-time database setup step from the earlier theme change was never applied to the live database. We could not reach the live database to confirm. Please have someone with database access run that step (it is safe to run more than once); this change alone will not make the choice stick.

**Status:** Not ready to call fixed: merge once the database step is confirmed and the preview check above passes.
