// Expéditeur réel de la file de notifications (outbox) des rendez-vous.
//
// Ce qui est garanti :
//  - la base reste seule source de vérité : on RÉSERVE un lot via
//    claim_due_notifications (FOR UPDATE SKIP LOCKED), puis on rapporte le
//    résultat via mark_notification_result ;
//  - un message n'est marqué « sent » que si le fournisseur a répondu 2xx avec
//    un identifiant ; sinon « failed » + message d'erreur du fournisseur ;
//  - si aucun fournisseur n'est configuré, la file d'attente reste intacte et
//    l'état exact des canaux/secrets est remonté sans jamais exposer de clé ;
//  - le canal SMS est explicitement non pris en charge (channel_not_supported: sms).
//
// Deux modes d'appel :
//  1. Automatique (cron) : en-tête `x-dispatch-token` = NOTIFICATIONS_DISPATCH_TOKEN,
//     ou Authorization: Bearer <service_role_key>. Traite tous les salons.
//  2. Manuel / Sonde santé (ERP ou SuperAdmin) : Authorization: Bearer <JWT utilisateur>
//     + body { salon_id } (ou { mode: 'health', scope: 'platform' } pour SuperAdmin).
//
// Secrets à définir (Dashboard Supabase > Edge Functions > Secrets) :
//   RESEND_API_KEY, NOTIFICATIONS_EMAIL_FROM
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_PREFIX (recommandé hors 24 h),
//   WHATSAPP_BUSINESS_ACCOUNT_ID (optionnel, pour auditer le statut des modèles Meta)
//   PUBLIC_APP_URL (origine du site, pour le lien « Ma réservation »)
//   NOTIFICATIONS_DISPATCH_TOKEN (jeton du planificateur)

// Aucune dépendance externe : le runtime Edge de ce projet ne résout pas les
// modules distants (esm.sh / jsr provoque un BOOT_ERROR). On parle donc à
// PostgREST et à GoTrue en fetch direct, avec les clés fournies par le runtime.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM = Deno.env.get('NOTIFICATIONS_EMAIL_FROM') ?? '';
const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN') ?? '';
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';
const WHATSAPP_WABA_ID = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID') ?? '';
const WHATSAPP_TEMPLATE_PREFIX = Deno.env.get('WHATSAPP_TEMPLATE_PREFIX') ?? '';
const WHATSAPP_TEMPLATE_LANG = Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'fr';
const WHATSAPP_COUNTRY_CODE = Deno.env.get('WHATSAPP_DEFAULT_COUNTRY_CODE') ?? '225';
const PUBLIC_APP_URL = (Deno.env.get('PUBLIC_APP_URL') ?? '').replace(/\/$/, '');
const DISPATCH_TOKEN = Deno.env.get('NOTIFICATIONS_DISPATCH_TOKEN') ?? '';

const WHATSAPP_TEMPLATE_KINDS = [
  'booking_received',
  'booking_confirmed',
  'booking_cancelled',
  'reminder_24h',
  'review_request',
] as const;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dispatch-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type Notification = {
  id: string;
  salon_id: string;
  appointment_id: string;
  channel: 'email' | 'whatsapp' | 'sms';
  kind: string;
  recipient: string;
  payload: Record<string, unknown>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);

function getCapabilities() {
  const emailHasApiKey = Boolean(RESEND_API_KEY);
  const emailHasSender = Boolean(EMAIL_FROM);
  const emailConfigured = emailHasApiKey && emailHasSender;

  const waHasToken = Boolean(WHATSAPP_TOKEN);
  const waHasPhoneId = Boolean(WHATSAPP_PHONE_ID);
  const waConfigured = waHasToken && waHasPhoneId;
  const waTemplateMode = Boolean(WHATSAPP_TEMPLATE_PREFIX);

  return {
    email: {
      provider: 'resend',
      supported: true,
      configured: emailConfigured,
      hasApiKey: emailHasApiKey,
      hasSender: emailHasSender,
    },
    whatsapp: {
      provider: 'meta_cloud_api',
      supported: true,
      configured: waConfigured,
      hasToken: waHasToken,
      hasPhoneNumberId: waHasPhoneId,
      hasBusinessAccountId: Boolean(WHATSAPP_WABA_ID),
      templateModeEnabled: waTemplateMode,
      templatePrefixConfigured: waTemplateMode,
      templateLang: WHATSAPP_TEMPLATE_LANG,
      defaultCountryCode: WHATSAPP_COUNTRY_CODE,
      expectedTemplates: waTemplateMode
        ? WHATSAPP_TEMPLATE_KINDS.map((kind) => `${WHATSAPP_TEMPLATE_PREFIX}_${kind}`)
        : [],
    },
    sms: {
      provider: null,
      supported: false,
      configured: false,
      reason: 'channel_not_supported: sms',
      message: 'Le canal SMS n’est pas disponible tant qu’il n’a pas de fournisseur raccordé.',
    },
    scheduler: {
      dispatchTokenConfigured: Boolean(DISPATCH_TOKEN),
      publicAppUrlConfigured: Boolean(PUBLIC_APP_URL),
    },
  };
}

function money(amount: unknown): string {
  const value = Number(amount ?? 0);
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(value))} FCFA`;
}

function abidjan(iso: unknown): { date: string; time: string } {
  const d = new Date(str(iso));
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const date = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return { date, time };
}

function portalLink(payload: Record<string, unknown>): string {
  const token = str(payload.booking_token);
  if (!PUBLIC_APP_URL || !token) return '';
  // Le jeton voyage dans le fragment (#) afin de ne jamais être envoyé au
  // serveur web ni journalisé dans les accès HTTP ou les en-têtes Referer.
  return `${PUBLIC_APP_URL}/reservation#${token}`;
}

const TITLES: Record<string, string> = {
  booking_received: 'Demande de réservation reçue',
  booking_confirmed: 'Réservation confirmée',
  booking_cancelled: 'Réservation annulée',
  reminder_24h: 'Rappel : votre rendez-vous demain',
  review_request: "Comment s'est passée votre prestation ?",
};

function render(n: Notification) {
  const p = n.payload ?? {};
  const client = str(p.client_name, 'Bonjour');
  const salon = str(p.salon_name, 'votre salon');
  const service = str(p.service_name, 'votre prestation');
  const staff = str(p.staff_name);
  const { date, time } = abidjan(p.starts_at);
  const link = portalLink(p);
  const title = TITLES[n.kind] ?? 'Votre rendez-vous';

  const intro: Record<string, string> = {
    booking_received: `Votre demande de réservation chez ${salon} est enregistrée. Le salon doit encore la confirmer.`,
    booking_confirmed: `Bonne nouvelle : votre réservation chez ${salon} est confirmée.`,
    booking_cancelled: `Votre réservation chez ${salon} a été annulée.`,
    reminder_24h: `Petit rappel : votre rendez-vous chez ${salon} approche.`,
    review_request: `Merci pour votre visite chez ${salon}. Votre avis aide les autres clients à choisir.`,
  };

  const lines = [
    `${client},`,
    '',
    intro[n.kind] ?? `Concernant votre rendez-vous chez ${salon}.`,
    '',
    `Prestation : ${service}`,
    date ? `Date : ${date} à ${time}` : '',
    staff ? `Avec : ${staff}` : '',
    n.kind === 'booking_confirmed' || n.kind === 'reminder_24h' ? `Montant : ${money(p.amount)}` : '',
    '',
    n.kind === 'review_request'
      ? link
        ? `Notez votre prestation : ${link}`
        : 'Vous pouvez noter votre prestation depuis votre lien de réservation.'
      : link
        ? `Suivre, modifier ou annuler : ${link}`
        : '',
    link
      ? 'Attention : ce lien est un secret d’accès. Toute personne qui le possède peut agir sur cette réservation ; ne le transférez pas.'
      : '',
    '',
    `— ${salon}`,
  ].filter((line) => line !== '');

  const text = lines.join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111">
  <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(title)}</h2>
  ${lines
    .slice(1)
    .map((line) => `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`)
    .join('\n')}
</div>`;

  return { subject: `${title} — ${salon}`, text, html, whatsapp: text };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function whatsappNumber(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, '');
  digits = digits.replace(/^00/, '');
  if (digits.length === 10 && digits.startsWith('0')) digits = WHATSAPP_COUNTRY_CODE + digits;
  return digits;
}

function formatResendError(status: number, rawBody: string): string {
  try {
    const parsed = JSON.parse(rawBody) as { name?: string; message?: string };
    const code = parsed.name ? ` (${parsed.name})` : '';
    const detail = parsed.message ?? rawBody;
    return `resend ${status}${code}: ${String(detail).slice(0, 260)}`;
  } catch {
    return `resend ${status}: ${rawBody.slice(0, 280)}`;
  }
}

function formatWhatsappError(status: number, rawBody: string): string {
  try {
    const parsed = JSON.parse(rawBody) as {
      error?: { code?: number; message?: string; error_subcode?: number };
    };
    const code = parsed?.error?.code;
    const msg = parsed?.error?.message ?? rawBody;
    let hint = '';
    if (code === 131047) hint = ' / template_required_24h';
    else if (code === 132000 || code === 132001 || code === 132012) hint = ' / template_not_approved';
    else if (code === 190) hint = ' / token_invalid_or_expired';
    return `whatsapp ${status}${code ? ` (code ${code}${hint})` : ''}: ${String(msg).slice(0, 240)}`;
  } catch {
    return `whatsapp ${status}: ${rawBody.slice(0, 280)}`;
  }
}

async function sendEmail(
  n: Notification,
): Promise<{ ok: boolean; id?: string; error?: string; skipped?: boolean }> {
  if (!RESEND_API_KEY || !EMAIL_FROM)
    return {
      ok: false,
      skipped: true,
      error: 'provider_not_configured: RESEND_API_KEY / NOTIFICATIONS_EMAIL_FROM',
    };
  const content = render(n);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [n.recipient],
      subject: content.subject,
      text: content.text,
      html: content.html,
      headers: { 'X-Entity-Ref-ID': n.id },
    }),
  });
  const body = await res.text();
  if (!res.ok) return { ok: false, error: formatResendError(res.status, body) };
  try {
    return { ok: true, id: str(JSON.parse(body).id) };
  } catch {
    return { ok: false, error: 'resend: réponse illisible' };
  }
}

async function sendWhatsapp(
  n: Notification,
): Promise<{ ok: boolean; id?: string; error?: string; skipped?: boolean }> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID)
    return {
      ok: false,
      skipped: true,
      error: 'provider_not_configured: WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID',
    };
  const p = n.payload ?? {};
  const { date, time } = abidjan(p.starts_at);
  const link = portalLink(p);
  const to = whatsappNumber(n.recipient);
  if (to.length < 8) return { ok: false, error: 'invalid_whatsapp_recipient' };

  // Hors d'une fenêtre de 24 h ouverte par le client, Meta n'accepte que des
  // modèles approuvés : WHATSAPP_TEMPLATE_PREFIX active ce mode.
  const payload = WHATSAPP_TEMPLATE_PREFIX
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: `${WHATSAPP_TEMPLATE_PREFIX}_${n.kind}`,
          language: { code: WHATSAPP_TEMPLATE_LANG },
          components: [
            {
              type: 'body',
              parameters: [
                str(p.client_name, 'Client'),
                str(p.salon_name, ''),
                str(p.service_name, ''),
                `${date} ${time}`.trim(),
                link,
              ].map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }
    : {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: false, body: render(n).whatsapp },
      };

  const res = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) return { ok: false, error: formatWhatsappError(res.status, body) };
  try {
    const parsed = JSON.parse(body);
    return { ok: true, id: str(parsed?.messages?.[0]?.id) };
  } catch {
    return { ok: false, error: 'whatsapp: réponse illisible' };
  }
}

async function auditWhatsappConfig() {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    return {
      checked: false,
      phoneVerified: false,
      templatesChecked: false,
      approvedTemplates: [] as Array<{ name: string; status: string; language: string }>,
      missingTemplates: WHATSAPP_TEMPLATE_PREFIX
        ? WHATSAPP_TEMPLATE_KINDS.map((k) => `${WHATSAPP_TEMPLATE_PREFIX}_${k}`)
        : [],
      error: 'WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID absent.',
    };
  }

  let phoneVerified = false;
  let verifiedName = '';
  let displayPhoneNumber = '';
  let qualityRating = '';
  let error: string | null = null;

  try {
    const phoneRes = await fetch(
      `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}?fields=verified_name,display_phone_number,quality_rating`,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
    );
    const phoneBody = await phoneRes.text();
    if (phoneRes.ok) {
      const parsed = JSON.parse(phoneBody) as {
        verified_name?: string;
        display_phone_number?: string;
        quality_rating?: string;
      };
      phoneVerified = true;
      verifiedName = str(parsed.verified_name);
      displayPhoneNumber = str(parsed.display_phone_number);
      qualityRating = str(parsed.quality_rating);
    } else {
      error = formatWhatsappError(phoneRes.status, phoneBody);
    }
  } catch (err) {
    error = `whatsapp_probe_exception: ${(err as Error).message}`.slice(0, 240);
  }

  let templatesChecked = false;
  const approvedTemplates: Array<{ name: string; status: string; language: string }> = [];
  const expectedNames = WHATSAPP_TEMPLATE_PREFIX
    ? WHATSAPP_TEMPLATE_KINDS.map((k) => `${WHATSAPP_TEMPLATE_PREFIX}_${k}`)
    : [];
  const foundNames = new Set<string>();

  if (WHATSAPP_WABA_ID) {
    try {
      const tplRes = await fetch(
        `https://graph.facebook.com/v20.0/${WHATSAPP_WABA_ID}/message_templates?fields=name,status,language,category&limit=100`,
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
      );
      const tplBody = await tplRes.text();
      if (tplRes.ok) {
        templatesChecked = true;
        const parsed = JSON.parse(tplBody) as {
          data?: Array<{ name?: string; status?: string; language?: string }>;
        };
        for (const tpl of parsed.data ?? []) {
          const name = str(tpl.name);
          const status = str(tpl.status);
          const language = str(tpl.language);
          if (!WHATSAPP_TEMPLATE_PREFIX || name.startsWith(WHATSAPP_TEMPLATE_PREFIX)) {
            approvedTemplates.push({ name, status, language });
            if (status.toUpperCase() === 'APPROVED') foundNames.add(name);
          }
        }
      } else if (!error) {
        error = formatWhatsappError(tplRes.status, tplBody);
      }
    } catch (err) {
      if (!error) error = `whatsapp_templates_exception: ${(err as Error).message}`.slice(0, 240);
    }
  }

  return {
    checked: true,
    phoneVerified,
    verifiedName,
    displayPhoneNumber,
    qualityRating,
    templatesChecked,
    approvedTemplates,
    missingTemplates: expectedNames.filter((name) => !foundNames.has(name)),
    error,
  };
}

// Appel PostgREST d'une RPC. `bearer` porte soit la clé service, soit le JWT
// de l'utilisateur : dans les deux cas PostgreSQL applique ses propres droits.
async function rpc<T>(
  fn: string,
  args: Record<string, unknown>,
  bearer: string,
): Promise<{ data?: T; error?: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: bearer === SERVICE_KEY ? SERVICE_KEY : ANON_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const raw = await res.text();
  if (!res.ok) return { error: `${fn} ${res.status}: ${raw.slice(0, 300)}` };
  try {
    return { data: (raw ? JSON.parse(raw) : null) as T };
  } catch {
    return { error: `${fn}: réponse illisible` };
  }
}

async function recordRun(params: {
  salonId: string | null;
  triggerSource: 'cron' | 'manual' | 'probe';
  capabilities: ReturnType<typeof getCapabilities>;
  processed?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  error?: string | null;
  details?: Record<string, unknown>;
}) {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  await rpc(
    'record_notification_dispatch_run',
    {
      p_salon_id: params.salonId,
      p_trigger_source: params.triggerSource,
      p_provider_configured: params.capabilities.email.configured || params.capabilities.whatsapp.configured,
      p_email_configured: params.capabilities.email.configured,
      p_whatsapp_configured: params.capabilities.whatsapp.configured,
      p_whatsapp_template_mode: params.capabilities.whatsapp.templateModeEnabled,
      p_processed: params.processed ?? 0,
      p_sent: params.sent ?? 0,
      p_failed: params.failed ?? 0,
      p_skipped: params.skipped ?? 0,
      p_error: params.error ?? null,
      p_details: params.details ?? {},
    },
    SERVICE_KEY,
  ).catch(() => null);
}

type AuthContext = {
  salonId: string | null;
  triggerSource: 'cron' | 'manual' | 'probe';
};

async function authorize(req: Request, body: Record<string, unknown>): Promise<AuthContext | Response> {
  const mode = str(body.mode);
  const scope = str(body.scope);
  const token = req.headers.get('x-dispatch-token') ?? '';
  if (DISPATCH_TOKEN && token === DISPATCH_TOKEN) {
    return { salonId: null, triggerSource: mode === 'health' ? 'probe' : 'cron' };
  }

  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.replace(/^Bearer\s+/i, '');
  if (!bearer) return json({ error: 'unauthorized' }, 401);
  if (SERVICE_KEY && bearer === SERVICE_KEY) {
    return { salonId: null, triggerSource: mode === 'health' ? 'probe' : 'cron' };
  }

  // Le JWT doit être un utilisateur réel, pas une clé anon quelconque.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${bearer}` },
  });
  if (!userRes.ok) return json({ error: 'unauthorized' }, 401);
  const user = await userRes.json().catch(() => null);
  if (!user?.id) return json({ error: 'unauthorized' }, 401);

  if (mode === 'health' && scope === 'platform') {
    const isAdmin = await rpc<boolean>('can_administer_notifications', {}, bearer);
    if (isAdmin.error) return json({ error: isAdmin.error }, 400);
    if (isAdmin.data !== true) return json({ error: 'forbidden' }, 403);
    return { salonId: null, triggerSource: 'probe' };
  }

  const salonId = str(body.salon_id);
  if (!salonId) return json({ error: 'salon_id required for user-triggered dispatch' }, 400);

  const allowed = await rpc<boolean>('can_manage_notifications', { p_salon_id: salonId }, bearer);
  if (allowed.error) return json({ error: allowed.error }, 400);
  if (allowed.data !== true) return json({ error: 'forbidden' }, 403);
  return { salonId, triggerSource: mode === 'health' ? 'probe' : 'manual' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const capabilities = getCapabilities();
  if (req.method === 'GET') {
    return json({
      service: 'notifications-dispatcher',
      ok: true,
      capabilities,
      checkedAt: new Date().toISOString(),
    });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'server_misconfigured' }, 500);

  let body: Record<string, unknown> = {};
  try {
    const raw = await req.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const auth = await authorize(req, body);
  if (auth instanceof Response) return auth;

  if (str(body.mode) === 'health') {
    const whatsappAudit = body.check_whatsapp_api === true ? await auditWhatsappConfig() : null;
    await recordRun({
      salonId: auth.salonId,
      triggerSource: 'probe',
      capabilities,
      details: {
        scope: str(body.scope, auth.salonId ? 'salon' : 'cron'),
        whatsappAudit,
      },
    });
    return json({
      service: 'notifications-dispatcher',
      ok: true,
      mode: 'health',
      provider_configured: capabilities.email.configured || capabilities.whatsapp.configured,
      capabilities,
      whatsappAudit,
      checkedAt: new Date().toISOString(),
    });
  }

  // Aucun fournisseur configuré : on ne réserve RIEN. La file reste intacte et
  // repartira toute seule dès qu'une clé sera posée, sans relance manuelle.
  const emailReady = capabilities.email.configured;
  const whatsappReady = capabilities.whatsapp.configured;
  if (!emailReady && !whatsappReady) {
    const message = 'Aucun fournisseur configuré : la file est conservée telle quelle.';
    await recordRun({
      salonId: auth.salonId,
      triggerSource: auth.triggerSource,
      capabilities,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      error: 'provider_not_configured',
    });
    return json({
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      provider_configured: false,
      trigger_source: auth.triggerSource,
      capabilities,
      message,
    });
  }

  const limit = Math.min(Math.max(Number(body.limit ?? 25) || 25, 1), 100);
  const claimed = await rpc<Notification[]>(
    'claim_due_notifications',
    {
      p_limit: limit,
      p_salon_id: auth.salonId,
    },
    SERVICE_KEY,
  );
  if (claimed.error) return json({ error: claimed.error }, 400);

  const rows = claimed.data ?? [];
  const results: Array<Record<string, unknown>> = [];
  let sent = 0,
    failed = 0,
    skipped = 0;

  for (const n of rows) {
    let outcome: { ok: boolean; id?: string; error?: string; skipped?: boolean };
    try {
      if (n.channel === 'email') outcome = await sendEmail(n);
      else if (n.channel === 'whatsapp') outcome = await sendWhatsapp(n);
      else outcome = { ok: false, skipped: true, error: 'channel_not_supported: sms' };
    } catch (err) {
      outcome = { ok: false, error: `exception: ${(err as Error).message}`.slice(0, 300) };
    }

    const status = outcome.ok ? 'sent' : outcome.skipped ? 'skipped' : 'failed';
    const marked = await rpc(
      'mark_notification_result',
      {
        p_id: n.id,
        p_status: status,
        p_provider_message_id: outcome.id ?? null,
        p_error: outcome.error ?? null,
      },
      SERVICE_KEY,
    );
    if (marked.error) {
      // Le message reste « sending » : le claim le reprendra après 10 minutes.
      results.push({
        id: n.id,
        channel: n.channel,
        kind: n.kind,
        status: 'mark_failed',
        error: marked.error,
      });
      failed++;
      continue;
    }
    if (status === 'sent') sent++;
    else if (status === 'skipped') skipped++;
    else failed++;
    results.push({ id: n.id, channel: n.channel, kind: n.kind, status, error: outcome.error ?? null });
  }

  await recordRun({
    salonId: auth.salonId,
    triggerSource: auth.triggerSource,
    capabilities,
    processed: rows.length,
    sent,
    failed,
    skipped,
    error: failed > 0 ? `${failed} notification(s) en échec` : null,
    details: { results: results.slice(0, 20) },
  });

  return json({
    processed: rows.length,
    sent,
    failed,
    skipped,
    provider_configured: true,
    trigger_source: auth.triggerSource,
    capabilities,
    results,
  });
});
