// APPLIED 2026-09-12 with these values. Edit and redeploy to change the live configuration.
using './main.bicep'

param namePrefix = 'snaccer'
param teamName = 'Manchester City'
param timeZone = 'America/New_York'
param coachEmail = '' // your address, for the Monday "nobody signed up" nudge; empty disables it
param siteUrl = 'https://signup.alteonapps.com'
param emailCustomDomain = 'alteonapps.com'
param linkCustomEmailDomain = false // flip to true after the domain shows Verified (runbook step 6)
param emailLive = 'off'
