# Native CI temporary-path repair

Baseline: `62012d3b304d873886d12deeb87fbce32f8a52ac`.
Original GitHub Actions run: https://github.com/huiyuanXP/AtlasMode/actions/runs/37141517790

Ubuntu native and Chromium jobs passed. Windows native had ten failing tests in
configuration/package capture; macOS had those ten plus two development cwd checks.
All failures compared a raw temporary root with the canonical filesystem path.
macOS resolves `/var` through `/private/var`; Windows expands its short temp path.
Production intentionally canonicalizes roots; security checks must retain that behavior.
Test roots must match actual filesystem identity so no-read/growth fault injection
and process cwd assertions remain effective. Directory-alias regressions reproduce
this mismatch on Linux without changing product paths or skipping native checks.

Latest user explicitly authorizes stage commits and uploads to GitHub. Keep `work`
as the development branch; no merge into `main` or public deployment is requested.
Detailed RED/GREEN evidence and independent review are stored beside this file.
