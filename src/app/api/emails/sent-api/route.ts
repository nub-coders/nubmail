import { NextRequest } from 'next/server';
import { GET as handleReadApi } from '../read-api/route';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  url.searchParams.set('folder', 'sent');
  const newReq = new NextRequest(url.toString(), {
    headers: req.headers,
  });
  return handleReadApi(newReq);
}
