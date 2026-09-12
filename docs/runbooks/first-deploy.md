# First deploy — signup.alteonapps.com

_Status: not yet performed. Every Azure name below is what `infra/main.bicep` will create._

Everything runs on the free or per-use tiers; the expected bill is under a few dollars a month.
Steps 1–3 create the Azure resources, 4–5 wire GitHub and ship, 6–8 attach the domain and switch
email on. Steps 6 and 7 need access to the DNS records for `alteonapps.com`; everything else is the
Azure portal, the Azure CLI and GitHub.

## 0. Before you start

- Azure CLI installed and signed in: `az login`, then `az account set --subscription "<name>"`.
- This repo merged to `main` (the deploy jobs only run from `main`).
- `infra/main.bicepparam` checked: `teamName`, `timeZone`, `coachEmail`. `siteUrl` and
  `emailCustomDomain` are already set for signup.alteonapps.com.

These commands are written for a bash shell such as Azure Cloud Shell (shell.azure.com), which has
`az` and `git` ready. In Windows PowerShell, run commands one per line (no `&&`).

## 1. Create the resource group

```
az group create --name snaccer-rg --location eastus2
```

## 2. Apply the Bicep

```
az deployment group create --resource-group snaccer-rg --template-file infra/main.bicep --parameters infra/main.bicepparam
az deployment group show --resource-group snaccer-rg --name main --query properties.outputs -o table
```

Note `staticWebAppName`, `staticWebAppDefaultHostname`, `remindersFunctionAppName`. Email is
created with the Azure-managed sender for now (`emailFrom` output) and the `alteonapps.com`
domain resource exists but is not linked yet; that is step 7.

From this moment `infra/main.bicep` is authoritative: change the first line of that file and of
`infra/main.bicepparam` to say so, in the same commit as any later change to them.

If the deployment fails, paste the error into a Claude session against this repo; an API version
or property name is the likely culprit and is a one-line fix. One already seen:
`SubscriptionIsOverQuotaForSku` for `Microsoft.Web/serverFarms` means the subscription's
Consumption-plan allowance in that region is used up; the reminders app deploys to
`functionsLocation` (default East US) for that reason. Change that parameter to any region with
free quota.

## 3. Get the two deployment credentials

```
az staticwebapp secrets list --name <staticWebAppName> --resource-group snaccer-rg --query properties.apiKey -o tsv
az functionapp deployment list-publishing-profiles --name <remindersFunctionAppName> --resource-group snaccer-rg --xml
```

## 4. Put them in GitHub

Repository → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| Secret | `AZURE_STATIC_WEB_APPS_API_TOKEN` | the first command's output |
| Secret | `AZURE_REMINDERS_PUBLISH_PROFILE` | the whole XML from the second |
| Variable | `AZURE_REMINDERS_APP_NAME` | `remindersFunctionAppName` |
| Variable | `DEPLOY_ENABLED` | `true` |

Until `DEPLOY_ENABLED` exists, pushes to `main` run the gate and deploy nothing.

## 5. Ship and become the coach

Push to `main` (or re-run the latest CI run from the Actions tab). `deploy-web` and
`deploy-reminders` run after `test` passes. Open `https://<staticWebAppDefaultHostname>/`: the
schedule page, empty.

Portal → the Static Web App → **Role management** → Invite: provider *Microsoft Entra ID*, your
Microsoft account email, role `admin`, 24-hour link. Open the link, accept, then go to `/login` on
the site. `/admin.html` now works: paste the team list, add the first game.

## 6. signup.alteonapps.com

At your DNS host for `alteonapps.com`, add:

| Type | Name | Value |
|---|---|---|
| CNAME | `signup` | `<staticWebAppDefaultHostname>` (looks like `xxx-yyy.N.azurestaticapps.net`) |

Then:

```
az staticwebapp hostname set --name <staticWebAppName> --resource-group snaccer-rg --hostname signup.alteonapps.com
```

Validation takes a few minutes after the CNAME propagates; the certificate is issued automatically
and renews itself. The site answers at https://signup.alteonapps.com, and the default hostname
keeps working too.

## 7. Email from snacks@alteonapps.com

Portal → **Email Communication Services** → `snaccer-email` → **Provision domains** →
`alteonapps.com`. It lists four records to add at your DNS host:

| Purpose | Type | Name | Note |
|---|---|---|---|
| Domain ownership | TXT | `@` (apex) | value shown in the portal |
| SPF | TXT | `@` (apex) | **if `alteonapps.com` already has an SPF record** (Microsoft 365 mail, for example), do not add a second one — merge the `include:` the portal shows into the existing record; a domain may have only one SPF TXT |
| DKIM | CNAME | `selector1-azurecomm-prod-net._domainkey` | value shown in the portal |
| DKIM | CNAME | `selector2-azurecomm-prod-net._domainkey` | value shown in the portal |

Click **Verify** on each. It can take up to an hour. When all four show Verified, flip the link:

```
# infra/main.bicepparam: param linkCustomEmailDomain = true
az deployment group create --resource-group snaccer-rg --template-file infra/main.bicep --parameters infra/main.bicepparam
```

The `emailFrom` output becomes `snacks@alteonapps.com`. Commit the parameter change.

## 8. Turn email on and test

```
# infra/main.bicepparam: param emailLive = 'on'
az deployment group create --resource-group snaccer-rg --template-file infra/main.bicep --parameters infra/main.bicepparam
```

Then sign up for a game on the site with your own player: the confirmation should arrive from
snacks@alteonapps.com within a minute. To exercise the timer without waiting for Monday:

```
curl -X POST "https://<remindersFunctionAppName>.azurewebsites.net/admin/functions/send-reminders" \
  -H "x-functions-key: <master key: Portal → Function App → App keys → _master>" \
  -H "content-type: application/json" -d "{}"
```

On a day that is not Monday or Thursday it logs `reminders.run` with `day: other` and sends
nothing, which is itself the check that the timer is wired. Logs: Application Insights
`snaccer-insights` → Logs → `traces | where message contains "reminders.run"`.

## Rollback

`emailLive = 'off'` and redeploy the Bicep stops all outbound mail within a minute. Removing the
`DEPLOY_ENABLED` variable stops deploys. `az group delete --name snaccer-rg` removes everything
(the DNS records at your host stay until you delete them).
