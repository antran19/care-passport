// tide's secureFetch builds `new URL(url)` to sign a DPoP proof, so it needs an ABSOLUTE url.
// Our own API routes are same-origin; this turns "/api/..." into "http://host/api/...".
export const abs = (path: string): string => new URL(path, window.location.origin).toString();
