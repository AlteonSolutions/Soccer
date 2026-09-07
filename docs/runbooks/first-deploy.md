# First deploy

_Status: not yet performed. Every name below is what `infra/main.bicep` will create._

Everything runs on the free or per-use tiers; the expected bill is under a few dollars a month.
Do these in order. Steps 1–3 create Azure resources, 4–5 wire GitHub, 6–8 make it yours.

## 1. Sign in and create the resource group

```
az login
az account set --subscription "<your subscription>"
az group create --name soccer-rg --location eastus2
```

## 2. Apply the Bicep

Edit `infra/main.bicepparam` (team name, time zone, coach email). Leave `emailCustomDomain` empty
and `emailLive` off for the first run: that gives you a working Azure-managed sender with no DNS
work, and no email leaves until you say so.

```
az deployment group create --resource-group soccer-rg --template-file infra/main.bicep --parameters infra/main.bicepparam
az deployment group show --resource-group soccer-rg --name main --query properties.outputs
```

Note the outputs: `staticWebAppName`, `staticWebAppDefaultHostname`, `remindersFunctionAppName`,
`emailFrom`. From this moment `infra/main.bicep` is authoritative; change the first line of that
file and of `infra/main.bicepparam` to say so, in the same commit as any change to it.

## 3. Get the two deployment credentials

```
az staticwebapp secrets list --name <staticWebAppName> --query properties.apiKey -o tsv
az functionapp deployment list-publishing-profiles --name <remindersFunctionAppName> --resource-group soccer-rg --xml
```

## 4. Put them in GitHub

Repository → Settings → Secrets and variables → Actions:

- Secret `AZURE_STATIC_WEB_APPS_API_TOKEN` — the first value.
- Secret `AZURE_REMINDERS_PUBLISH_PROFILE` — the whole XML of the second.
- Variable `AZURE_REMINDERS_APP_NAME` — `remindersFunctionAppName`.
- Variable `DEPLOY_ENABLED` — `true`. Until this exists, pushes to `main` run the gate and deploy
  nothing.

## 5. Deploy

Merge to `main`. The `deploy-web` and `deploy-reminders` jobs run after `test` passes. Open
`https://<staticWebAppDefaultHostname>/`: the schedule page with no games.

## 6. Make yourself the coach

Azure Portal → the Static Web App → Role management → Invite. Provider: Microsoft Entra ID
(`aad`); your Microsoft account email; role `admin`; 24-hour link. Open the link, accept, then
visit `/login` on the site. `/admin.html` now works; add the first game.

## 7. Your domain

Site: Portal → Static Web App → Custom domains → Add. For `snacks.example.org` add the CNAME it
shows at your DNS host; for the apex `example.org` use the TXT-then-ALIAS/A flow it shows.
Certificate is automatic and free. Then set `siteUrl` in `main.bicepparam` and redeploy the Bicep
so emails link to the real address.

Email from your domain: set `emailCustomDomain` in `main.bicepparam` and redeploy the Bicep. Then
Portal → Email Communication Service → Provision domains → your domain → it lists the records to
add at your DNS host: a TXT for ownership, SPF (TXT), and two DKIM CNAMEs. Add them, click Verify
on each. Verification can take up to an hour. Once all four show Verified, the sender is
`snacks@example.org` (`emailFrom` output).

## 8. Turn email on

Set `emailLive = 'on'` in `main.bicepparam` and redeploy the Bicep. Then send a test run:

```
az functionapp function keys list --name <remindersFunctionAppName> --resource-group soccer-rg --function-name send-reminders --query default -o tsv
curl -X POST "https://<remindersFunctionAppName>.azurewebsites.net/admin/functions/send-reminders" -H "x-functions-key: <master key from Portal → App keys>" -H "content-type: application/json" -d "{}"
```

Watch Application Insights (`soccer-insights`) for `reminders.run` and `email.sent` events.

## Rollback

`emailLive = 'off'` and redeploy the Bicep stops all outbound mail within a minute. Removing the
`DEPLOY_ENABLED` variable stops deploys. `az group delete --name soccer-rg` removes everything.
