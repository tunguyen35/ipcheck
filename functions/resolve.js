// resolve.txt — API: GET /resolve?domain=example.com
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (!domain) return new Response(JSON.stringify({ error: 'Missing domain parameter' }), { status: 400, headers: corsHeaders });

  // Loại bỏ giao thức/trailing slash
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];

  try {
    // Cloudflare Workers hỗ trợ dnsResolve (chỉ với tên miền hợp lệ)
    const ip = await context.cloudflare.dnsResolve(cleanDomain);
    
    // Lấy GeoIP từ IP
    const geo = await fetch(`https://ipinfo.io/${ip}/json?token=YOUR_TOKEN`).then(r => r.json()).catch(() => ({}));
    
    return new Response(
      JSON.stringify({
        domain: cleanDomain,
        ip: ip,
        country: geo.country || 'N/A',
        region: geo.region || '',
        city: geo.city || '',
        isp: geo.org || '',
        org: geo.org || '',
        postal: geo.postal || '',
        timezone: geo.timezone || ''
      }),
      { headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to resolve domain',
        message: err.message 
      }),
      { status: 400, headers: corsHeaders }
    );
  }
}
