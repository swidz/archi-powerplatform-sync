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

## Results on 2026-09-28 — version 0.9.0

Verified **144 Node tests**, syntax checks for **62 JavaScript files**, **19 native SWT picker checks**, **13 selected-object Archi checks**, **32 scoped Archi checks**, **13 plug-in Archi checks**, **12 table Documentation checks**, **21 flow Process checks** and **22 bulk Archi checks**.

Selection tests cover all six component script groups, cancellation/empty selection before enrichment, unchecked component and membership preservation, selected versus unchecked dependency owners, Dataverse identity aliases, shared solution membership, copied environment IDs, missing unchecked reference targets, agent flow tools, view/table references and automatic registered tables for checked plug-ins. Native dialogs verify defaults, filtering, cross-environment selection, empty scope and cancellation. The real Archi test imports a single table/view while preserving unchecked IDs, properties, Documentation, links and diagrams; only the checked table triggers field-list collection. Save/reload and selected plug-in Access endpoints pass.

All model tests use disposable local models. No collection API changed, so this release did not require a new live tenant read. Run the added model test with `tools/test-archi.ps1 -BundlesFile '<effective-configuration>/org.eclipse.equinox.simpleconfigurator/bundles.info' -Script object-selection-archi-smoke.ajs`.

## Results on 2026-09-28 — version 0.8.0

Verified **131 Node tests**, syntax checks for **60 JavaScript files**, **12 table Documentation checks**, **32 scoped Archi checks**, **13 plug-in Archi checks**, **21 flow Process checks**, **22 bulk Archi checks** and **6 live table-field checks**.

The new suites exercise localized field labels, technical-name sorting, numbered Markdown, markup escaping, schema-name/type fallbacks, system/virtual fields, duplicate rows, partial reads, generated-section replacement, unchanged manual notes, damaged markers, updates made during preview, stable IDs/diagrams, idempotence, Undo/Redo and save/reload. The live test used the previously approved environment and read only metadata for its account table. All **243 fields** were written as numbered entries in a disposable Archi model and saved/reloaded successfully. Existing user models and Power Platform configuration were not changed.

Run the new tests with:

```powershell
.\tools\test-archi.ps1 -BundlesFile '<effective-configuration>\org.eclipse.equinox.simpleconfigurator\bundles.info' -Script table-fields-archi-smoke.ajs
$env:ARCHI_PP_TEST_ENVIRONMENT = '<approved-environment-id>'
$env:ARCHI_PP_TEST_TABLE = 'account'
.\tools\test-archi.ps1 -BundlesFile '<effective-configuration>\org.eclipse.equinox.simpleconfigurator\bundles.info' -Script table-fields-live-smoke.ajs
```

## Results on 2026-09-28 — version 0.7.0

Verified **122 Node tests**, syntax checks for **57 JavaScript files**, **21 flow Process checks**, **18 plug-in Function migration checks**, **13 plug-in Archi checks**, **32 scoped Archi checks** and **22 bulk Archi checks**.

The new `flow-processes-archi-smoke.ajs` suite verifies fresh multi-solution get-flows retrieval, legacy Component conversion, membership links from both selected and unselected solutions, stable concept/relationship IDs, manual and repeated properties, documentation, specializations, child-flow Triggering, environment/agent Serving, diagrams, incompatible manual-link preflight, Undo/Redo, repeated retrieval, save/reload, bulk conversion and mixed flow/plug-in migration. The Node suite also checks that unobserved legacy endpoints retain their actual type during relationship validation. Existing generic script tests exercise the renamed flows action, including rejection of incorrect multi-selection before authentication.

These tests use synthetic metadata and disposable Archi models. The Dataverse workflows API and metadata collection boundaries are unchanged; no new live tenant read was needed.

## Results on 2026-09-28 — version 0.6.0

Verified **119 Node tests**, syntax checks for **56 JavaScript files**, **18 Function migration checks**, **13 plug-in Archi checks**, **32 scoped Archi checks** and **22 bulk Archi checks**. The migration suite exercises existing Component models, both solution membership links during table-context retrieval, unchanged IDs, manual/duplicate properties, documentation, specializations, Access/Serving links, diagram layout/connections, invalid manual-link preflight, unselected legacy plug-ins, save/reload, and Undo/Redo. Related plug-ins connected by a valid manual Aggregation convert as one batch. Repeated retrieval creates no duplicate elements or relationships.

All model changes in these tests targeted disposable local models. Power Platform collection APIs were unchanged; this release did not require another live metadata read.

## Results on 2026-09-28 — version 0.5.1

Verified **117 Node tests**, syntax checks for **55 JavaScript files**, and **13 plug-in Archi checks**. The disposable Archi test confirms that solution retrieval names the plug-in Application Component using PowerPlatform-PluginTypeName while preserving the friendly name in properties. A subsequent multi-table refresh replaces a legacy friendly element name on the same concept, retains its GUID and manual notes, and preserves registration/Access behavior. This narrow naming change did not require new live API reads.

## Results on 2026-09-28 — version 0.5.0

Verified **117 Node tests**, syntax checks for **55 JavaScript files**, **32 scoped Archi checks**, **22 bulk Archi checks**, **13 plug-in Archi checks**, **27 live scoped checks** and **12 live plug-in checks**. The tests cover English selection ahead of a Polish user label, alternate language settings, deterministic missing-translation fallback, label-read failures, technical table/view names, and updates that preserve existing element GUIDs, manual properties/documentation and diagram occurrences.

A narrow live read demonstrated the language difference directly: the connection returned a Polish system-view name, while RetrieveLocLabels returned its English translation. The table became account and the view received its table/GUID technical identifier; English display-name properties and an English Active choice label were verified. No user or organization language setting was changed.

The two-solution live run verified all **15 table names** against logical/schema identifiers and all **111 view identifiers** with English (LCID 1033) display-name properties. The disposable model retained **175 elements and 423 relationships**, and refresh preserved every GUID. The live plug-in test again produced **42 elements**, **19 Access relationships** and **76 relationships total**, with localized choice metadata readable for plug-in assemblies and steps. Existing user models were not edited.

## Results on 2026-09-28 — version 0.4.0

Verified **108 Node tests** and syntax checks for **54 JavaScript files**. Real-runtime checks passed: **13 plug-in Archi checks**, **27 scoped compatibility checks**, **22 bulk compatibility checks**, **12 SWT dialog checks**, **12 live plug-in checks**, and **19 live scoped checks**.

The plug-in suite covers table and solution multi-selection, wrong/mixed types before authentication, direct type/assembly/step solution membership, shared types, copied environments, global registrations, workflow-activity exclusion, partial reads, relationship retirement across table/solution runs, metadata exclusion and preservation of manual content.

The approved live plug-in test used two solutions and two tables. Its disposable model contained **37 plug-in types**, **2 tables**, **2 solutions** and **1 environment**, with **19 Access relationships**, **76 relationships total** and **2,813 added metadata properties**. A repeated table batch created no duplicate elements or links, retained every GUID, and saved/reloaded successfully. All Access relationships used the actual unspecified access type. Global registrations did not receive fabricated table links.

The scoped live test exercised all six component groups with property enrichment. It produced **175 elements and 423 relationships**: 1 environment, 2 solutions, 2 apps, 23 flows, 3 agents, 15 tables, 111 views and 18 plug-in types. Static dependency targets outside the imported inventory remain reported; successful metadata retrieval does not assert full runtime dependency coverage.

A separate read-only metadata audit checked available attributes for solution, canvasapp, appmodule, workflow, bot, savedquery, role, plugintype, pluginassembly and sdkmessageprocessingstep, plus table-definition properties. Additional-field reads succeeded for the existing app/flow/agent/view/role types. The [property catalogue](metadata-properties.md) records the exact allowlist and exclusions. Code/generic apps retain Resource Graph metadata coverage rather than a fabricated Dataverse mapping.

Run the additional plug-in tests with:

```powershell
.\tools\test-archi.ps1 -BundlesFile '<effective-configuration>\org.eclipse.equinox.simpleconfigurator\bundles.info' -Script plugins-archi-smoke.ajs
$env:ARCHI_PP_TEST_ENVIRONMENT = '<approved-environment-id>'
$env:ARCHI_PP_TEST_SOLUTIONS = '<first-solution-id>,<second-solution-id>'
$env:ARCHI_PP_TEST_TABLES = '<first-table-id>,<second-table-id>'
.\tools\test-archi.ps1 -BundlesFile '<effective-configuration>\org.eclipse.equinox.simpleconfigurator\bundles.info' -Script plugins-live-smoke.ajs
```

These tests changed only new disposable models. Existing user models and Power Platform configuration were not modified.

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
