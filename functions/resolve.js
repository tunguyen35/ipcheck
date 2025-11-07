// Cloudflare Pages Function - Domain IP Lookup (FIXED)
// Endpoint: /resolve?domain=example.com

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // Validate domain parameter
  if (!domain) {
    return new Response(
      JSON.stringify({ 
        error: 'Missing domain parameter'
      }), 
      { status: 400, headers: corsHeaders }
    );
  }

  // Clean domain
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .split('/')[0];

  try {
    // Step 1: DNS Lookup to get IP
    const dnsRes = await fetch(
      `https://dns.google/resolve?name=${cleanDomain}&type=A`,
      { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!dnsRes.ok) {
      throw new Error('DNS lookup failed');
    }

    const dnsData = await dnsRes.json();
    
    if (!dnsData.Answer || dnsData.Answer.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Domain not found',
          domain: cleanDomain
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get IP from A record
    const ipRecord = dnsData.Answer.find(r => r.type === 1);
    if (!ipRecord) {
      return new Response(
        JSON.stringify({ 
          error: 'No A record found',
          domain: cleanDomain
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    const domainIP = ipRecord.data;

    // Step 2: GeoIP lookup for DOMAIN IP (NOT user IP!)
    let geoData = null;
    
    try {
      const geoRes = await fetch(
        `http://ip-api.com/json/${domainIP}?fields=country,countryCode,region,regionName,city,isp,org`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (geoRes.ok) {
        const data = await geoRes.json();
        if (data.status !== 'fail') {
          geoData = data;
        }
      }
    } catch (err) {
      console.log('GeoIP failed for domain IP');
    }

    // Return domain IP info (NOT user IP!)
    return new Response(
      JSON.stringify({
        domain: cleanDomain,
        ip: domainIP,
        country: geoData?.country || 'Unknown',
        countryCode: geoData?.countryCode || null,
        region: geoData?.regionName || geoData?.region || 'Unknown',
        city: geoData?.city || 'Unknown',
        isp: geoData?.isp || geoData?.org || 'Unknown',
        org: geoData?.org || null
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
        domain: cleanDomain
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
