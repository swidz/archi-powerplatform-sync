# Context-specific retrieval

The normal workflow is **environment → solution → component type**. Each stage is a separate script. It reads metadata, displays a preview and applies changes to the open model only after confirmation.

| Script | Required selection | Result |
| --- | --- | --- |
| `get-environments.ajs` | Open model | Multi-select popup; creates or updates only environment Nodes |
| `get-solutions.ajs` | One or more imported environment Nodes | Combined multi-select popup; creates or updates selected solutions |
| `get-applications.ajs` | One or more imported solution Application Components | Canvas and model-driven apps in those solutions |
| `get-flows.ajs` | One or more imported solution Application Components | Power Automate cloud-flow definitions in those solutions |
| `get-agents.ajs` | One or more imported solution Application Components | Copilot Studio agents in those solutions |
| `get-tables.ajs` | One or more imported solution Application Components | Table definitions represented as Data Objects |
| `get-views.ajs` | One or more imported solution Application Components | System views represented as Data Objects |
| `get-plugins.ajs` | One or more imported table Data Objects **or** solution Application Components; one context type per selection | Plug-in types and Access relationships to registered tables |

Use Ctrl-click or Shift-click in the model tree on Windows to select several contexts, then run the desired script. Selection can also come from element occurrences in a diagram. Several occurrences of the same concept resolve to one context. Solutions may belong to different environments, provided they belong to the same tenant and active model. The signed-in tenant must match every selected context.

Before authentication or API calls, every selected object must match both the required Power Platform object kind and ArchiMate base type. Folders, relationships, manual elements, deleted contexts, elements from another model, corrupt identities and mixed types stop the entire run with an error identifying the problem. For example, selecting a solution and an app together cannot run `get-applications`, even though both are Application Components. `get-solutions` requires actual environment Nodes; an environment folder or an app cannot supply context.

All selected environments must be available and have a readable Dataverse URL before per-context collection begins. Collection completes across all contexts before one combined preview and Apply step. Cancelling or a fatal error in a later context leaves the whole model unchanged. Recoverable partial reads are reported in the preview and preserve existing links in affected environments.

The solution picker supports search, sorting and multi-selection across all selected environments, with Environment and Environment ID columns. Selection uses environment-qualified identities, so copies with the same solution GUID remain independent. It shows platform-visible solutions by default; set `includeHiddenSolutions:true` in `config/settings.js` to include internal/hidden solutions. New solutions start unchecked, while previously imported solutions are checked. Deselecting a solution preserves its existing content. There is no tenant folder or tenant element.

**get-plugins** also supports multiple table contexts. Its selection must contain only tables or only solutions, never both. The [plug-in guide](plugins.md) explains registration scope and automatic table endpoints. Every retrieval script enriches observed elements using the [metadata property catalogue](metadata-properties.md) before the common preview.

## Layer and folder mapping

Environments remain Technology-layer **Nodes**. Solutions, applications and agents are Application-layer **Application Components**. Flows are Application-layer **Application Processes**. Plug-ins are Application-layer **Application Functions**. Tables and system views are Application-layer **Data Objects**. Custom Dataverse roles retain their Business-layer **Business Role** mapping and are available through the original `Sync Power Platform` workflow.

Under each category, the root remains `PowerPlatform / Environment [short ID]`. The Application category contains sibling folders `Solutions`, `Applications`, `Flows`, `Agents`, `Tables`, `Views` and `Plugins` as needed.

A component has one canonical identity per tenant/environment/kind/source ID, even when it belongs to several solutions. Membership is represented by links, rather than duplicate elements or placing a shared component into one solution's folder. Application components use **Aggregation** from the solution. Data Objects, flow Processes and plug-in Functions use **Association**, labelled through `PowerPlatform-InteractionKind=solution-member`. Membership describes packaging and does not assert runtime invocation.

## Metadata boundaries

Solution membership comes from `solutioncomponents` filtered by both the selected solution ID and the requested component types. Component metadata is read in bounded ID batches. The solution itself is refreshed with name, unique name, version, publisher and managed status. Agents' component type is discovered from the organization's `solutioncomponentdefinitions` for `bot`, because modern component codes are not universally enumerated by the static SDK list. Failure to discover that code leaves agent membership incomplete and preserves prior links.

Tables use `EntityDefinitions`, with names, schema/entity-set names, descriptions and custom/managed flags. Field names, labels and data types are read from each table's Attributes metadata and listed in its Documentation. Fields are not separate model elements. Keys, table relationships, records and data contents are not loaded.

Views use `savedqueries`, with their name, description, table logical name, query type and managed/custom flags. Their FetchXML, layout XML and query results are not retrieved. Personal `userquery` views are outside solution scope.

Some solutions include a table with **Include Subcomponents** (`rootcomponentbehavior=0`) instead of listing every view separately. `get-views` includes those table views as well as explicit type-26 members. Table shells and roots configured to exclude subcomponents do not expand to all views. Duplicate view IDs are collapsed. An imported view links to its table when both are available in the model; importing tables after views also establishes that link.

`get-flows` retains the original cloud-flow boundary: category 5, definition type 1. Classic workflows/business rules are excluded and counted separately in the preview, so they are not confused with failed metadata reads. Component libraries/custom pages are likewise excluded from app components. Code apps still rely on environment-wide inventory in this version; solution-context application retrieval covers canvas and model-driven apps.

## Dependencies and incremental use

With `discoverDependencies=true`, component scripts also read static child-flow references, explicit agent-flow tools and declared app/flow dependencies. References resolve after all selected solutions have been read, so a reference to a component collected later in the same batch resolves immediately. Shared components and repeated evidence are deduplicated. Dependencies may also link to another component already imported into the same environment, without refreshing that component or recursively importing unrelated objects. A view-to-table link uses only its explicit table logical name.

When an endpoint has not yet been imported, the script reports an unresolved reference. Import it through the relevant solution/type script, then rerun the originating component script. Runtime calls cannot be inferred from shared connectors or mere solution membership. Cross-environment dependencies are not guessed.

Each script updates only its observed objects and completed evidence scopes. A table run cannot retire app/flow/agent membership. A solution-A refresh cannot retire unselected solution-B membership. A failed page or denied metadata read protects prior links throughout its environment for that batch, including shared objects read successfully in another selected solution. An unresolved endpoint protects its own evidence scope. Rerun a complete batch to reconcile removals. A component removed from a solution stays in the model; only its membership link can receive the reversible `IsDeleted=yes` marker.

Context runs record `PowerPlatform-LastSyncScope` on the model. Their success status describes that action's scope, not full environment coverage. They do not overwrite the saved environment-wide role selection.

## Upgrading existing flows

Version 0.7.0 replaces `get-workflows.ajs` with `get-flows.ajs`. Select one or more imported solution Application Components and run get-flows. The same selection validation and combined preview apply. Newly imported flows are Application Processes. Applying a refresh also converts observed legacy flow Components to Processes; environment-wide sync uses the same mapping and migration.

Conversion retains concept IDs, names, documentation, manual properties, diagram occurrences and connections. Solution membership Aggregations become Associations with the same relationship IDs, including memberships in solutions outside the current selection. Environment Serving, child-flow Triggering and flow-to-agent Serving remain valid. Unobserved flows keep their existing types until retrieved. An incompatible manual relationship blocks the operation before any changes, identifying the relationship to adjust. Undo/Redo covers the conversion together with the retrieval update. Review and save the model normally after Apply.

When `useSpecializations=true`, the Power Automate Flow specialization is recreated for Application Process. Otherwise, the preview warns if conversion removes an existing Component specialization. Dataverse still calls the source API collection `workflows`; the script rename does not change its cloud-flow filter or metadata properties.

## Compatibility and installation

Version 0.8.0 reuses 0.1.0–0.7.0 element identities, lifecycle properties and folder keys. No manual replacement or full reimport is required; get-flows and get-plugins preview the type migration for observed legacy flows and plug-ins. The installer replaces the former get-workflows script with get-flows. Install the updated package with `tools/Install-ArchiScripts.ps1`; existing `config/settings.js` is preserved. Refresh the Scripts tree after installation. Single-element selection remains supported, subject to the same strict type checks. The next table/view refresh applies technical element names to the existing concepts. get-plugins also migrates observed legacy plug-in Components to Application Functions, retaining IDs. See [plug-in migration](plugins.md#upgrading-existing-plug-ins). The default label language is en-US even when the preserved settings file has no labelLanguage setting. See [names and language](naming-and-language.md).

The original `Sync Power Platform`, `Select Environments`, connection diagnostic and inventory export remain available. Environment-wide sync leaves solutions/tables/views untouched when they are not part of its collection scope.

Official references: [solution concepts](https://learn.microsoft.com/en-us/power-platform/alm/solution-concepts-alm), [solution API and newer component types](https://learn.microsoft.com/en-us/power-platform/alm/solution-api), [solution component metadata](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/solutioncomponent?view=dataverse-latest), [table metadata queries](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-metadata-web-api), [saved query metadata](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/savedquery?view=dataverse-latest).
