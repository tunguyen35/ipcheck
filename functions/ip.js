// Cloudflare Pages Function - Get User IP API
// Endpoint: /ip

export async function onRequestGet({ request }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // Get real IP from Cloudflare header
    const ip = request.headers.get('cf-connecting-ip') || 
                request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'Unknown';

    // Get Cloudflare country code
    const country = request.headers.get('cf-ipcountry') || 'Unknown';
    
    // Get user agent
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // Get additional Cloudflare headers if available
    const cfData = {
      ip: ip,
      country: country,
      userAgent: userAgent,
      city: request.headers.get('cf-ipcity') || null,
      region: request.headers.get('cf-region') || null,
      timezone: request.headers.get('cf-timezone') || null,
      postalCode: request.headers.get('cf-postal-code') || null
    };

    // Try to get more detailed info from external GeoIP API
    try {
      if (ip && ip !== 'Unknown') {
        const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`, {
          headers: {
            'User-Agent': 'CheckTools/1.0'
          },
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });

        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          
          return new Response(
            JSON.stringify({
              ip: ip,
              country: geoData.country_name || country,
              countryCode: geoData.country_code || country,
              city: geoData.city || cfData.city,
              region: geoData.region || cfData.region,
              timezone: geoData.timezone || cfData.timezone,
              postal: geoData.postal || cfData.postalCode,
              org: geoData.org || null,
              isp: geoData.org || null,
              userAgent: userAgent,
              timestamp: new Date().toISOString()
            }),
            { 
              status: 200,
              headers: corsHeaders
            }
          );
        }
      }
    } catch (geoError) {
      console.error('GeoIP lookup failed:', geoError);
      // Continue with basic info
    }

    // Return basic info if GeoIP fails
    return new Response(
      JSON.stringify({
        ip: ip,
        country: country,
        countryCode: country,
        city: cfData.city,
        region: cfData.region,
        timezone: cfData.timezone,
        postal: cfData.postalCode,
        userAgent: userAgent,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ 
        error: err.message,
        message: 'Không thể lấy thông tin IP'
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
