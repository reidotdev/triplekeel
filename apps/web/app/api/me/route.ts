// GET /api/me: the extension reads the account's email and track.
// Relative imports keep the route testable without a path alias.
import {
  deviceApiOptions,
  handleMe,
  supabaseDeviceApiDeps,
} from "../../../src/lib/device-api";

export const OPTIONS = deviceApiOptions;

export function GET(request: Request): Promise<Response> {
  return handleMe(request, supabaseDeviceApiDeps());
}
