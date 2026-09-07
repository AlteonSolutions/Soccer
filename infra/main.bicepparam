// NOT YET APPLIED. Parameter values for the first deployment; edit before running the runbook.
using './main.bicep'

param namePrefix = 'soccer'
param teamName = 'Manchester City'
param timeZone = 'America/New_York'
param coachEmail = '' // your address, for the Monday "nobody signed up" nudge; empty disables it
param siteUrl = 'https://signup.alteonapps.com'
param emailCustomDomain = 'alteonapps.com'
param linkCustomEmailDomain = false // flip to true after the domain shows Verified (runbook step 6)
param emailLive = 'off'
