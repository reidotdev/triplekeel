// GET /api/questions: the extension reads the question set for its track.
// Relative imports keep the route testable without a path alias.
import {
  deviceApiOptions,
  handleQuestions,
  supabaseDeviceApiDeps,
} from "../../../src/lib/device-api";

export const OPTIONS = deviceApiOptions;

export function GET(request: Request): Promise<Response> {
  return handleQuestions(request, supabaseDeviceApiDeps());
}
