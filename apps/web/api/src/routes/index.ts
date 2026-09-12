/*
 * Entry point of the API Function App. Every route file registers its functions with
 * `app.http(...)` as a side effect of being imported, so a route that is not imported here does
 * not exist — nothing errors, the URL just 404s. Add the import in the same commit as the route.
 */
import "./games.js";
import "./claims.js";
import "./admin.js";
import "./jobs.js";
