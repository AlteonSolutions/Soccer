// NOT YET APPLIED. This file becomes authoritative the moment `az deployment group create` runs
// against it (docs/runbooks/first-deploy.md). Until then the live names are whatever that run
// creates, and nothing exists in Azure.
//
// Everything the app needs, at the lowest tier that works:
//   - one storage account: Table Storage for the app, plus the reminders Function App's own state
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

@description('Node major for the reminders Function App. Must equal package.json engines, CLAUDE.md, ci.yml and apps/web/client/staticwebapp.config.json.')
param nodeMajor string = '22'

@description('Team name shown on the site and in emails.')
param teamName string = 'Our Team'

@description('IANA time zone used to decide what "today" is for reminders.')
param timeZone string = 'America/New_York'

@description('Days before a game to send the reminder.')
param reminderDaysAhead int = 2

@description('Where "nobody signed up" nudges go. Empty disables the nudge.')
param coachEmail string = ''

@description('Public URL of the site, used in emails. Set after the custom domain is live.')
param siteUrl string = ''

@description('Your verified custom email domain (e.g. example.org). Empty uses the Azure-managed domain, which works with no DNS setup.')
param emailCustomDomain string = ''

@description('Send real email (on) or capture (off). Leave off until the sender domain is verified and you have tested.')
@allowed(['on', 'off'])
param emailLive string = 'off'

var suffix = uniqueString(resourceGroup().id)
var storageName = toLower('${namePrefix}${suffix}')
var useCustomEmailDomain = !empty(emailCustomDomain)

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

resource azureManagedDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = if (!useCustomEmailDomain) {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: { domainManagement: 'AzureManaged' }
}

resource customDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = if (useCustomEmailDomain) {
  parent: emailService
  name: emailCustomDomain
  location: 'global'
  properties: { domainManagement: 'CustomerManaged', userEngagementTracking: 'Disabled' }
}

resource customSender 'Microsoft.Communication/emailServices/domains/senderUsernames@2023-04-01' = if (useCustomEmailDomain) {
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
  : 'DoNotReply@${azureManagedDomain!.properties.fromSenderDomain}'
var acsConnectionString = communication.listKeys().primaryConnectionString

// Shared by both Function hosts: exactly the variables packages/shared/src/config.ts declares.
var appConfig = {
  NODE_ENV: 'production'
  STORAGE_CONNECTION_STRING: storageConnectionString
  ACS_CONNECTION_STRING: acsConnectionString
  EMAIL_FROM: emailFrom
  EMAIL_LIVE: emailLive
  COACH_EMAIL: coachEmail
  REMINDER_DAYS_AHEAD: string(reminderDaysAhead)
  TIMEZONE: timeZone
  TEAM_NAME: teamName
  SITE_URL: siteUrl
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

// ---------------------------------------------------------------- reminders function app
resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-insights'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', RetentionInDays: 30 }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-plan'
  location: location
  kind: 'functionapp'
  sku: { name: 'Y1', tier: 'Dynamic' } // Consumption: billed per execution, free grant covers a daily timer
  properties: { reserved: true } // Linux
}

resource reminders 'Microsoft.Web/sites@2023-12-01' = {
  name: '${namePrefix}-reminders-${suffix}'
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|${nodeMajor}'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
  }
}

resource remindersSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: reminders
  name: 'appsettings'
  properties: union(appConfig, {
    AzureWebJobsStorage: storageConnectionString
    FUNCTIONS_EXTENSION_VERSION: '~4'
    FUNCTIONS_WORKER_RUNTIME: 'node'
    WEBSITE_RUN_FROM_PACKAGE: '1'
    APPLICATIONINSIGHTS_CONNECTION_STRING: insights.properties.ConnectionString
    SITE_URL: empty(siteUrl) ? 'https://${swa.properties.defaultHostname}' : siteUrl
  })
}

// ---------------------------------------------------------------- outputs (no secrets)
output staticWebAppName string = swa.name
output staticWebAppDefaultHostname string = swa.properties.defaultHostname
output remindersFunctionAppName string = reminders.name
output storageAccountName string = storage.name
output emailFrom string = emailFrom
output emailDomainResourceId string = useCustomEmailDomain ? customDomain.id : azureManagedDomain.id
