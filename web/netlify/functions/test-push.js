// netlify/functions/test-push.js
// Envoie un vrai push immédiat à l'utilisateur connecté, pour tester
// toute la chaîne (abonnement + clés VAPID + réception) sans attendre
// un créneau planifié. Nécessite le token de session de l'utilisateur.

const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const missing = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!VAPID_PUBLIC_KEY) missing.push('VAPID_PUBLIC_KEY');
  if (!VAPID_PRIVATE_KEY) missing.push('VAPID_PRIVATE_KEY');
  if (missing.length) {
    return { statusCode: 500, body: JSON.stringify({ error: 'متغيرات ناقصة على الخادم: ' + missing.join('، ') }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'يجب تسجيل الدخول أولًا.' }) };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData || !userData.user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'الجلسة غير صالحة، سجّل الدخول من جديد.' }) };
  }

  webpush.setVapidDetails('mailto:contact@ansahni.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userData.user.id);

  if (subsErr) {
    return { statusCode: 500, body: JSON.stringify({ error: subsErr.message }) };
  }
  if (!subs || subs.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'لا يوجد اشتراك إشعارات مسجَّل لهذا الحساب على هذا الجهاز. فعّل 🔔 أولًا.' }) };
  }

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify({ title: 'اختبار الإشعارات 🔔', body: 'إن وصلتك هذه الرسالة، فكل شيء يعمل بشكل صحيح!' })
      );
      sent++;
    } catch (err) {
      console.error('test push error:', err.statusCode || err.message);
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sent }) };
};
