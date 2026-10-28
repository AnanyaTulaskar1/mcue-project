const nodemailer = require('nodemailer');

// 1. Create reusable transporter
const emailPort = Number(process.env.EMAIL_PORT || 587);
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: emailPort,
  secure: emailPort === 465,
  auth: process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    : undefined
});

// 2. Transporter Verification
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.log('Studio email is not configured; outgoing emails will be saved as failed until SMTP is set up.');
} else transporter.verify((error) => {
  if (error) {
    console.error('⚠️ Email Transporter Connection Error:', error.message);
  } else {
    console.log('✉️ Live Email Transporter Ready');
  }
});

// 3. Main Email Sending Function
const sendEmail = async ({ to, subject, html }) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('Email delivery is not configured. Set EMAIL_USER and EMAIL_PASS.');
    }
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to} (Message ID: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error.message);
    throw new Error('Email delivery failed');
  }
};

module.exports = sendEmail;
