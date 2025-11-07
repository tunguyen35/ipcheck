// Cloudflare Pages Function - Get User IP (ULTRA SIMPLE)
// Endpoint: /ip

export async function onRequestGet({ request }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    // Get IP from Cloudflare
    const ip = request.headers.get('cf-connecting-ip') || 'Unknown';
    const country = request.headers.get('cf-ipcountry') || 'Unknown';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // Detect IP type
    const isIPv6 = ip.includes(':');

    // Try GeoIP (with timeout)
    let geoData = null;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const res = await fetch(
        `http://ip-api.com/json/${ip}?fields=country,countryCode,region,regionName,city,isp,org`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        if (data.status !== 'fail') {
          geoData = data;
        }
      }
    } catch (err) {
      console.log('GeoIP failed, using basic data');
    }

    // Return response
    return new Response(
      JSON.stringify({
        ip: ip,
        type: isIPv6 ? 'IPv6' : 'IPv4',
        country: geoData?.country || country,
        countryCode: geoData?.countryCode || country,
        city: geoData?.city || null,
        region: geoData?.regionName || geoData?.region || null,
        isp: geoData?.isp || geoData?.org || null,
        userAgent: userAgent
      }),
      { 
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ 
        error: err.message 
      }),
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }
  });
}
