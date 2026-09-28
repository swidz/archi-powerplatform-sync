# Element metadata properties

Version 0.4.0 adds descriptive metadata to every supported element type. The catalogue below is the explicit allowlist in lib/metadata.js. It was checked against the approved environment on 2026-09-28. Available fields vary by organization/version and read permissions.

Existing friendly properties such as PowerPlatform-Description, PowerPlatform-Version, identity and lifecycle fields remain. Additional fields use `PowerPlatform-Metadata-<source>-<field>`; for example, PowerPlatform-Metadata-Dataverse-publishedon, PowerPlatform-Metadata-Dataverse-OwnershipType, and PowerPlatform-Metadata-Assembly-isolationmode. Choice and lookup labels use a .Label suffix. Managed properties store their Value. Version 0.5.0 selects table labels and supported record names/descriptions using labelLanguage (default en-US); choice/state/status/boolean labels are resolved from attribute option metadata in that language. Lookup names and other formatted annotations retain API-supplied text and carry .LabelLanguage=source-user. Localized fields record .LanguageCode/.LanguageStatus, and resolved choice labels record .LabelLanguage/.LabelLanguageStatus. See [names and language](naming-and-language.md). False and zero are preserved. An explicit null clears the corresponding property to an empty string.

## Collection and preservation

Additional metadata is read before the common preview/Apply step for every context script and the bulk sync/diagnostic/export workflow. Requests include only imported object IDs, in batches of 35. For Dataverse record types, the collector first checks readable attribute metadata and intersects it with this catalogue. It never uses $select=*. Table Attributes metadata is also read to create the numbered field list in Documentation, as described below; fields do not become separate model concepts. Other attribute-schema queries concern platform metadata types such as workflow and plugintype.

A denied schema/property request reports a warning and preserves previously stored values. Fields absent from a response or unsupported by that organization are not cleared. Manual properties remain unchanged. Set includeElementMetadata:false to skip additional property/schema/choice requests; properties already observed by the main collectors are still retained. Localized object-name reads and table field lists remain enabled. Use includeTableFields:false to skip field-list reads independently.

## Table field documentation

Version 0.8.0 adds an **Available fields** section to the Documentation of every observed table. `get-tables` and table definitions retrieved by `get-plugins` participate. The list covers all field definitions returned for the table, including standard, custom and virtual fields, regardless of which field subcomponents were included in the selected solution. It reads definitions, never record values or field-security assignments.

The collector requests `EntityDefinitions(<MetadataId>)/Attributes` with an explicit selection of `MetadataId`, `LogicalName`, `SchemaName`, `DisplayName`, `AttributeType` and `AttributeTypeName`. Logical names are preferred, with schema names as fallback. The configured `labelLanguage` (default en-US) selects labels using the same deterministic fallback as table names. Specialized attribute type names are preferred to the generic type, for example File rather than Virtual. Rows are sorted by technical name and formatted as numbered Markdown:

```markdown
## Available fields

1. **accountid** — Account (Uniqueidentifier)
2. **name** — Account Name (String)
```

The generated section is enclosed by `<!-- PowerPlatform:TableFields:begin -->` and `<!-- PowerPlatform:TableFields:end -->`. Keep personal notes outside these markers: refresh replaces their contents while preserving text before and after the section. Incomplete or duplicate marker pairs stop the update before any model changes. Authored metadata is escaped for Markdown; an empty successful response explicitly reports that no field definitions were returned.

The common preview counts Documentation updates. Apply uses the existing Data Object, preserving IDs and diagrams, and supports Undo/Redo. If Documentation changes between collection and Apply, the run stops before writes so the latest manual notes can be included on retry. A failed or incomplete metadata read preserves the previous field list and reports a warning. Identical lists are not rewritten.

`PowerPlatform-TableFieldCount` records the returned field count, and `PowerPlatform-TableFieldsLabelLanguage` records the preferred language. Both properties update only with a complete field list. `includeTableFields:true` is the default, including for preserved settings files without that setting. Set it to false to skip the additional request per observed table and leave existing field lists intact. This option is independent of `includeElementMetadata`.

See Microsoft's [table and attribute metadata query documentation](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-metadata-web-api#query-entitymetadata-attributes) for the source API.

## Source coverage

| Element | Source | Additional metadata |
| --- | --- | --- |
| Environments | Environment API, organization discovery, Resource Graph fallback | Region, state/type, dates, organization identifiers, Dataverse URLs and admin-access flag |
| Solutions | Dataverse solution/publisher | Version/package version, publisher, installed/updated dates, management and source-control flags |
| Canvas apps | Dataverse canvasapp and Resource Graph | App/subtype, versions, publication date, ownership, featured/hidden/consent flags |
| Model-driven apps | Dataverse appmodule and Resource Graph | Client/form factor, navigation, publication/version, state/status, publisher |
| Code/generic apps | Resource Graph inventory | Available application/version/subtype/ownership/publication metadata; no invented Dataverse entity mapping |
| Flows | Dataverse workflow and Resource Graph | Category/type, execution mode, state/status, scope, ownership, version, trigger flags |
| Agents | Dataverse bot and Resource Graph | Language, publication, runtime provider, authentication/access-control mode, ownership |
| Tables | Dataverse EntityDefinitions | Names/IDs, ownership/table type, provider/source IDs, audit/change-tracking and customization capabilities |
| Views | Dataverse savedquery | Table, query type, default/private/quick-find flags, management, state/status |
| Custom roles | Dataverse role | Description, business-unit/root/template IDs, inheritance/assignment, management/customization |
| Plug-ins | Dataverse plugintype, pluginassembly and sdkmessageprocessingstep | Type/assembly/version/isolation, registration message/table/stage/mode/rank/filtering attributes, enabled/disabled state |

Assembly and step metadata are properties of the plug-in element; they do not create separate EA elements. PowerPlatform-Registrations stores sanitized JSON for the observed steps, with PowerPlatform-RegistrationScope, PowerPlatform-RegistrationCount and PowerPlatform-RegisteredTables. Table-context runs summarize registrations on the selected tables; solution-context runs summarize all registrations of included plug-in types. Shared plug-in registration records merge across selected contexts.

## Exclusions

The broader property audit includes fields that are deliberately not imported: assembly binaries/content, canvas documents/assets, raw flow definitions/XAML/client data, connection and authentication configurations, credentials, plug-in secure/unsecure configuration, topic content, view FetchXML/layout/SQL, arbitrary payload blobs, table rows and user records. Owner/creator IDs and API-provided lookup labels may be included as metadata. The existing dependency parser may read a flow definition transiently, but never saves it as a property. Long descriptive metadata values are limited to 16,384 characters; structured registration JSON is validated against the existing 1 MiB property limit without truncation.

## Exact field catalogue

These lists describe requested candidates; organization schema support and readable values determine which appear on an element. Readable field counts include derived/virtual source attributes that are not necessarily Web API scalar properties or appropriate EA metadata.

### solution

Live schema audit: 46 readable source attributes. Catalogue: 22 candidate fields.

`_configurationpageid_value`, `_createdby_value`, `_modifiedby_value`, `_parentsolutionid_value`, `_publisherid_value`, `createdon`, `description`, `enabledforsourcecontrolintegration`, `friendlyname`, `installedon`, `isapimanaged`, `ismanaged`, `isvisible`, `modifiedon`, `solutionid`, `solutionpackageversion`, `solutiontype`, `sourcecontrolsyncstatus`, `uniquename`, `updatedon`, `version`, `versionnumber`.

### canvasapp

Live schema audit: 78 readable source attributes. Catalogue: 38 candidate fields.

`_createdby_value`, `_modifiedby_value`, `_ownerid_value`, `_owningbusinessunit_value`, `aadcreatedbyid`, `aadlastmodifiedbyid`, `aadlastpublishedbyid`, `admincontrolbypassconsent`, `appversion`, `bypassconsent`, `canconsumeapppass`, `canvasappid`, `canvasapprowid`, `canvasappsubtype`, `canvasapptype`, `componentstate`, `createdbyclientversion`, `createdon`, `createdtime`, `description`, `displayname`, `hascustommiddletier`, `introducedversion`, `iscdsupgraded`, `iscustomizable`, `isfeaturedapp`, `isheroapp`, `ishidden`, `ismanaged`, `lastmodifiedtime`, `lastpublishtime`, `minclientversion`, `modifiedon`, `name`, `solutionid`, `status`, `uniquecanvasappid`, `versionnumber`.

### modelapp

Live schema audit: 51 readable source attributes. Catalogue: 28 candidate fields.

`_createdby_value`, `_modifiedby_value`, `_ownerid_value`, `_owningbusinessunit_value`, `_publisherid_value`, `appmoduleid`, `appmoduleidunique`, `appmoduleversion`, `clienttype`, `componentstate`, `createdon`, `description`, `formfactor`, `introducedversion`, `iscustomizable`, `isdefault`, `isfeatured`, `ismanaged`, `modifiedon`, `name`, `navigationtype`, `optimizedfor`, `publishedon`, `solutionid`, `statecode`, `statuscode`, `uniquename`, `versionnumber`.

### flow

Live schema audit: 135 readable source attributes. Catalogue: 41 candidate fields.

`_activeworkflowid_value`, `_createdby_value`, `_modifiedby_value`, `_ownerid_value`, `_owningbusinessunit_value`, `_parentworkflowid_value`, `asyncautodelete`, `category`, `componentstate`, `createdon`, `description`, `introducedversion`, `iscustomizable`, `ismanaged`, `istransacted`, `languagecode`, `mode`, `modernflowtype`, `modifiedon`, `name`, `ondemand`, `planverified`, `primaryentity`, `processorder`, `rank`, `runas`, `schemaversion`, `scope`, `solutionid`, `statecode`, `statuscode`, `subprocess`, `throttlingbehavior`, `triggeroncreate`, `triggerondelete`, `triggeronupdateattributelist`, `type`, `uniquename`, `versionnumber`, `workflowid`, `workflowidunique`.

### agent

Live schema audit: 68 readable source attributes. Catalogue: 27 candidate fields.

`_createdby_value`, `_modifiedby_value`, `_ownerid_value`, `_owningbusinessunit_value`, `_publishedby_value`, `accesscontrolpolicy`, `authenticationmode`, `authenticationtrigger`, `botid`, `componentidunique`, `componentstate`, `createdon`, `introducedversion`, `iscustomizable`, `ismanaged`, `language`, `modifiedon`, `name`, `origin`, `publishedon`, `runtimeprovider`, `schemaname`, `solutionid`, `statecode`, `statuscode`, `template`, `versionnumber`.

### view

Live schema audit: 57 readable source attributes. Catalogue: 29 candidate fields.

`_createdby_value`, `_modifiedby_value`, `_ownerid_value`, `_owningbusinessunit_value`, `canbedeleted`, `componentstate`, `createdon`, `description`, `enablecrosspartition`, `introducedversion`, `iscustom`, `iscustomizable`, `isdefault`, `ismanaged`, `isprivate`, `isquickfindquery`, `isuserdefined`, `modifiedon`, `name`, `organizationtaborder`, `queryappusage`, `querytype`, `returnedtypecode`, `savedqueryid`, `savedqueryidunique`, `solutionid`, `statecode`, `statuscode`, `versionnumber`.

### role

Live schema audit: 46 readable source attributes. Catalogue: 26 candidate fields.

`_businessunitid_value`, `_createdby_value`, `_modifiedby_value`, `_ownerid_value`, `_owningbusinessunit_value`, `_parentroleid_value`, `_parentrootroleid_value`, `_roletemplateid_value`, `applicationid`, `appliesto`, `canbedeleted`, `componentstate`, `createdon`, `description`, `introducedversion`, `isautoassigned`, `iscustomizable`, `isinherited`, `ismanaged`, `issytemgenerated`, `modifiedon`, `name`, `roleid`, `roleidunique`, `solutionid`, `versionnumber`.

### plugin

Live schema audit: 39 readable source attributes. Catalogue: 27 candidate fields.

`_createdby_value`, `_modifiedby_value`, `_ownerid_value`, `_owningbusinessunit_value`, `_pluginassemblyid_value`, `assemblyname`, `componentstate`, `createdon`, `culture`, `description`, `friendlyname`, `introducedversion`, `iscustomizable`, `ismanaged`, `isworkflowactivity`, `major`, `minor`, `modifiedon`, `name`, `plugintypeexportkey`, `plugintypeid`, `plugintypeidunique`, `publickeytoken`, `solutionid`, `typename`, `version`, `versionnumber`.

### assembly

Live schema audit: 48 readable source attributes. Catalogue: 26 candidate fields.

`_createdby_value`, `_managedidentityid_value`, `_modifiedby_value`, `_ownerid_value`, `_owningbusinessunit_value`, `_packageid_value`, `authtype`, `componentstate`, `createdon`, `culture`, `description`, `introducedversion`, `iscustomizable`, `ishidden`, `ismanaged`, `isolationmode`, `major`, `minor`, `modifiedon`, `name`, `pluginassemblyid`, `publickeytoken`, `solutionid`, `sourcetype`, `version`, `versionnumber`.

### step

Live schema audit: 68 readable source attributes. Catalogue: 30 candidate fields.

`_createdby_value`, `_eventhandler_value`, `_impersonatinguserid_value`, `_modifiedby_value`, `_ownerid_value`, `_owningbusinessunit_value`, `_sdkmessagefilterid_value`, `_sdkmessageid_value`, `asyncautodelete`, `canbebypassed`, `canusereadonlyconnection`, `componentstate`, `createdon`, `description`, `enablepluginprofiler`, `filteringattributes`, `introducedversion`, `iscustomizable`, `ismanaged`, `mode`, `modifiedon`, `name`, `rank`, `sdkmessageprocessingstepid`, `solutionid`, `stage`, `statecode`, `statuscode`, `supporteddeployment`, `versionnumber`.

### table

Catalogue: 67 candidate fields.

`AutoRouteToOwnerQueue`, `CanBeInManyToMany`, `CanBePrimaryEntityInRelationship`, `CanBeRelatedEntityInRelationship`, `CanCreateAttributes`, `CanCreateCharts`, `CanCreateForms`, `CanCreateViews`, `CanEnableSyncToExternalSearchIndex`, `ChangeTrackingEnabled`, `CollectionSchemaName`, `CreatedOn`, `DataProviderId`, `DataSourceId`, `Description`, `DisplayCollectionName`, `DisplayName`, `EnforceStateTransitions`, `EntitySetName`, `ExternalCollectionName`, `ExternalName`, `HasActivities`, `HasNotes`, `IntroducedVersion`, `IsActivity`, `IsActivityParty`, `IsArchivalEnabled`, `IsAuditEnabled`, `IsAvailableOffline`, `IsBusinessProcessEnabled`, `IsConnectionsEnabled`, `IsCustomEntity`, `IsCustomizable`, `IsDocumentManagementEnabled`, `IsDuplicateDetectionEnabled`, `IsEnabledForCharts`, `IsImportable`, `IsIntersect`, `IsKnowledgeManagementEnabled`, `IsMSTeamsIntegrationEnabled`, `IsMailMergeEnabled`, `IsManaged`, `IsMappable`, `IsOfflineInMobileClient`, `IsOneNoteIntegrationEnabled`, `IsOptimisticConcurrencyEnabled`, `IsPrivate`, `IsQuickCreateEnabled`, `IsRenameable`, `IsRetentionEnabled`, `IsSLAEnabled`, `IsSolutionAware`, `IsStateModelAware`, `IsValidForAdvancedFind`, `IsVisibleInMobile`, `LogicalCollectionName`, `LogicalName`, `MetadataId`, `ModifiedOn`, `ObjectTypeCode`, `OwnerId`, `OwnershipType`, `OwningBusinessUnit`, `PrimaryIdAttribute`, `PrimaryNameAttribute`, `SchemaName`, `TableType`.

### Environments and inventory

Environment API: `id`, `displayName`, `type`, `state`, `azureRegion`, `geo`, `url`, `createdDateTime`, `modifiedDateTime`, `deletedDateTime`, `dataverseId`, `isDefault`, `isManaged`, `isPayAsYouGo`, `isTeamsEnvironment`, `linkedEnvironmentId`.

Organization discovery: EnvironmentId, TenantId, Url, ApiUrl, IsUserSysAdmin, Id.

Resource Graph (all supported inventory kinds, including code apps): `id`, `name`, `type`, `location`, `kind`, `sku.name`, `sku.tier`, `properties.displayName`, `properties.environmentId`, `properties.logicalName`, `properties.schemaName`, `properties.createdAt`, `properties.lastModifiedAt`, `properties.lastPublishedAt`, `properties.isManaged`, `properties.subType`, `properties.ownerId`, `properties.createdBy`, `properties.isQuarantined`, `properties.state`, `properties.status`, `properties.appType`, `properties.appVersion`, `properties.version`, `properties.description`, `properties.appModuleId`, `properties.workflowEntityId`, `properties.botId`, `properties.name`. Connector/channel summaries continue to use their existing sanitized properties.

## References

The implementation follows [Dataverse metadata queries](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-metadata-web-api), [plug-in type metadata](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/plugintype?view=dataverse-latest), [step registration metadata](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/sdkmessageprocessingstep?view=dataverse-latest), and the [SDK message filter](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/sdkmessagefilter?view=dataverse-latest).
