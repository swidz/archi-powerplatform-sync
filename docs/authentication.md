# Authentication and access

## Default route

Sign in interactively with Azure CLI:

```powershell
az login --allow-no-subscriptions
az account show --query "{tenant:tenantId,cloud:environmentName}" --output json
```

If needed, use `az login --tenant <tenant-id> --allow-no-subscriptions`. The script takes the tenant from the CLI session and passes that tenant explicitly when requesting each token. It requires a user session in `AzureCloud`; service-principal sessions and sovereign clouds are not supported in this version.

The script reuses the existing sign-in instead of opening a login prompt inside Archi. Sign in again from a terminal if MFA, conditional access or an expired refresh token prevents token acquisition. No credential should be entered in `config/settings.js`.

| Token audience | Use |
| --- | --- |
| `https://api.powerplatform.com/` | Environment enumeration |
| `https://management.azure.com/` | Power Platform Resource Graph inventory |
| `https://globaldisco.crm.dynamics.com/` | Dataverse organization discovery |
| `https://<organization>.crmN.dynamics.com/` | That organization's Dataverse Web API |

The API endpoint may contain `.api.crmN.` while the token audience remains the organization URL. The client validates this specific host pairing. It accepts public-cloud HTTPS Dataverse organization origins only.

The current account successfully obtained all four token audiences and read the selected environment without creating an app registration. This is a verified route, not a guarantee that every tenant permits it. If a tenant policy blocks a Microsoft first-party CLI client, the tool reports the failure. It does not register an application, grant consent, bypass policy or silently switch credentials.

## Administrator access

The account should have an active Power Platform Administrator role for tenant inventory. Dataverse has its own read privileges: administration at the Power Platform level must not be treated as proof that every organization collection is readable.

The tested account could read inventory in a development environment while some Dataverse detail reads returned 403. The user-selected Global Applications environment allowed the scoped collections. Those capability differences are surfaced per collector. Successful narrow reads can still be visibility-filtered; the tool uses `IsUserSysAdmin` from organization discovery as an additional prerequisite for confirming missing objects.

No role assignments or environment access changes are performed by the tool. If another environment returns 403, ask the environment administrator to verify the account's effective read privileges. Previously imported content remains preserved.

## Troubleshooting

- **Azure CLI not found:** install Azure CLI 2.54+ and restart Archi so it receives the updated PATH. Alternatively set `ARCHI_POWERPLATFORM_AZ` to the absolute path to `az.cmd` or the CLI executable before starting Archi.
- **Authentication failed:** run `az login --allow-no-subscriptions` in a terminal. Verify the tenant, interactive user session and active administrator role. The CLI diagnostic may show an AADSTS code; the Java bridge deliberately discards raw CLI stderr.
- **No environments:** run `Test Power Platform Connection` or `node tools/diagnose.cjs --list`; check active role and environment API/Resource Graph access.
- **Some detail collectors fail:** review Scripts output for collector and HTTP status. Inventory-only data can still be imported with a partial status.
- **Network/TLS/proxy failure:** Java uses the Archi JVM's network and trust configuration. Azure CLI connectivity alone does not prove Java HTTPS connectivity. Verify corporate proxy and certificate setup for Archi; do not disable TLS validation.
- **Archi appears busy:** collection currently runs synchronously in the script, with progress in Scripts output. Large environments and retries can take minutes. Cancellation is available in the selection and preview dialogs, not midway through an HTTP request.

Official references: [Azure CLI authentication](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli-interactively), [get-access-token](https://learn.microsoft.com/en-us/cli/azure/account#az-account-get-access-token), [Power Platform inventory](https://learn.microsoft.com/en-us/power-platform/admin/power-platform-inventory), [Dataverse discovery service](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/discovery-service).
