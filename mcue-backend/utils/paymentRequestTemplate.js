const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

const formatAmount = (amount, currency) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2
}).format(amount);

module.exports = (payment) => {
  const amount = formatAmount(payment.amount, payment.currency);
  const dueDate = payment.dueDate
    ? new Date(payment.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Please contact the studio if you need a due date.';
  const paymentLink = payment.paymentUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(payment.paymentUrl)}" style="display:inline-block;padding:13px 20px;border-radius:6px;background:#e8bd4b;color:#161616;text-decoration:none;font-weight:700">Pay securely</a></p>`
    : '';
  const instructions = payment.paymentInstructions
    ? `<p style="white-space:pre-line;color:#424242">${escapeHtml(payment.paymentInstructions)}</p>`
    : '';

  return `
    <div style="max-width:600px;margin:0 auto;padding:32px 24px;font-family:Arial,sans-serif;color:#202020;line-height:1.6">
      <p style="margin:0;color:#92701c;font-size:12px;font-weight:700;letter-spacing:1.5px">MCUE STUDIO</p>
      <h1 style="margin:12px 0 8px;font-size:25px">Your shoot is complete</h1>
      <p>Hello ${escapeHtml(payment.clientName)},</p>
      <p>Thank you for choosing MCue Studio. Here is the payment request for your completed shoot.</p>
      <div style="margin:22px 0;padding:18px;border:1px solid #e4e0d6;border-radius:8px;background:#faf9f6">
        <p style="margin:0 0 8px"><strong>Session:</strong> ${escapeHtml(payment.shootTitle)}</p>
        <p style="margin:0 0 8px"><strong>Amount due:</strong> ${escapeHtml(amount)}</p>
        <p style="margin:0"><strong>Due date:</strong> ${escapeHtml(dueDate)}</p>
      </div>
      ${paymentLink}
      ${instructions}
      ${!paymentLink && !instructions ? '<p>Please reply to this email or contact the studio for payment instructions.</p>' : ''}
      <p style="margin-top:28px;color:#777;font-size:12px">MCue Studio · Payment request</p>
    </div>`;
};
