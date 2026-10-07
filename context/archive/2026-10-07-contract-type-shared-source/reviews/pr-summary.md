<!-- preview-link -->

**What this delivers:** An automatic safety check that keeps the list of contract types in the app and the list allowed by the database in sync. If someone adds or removes a contract type in only one place, the checks now fail and say which value is missing, instead of the mismatch showing up later as a save error.

**Status:** Ready to merge; nothing to check by hand. Nothing changes for users, since this adds a check only.
