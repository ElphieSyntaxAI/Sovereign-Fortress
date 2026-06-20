import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

describe("resolveGoogleOAuthRedirectUri", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  test("production prefers Author SPA origin over Cloud Run redirect in env", async () => {
    process.env = {
      ...env,
      NODE_ENV: "production",
      AUTHOR_APP_URL: "https://authorecosystem.elphiesyntax.com",
      GOOGLE_OAUTH_REDIRECT_URI:
        "https://author-bff-504003558298.us-central1.run.app/api/google/oauth/callback",
    };
    const { resolveGoogleOAuthRedirectUri } = await import("../src/lib/googleOAuth.js");
    assert.equal(
      resolveGoogleOAuthRedirectUri(),
      "https://authorecosystem.elphiesyntax.com/api/google/oauth/callback"
    );
  });

  test("production keeps env redirect when host matches public Author app", async () => {
    process.env = {
      ...env,
      NODE_ENV: "production",
      AUTHOR_APP_URL: "https://authorecosystem.elphiesyntax.com",
      GOOGLE_OAUTH_REDIRECT_URI:
        "https://authorecosystem.elphiesyntax.com/api/google/oauth/callback",
    };
    const { resolveGoogleOAuthRedirectUri } = await import("../src/lib/googleOAuth.js");
    assert.equal(
      resolveGoogleOAuthRedirectUri(),
      "https://authorecosystem.elphiesyntax.com/api/google/oauth/callback"
    );
  });

  test("development falls back to localhost BFF callback", async () => {
    process.env = {
      ...env,
      NODE_ENV: "development",
    };
    delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
    const { resolveGoogleOAuthRedirectUri } = await import("../src/lib/googleOAuth.js");
    assert.match(resolveGoogleOAuthRedirectUri(), /127\.0\.0\.1:3002\/api\/google\/oauth\/callback$/);
  });
});
