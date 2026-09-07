// NOT YET APPLIED. Parameter values for the first deployment; edit before running the runbook.
using './main.bicep'

param namePrefix = 'soccer'
param teamName = 'Our Team'
param timeZone = 'America/New_York'
param reminderDaysAhead = 2
param coachEmail = ''
param siteUrl = ''
param emailCustomDomain = ''
param emailLive = 'off'
