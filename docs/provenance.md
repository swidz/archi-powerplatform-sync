# Provenance

This separate Power Platform repository follows the locally developed `archi-azure-sync` version 0.13.0: Java-only CLI access from jArchi, source-owned properties, stable concept identities, soft deletion and preservation of manual architecture content.

`lib/cli-java.js` adapts that project's process bridge. Power Platform discovery, metadata collectors, identity mapping, role selection, native environment multi-selection and dependency evidence handling are implemented here. No Azure resource mappings or Azure inventory are imported into this package.

The package has no npm production dependencies and bundles no Microsoft SDK, Archi runtime, jArchi plug-in or third-party binary. Archi, jArchi, Azure CLI and Microsoft APIs are external prerequisites governed by their own terms. No public distribution license is assigned by this initial private package.

The repo contains synthetic fixtures only. Organization inventories, generated Archi models, runtime configurations and diagnostics live under ignored `work/`; credentials are not included in the source or release archive.
