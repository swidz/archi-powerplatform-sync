# Context-specific retrieval

The normal workflow is **environment → solution → component type**. Each stage is a separate script. It reads metadata, displays a preview and applies changes to the open model only after confirmation.

| Script | Required selection | Result |
| --- | --- | --- |
| `get-environments.ajs` | Open model | Multi-select popup; creates or updates only environment Nodes |
| `get-solutions.ajs` | An imported environment Node, its environment folder, or a managed element in that environment | Multi-select popup; creates or updates selected solutions |
| `get-applications.ajs` | One imported solution | Canvas and model-driven apps in that solution |
| `get-workflows.ajs` | One imported solution | Power Automate cloud-flow definitions in that solution |
| `get-agents.ajs` | One imported solution | Copilot Studio agents in that solution |
| `get-tables.ajs` | One imported solution | Table definitions represented as Data Objects |
| `get-views.ajs` | One imported solution | System views represented as Data Objects |

Selection can come from the model tree or from an element occurrence in a diagram. Several occurrences of the same solution resolve to one context. Conflicting environments/solutions, unowned objects and a missing selection are rejected before collection; the script never silently reuses a previous solution. The signed-in tenant must match the selected object.

The solution picker supports search, sorting and multi-selection. It shows platform-visible solutions by default; set `includeHiddenSolutions:true` in `config/settings.js` to include internal/hidden solutions. New solutions start unchecked, while previously imported solutions are checked. Deselecting a solution preserves its existing content. There is no tenant folder or tenant element.

## Layer and folder mapping

Environments remain Technology-layer **Nodes**. Solutions, applications, flows and agents are Application-layer **Application Components**. Tables and system views are Application-layer **Data Objects**. Custom Dataverse roles retain their Business-layer **Business Role** mapping and are available through the original `Sync Power Platform` workflow.

Under each category, the root remains `PowerPlatform / Environment [short ID]`. The Application category contains sibling folders `Solutions`, `Applications`, `Flows`, `Agents`, `Tables` and `Views` as needed.

A component has one canonical identity per tenant/environment/kind/source ID, even when it belongs to several solutions. Membership is represented by links, rather than duplicate elements or placing a shared component into one solution's folder. Application components use **Aggregation** from the solution. Data Objects use **Association**, labelled through `PowerPlatform-InteractionKind=solution-member`. Membership describes packaging and does not assert runtime invocation.

## Metadata boundaries

Solution membership comes from `solutioncomponents` filtered by both the selected solution ID and the requested component types. Component metadata is read in bounded ID batches. The solution itself is refreshed with name, unique name, version, publisher and managed status. Agents' component type is discovered from the organization's `solutioncomponentdefinitions` for `bot`, because modern component codes are not universally enumerated by the static SDK list. Failure to discover that code leaves agent membership incomplete and preserves prior links.

Tables use `EntityDefinitions`, with names, schema/entity-set names, descriptions and custom/managed flags. Columns, keys, relationships, records and data contents are not loaded.

Views use `savedqueries`, with their name, description, table logical name, query type and managed/custom flags. Their FetchXML, layout XML and query results are not retrieved. Personal `userquery` views are outside solution scope.

Some solutions include a table with **Include Subcomponents** (`rootcomponentbehavior=0`) instead of listing every view separately. `get-views` includes those table views as well as explicit type-26 members. Table shells and roots configured to exclude subcomponents do not expand to all views. Duplicate view IDs are collapsed. An imported view links to its table when both are available in the model; importing tables after views also establishes that link.

`get-workflows` retains the original cloud-flow boundary: category 5, definition type 1. Classic workflows/business rules are excluded and counted separately in the preview, so they are not confused with failed metadata reads. Component libraries/custom pages are likewise excluded from app components. Code apps still rely on environment-wide inventory in this version; solution-context application retrieval covers canvas and model-driven apps.

## Dependencies and incremental use

With `discoverDependencies=true`, component scripts also read static child-flow references, explicit agent-flow tools and declared app/flow dependencies. Dependencies may link to another component already imported into the same environment, without refreshing that component or recursively importing unrelated objects. A view-to-table link uses only its explicit table logical name.

When an endpoint has not yet been imported, the script reports an unresolved reference. Import it through the relevant solution/type script, then rerun the originating component script. Runtime calls cannot be inferred from shared connectors or mere solution membership. Cross-environment dependencies are not guessed.

Each script updates only its observed objects and completed evidence scopes. A table run cannot retire app/flow/agent membership. A solution-A refresh cannot retire solution-B membership. A failed page, denied metadata read or unresolved endpoint protects prior evidence. A component removed from a solution stays in the model; only its membership link can receive the reversible `IsDeleted=yes` marker.

Context runs record `PowerPlatform-LastSyncScope` on the model. Their success status describes that action's scope, not full environment coverage. They do not overwrite the saved environment-wide role selection.

## Compatibility and installation

Version 0.2.0 reuses 0.1.0 element identities, lifecycle properties and folder keys. No migration or reimport is required. Install the updated package with `tools/Install-ArchiScripts.ps1`; existing `config/settings.js` is preserved. Refresh the Scripts tree to see the seven new `get-*` commands.

The original `Sync Power Platform`, `Select Environments`, connection diagnostic and inventory export remain available. Environment-wide sync leaves solutions/tables/views untouched when they are not part of its collection scope.

Official references: [solution concepts](https://learn.microsoft.com/en-us/power-platform/alm/solution-concepts-alm), [solution API and newer component types](https://learn.microsoft.com/en-us/power-platform/alm/solution-api), [solution component metadata](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/solutioncomponent?view=dataverse-latest), [table metadata queries](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-metadata-web-api), [saved query metadata](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/savedquery?view=dataverse-latest).
