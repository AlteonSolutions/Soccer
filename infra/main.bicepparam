// NOT YET APPLIED: the 2026-09-15 values (siteUrl, linkCustomEmailDomain, emailLive) await the
// deploy in runbook step 7. Last applied 2026-09-12. Edit and redeploy to change the live configuration.
using './main.bicep'

param namePrefix = 'snaccer'
param teamName = 'Manchester City'
param timeZone = 'America/New_York'
param coachEmail = '' // fallback for {{coach}} in the emails; the Coach Email saved on the admin page wins
param siteUrl = 'https://snackduty.alteonapps.com'
param emailCustomDomain = 'alteonapps.com'
param linkCustomEmailDomain = true // alteonapps.com showed Verified (all four records) on 2026-09-15
param emailLive = 'on' // from 2026-09-15: the sender domain is verified, so emails go out for real
