import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { assetKindSchema, withData } from "@soccer/shared";
import { parseParam, toErrorResponse } from "../lib/http.js";
import { getLogo } from "../lib/settings.js";

// The uploaded badge or Snack Duty logo, public like the page that shows them. The URL carries a
// version (?v=) so it can be cached hard; a new upload changes the version. Served with a
// no-script policy: an SVG opened directly is otherwise a page that can run script on this origin.
app.http("assets", {
  route: "assets/{kind}",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      const kind = parseParam(request.params.kind, assetKindSchema, "image kind");
      const logo = await withData((repo) => getLogo(repo, kind));
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
