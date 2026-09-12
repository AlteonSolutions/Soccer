// NOT YET APPLIED. This file becomes authoritative the moment `az deployment group create` runs
// against it (docs/runbooks/first-deploy.md). Until then the live names are whatever that run
// creates, and nothing exists in Azure.
//
// Everything the app needs, at the lowest tier that works:
//   - one storage account: Table Storage for the app
//   - Static Web Apps Free: the site, its HTTP API (managed Functions), custom domain + TLS, auth
//   - Communication Services + Email Service: outbound mail from your domain (Azure-managed
//     domain first; switch to the custom one after DNS verification — see the runbook)
//   - a Consumption-plan Function App for the daily reminder timer (SWA Free is HTTP-only)
//   - Application Insights so the two Function hosts have logs (free below 5 GB/month)

targetScope = 'resourceGroup'

@description('Prefix for every resource name. Lowercase letters and digits only; keep it short.')
@minLength(3)
@maxLength(12)
param namePrefix string = 'soccer'

@description('Region for regional resources. Static Web Apps picks its own nearest region.')
param location string = resourceGroup().location

@description('Region for the Static Web App; only a few are allowed.')
@allowed(['westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia'])
param staticWebAppLocation string = 'eastus2'

@description('Team name shown on the site and in emails.')
param teamName string = 'Our Team'

@description('IANA time zone used to decide what "today" is for reminders.')
param timeZone string = 'America/New_York'

@description('Where "nobody signed up" nudges go. Empty disables the nudge.')
param coachEmail string = ''

@description('Public URL of the site, used in emails. Set after the custom domain is live.')
param siteUrl string = ''

@description('Your custom email domain (e.g. alteonapps.com). Creates the domain resource so its DNS verification records appear in the portal; empty skips it.')
param emailCustomDomain string = ''

@description('Send from the custom email domain instead of the Azure-managed one. Flip to true only after every record for it shows Verified; linking an unverified domain fails the deployment.')
param linkCustomEmailDomain bool = false

@description('Send real email (on) or capture (off). Leave off until the sender domain is verified and you have tested.')
@allowed(['on', 'off'])
param emailLive string = 'off'

var suffix = uniqueString(resourceGroup().id)
var storageName = toLower('${namePrefix}${suffix}')
var hasCustomEmailDomain = !empty(emailCustomDomain)
var useCustomEmailDomain = hasCustomEmailDomain && linkCustomEmailDomain

// ---------------------------------------------------------------- storage
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take(storageName, 24)
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' } // locally redundant is the cheapest; this data is re-enterable
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource tables 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource gamesTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tables
  name: 'games'
}

resource claimsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tables
  name: 'claims'
}

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

// ---------------------------------------------------------------- email
resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${namePrefix}-email'
  location: 'global'
  properties: { dataLocation: 'United States' }
}

resource azureManagedDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: { domainManagement: 'AzureManaged' }
}

resource customDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = if (hasCustomEmailDomain) {
  parent: emailService
  name: emailCustomDomain
  location: 'global'
  properties: { domainManagement: 'CustomerManaged', userEngagementTracking: 'Disabled' }
}

resource customSender 'Microsoft.Communication/emailServices/domains/senderUsernames@2023-04-01' = if (hasCustomEmailDomain) {
  parent: customDomain
  name: 'snacks'
  properties: { username: 'snacks', displayName: '${teamName} Snacks' }
}

resource communication 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: '${namePrefix}-comms'
  location: 'global'
  properties: {
    dataLocation: 'United States'
    linkedDomains: [useCustomEmailDomain ? customDomain.id : azureManagedDomain.id]
  }
}

var emailFrom = useCustomEmailDomain
  ? 'snacks@${emailCustomDomain}'
  : 'DoNotReply@${azureManagedDomain.properties.fromSenderDomain}'
var acsConnectionString = communication.listKeys().primaryConnectionString

// The secret the Logic App presents to POST /api/jobs/reminders. Deterministic from ids nobody
// outside the subscription knows, so every redeploy hands the same key to both sides; the job it
// guards is idempotent, so the worst case of a leak is an early, duplicate-free run.
var jobKey = '${uniqueString(subscription().id, resourceGroup().id, 'job-key-1')}${uniqueString(resourceGroup().id, 'job-key-2')}${uniqueString(subscription().id, 'job-key-3')}'

// Exactly the variables packages/shared/src/config.ts declares, plus Application Insights.
var appConfig = {
  NODE_ENV: 'production'
  STORAGE_CONNECTION_STRING: storageConnectionString
  ACS_CONNECTION_STRING: acsConnectionString
  EMAIL_FROM: emailFrom
  EMAIL_LIVE: emailLive
  COACH_EMAIL: coachEmail
  TIMEZONE: timeZone
  TEAM_NAME: teamName
  SITE_URL: siteUrl
  JOB_KEY: jobKey
  APPLICATIONINSIGHTS_CONNECTION_STRING: insights.properties.ConnectionString
}

// ---------------------------------------------------------------- static web app
resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${namePrefix}-web'
  location: staticWebAppLocation
  sku: { name: 'Free', tier: 'Free' }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
  }
}

resource swaSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: swa
  name: 'appsettings'
  properties: union(appConfig, {
    SITE_URL: empty(siteUrl) ? 'https://${swa.properties.defaultHostname}' : siteUrl
  })
}

// ---------------------------------------------------------------- logs + schedule
resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-insights'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', RetentionInDays: 30 }
}

// One recurrence, one HTTP call. 14:00 UTC = 10:00 Eastern in summer, 09:00 in winter: morning,
// before the shops open. Retries three times ten minutes apart; the endpoint is idempotent.
resource schedule 'Microsoft.Logic/workflows@2019-05-01' = {
  name: '${namePrefix}-reminders-schedule'
  location: location
  properties: {
    state: 'Enabled'
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      parameters: {
        jobKey: { type: 'SecureString' }
        jobUrl: { type: 'String' }
      }
      triggers: {
        daily: {
          type: 'Recurrence'
          recurrence: {
            frequency: 'Day'
            interval: 1
            timeZone: 'UTC'
            schedule: { hours: ['14'], minutes: [0] }
          }
        }
      }
      actions: {
        run_reminders: {
          type: 'Http'
          inputs: {
            method: 'POST'
            uri: '@parameters(\'jobUrl\')'
            headers: {
              'x-job-key': '@parameters(\'jobKey\')'
              'content-type': 'application/json'
            }
            body: {}
          }
          retryPolicy: { type: 'fixed', count: 3, interval: 'PT10M' }
        }
      }
      outputs: {}
    }
    parameters: {
      jobKey: { value: jobKey }
      jobUrl: { value: 'https://${swa.properties.defaultHostname}/api/jobs/reminders' }
    }
  }
}

// ---------------------------------------------------------------- outputs (no secrets)
output staticWebAppName string = swa.name
output staticWebAppDefaultHostname string = swa.properties.defaultHostname
output scheduleLogicAppName string = schedule.name
output storageAccountName string = storage.name
output emailFrom string = emailFrom
output emailDomainResourceId string = useCustomEmailDomain ? customDomain.id : azureManagedDomain.id
output customEmailDomainResourceId string = hasCustomEmailDomain ? customDomain.id : ''

