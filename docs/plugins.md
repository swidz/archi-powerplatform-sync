# Plug-in retrieval

Run **get-plugins.ajs** with either one or more imported **table Data Objects**, or one or more imported **solution Application Components** selected in the model tree or a diagram. All selected items must have the same Power Platform object type. Mixed tables/solutions, views, folders, manual objects and other types are rejected before authentication or API calls.

Like the other component scripts, this command collects all matching plug-ins and then shows one combined change preview. It does not add a separate plug-in checkbox picker.

## Model mapping

Each Dataverse plugintype becomes one **Application Component**, under Application / PowerPlatform / Environment / Plugins. Shared types keep one element per environment. Assemblies and processing steps are properties of that element.

Each explicit table-specific processing-step registration creates an **Access relationship from the plug-in to the primary registered table**. The actual jArchi accessType is set to **access**, leaving read/write unspecified. A registered Create, Update or Retrieve message does not prove what the implementation does internally. Several steps on the same table share one Access link with separate evidence records.

Enabled and disabled registrations are included; their state, stage, mode, execution order, message and filtering attributes are properties. Global/unbound registrations and types without table-specific registrations remain documented without an invented table endpoint. A secondary table name is retained in registration properties; it is not inferred as another primary registration. Workflow activity types and webhook/service-endpoint handlers are excluded from plug-in concepts. Microsoft/managed plug-in types returned for the selected scope are included.

## Scope

- **Tables:** query sdkmessageprocessingsteps by sdkmessagefilterid/primaryobjecttypecode for each selected table, then read the referenced plug-in types. Only the selected tables receive Access links.
- **Solutions:** read solutioncomponent types 90 (plug-in type), 91 (assembly) and 92 (processing step). Assembly membership includes its plug-in types, except a shell-only assembly. A solution step may identify a plug-in even when the assembly is packaged separately. All registrations of each included type are read to document its registered tables. Registered table definitions are imported as Data Objects when needed for Access endpoints, including tables outside the solution package.
- Source identity includes tenant, environment, kind and object ID. Copies across environments remain separate. Solution membership uses Aggregation from the solution to the plug-in.

A complete refresh can mark a removed Access relationship IsDeleted=yes. Evidence is owned by the plug-in/table pair, so a table refresh can reconcile a link originally discovered through a solution, and vice versa. Unselected table pairs remain intact. Incomplete registration/type/table reads preserve prior links; missing table endpoints are reported. Removing a type from a solution retires its solution-membership link, not the plug-in element or registrations.

## Properties

The new [property catalogue](metadata-properties.md) lists exact fields. Plug-ins receive type/class names, assembly name/version/culture/public key token, isolation/source mode, management/customization and creation/modification metadata. PowerPlatform-Registrations contains sanitized step metadata; PowerPlatform-RegistrationScope identifies whether those details cover selected tables or all registrations of the included types.

No assembly content, source code, step configuration, secure configuration, business records or execution traces are retrieved. Existing manual properties, diagram layout and concept GUIDs are preserved. The model remains unsaved after Apply.

## References

The collector follows Microsoft's [plug-in registration model](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/register-plug-in), [solution component types](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/solutioncomponent?view=dataverse-latest), [processing steps](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/sdkmessageprocessingstep?view=dataverse-latest), [message filters](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/sdkmessagefilter?view=dataverse-latest), and the documented [jArchi Access relationship property](https://github.com/archimatetool/archi-scripting-plugin/wiki/Relationships#accessType).
