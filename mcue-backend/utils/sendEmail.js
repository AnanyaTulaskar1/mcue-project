const nodemailer = require('nodemailer');
const { Resend } = require('resend');

const resendApiKey = process.env.RESEND_API_KEY?.trim();
const emailFrom = process.env.EMAIL_FROM?.trim();
const smtpConfigured = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
const emailPort = Number(process.env.EMAIL_PORT || 587);
const transporter = smtpConfigured
  ? nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: emailPort,
    secure: emailPort === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  })
  : null;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

if (resend) {
  console.log('Studio email is configured with the Resend API.');
} else if (transporter) {
  transporter.verify((error) => {
    if (error) {
      console.error('Email SMTP connection error:', error.message);
    } else {
      console.log('Studio SMTP email transport is ready.');
    }
  });
} else {
  console.log('Studio email is not configured. Set RESEND_API_KEY and EMAIL_FROM, or SMTP credentials.');
}

const sendEmail = async ({ to, subject, html }) => {
  if (resend) {
    if (!emailFrom) {
      throw new Error('Resend is configured, but EMAIL_FROM is missing. Set it to an address on a verified Resend domain.');
    }
    try {
      const { data, error } = await resend.emails.send({
        from: emailFrom,
        to,
        subject,
        html
      });
      if (error) throw new Error(error.message || 'Resend rejected the email.');
      console.log(`Email sent successfully to ${to} with Resend (Email ID: ${data?.id || 'accepted'}).`);
      return data;
    } catch (error) {
      const message = error.message || 'Unknown Resend API error.';
      console.error(`Failed to send email to ${to} with Resend:`, message);
      throw new Error(`Resend: ${message}`);
    }
  }

  if (!transporter) {
    throw new Error('Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM (recommended on Render), or EMAIL_USER and EMAIL_PASS for SMTP.');
  }

  try {
    const info = await transporter.sendMail({
      from: emailFrom || process.env.EMAIL_USER,
      to,
      subject,
      html
    });
    console.log(`Email sent successfully to ${to} (Message ID: ${info.messageId}).`);
    return info;
  } catch (error) {
    let message = error.message || 'Unknown SMTP error.';
    if ((process.env.RENDER || process.env.RENDER_SERVICE_ID) && ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET'].includes(error.code)) {
      message += ' If this is a Render Free web service, outbound SMTP is blocked; configure RESEND_API_KEY and EMAIL_FROM to send through the Resend API.';
    }
    console.error(`Failed to send email to ${to} with SMTP:`, message);
    throw new Error(`SMTP: ${message}`);
  }
};

sendEmail.isConfigured = () => Boolean(resend || transporter);

module.exports = sendEmail;
