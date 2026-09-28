# Archi Power Platform Sync

Retrieve Power Platform environments, solutions and their components into an open Archi model using context-specific scripts. Version **0.6.0**. Apps, cloud flows, agents, tables and views can each be retrieved for one or more selected solutions in a single batch. Plug-ins can be retrieved from selected solutions or tables. The original environment-wide sync remains available for broader inventory and custom Dataverse security roles.

The tool uses your existing **Azure CLI user sign-in**. It makes metadata reads, previews the resulting model changes, and updates the model only after you select **Apply**. Save and commit the model through your normal Archi/coArchi workflow. It does not write to Power Platform or commit an Archi repository automatically.

## Quick start

Requirements: Archi with jArchi using **GraalJS**, Azure CLI **2.54+**, and an interactive user account with the appropriate Power Platform and Dataverse read access. Tested on Windows with Archi 5.10.0 and jArchi 1.12.0. Node.js is needed only for development and the optional terminal diagnostic.

1. Sign in from a terminal:

   ```powershell
   az login --allow-no-subscriptions
   ```

   If tenant selection is necessary, add `--tenant <tenant-id>`. Activate any required administrator role before signing in. An Azure subscription is not required.

2. Install the script package from this repository:

   ```powershell
   .\tools\Install-ArchiScripts.ps1
   ```

   Or copy the entire package to `Documents\Archi\scripts\archi-powerplatform-sync`. Keep `scripts`, `lib` and `config` together. Refresh the jArchi Scripts tree if needed.

3. Open the target Archi model. Run **archi-powerplatform-sync / scripts / get-environments.ajs**. Check the environments to import; optionally assign architecture stages. Review the preview and apply. This creates only environment Nodes.
4. Select one or more imported environment Nodes in the model tree or a diagram (Ctrl-click or Shift-click on Windows). Run **get-solutions.ajs**, choose solutions in the combined searchable popup, review and apply. The popup identifies each solution's environment.
5. Select one or more imported solution Application Components. Run **get-applications.ajs**, **get-workflows.ajs**, **get-agents.ajs**, **get-tables.ajs** or **get-views.ajs** to retrieve that component type. The entire selection is validated before authentication or API calls; wrong or mixed types stop the run. Each batch has one combined preview and Apply step.
6. Select multiple imported tables or multiple solutions and run **get-plugins.ajs** to retrieve plug-in types and their registered-table Access relationships. Keep one context type per selection.
7. Inspect and save the model. Rerun a component command after importing its referenced components to resolve additional links.

See the [context workflow guide](docs/context-workflow.md) for selection rules, shared components and the difference between solution membership and runtime dependencies.

The initial environment selection is empty. Later runs remember environment and role IDs in the model. New environments remain unchecked. **Deselecting an environment or role preserves its existing elements and relationships.** Copied environments remain distinct even when object IDs and names match.

## Model structure

Each relevant Archi category gets a `PowerPlatform` root. There is no tenant folder or tenant element.

```text
Technology / PowerPlatform / Environment [short ID] / Environment node
Application / PowerPlatform / Environment [short ID] / Applications
                                                      Solutions
                                                      Flows
                                                      Agents
                                                      Tables
                                                      Views
                                                      Plugins
Business / PowerPlatform / Environment [short ID] / Security Roles
Relations / PowerPlatform / Environment [short ID] / Relationships
```

| Source | ArchiMate element |
| --- | --- |
| Power Platform environment | Node |
| Dataverse solution | Application Component |
| Canvas, model-driven and code app | Application Component |
| Power Automate cloud/agent flow | Application Component |
| Copilot Studio agent | Application Component |
| Dataverse table or system view | Data Object |
| Dataverse plug-in type | Application Function |
| Selected custom Dataverse security role | Business Role |

Environments **serve** their solutions, apps, flows and agents. Solutions **aggregate** application components and have membership **associations** to tables and views. A view has a **view-of association** to its imported table. Explicit child-flow calls use **Triggering**; flow tools **serve** their agents; declared solution dependencies and app-role access mappings use **Association**. See [architecture and mappings](docs/architecture.md).

Tables and views can be imported through their specific solution-context scripts. **get-plugins** also imports registered table definitions needed for Access relationships. Columns, business rules, users, teams, connections and connectors are not created as model elements. Dataverse views are represented as Data Objects; no Archi diagrams are generated or rearranged.

Components shared by several selected solutions keep one element per environment, with multiple solution membership links. They remain in the environment's component-type folders, so retrieving another solution neither duplicates nor moves them. References between components collected in the same batch resolve regardless of selection order.

All supported element types now receive additional descriptive metadata properties, including versions, publication dates, ownership IDs, state/configuration flags and table capabilities. Plug-ins also carry assembly and registration metadata. See the [exact property catalogue](docs/metadata-properties.md) and [plug-in workflow](docs/plugins.md).

## Other scripts

| Script | Purpose |
| --- | --- |
| Sync Power Platform | Original environment-wide inventory, dependency discovery and custom-role review; does not discover solutions/tables/views |
| Select Environments | Store environment choices and architecture stages without synchronizing |
| Test Power Platform Connection | Read selected metadata and report counts, coverage and warnings |
| Export Power Platform Inventory | Save the normalized inventory and evidence as JSON, without modifying the model |

These compatibility scripts use the environment picker. The diagnostic and export also offer the role picker. Exported inventory contains organization metadata and should be handled accordingly; it excludes access tokens, raw flow definitions, connection parameters and agent topic content.

## Authentication and coverage

No new app registration, client secret or PAC installation is needed for the verified Azure CLI route. Tenant consent or conditional-access policy may restrict another account; errors are reported rather than automatically changing authentication configuration. Power Platform Administrator alone does not guarantee every Dataverse read. See [authentication](docs/authentication.md).

Discovery combines the Power Platform environment API, Power Platform inventory in Azure Resource Graph and Dataverse Web API. The environment API and parts of the inventory schema are preview dependencies. Inventory can lag behind Dataverse. [Coverage and limitations](docs/coverage.md) explains what can and cannot establish a dependency or a deletion.

Custom-role classification is deliberately reviewable: Microsoft does not expose a universal `isCustomRole` flag. Template and system-generated roles are excluded by default; other managed roles remain candidates, not automatically selected custom roles. Configure exact IDs or known solution publisher prefixes in [settings.js](config/settings.js) when useful.

## Names and language

Tables use their logical name (schema name if needed) as the Archi element name. Dataverse system views have no per-view logical/schema name, so their stable name is `<table-logical-name>.view.<savedqueryid>`. The display name is stored in `PowerPlatform-DisplayName` and `PowerPlatform-ObjectName`; `PowerPlatform-TechnicalName` records the identifier used as the element name.

Plug-ins use `PowerPlatform-PluginTypeName` (Dataverse `typename`) as the element name. Their friendly name stays in `PowerPlatform-DisplayName` and `PowerPlatform-ObjectName`. Rerun `get-plugins` from selected solutions or tables to refresh existing plug-in elements. From version 0.6.0, the preview also converts previously imported plug-in Components to Application Functions and their solution membership links to Associations. Archi IDs, properties, Access links and diagram occurrences are retained. See [plug-in migration](docs/plugins.md#upgrading-existing-plug-ins).

`config/settings.js` includes `labelLanguage:"en-US"` by default. This selects English metadata labels independently of the connected user's language. Supported language tags such as `pl-PL` and numeric Dataverse LCIDs are also accepted. The default also applies to preserved configuration files that omit this setting. See [naming and language behavior](docs/naming-and-language.md) for translation coverage and fallbacks.

Rerun `get-tables` and `get-views`, review the preview and Apply to rename previously imported elements while retaining their GUIDs, relationships, manual notes and diagram occurrences.

## Reconciliation

- Stable identities include tenant, environment, object kind and source ID; known source aliases preserve the same Archi concept when discovery sources differ between runs.
- Manual documentation, custom properties, diagrams and matching manual relationships are preserved. The synchronizer owns imported names, `PowerPlatform-*` properties, lifecycle properties and its managed folders/relationships.
- Unobserved objects are preserved. A successful complete Dataverse read, an unrestricted organization context and a fresh primary-ID 404 are required to mark a previously imported Dataverse object deleted.
- Deletion is a reversible `IsDeleted=yes` property update. Elements and relationships are never physically removed. A returning object reuses its original GUID.
- Context scripts never mark absent component objects deleted. A complete refresh may retire a removed membership link for only the selected solution and component type. Other solution memberships remain intact.
- Incomplete or unresolved dependency reads preserve prior evidence for the affected collection. Source records do not become links merely because they use the same connector.
- Cancellation before Apply leaves the model unchanged. Apply errors require **Edit > Undo** before retrying. The model is never automatically saved.

## Development

No npm packages are required:

```powershell
npm test
npm run check
node tools/diagnose.cjs --list
node tools/diagnose.cjs --environment <environment-id> --full --save work/my-inventory.json
node tools/diagnose-scoped.cjs --environment <environment-id> --list-solutions
node tools/diagnose-scoped.cjs --environment <environment-id> --solution <solution-id> --kind tables
node tools/diagnose-scoped.cjs --environment <environment-id> --table <table-id> --kind plugins
```

Real Archi/SWT tests and the opt-in live integration test are described in [verification](docs/verification.md). Generated test models and inventories are ignored by Git.

The design follows the existing `archi-azure-sync` conventions while keeping this Power Platform implementation in an independent Git repository. See [provenance](docs/provenance.md).
