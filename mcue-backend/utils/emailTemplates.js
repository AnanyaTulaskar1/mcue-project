exports.otpTemplate = (otpCode) => `
  <div style="background-color: #111; color: #fff; padding: 30px; font-family: Arial, sans-serif; border-radius: 8px; border: 1px solid #FFD700; max-width: 500px; margin: 0 auto;">
    <h2 style="color: #FFD700; margin-top: 0; text-align: center;">MCue Studio Verification</h2>
    <p style="color: #CCC;">Your one-time security code is:</p>
    <div style="background-color: #222; color: #FFD700; font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 6px; padding: 15px; border-radius: 6px; margin: 20px 0;">
      ${otpCode}
    </div>
    <p style="color: #888; font-size: 12px; text-align: center;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
  </div>
`;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

exports.bookingConfirmationTemplate = (clientName, shootTitle, shootDate, shootTime, shootLocation, studioMessage) => `
  <div style="background-color: #111; color: #fff; padding: 30px; font-family: Arial, sans-serif; border-radius: 8px; border: 1px solid #FFD700; max-width: 500px; margin: 0 auto;">
    <h2 style="color: #FFD700; margin-top: 0;">Booking Confirmed!</h2>
    <p>Hi <strong>${escapeHtml(clientName)}</strong>,</p>
    <p>Your shoot session has been successfully booked with MCue Studio.</p>
    <div style="background-color: #222; padding: 15px; border-radius: 6px; border-left: 4px solid #FFD700; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Session:</strong> ${escapeHtml(shootTitle)}</p>
      <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(shootDate).toLocaleDateString()}</p>
      <p style="margin: 5px 0;"><strong>Time:</strong> ${escapeHtml(shootTime)}</p>
      ${shootLocation ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${escapeHtml(shootLocation)}</p>` : ''}
    </div>
    ${studioMessage ? `<div style="background-color: #222; padding: 15px; border-radius: 6px; border-left: 4px solid #FFD700; margin: 20px 0;"><strong style="color: #FFD700;">A note from the studio</strong><p style="margin-bottom: 0;">${escapeHtml(studioMessage).replace(/\n/g, '<br>')}</p></div>` : ''}
    <p style="color: #CCC;">You can log into your Client Portal anytime to check status and gallery updates.</p>
  </div>
`;

exports.bookingAcknowledgementTemplate = (clientName, shootTitle, studioMessage) => `
  <div style="background-color: #111; color: #fff; padding: 30px; font-family: Arial, sans-serif; border-radius: 8px; border: 1px solid #FFD700; max-width: 500px; margin: 0 auto;">
    <h2 style="color: #FFD700; margin-top: 0;">Your request has been received</h2>
    <p>Hi <strong>${escapeHtml(clientName)}</strong>,</p>
    <p>The MCue Studio team has received your request for <strong>${escapeHtml(shootTitle)}</strong>. We’ll review the details and email you again when your shoot date and time are confirmed.</p>
    ${studioMessage ? `<div style="background-color: #222; padding: 15px; border-radius: 6px; border-left: 4px solid #FFD700; margin: 20px 0;"><strong style="color: #FFD700;">A note from the studio</strong><p style="margin-bottom: 0;">${escapeHtml(studioMessage).replace(/\n/g, '<br>')}</p></div>` : ''}
    <p style="color: #CCC;">You can check your Client Portal for the latest request status and studio updates.</p>
  </div>
`;

exports.adminBookingRequestTemplate = (client, shoot) => `
  <div style="background-color: #111; color: #fff; padding: 30px; font-family: Arial, sans-serif; border-radius: 8px; border: 1px solid #FFD700; max-width: 560px; margin: 0 auto;">
    <h2 style="color: #FFD700; margin-top: 0;">New shoot request</h2>
    <p>A client has requested a shoot. Review the request in the MCue Studio admin workspace.</p>
    <div style="background-color: #222; padding: 15px; border-radius: 6px; border-left: 4px solid #FFD700; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Client:</strong> ${escapeHtml(client.name)}</p>
      <p style="margin: 5px 0;"><strong>Email:</strong> ${escapeHtml(client.email)}</p>
      <p style="margin: 5px 0;"><strong>Shoot:</strong> ${escapeHtml(shoot.title)}</p>
      <p style="margin: 5px 0;"><strong>Preferred date:</strong> ${shoot.preferredDate ? escapeHtml(new Date(shoot.preferredDate).toLocaleDateString()) : 'Not selected'}</p>
      <p style="margin: 5px 0;"><strong>Preferred time:</strong> ${shoot.preferredTime ? escapeHtml(shoot.preferredTime) : 'Flexible'}</p>
      <p style="margin: 5px 0;"><strong>Location:</strong> ${shoot.location ? escapeHtml(shoot.location) : 'Not provided'}</p>
      <p style="margin: 12px 0 5px;"><strong>Client's description:</strong></p>
      <p style="margin: 5px 0;">${escapeHtml(shoot.description).replace(/\n/g, '<br>')}</p>
    </div>
    <p style="color: #CCC;">Acknowledge the request to let the client know it has been received. Add a confirmed date and time to send the booking confirmation email.</p>
  </div>
`;

exports.galleryReadyTemplate = (clientName, galleryLink) => `
  <div style="background-color: #111; color: #fff; padding: 30px; font-family: Arial, sans-serif; border-radius: 8px; border: 1px solid #FFD700; max-width: 500px; margin: 0 auto;">
    <h2 style="color: #FFD700; margin-top: 0;">Your Gallery is Ready! 📸</h2>
    <p>Hi <strong>${clientName}</strong>,</p>
    <p>Great news! Your shoot gallery has been published and is ready for viewing.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${galleryLink}" target="_blank" style="background-color: #FFD700; color: #000; padding: 12px 25px; font-weight: bold; text-decoration: none; border-radius: 5px;">
        View Photo Gallery
      </a>
    </div>
  </div>
`;
