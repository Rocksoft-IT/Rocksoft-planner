<!-- preview-link -->

**What this delivers:** The database setup script was missing the "team members" table, so setting up a brand-new copy of the database used to fail partway through. It now includes that table, so a fresh setup completes successfully.

**Please check on the preview:**
- If you can, run the setup script against a genuinely empty database and confirm it finishes without errors (this isn't something we can check automatically in our environment).
- Read the new notes added to the setup script and to the README, and confirm they clearly explain that the real access rules for this table still need to be copied over by hand before a freshly set-up database is used for real data.

**Your decision is needed on:**
- We deliberately left the new table locked down (no one can read or write it) on a brand-new setup, rather than guessing at the real access rules, since getting that wrong would be a security risk. Someone will need to copy the real rules over from the live system before a freshly set-up database can serve real traffic. Tell us if you'd rather we handle this differently.

**Status:** Ready to merge; nothing blocking, just the two checks above when you get a chance.
