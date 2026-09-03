// @ts-expect-error Deno imports
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'npm:jose';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export async function verifyClerkToken(req: Request, token: string): Promise<string> {
  const expectedIssuer = Deno.env.get("CLERK_ISSUER");
  if (!expectedIssuer) {
    throw new Error("Server configuration error: CLERK_ISSUER is missing");
  }

  const decoded = decodeJwt(token);
  if (!decoded || decoded.iss !== expectedIssuer) {
    throw new Error("Invalid token issuer");
  }

  const jwksUrl = new URL('/.well-known/jwks.json', expectedIssuer);
  const JWKS = createRemoteJWKSet(jwksUrl);

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: expectedIssuer,
    algorithms: ["RS256"],
  });

  if (!payload.sub) {
    throw new Error("No user ID in token.");
  }

  return payload.sub;
}
