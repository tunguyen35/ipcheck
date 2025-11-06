// Cloudflare Pages Function - Get User IP API (IPv4 Priority)
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
    const cfIP = request.headers.get('cf-connecting-ip') || 
                 request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'Unknown';

    // Detect if IPv6
    const isIPv6 = cfIP.includes(':');
    
    // Get Cloudflare country code
    const country = request.headers.get('cf-ipcountry') || 'Unknown';
    
    // Get user agent
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // Try to get IPv4 if current IP is IPv6
    let ipv4 = null;
    let ipv6 = null;
    let primaryIP = cfIP;

    if (isIPv6) {
      ipv6 = cfIP;
      
      // Try to get IPv4 by making a request to a service that returns IPv4
      try {
        const ipv4Response = await fetch('https://api.ipify.org?format=json', {
          signal: AbortSignal.timeout(3000)
        });
        if (ipv4Response.ok) {
          const ipv4Data = await ipv4Response.json();
          ipv4 = ipv4Data.ip;
          primaryIP = ipv4; // Use IPv4 as primary for better GeoIP data
        }
      } catch (err) {
        console.log('Could not fetch IPv4:', err.message);
      }
    } else {
      ipv4 = cfIP;
      primaryIP = ipv4;
    }

    // Try to get detailed GeoIP info using PRIMARY IP (prefer IPv4)
    try {
      // Use ip-api.com - better support for both IPv4 and IPv6
      const geoResponse = await fetch(
        `http://ip-api.com/json/${primaryIP}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`,
        {
          signal: AbortSignal.timeout(5000)
        }
      );

      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        
        if (geoData.status === 'success') {
          return new Response(
            JSON.stringify({
              ip: primaryIP,
              ipv4: ipv4,
              ipv6: ipv6,
              type: isIPv6 ? 'IPv6' : 'IPv4',
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
    } catch (geoError) {
      console.error('ip-api.com failed:', geoError);
    }

    // Fallback: Try ipwho.is
    try {
      const whoResponse = await fetch(
        `https://ipwho.is/${primaryIP}`,
        {
          signal: AbortSignal.timeout(5000)
        }
      );

      if (whoResponse.ok) {
        const whoData = await whoResponse.json();
        
        if (whoData.success) {
          return new Response(
            JSON.stringify({
              ip: primaryIP,
              ipv4: ipv4,
              ipv6: ipv6,
              type: isIPv6 ? 'IPv6' : 'IPv4',
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
    } catch (whoError) {
      console.error('ipwho.is failed:', whoError);
    }

    // Last fallback: Try ipapi.co
    try {
      const ipapiResponse = await fetch(
        `https://ipapi.co/${primaryIP}/json/`,
        {
          headers: { 'User-Agent': 'CheckTools/1.0' },
          signal: AbortSignal.timeout(5000)
        }
      );

      if (ipapiResponse.ok) {
        const ipapiData = await ipapiResponse.json();
        
        if (!ipapiData.error) {
          return new Response(
            JSON.stringify({
              ip: primaryIP,
              ipv4: ipv4,
              ipv6: ipv6,
              type: isIPv6 ? 'IPv6' : 'IPv4',
              country: ipapiData.country_name || country,
              countryCode: ipapiData.country_code || country,
              city: ipapiData.city || null,
              region: ipapiData.region || null,
              postal: ipapiData.postal || null,
              timezone: ipapiData.timezone || null,
              latitude: ipapiData.latitude || null,
              longitude: ipapiData.longitude || null,
              org: ipapiData.org || null,
              isp: ipapiData.org || null,
              userAgent: userAgent,
              timestamp: new Date().toISOString(),
              source: 'ipapi.co'
            }),
            { 
              status: 200,
              headers: corsHeaders
            }
          );
        }
      }
    } catch (ipapiError) {
      console.error('ipapi.co failed:', ipapiError);
    }

    // If all GeoIP APIs fail, return basic Cloudflare data
    return new Response(
      JSON.stringify({
        ip: primaryIP,
        ipv4: ipv4,
        ipv6: ipv6,
        type: isIPv6 ? 'IPv6' : 'IPv4',
        country: country,
        countryCode: country,
        city: request.headers.get('cf-ipcity') || null,
        region: request.headers.get('cf-region') || null,
        timezone: request.headers.get('cf-timezone') || null,
        postal: request.headers.get('cf-postal-code') || null,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
        source: 'cloudflare-headers',
        note: 'Using basic Cloudflare data (GeoIP APIs failed)'
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
