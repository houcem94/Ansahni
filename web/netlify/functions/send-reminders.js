// netlify/functions/send-reminders.js
// Fonction planifiée (s'exécute toutes les 10 minutes) qui envoie un rappel
// push aux utilisateurs n'ayant pas encore fait l'activité du créneau en cours.
// Nécessite le rôle "service_role" de Supabase (contourne le RLS pour lire
// tous les abonnements) — jamais utilisé côté navigateur.

const { schedule } = require('@netlify/functions');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// عدّل هذا إلى المنطقة الزمنية لأغلب مستخدميك إن لزم الأمر
const TIMEZONE = process.env.REMINDER_TIMEZONE || 'Africa/Tunis';

const SLOTS = [
  { name: 'morning', hour: 7, minute: 30, title: 'صباح الخير 🌿', body: 'ابدأ يومك بأذكار الصباح ومخططك — أنيس بانتظارك.' },
  { name: 'midday', hour: 13, minute: 0, title: 'حان وقت استراحة قصيرة 🌱', body: 'خذ 5 دقائق لنشاط بسيط يعيد لك توازنك.' },
  { name: 'evening', hour: 20, minute: 0, title: 'قبل أن ينتهي يومك 🌙', body: 'أنيس بانتظارك لإعادة صياغة أفكارك وأذكار المساء.' },
];

const handler = async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('متغيرات البيئة الناقصة لإرسال التذكيرات (تحقق من Netlify env vars)');
    return { statusCode: 200 };
  }

  webpush.setVapidDetails('mailto:contact@ansahni.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute').value, 10);

  const activeSlot = SLOTS.find((s) => s.hour === hour && Math.abs(s.minute - minute) <= 5);
  if (!activeSlot) return { statusCode: 200 };

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now); // YYYY-MM-DD

  const { data: subs, error: subsErr } = await supabase.from('push_subscriptions').select('*');
  if (subsErr || !subs || subs.length === 0) {
    if (subsErr) console.error(subsErr);
    return { statusCode: 200 };
  }

  for (const sub of subs) {
    try {
      const { data: plan } = await supabase
        .from('daily_plans')
        .select('morning_adhkar_done, lunch_activity_done, evening_adhkar_done, breathing_exercise_done')
        .eq('user_id', sub.user_id)
        .eq('plan_date', todayStr)
        .maybeSingle();

      let alreadyDone = false;
      if (plan) {
        if (activeSlot.name === 'morning') alreadyDone = plan.morning_adhkar_done;
        if (activeSlot.name === 'midday') alreadyDone = plan.lunch_activity_done;
        if (activeSlot.name === 'evening') alreadyDone = plan.evening_adhkar_done && plan.breathing_exercise_done;
      }
      if (alreadyDone) continue;

      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify({ title: activeSlot.title, body: activeSlot.body })
      );
    } catch (err) {
      console.error('push error for subscription', sub.id, err.statusCode || err.message);
      // إزالة الاشتراكات المنتهية أو غير الصالحة
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  return { statusCode: 200 };
};

exports.handler = schedule('*/10 * * * *', handler);
