# Group edge click fixture timing

CI38075266862 on docs-only HEAD8c305ae: native3PASS/browser18PASS1FAIL. Raw trace proves the fit viewport changed between coordinate capture and native mouse. Only test geometry observation changed; no product code or synthetic event/store mutation.

Original correct-browser local3PASS; fixed local3PASS and clean single19PASS(1.8m), lint0. These passing replays are not fabricated RED. Initial /usr/bin/chromium launch errors preserved separately; actual installed browser /home/agent/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome. All314 source/compiled file hashes unchanged across final browser run. Independent review APPROVE C0I0M0. New product source windows excluded.

Exact command: PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/agent/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome ./node_modules/.bin/playwright test --workers=1. Product ticket count unchanged; QA02 real clients still pending.
