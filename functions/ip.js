// ip.txt — API: GET /ip
export async function onRequest(context) {
  const { request } = context;
  const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
  const userAgent = request.headers.get('User-Agent') || '';
  const country = request.cf?.country || 'N/A';
  const region = request.cf?.region || '';
  const city = request.cf?.city || '';
  const postal = request.cf?.postalCode || '';
  const timezone = request.cf?.timezone || '';
  // Ghi chú: Cloudflare Workers miễn phí KHÔNG cung cấp ISP/org trực tiếp
  // Bạn có thể tích hợp IPinfo/Ipapi nếu cần org/ISP

  return new Response(
    JSON.stringify({
      ip: ip,
      country: country,
      countryCode: country,
      region: region,
      city: city,
      postal: postal,
      timezone: timezone,
      userAgent: userAgent,
      // org/isp không có trong CF miễn phí → để trống hoặc dùng service khác
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    }
  );
}
