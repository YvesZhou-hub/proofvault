// Vercel Function: receiver check — is this copy exactly what was approved, by whom and when.
import { handleReceipt } from '../server/receipt.js';

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { status, body } = await handleReceipt(payload);
  return Response.json(body, { status });
}
