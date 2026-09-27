# Verification

## Automated tests

Run with Node.js 20 or later. There are no packages to install:

```powershell
npm test
npm run check
```

The regression suite covers scoped and copied identities, source aliases, Dataverse primary-ID absence confirmation, soft deletion and restoration, manually authored content, partial dependency evidence, role classification and deselection, CLI authentication boundaries, retries, strict pagination, malformed responses, flow-reference parsing and cancellation before model writes.

`npm run check` syntax-checks the runtime modules and Archi scripts. Node tests use synthetic metadata, do not log in, and do not access an Archi installation or a tenant.

## Real Archi tests

`tools/test-archi.ps1` starts an isolated Archi command-line process using its bundled Java. It keeps configuration, workspace and models under ignored `work/archi-runtime`. Supply an effective Eclipse `bundles.info` from an installation/configuration containing jArchi and its GraalJS dependencies; installed plug-ins remain external references, not copied or redistributed.

```powershell
.\tools\test-archi.ps1 -BundlesFile '<effective-configuration>\org.eclipse.equinox.simpleconfigurator\bundles.info'
.\tools\test-archi.ps1 -BundlesFile '<effective-configuration>\org.eclipse.equinox.simpleconfigurator\bundles.info' -Script ui-smoke.ajs
```

`archi-smoke.ajs` creates a new synthetic model and checks 22 behaviors, including valid relationships, folder placement, stable GUIDs, diagram occurrence deduplication, manual documentation/properties/layout, manual links, copied environments, deselection, soft deletion/restoration and saving/reloading. It never opens a user's model.

`ui-smoke.ajs` opens short-lived disposable SWT dialogs and drives real events. Eight assertions cover listing, filtering, selection retention, disabled rows, multi-selection, empty role selection and cancellation. The test runner requires a fresh success-result JSON file because an Archi command-line process may return zero even if a script throws.

## Opt-in live test

This makes real metadata reads against the explicitly named environment, then writes **only a new disposable test model**:

```powershell
$env:ARCHI_PP_TEST_ENVIRONMENT = '<approved-environment-id>'
.\tools\test-archi.ps1 -BundlesFile '<effective-configuration>\org.eclipse.equinox.simpleconfigurator\bundles.info' -Script live-read-smoke.ajs
```

The live test exercises the production Java CLI bridge and HTTPS transport, object collection, dependency resolution, ArchiMate validation, repeated application and model save/reload. It temporarily includes unmanaged role candidates in that test model to exercise role mapping; it does not select roles in another model or assert that every candidate is custom.

## Results on 2026-09-27

Verified with Archi **5.10.0**, jArchi **1.12.0**, GraalJS and Node **24.19.0** on Windows:

- Node regression suite: **48 tests passed**; syntax checks passed for **29 JavaScript files**.
- Real Archi synthetic model test: **22 checks passed**.
- Real SWT dialog test: **8 checks passed**.
- Live Java/Archi integration: **8 checks passed**.
- Live disposable model: **429 elements and 556 relationships**; second application created no new elements or relationships and retained every concept GUID.
- Live object totals: 1 environment, 8 canvas apps, 26 model-driven apps, 339 flows, 52 agents, and 3 test-selected role candidates.
- All scoped object collections completed. There were **28 unresolved solution-dependency records**; this produced a partial dependency status, with prior affected evidence protected.
- Existing Azure CLI sign-in supplied the required audiences. No application registration or client secret was created.

The user's existing Archi models and Power Platform configuration were not modified. Test inventories and models are intentionally excluded from Git and the release archive. The precise live sample will change as the environment changes; see [coverage](coverage.md) for interpretation.

Not validated: sovereign clouds, macOS/Linux desktop execution, every tenant consent/conditional-access policy, every possible connector/tool representation, or universal extraction of runtime dependencies from app packages.
