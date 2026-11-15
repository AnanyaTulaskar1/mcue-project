const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

const formatDate = (value) => value
  ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  : 'To be confirmed';

const details = (shoot) => `
  <div style="margin:22px 0;padding:18px;border:1px solid #e4e0d6;border-radius:8px;background:#faf9f6">
    <p style="margin:0 0 8px"><strong>Session:</strong> ${escapeHtml(shoot.title)}</p>
    <p style="margin:0 0 8px"><strong>Date:</strong> ${escapeHtml(formatDate(shoot.date))}</p>
    <p style="margin:0 0 8px"><strong>Time:</strong> ${escapeHtml(shoot.time || 'To be confirmed')}</p>
    <p style="margin:0"><strong>Location:</strong> ${escapeHtml(shoot.location || 'To be confirmed')}</p>
  </div>
  ${shoot.description ? `<p style="white-space:pre-line;color:#424242">${escapeHtml(shoot.description)}</p>` : ''}`;

const email = (heading, body, shoot, ending = 'Please reply to this email if you have any questions.') => `
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;font-family:Arial,sans-serif;color:#202020;line-height:1.6">
    <p style="margin:0;color:#92701c;font-size:12px;font-weight:700;letter-spacing:1.5px">MCUE STUDIO</p>
    <h1 style="margin:12px 0 8px;font-size:25px">${heading}</h1>
    <p>Hello ${escapeHtml(shoot.clientName || 'there')},</p>
    <p>${body}</p>
    ${details(shoot)}
    <p>${ending}</p>
    <p style="margin-top:28px;color:#777;font-size:12px">MCue Studio</p>
  </div>`;

exports.requestReceived = (shoot) => email(
  'We received your shoot request',
  'The studio has received your shoot request. We will contact you once the date and time are confirmed.',
  shoot
);

exports.confirmation = (shoot) => email(
  'Your shoot is confirmed',
  'Your shoot has been scheduled with MCue Studio. Here are the confirmed details:',
  shoot,
  'Please let us know if you have any questions about the booking.'
);

exports.updated = (shoot, changedFields = []) => {
  const changeSummary = changedFields.length
    ? ` The studio updated: ${changedFields.map(escapeHtml).join(', ')}.`
    : '';
  return email(
    'Your shoot details have changed',
    `The latest details for your MCue Studio booking are below.${changeSummary}`,
    shoot
  );
};

exports.statusUpdate = (shoot) => email(
  'Your shoot status was updated',
  `The status of your shoot is now ${escapeHtml(shoot.status)}. Here are the latest details:`,
  shoot
);

exports.cancelled = (shoot) => email(
  'Your shoot has been cancelled',
  'We are sorry, but your shoot booking has been cancelled. Please contact the studio if you would like to discuss rescheduling.',
  shoot,
  'You can reply to this email to contact MCue Studio.'
);
