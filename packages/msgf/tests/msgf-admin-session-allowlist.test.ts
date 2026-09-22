/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  isMsgfGlobalAdminEmail,
  isMsgfIndividualAdminEmail,
  resolveHumanSessionAccessRole,
} from "../lib/msgf-admin-session.ts";

describe("human session admin roles", () => {
  const prevGlobal = process.env.MSGF_GLOBAL_ADMIN_EMAILS;
  const prevIndividual = process.env.MSGF_INDIVIDUAL_ADMIN_EMAILS;

  afterEach(() => {
    if (prevGlobal == null) delete process.env.MSGF_GLOBAL_ADMIN_EMAILS;
    else process.env.MSGF_GLOBAL_ADMIN_EMAILS = prevGlobal;
    if (prevIndividual == null) delete process.env.MSGF_INDIVIDUAL_ADMIN_EMAILS;
    else process.env.MSGF_INDIVIDUAL_ADMIN_EMAILS = prevIndividual;
  });

  test("only the Elphie Syntax Workspace email is GLOBAL_ADMIN", () => {
    process.env.MSGF_GLOBAL_ADMIN_EMAILS = "jessicapickens@elphiesyntax.com";
    process.env.MSGF_INDIVIDUAL_ADMIN_EMAILS = "jessica@dealstar.io";
    assert.equal(isMsgfGlobalAdminEmail("JessicaPickens@elphiesyntax.com"), true);
    assert.equal(isMsgfGlobalAdminEmail("dev@elphiesyntax.com"), false);
    assert.equal(isMsgfGlobalAdminEmail("jessica@dealstar.io"), false);
    assert.equal(isMsgfIndividualAdminEmail("jessica@dealstar.io"), true);
    assert.equal(isMsgfIndividualAdminEmail("jessicapickens@elphiesyntax.com"), false);
  });

  test("DealStar individual admin is COMPANY_ADMIN even if profile still says GLOBAL_ADMIN", () => {
    process.env.MSGF_GLOBAL_ADMIN_EMAILS = "jessicapickens@elphiesyntax.com";
    process.env.MSGF_INDIVIDUAL_ADMIN_EMAILS = "jessica@dealstar.io";
    assert.equal(
      resolveHumanSessionAccessRole({
        email: "jessica@dealstar.io",
        profileRole: "GLOBAL_ADMIN",
        metadataRole: "GLOBAL_ADMIN",
      }),
      "COMPANY_ADMIN"
    );
    assert.equal(
      resolveHumanSessionAccessRole({
        email: "jessicapickens@elphiesyntax.com",
        profileRole: "DEVELOPER",
        metadataRole: "DEVELOPER",
      }),
      "GLOBAL_ADMIN"
    );
  });
});
