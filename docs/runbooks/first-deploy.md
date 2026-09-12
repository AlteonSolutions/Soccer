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

Note `staticWebAppName`, `staticWebAppDefaultHostname`, `scheduleLogicAppName`. Email is
created with the Azure-managed sender for now (`emailFrom` output) and the `alteonapps.com`
domain resource exists but is not linked yet; that is step 7.

From this moment `infra/main.bicep` is authoritative: change the first line of that file and of
`infra/main.bicepparam` to say so, in the same commit as any later change to them.

If the deployment fails, paste the error into a Claude session against this repo; an API version
or property name is the likely culprit and is a one-line fix. (The first attempt hit
`SubscriptionIsOverQuotaForSku` for a Consumption-plan Function App; that is why the schedule is a
Logic App now and there is no Function App to have quota for.)

## 3. Get the deployment token

```
az staticwebapp secrets list --name <staticWebAppName> --resource-group snaccer-rg --query properties.apiKey -o tsv
```

## 4. Put it in GitHub

Repository → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| Secret | `AZURE_STATIC_WEB_APPS_API_TOKEN` | the command's output |
| Variable | `DEPLOY_ENABLED` | `true` |

Until `DEPLOY_ENABLED` exists, pushes to `main` run the gate and deploy nothing.

## 5. Ship and become the coach

Push to `main` (or run the CI workflow from the Actions tab on `main`). `deploy-web` runs after
`test` passes. Open `https://<staticWebAppDefaultHostname>/`: the
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
snacks@alteonapps.com within a minute. To exercise the daily job without waiting for 14:00 UTC:
Portal → Logic apps → `snaccer-reminders-schedule` → **Run** → Run. The run history shows the HTTP
call and the JSON summary it returned (`day`, counts). On a day that is not Monday or Thursday it
returns `day: other` and sends nothing, which is itself the check that the schedule is wired.
Logs: Application Insights `snaccer-insights` → Logs → `traces | where message contains "reminders.run"`.

## Rollback

`emailLive = 'off'` and redeploy the Bicep stops all outbound mail within a minute. Removing the
`DEPLOY_ENABLED` variable stops deploys. `az group delete --name snaccer-rg` removes everything
(the DNS records at your host stay until you delete them).
