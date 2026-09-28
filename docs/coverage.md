# Coverage and known limitations

Version 0.7.0 includes flow Application Processes, solutions, table/system-view Data Objects, and plug-in Application Functions through explicit context scripts. See [context workflow](context-workflow.md). The original environment-wide collection remains available and keeps its previous EA-level scope; it does not automatically import tables, views or plug-ins.

## Sources

| Source | Implemented use | Boundary |
| --- | --- | --- |
| Power Platform environment API, `2022-03-01-preview` | Enumerate names, IDs, types, regions, state and Dataverse URL | Preview contract; fallback to Resource Graph on read failure |
| Azure Resource Graph, `2022-10-01`, `PowerPlatformResources` | Selected-environment app, flow and agent inventory | Indexed and eventually consistent; not authoritative for deletion |
| Dataverse global discovery v2.0 | Organization/API URLs and sysadmin context | Returns accessible organizations; does not replace tenant environment discovery |
| Dataverse Web API v9.2 | Model-driven apps, canvas apps, cloud flows, agents, roles and supported relationship metadata | Effective organization read access is required; no reads of business data |
| Scoped Dataverse solution membership | Solution metadata; requested apps/flows/agents/tables/views/plug-ins | Requires a selected environment/solution; no object deletion inferred from removed membership |

Environment discovery shows disabled and previously selected unavailable entries without allowing them to be checked. An epoch `deletedDateTime` is treated as the environment API's non-deleted sentinel. Unavailable or deselected environments never trigger model deletion.

Power Platform inventory includes published model-driven apps, whereas direct Dataverse reads can expose additional apps or flows. Records with different IDs remain distinct even if their names match. Environment copies are not merged. Specialized connectors and code apps depend on available inventory coverage; code apps have no separate Dataverse detail collector.

## Apps, flows and agents

- Canvas apps use `canvasapptype=0`, excluding custom pages and component libraries as standalone architecture components. Model-driven apps use `appmodules`.
- Flows use Dataverse `workflow` records with `category=5` and `type=1`, plus inventory cloud/agent flows. Classic workflows, business rules and desktop automation internals are not imported by the flow collector. Plug-ins have a separate get-plugins command.
- Flow definitions are inspected only for static child-flow Workflow actions, including nested branches and scopes. Arbitrary HTTP calls, dynamic workflow expressions and all connector operations are not resolved into component links.
- App-to-flow relationships come from explicit Dataverse solution dependencies where both endpoints resolve. This does **not** comprehensively parse canvas Power Fx, unpack `.msapp` files or prove all runtime calls.
- Agents use inventory and Dataverse `bot` metadata. Flow tools use `botcomponent_workflow` together with parent/associated bot IDs. Topics and their content are not model elements. Knowledge sources, websites, custom tools and external integrations are not comprehensively enumerated.
- Matching connector IDs are descriptive metadata only. They do not prove that two components interact. HTTP endpoints and secrets are not retained from action inputs.

Microsoft documents Dataverse APIs for programmatic flow management; this implementation avoids unsupported direct reliance on `api.flow.microsoft.com`.

## Plug-ins and properties

[get-plugins](plugins.md) accepts multiple tables or multiple solutions and uses explicit processing-step registrations for table Access relationships. It includes disabled registrations and managed/Microsoft types in the selected scope. Global/unbound registrations have no invented table links. Assemblies/steps are properties, not additional elements. The [property catalogue](metadata-properties.md) documents added fields and excluded payloads/secrets for every supported kind.

## Custom security roles

The scope is **Dataverse security roles only**. Entra directory roles, individual users, teams and privilege matrices are excluded.

Roles with `roletemplateid` or `issytemgenerated=true` are excluded unless an exact configured role ID explicitly includes them. Remaining unmanaged roles are labelled `custom-candidate`; managed roles are labelled `unclassified-managed`. Neither label is proof that the role is customer-defined. The native role picker lets an architect make the scope explicit.

`roleIds` preselects exact roles; `excludeRoleIds` excludes exact roles. `rolePublisherPrefixes` can identify roles shipped in known customer/ISV solutions. Publisher matching uses solution metadata and is skipped unless configured. `includeUnclassifiedRoles` defaults to false and should remain false unless the broader selection is intentional.

Grouping uses `parentrootroleid` so business-unit copies produce one architecture role. App associations resolve through every known copy ID. App-role links express configuration, not effective authorization for any specific user.

## Partial results and reconciliation

Collectors record coverage independently. A 403 or failed page preserves previous data for the unread scope. Malformed IDs, invalid paging hosts, duplicate identities or incompatible ArchiMate mappings stop the operation before Apply.

Unresolved dependency endpoints are listed with their source IDs and reason in the Scripts output/export. No placeholder element or guessed relationship is created. Prior evidence for an affected dependency owner is retained; for the solution dependency collection this protection covers the environment's prior solution dependency evidence.

Missing inventory is not proof of deletion. Per-ID Dataverse confirmation uses the saved primary ID and only runs after a complete collection with sysadmin discovery context. Sources without this proof, including environments and inventory-only app types, remain unverified. The retained `IsDeleted` property is descriptive; it does not automatically remove or hide a concept from existing diagrams.

## Verified live observations, 2026-09-27

The read-only test enumerated 41 environments, of which 38 were available. In the selected environment all implemented object collections completed: **34 apps, 339 flows, 52 agents** and **277 role candidates**. Of those role candidates, 3 were unmanaged custom candidates and 274 required managed-role classification. This does not claim that all 277 are custom roles.

With no role candidates selected, the collector returned **130 dependency observations**: 43 child-flow references, 25 flow-to-agent tool references and 62 declared solution dependencies. There were **28 unresolved solution-dependency records** whose endpoints were not both in the readable, in-scope inventory. Environment-serving links are added separately by the planner. These counts are an observed sample, not a tenant-wide completeness claim or future expected totals.

## Sources

- [Power Platform inventory](https://learn.microsoft.com/en-us/power-platform/admin/power-platform-inventory)
- [Inventory schema](https://learn.microsoft.com/en-us/power-platform/admin/inventory-schema)
- [Inventory sample queries](https://learn.microsoft.com/en-us/power-platform/admin/inventory-sample-queries)
- [Manage cloud flows with code](https://learn.microsoft.com/en-us/power-automate/manage-flows-with-code)
- [Canvas app Web API reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/canvasapp?view=dataverse-latest)
- [Workflow Web API reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/workflow?view=dataverse-latest)
- [Bot component Web API reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/botcomponent?view=dataverse-latest)
- [Role Web API reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/role?view=dataverse-latest)
- [App module Web API reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/appmodule?view=dataverse-latest)
