// Cloudflare Pages Function - Domain IP & GeoIP Lookup API (IPv4 + IPv6 SUPPORTED)
// Endpoint: /resolve?domain=example.com

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (!domain) {
    return new Response(JSON.stringify({
      error: 'Missing domain parameter',
      message: 'Vui lòng cung cấp ?domain=example.com'
    }), { status: 400, headers: corsHeaders });
  }

  // Làm sạch domain: loại bỏ protocol, path, query
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, ''); // Loại bỏ mọi thứ sau dấu /

  // Regex kiểm tra domain cơ bản (không hỗ trợ IDN)
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
  if (!domainRegex.test(cleanDomain)) {
    return new Response(JSON.stringify({
      error: 'Invalid domain',
      message: 'Domain không hợp lệ',
      domain: cleanDomain
    }), { status: 400, headers: corsHeaders });
  }

  try {
    // === BƯỚC 1: Tra cứu DNS IPv4 (A) và IPv6 (AAAA) ===
    const [dnsA, dnsAAAA] = await Promise.all([
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(cleanDomain)}&type=A`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      }).then(r => r.json()).catch(() => ({})),
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(cleanDomain)}&type=AAAA`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      }).then(r => r.json()).catch(() => ({}))
    ]);

    // Ưu tiên IPv4, nếu không có thì dùng IPv6
    let ipRecord = dnsA.Answer?.find(r => r.type === 1);
    let version = 'IPv4';

    if (!ipRecord) {
      ipRecord = dnsAAAA.Answer?.find(r => r.type === 28);
      version = 'IPv6';
    }

    if (!ipRecord) {
      return new Response(JSON.stringify({
        error: 'No valid IP found',
        message: 'Không tìm thấy địa chỉ IPv4 hoặc IPv6 cho domain này',
        domain: cleanDomain
      }), { status: 404, headers: corsHeaders });
    }

    const ip = ipRecord.data;

    // === BƯỚC 2: Tra cứu GeoIP qua nhiều dịch vụ (có fallback) ===

    // --- API 1: ip-api.com ---
    try {
      // Thêm lat,lon vào fields
      const geoUrl = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;
      const geoResponse = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) });

      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        if (geoData.status === 'success') {
          return new Response(JSON.stringify({
            domain: cleanDomain,
            ip: ip,
            version: version,
            country: geoData.country || 'Unknown',
            countryCode: geoData.countryCode || null,
            region: geoData.regionName || geoData.region || 'Unknown',
            city: geoData.city || 'Unknown',
            postal: geoData.zip || null,
            timezone: geoData.timezone || null,
            isp: geoData.isp || 'Unknown',
            org: geoData.org || geoData.as || null,
            asn: geoData.as || null,
            latitude: geoData.lat || null,
            longitude: geoData.lon || null,
            timestamp: new Date().toISOString(),
            source: 'ip-api.com'
          }), { status: 200, headers: corsHeaders });
        }
      }
    } catch (err) {
      console.error('ip-api.com failed:', err.message);
    }

    // --- API 2: ipwho.is ---
    try {
      const whoResponse = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(5000)
      });

      if (whoResponse.ok) {
        const whoData = await whoResponse.json();
        if (whoData.success) {
          return new Response(JSON.stringify({
            domain: cleanDomain,
            ip: ip,
            version: version,
            country: whoData.country || 'Unknown',
            countryCode: whoData.country_code || null,
            region: whoData.region || 'Unknown',
            city: whoData.city || 'Unknown',
            postal: whoData.postal || null,
            timezone: whoData.timezone?.id || null,
            isp: whoData.connection?.isp || 'Unknown',
            org: whoData.connection?.org || null,
            asn: whoData.connection?.asn || null,
            latitude: whoData.latitude || null,
            longitude: whoData.longitude || null,
            timestamp: new Date().toISOString(),
            source: 'ipwho.is'
          }), { status: 200, headers: corsHeaders });
        }
      }
    } catch (err) {
      console.error('ipwho.is failed:', err.message);
    }

    // --- API 3: ipapi.co ---
    try {
      const ipapiResponse = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
        headers: { 'User-Agent': 'DomainResolver/1.0' },
        signal: AbortSignal.timeout(5000)
      });

      if (ipapiResponse.ok) {
        const ipapiData = await ipapiResponse.json();
        // ipapi.co không trả "error" khi thành công. Nếu có lỗi, thường là HTTP error hoặc JSON chứa "error":true
        if (!ipapiData.error && ipapiData.ip) {
          return new Response(JSON.stringify({
            domain: cleanDomain,
            ip: ip,
            version: version,
            country: ipapiData.country_name || 'Unknown',
            countryCode: ipapiData.country_code || null,
            region: ipapiData.region || 'Unknown',
            city: ipapiData.city || 'Unknown',
            postal: ipapiData.postal || null,
            timezone: ipapiData.timezone || null,
            isp: ipapiData.org || 'Unknown',
            org: ipapiData.org || null,
            asn: ipapiData.asn || null,
            latitude: ipapiData.latitude || null,
            longitude: ipapiData.longitude || null,
            timestamp: new Date().toISOString(),
            source: 'ipapi.co'
          }), { status: 200, headers: corsHeaders });
        }
      }
    } catch (err) {
      console.error('ipapi.co failed:', err.message);
    }

    // === FALLBACK: có IP nhưng không tra được GeoIP ===
    return new Response(JSON.stringify({
      domain: cleanDomain,
      ip: ip,
      version: version,
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      isp: 'Unknown',
      message: 'Đã tìm thấy IP, nhưng không thể tra thông tin địa lý (GeoIP).',
      timestamp: new Date().toISOString()
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message || 'Unknown error',
      message: 'Không thể tra cứu domain',
      domain: domain
    }), { status: 500, headers: corsHeaders });
  }
}

// Xử lý CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
