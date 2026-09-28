// Shared settings. Never add passwords, client secrets, access tokens, or connection strings.
var POWERPLATFORM_SETTINGS={
    rootFolderName:"PowerPlatform",
    // Preferred Dataverse label language, independent of the signed-in user. A numeric LCID is also accepted.
    labelLanguage:"en-US",
    useSpecializations:false,
    discoverDependencies:true,
    // Enrich imported elements with supported descriptive metadata fields.
    includeElementMetadata:true,
    includeRoles:true,
    // Include hidden/internal solutions in get-solutions. Normally show platform-visible solutions only.
    includeHiddenSolutions:false,
    // Optional root or business-unit role IDs to preselect/exclude in the custom-role picker.
    roleIds:[],
    excludeRoleIds:[],
    // Optional customer/ISV solution publisher prefixes that identify roles to preselect.
    rolePublisherPrefixes:[],
    includeUnclassifiedRoles:false,
    // Optional environment-ID keys, e.g. "...": {stage:"PROD"}. Normally set in the picker.
    environmentSettings:{}
};
