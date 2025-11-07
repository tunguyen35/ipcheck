// Cloudflare Pages Function - Get User IP API (SIMPLIFIED)
// Endpoint: /ip

export async function onRequestGet({ request }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // Get IP from Cloudflare headers
    const ip = request.headers.get('cf-connecting-ip') || 
               request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'Unknown';

    // Detect IP type
    const isIPv6 = ip.includes(':');
    const ipType = isIPv6 ? 'IPv6' : 'IPv4';
    
    // Get Cloudflare country code
    const country = request.headers.get('cf-ipcountry') || 'Unknown';
    
    // Get user agent
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // Try to get GeoIP info - use ip-api.com (best for both IPv4 and IPv6)
    try {
      const geoResponse = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`,
        {
          signal: AbortSignal.timeout(5000)
        }
      );

      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        
        if (geoData.status === 'success') {
          return new Response(
            JSON.stringify({
              ip: ip,
              type: ipType,
              country: geoData.country || country,
              countryCode: geoData.countryCode || country,
              city: geoData.city || null,
              region: geoData.regionName || geoData.region || null,
              postal: geoData.zip || null,
              timezone: geoData.timezone || null,
              latitude: geoData.lat || null,
              longitude: geoData.lon || null,
              org: geoData.org || geoData.as || null,
              isp: geoData.isp || null,
              userAgent: userAgent,
              timestamp: new Date().toISOString(),
              source: 'ip-api.com'
            }),
            { 
              status: 200,
              headers: corsHeaders
            }
          );
        }
      }
    } catch (err) {
      console.log('ip-api.com failed, trying fallback...');
    }

    // Fallback 1: Try ipwho.is
    try {
      const whoResponse = await fetch(
        `https://ipwho.is/${ip}`,
        {
          signal: AbortSignal.timeout(5000)
        }
      );

      if (whoResponse.ok) {
        const whoData = await whoResponse.json();
        
        if (whoData.success) {
          return new Response(
            JSON.stringify({
              ip: ip,
              type: ipType,
              country: whoData.country || country,
              countryCode: whoData.country_code || country,
              city: whoData.city || null,
              region: whoData.region || null,
              postal: whoData.postal || null,
              timezone: whoData.timezone?.id || null,
              latitude: whoData.latitude || null,
              longitude: whoData.longitude || null,
              org: whoData.connection?.org || null,
              isp: whoData.connection?.isp || null,
              userAgent: userAgent,
              timestamp: new Date().toISOString(),
              source: 'ipwho.is'
            }),
            { 
              status: 200,
              headers: corsHeaders
            }
          );
        }
      }
    } catch (err) {
      console.log('ipwho.is failed, trying last fallback...');
    }

    // Fallback 2: Return basic Cloudflare data (always works)
    return new Response(
      JSON.stringify({
        ip: ip,
        type: ipType,
        country: country,
        countryCode: country,
        city: request.headers.get('cf-ipcity') || null,
        region: request.headers.get('cf-region') || null,
        timezone: request.headers.get('cf-timezone') || null,
        postal: request.headers.get('cf-postal-code') || null,
        isp: null,
        org: null,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
        source: 'cloudflare-headers',
        note: 'Using basic Cloudflare data'
      }),
      { 
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (err) {
    // Return error response
    return new Response(
      JSON.stringify({ 
        error: err.message,
        message: 'Không thể lấy thông tin IP',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

// Handle OPTIONS for CORS
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
