import { Resend } from 'resend'
import nodemailer from 'nodemailer'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const smtpTransport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null

const FROM = process.env.EMAIL_FROM ?? 'Indexr <noreply@indexr.io>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://indexr.io'

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<boolean> {
  try {
    if (resend) {
      await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html })
      return true
    }

    if (smtpTransport) {
      await smtpTransport.sendMail({
        from: FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      })
      return true
    }

    console.log('[Email skipped — no provider configured]', opts.subject, '->', opts.to)
    return false
  } catch (err) {
    console.error('Email send error:', err)
    return false
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Welcome to Indexr — your link indexing engine 🚀',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="background:#0a0a0a;color:#e5e5e5;font-family:monospace;padding:40px;max-width:600px;margin:0 auto">
        <div style="border:1px solid #22c55e;padding:32px;border-radius:8px">
          <h1 style="color:#22c55e;font-size:24px;margin-bottom:16px">Welcome to Indexr</h1>
          <p>Hey ${name || 'there'},</p>
          <p>Your account is live. Start submitting URLs to get Googlebot knocking on your pages within hours.</p>
          <div style="background:#111;padding:16px;border-radius:4px;margin:24px 0;border-left:3px solid #22c55e">
            <p style="margin:0;font-size:12px;color:#888">QUICK START</p>
            <p style="margin:8px 0 0;font-size:14px">1. Go to your dashboard<br>2. Paste your URLs (bulk supported)<br>3. Submit and track status</p>
          </div>
          <a href="${APP_URL}/dashboard" style="background:#22c55e;color:#000;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;font-weight:bold">Open Dashboard →</a>
          <p style="margin-top:32px;font-size:12px;color:#666">Indexr — Get your links indexed fast.</p>
        </div>
      </body>
      </html>
    `,
  })
}

export async function sendIndexingReport(
  email: string,
  stats: { indexed: number; pending: number; failed: number }
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Indexr Weekly Report — ${stats.indexed} URLs indexed`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="background:#0a0a0a;color:#e5e5e5;font-family:monospace;padding:40px;max-width:600px;margin:0 auto">
        <div style="border:1px solid #22c55e;padding:32px;border-radius:8px">
          <h2 style="color:#22c55e">Weekly Indexing Report</h2>
          <div style="display:grid;gap:12px;margin:24px 0">
            <div style="background:#111;padding:16px;border-radius:4px;border-left:3px solid #22c55e">
              <span style="color:#888;font-size:12px">INDEXED</span>
              <div style="font-size:32px;font-weight:bold;color:#22c55e">${stats.indexed}</div>
            </div>
            <div style="background:#111;padding:16px;border-radius:4px;border-left:3px solid #facc15">
              <span style="color:#888;font-size:12px">PENDING</span>
              <div style="font-size:32px;font-weight:bold;color:#facc15">${stats.pending}</div>
            </div>
            <div style="background:#111;padding:16px;border-radius:4px;border-left:3px solid #ef4444">
              <span style="color:#888;font-size:12px">FAILED</span>
              <div style="font-size:32px;font-weight:bold;color:#ef4444">${stats.failed}</div>
            </div>
          </div>
          <a href="${APP_URL}/dashboard" style="background:#22c55e;color:#000;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;font-weight:bold">View Dashboard →</a>
        </div>
      </body>
      </html>
    `,
  })
}
