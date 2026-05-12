import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const KROGER_BASE = "https://api.kroger.com/v1";

export const KROGER_SCOPES = {
  productCompact: "product.compact",
  cartBasicWrite: "cart.basic:write",
  profileCompact: "profile.compact",
} as const;

export const DEFAULT_SCOPES = [
  KROGER_SCOPES.productCompact,
  KROGER_SCOPES.cartBasicWrite,
  KROGER_SCOPES.profileCompact,
];

// ---------- PKCE + URL helpers ----------

const base64url = (buf: Buffer): string =>
  buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export type PkcePair = { verifier: string; challenge: string };

export const generatePkcePair = (): PkcePair => {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
};

export const generateState = (): string => randomBytes(16).toString("hex");

export const buildAuthorizeUrl = (opts: {
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  state: string;
  codeChallenge: string;
}): string => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: opts.scopes.join(" "),
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${KROGER_BASE}/connect/oauth2/authorize?${params.toString()}`;
};

// ---------- Token exchange + refresh ----------

const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;

const basicAuthHeader = (clientId: string, clientSecret: string): string =>
  `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;

const postToken = async (
  body: URLSearchParams,
  clientId: string,
  clientSecret: string,
): Promise<TokenResponse> => {
  const res = await fetch(`${KROGER_BASE}/connect/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(clientId, clientSecret),
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new KrogerApiError(
      `Kroger token endpoint failed: ${res.status}`,
      res.status,
      text,
    );
  }
  return TokenResponseSchema.parse(await res.json());
};

export const exchangeCode = (opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<TokenResponse> => {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
  });
  return postToken(body, opts.clientId, opts.clientSecret);
};

export const refreshAccessToken = (opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TokenResponse> => {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: opts.refreshToken,
  });
  return postToken(body, opts.clientId, opts.clientSecret);
};

// ---------- Locations ----------

const KrogerAddressSchema = z
  .object({
    addressLine1: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
  })
  .partial();

export const KrogerLocationSchema = z.object({
  locationId: z.string(),
  name: z.string(),
  chain: z.string().optional(),
  address: KrogerAddressSchema.optional(),
  phone: z.string().optional(),
});

export type KrogerLocation = z.infer<typeof KrogerLocationSchema>;

const LocationsResponseSchema = z.object({
  data: z.array(KrogerLocationSchema),
});

const SingleLocationResponseSchema = z.object({
  data: KrogerLocationSchema,
});

export const getLocation = async (opts: {
  accessToken: string;
  locationId: string;
}): Promise<KrogerLocation | null> => {
  const res = await fetch(
    `${KROGER_BASE}/locations/${encodeURIComponent(opts.locationId)}`,
    {
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        Accept: "application/json",
      },
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new KrogerApiError(
      `Kroger location lookup failed: ${res.status}`,
      res.status,
      await res.text(),
    );
  }
  const parsed = SingleLocationResponseSchema.parse(await res.json());
  return parsed.data;
};

export const searchLocations = async (opts: {
  accessToken: string;
  zipCode: string;
  radiusInMiles?: number;
  limit?: number;
}): Promise<KrogerLocation[]> => {
  const params = new URLSearchParams({
    "filter.zipCode.near": opts.zipCode,
    "filter.limit": String(opts.limit ?? 10),
  });
  if (opts.radiusInMiles) {
    params.set("filter.radiusInMiles", String(opts.radiusInMiles));
  }
  const res = await fetch(`${KROGER_BASE}/locations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${opts.accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new KrogerApiError(
      `Kroger locations failed: ${res.status}`,
      res.status,
      await res.text(),
    );
  }
  const parsed = LocationsResponseSchema.parse(await res.json());
  return parsed.data;
};

// ---------- Products ----------

const KrogerProductImageSizeSchema = z.object({
  size: z.string(),
  url: z.string().url(),
});

const KrogerProductImageSchema = z.object({
  perspective: z.string().optional(),
  default: z.boolean().optional(),
  sizes: z.array(KrogerProductImageSizeSchema),
});

const KrogerProductItemPriceSchema = z
  .object({
    regular: z.number().optional(),
    promo: z.number().optional(),
  })
  .partial();

const KrogerProductItemSchema = z.object({
  itemId: z.string().optional(),
  size: z.string().optional(),
  soldBy: z.string().optional(),
  price: KrogerProductItemPriceSchema.optional(),
  inventory: z
    .object({ stockLevel: z.string() })
    .optional(),
});

export const KrogerProductSchema = z.object({
  productId: z.string(),
  upc: z.string().optional(),
  brand: z.string().optional(),
  description: z.string(),
  categories: z.array(z.string()).optional(),
  images: z.array(KrogerProductImageSchema).optional(),
  items: z.array(KrogerProductItemSchema).optional(),
});

export type KrogerProduct = z.infer<typeof KrogerProductSchema>;

const ProductsResponseSchema = z.object({
  data: z.array(KrogerProductSchema),
});

// Kroger fulfillment channels. Pricing on /products is most reliably populated
// when an explicit fulfillment is requested. Default 'ais' (aisle/in-store)
// since this app drives an in-store shopping list.
export type KrogerFulfillment = "ais" | "csp" | "dug" | "del" | "sth";

export const searchProducts = async (opts: {
  accessToken: string;
  term: string;
  locationId: string;
  limit?: number;
  fulfillment?: KrogerFulfillment;
}): Promise<KrogerProduct[]> => {
  const params = new URLSearchParams({
    "filter.term": opts.term,
    "filter.locationId": opts.locationId,
    "filter.limit": String(opts.limit ?? 5),
    "filter.fulfillment": opts.fulfillment ?? "ais",
  });
  const res = await fetch(`${KROGER_BASE}/products?${params.toString()}`, {
    headers: { Authorization: `Bearer ${opts.accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new KrogerApiError(
      `Kroger products failed: ${res.status}`,
      res.status,
      await res.text(),
    );
  }
  const parsed = ProductsResponseSchema.parse(await res.json());
  return parsed.data;
};

// ---------- Query normalization (for ItemMatch lookup keys) ----------

// Lowercase, trim, and collapse internal whitespace. Kept deliberately minimal —
// we want "Cheddar Cheese" and "cheddar  cheese" to hit the same match, but we
// don't try to handle plurals/punctuation/synonyms. Iterate if needed.
export const normalizeQuery = (s: string): string =>
  s.toLowerCase().trim().replace(/\s+/g, " ");

// ---------- Snapshot helpers (for storing display data on ShoppingListItem) ----------

export type ProductSnapshot = {
  productId: string;
  upc?: string;
  brand?: string;
  description: string;
  imageUrl?: string;
  priceRegular?: number;
  pricePromo?: number;
  size?: string;
};

export const productToSnapshot = (p: KrogerProduct): ProductSnapshot => {
  // A single Kroger product can carry multiple `items` (different SKUs/sizes).
  // The first one isn't always the one with pricing — prefer the first item
  // that actually has a price, falling back to items[0] so size still shows.
  const itemWithPrice = p.items?.find(
    (i) => i.price?.regular != null || i.price?.promo != null,
  );
  const item = itemWithPrice ?? p.items?.[0];
  const image = (p.images ?? []).find((i) => i.default) ?? p.images?.[0];
  const imageUrl =
    image?.sizes.find((s) => s.size === "medium")?.url ??
    image?.sizes[0]?.url;
  return {
    productId: p.productId,
    upc: p.upc,
    brand: p.brand,
    description: p.description,
    imageUrl,
    priceRegular: item?.price?.regular,
    pricePromo: item?.price?.promo,
    size: item?.size,
  };
};

// ---------- Errors ----------

export class KrogerApiError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "KrogerApiError";
    this.status = status;
    this.body = body;
  }
}
