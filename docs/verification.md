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

`ui-smoke.ajs` opens short-lived disposable SWT dialogs and drives real events. Twelve assertions cover listing, filtering, selection retention, disabled rows, multi-selection, empty role selection, cancellation and independent selection of copied solution IDs across environments. The test runner requires a fresh success-result JSON file because an Archi command-line process may return zero even if a script throws.

## Opt-in live test

This makes real metadata reads against the explicitly named environment, then writes **only a new disposable test model**:

```powershell
$env:ARCHI_PP_TEST_ENVIRONMENT = '<approved-environment-id>'
.\tools\test-archi.ps1 -BundlesFile '<effective-configuration>\org.eclipse.equinox.simpleconfigurator\bundles.info' -Script live-read-smoke.ajs
```

The live test exercises the production Java CLI bridge and HTTPS transport, object collection, dependency resolution, ArchiMate validation, repeated application and model save/reload. It temporarily includes unmanaged role candidates in that test model to exercise role mapping; it does not select roles in another model or assert that every candidate is custom.

## Results on 2026-09-27

### Version 0.3.0 batch selection

Verified **85 Node tests**, syntax checks for **46 JavaScript files**, **27 scoped Archi checks**, **22 bulk compatibility checks**, **12 SWT dialog checks**, and **17 live batch integration checks**.

The selection tests check every context against its required source kind, ArchiMate type, ownership, identity, lifecycle state and active model. They cover mixed-type rejection before authentication, environment availability preflight, cancellation and a fatal error in the final context with no model changes. Batch tests verify shared component deduplication, copied IDs across environments, dependencies between selected solutions in either order and preservation of earlier evidence when overlapping reads are incomplete.

The real Archi tests validated multiple Nodes/solutions and diagram occurrences, rejected folders/relationships/wrong kinds, retained the shared component's GUID and saved/reloaded the resulting model. The SWT test selected identical solution GUIDs independently across two synthetic environments.

The approved live environment test collected two solutions together for all five component types, then repeated application/workflow/agent batches. All object collections completed; the disposable model again contained **157 elements and 387 relationships**, with every concept GUID retained across refresh. References to components not yet imported were reported as unresolved, as expected. Cross-environment selection was tested with synthetic metadata; the live test remained within the approved environment. No existing user model or Power Platform configuration was changed.

### Version 0.2.0 context workflow

The context extension adds regression coverage for explicit model selection, wrong-tenant rejection, cancellation, per-solution/type isolation, shared component IDs, inherited table-view membership, hidden-solution filtering, partial reads and compatibility with the bulk workflow.

Final verification: **69 Node tests**, syntax checks for **44 JavaScript files**, **14 scoped Archi checks**, **22 bulk compatibility checks**, **10 SWT dialog checks**, and **19 live scoped integration checks** passed. A separate live read verified that the default solution filter lists **138 visible solutions** in the test environment.

The live Java/Archi test exercised two selected solutions in the approved environment and all five component retrieval commands. All object collections completed; classic workflow subtypes were separately excluded. It produced **157 elements and 387 relationships**: 1 environment, 2 solutions, 2 apps, 23 cloud flows, 3 agents, 15 tables and 111 views. Repeated application/workflow/agent retrieval preserved all concept GUIDs. The model saved and reloaded successfully. Unimported dependency targets remain reported; complete object collection does not assert complete runtime dependency coverage.

Run the additional real-Archi checks with:

```powershell
.\tools\test-archi.ps1 -BundlesFile '<effective-configuration>\org.eclipse.equinox.simpleconfigurator\bundles.info' -Script scoped-archi-smoke.ajs
$env:ARCHI_PP_TEST_ENVIRONMENT = '<approved-environment-id>'
$env:ARCHI_PP_TEST_SOLUTIONS = '<first-solution-id>,<second-solution-id>'
.\tools\test-archi.ps1 -BundlesFile '<effective-configuration>\org.eclipse.equinox.simpleconfigurator\bundles.info' -Script scoped-live-smoke.ajs
```

The first script uses synthetic data and verifies tree/diagram context, Application-layer table/view types, membership removal without object deletion and manual-property preservation. The second makes real reads and writes only a new disposable model.

### Version 0.1.0 baseline

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
