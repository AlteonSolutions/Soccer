import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { withData } from "@soccer/shared";
import { toErrorResponse } from "../lib/http.js";
import { getLogo } from "../lib/settings.js";

// The uploaded badge, public like the page that shows it. The URL carries a version (?v=) so it
// can be cached hard; a new upload changes the version. Served with a no-script policy: an SVG
// opened directly is otherwise a page that can run script on this origin.
app.http("logo", {
  route: "logo",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (_request: HttpRequest, context: InvocationContext) => {
    try {
      const logo = await withData(getLogo);
      if (!logo) return { status: 404, body: "" };
      return {
        status: 200,
        body: logo.bytes,
        headers: {
          "content-type": logo.content_type,
          "cache-control": "public, max-age=31536000, immutable",
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
          "x-content-type-options": "nosniff",
        },
      };
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});
