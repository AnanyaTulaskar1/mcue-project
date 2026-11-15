const cron = require('node-cron');
const Payment = require('../models/Payment');
const EmailLog = require('../models/EmailLog');
const sendEmail = require('./sendEmail');
const paymentReminderTemplate = require('./paymentReminderTemplate');

const REMINDER_WINDOW_DAYS = 3;
const STALE_CLAIM_MINUTES = 15;

const utcDateKey = (date) => new Date(date).toISOString().slice(0, 10);

const sendDuePaymentReminders = async () => {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const firstDayAfterWindow = new Date(startOfToday);
  firstDayAfterWindow.setUTCDate(firstDayAfterWindow.getUTCDate() + REMINDER_WINDOW_DAYS + 1);
  const staleClaimBefore = new Date(now.getTime() - STALE_CLAIM_MINUTES * 60 * 1000);

  const payments = await Payment.find({
    status: { $ne: 'Paid' },
    dueDate: { $gte: startOfToday, $lt: firstDayAfterWindow }
  })
    .populate('clientId', 'name email')
    .populate('shootId', 'title')
    .sort({ dueDate: 1 });

  let sent = 0;
  let failed = 0;

  for (const payment of payments) {
    const dueDateKey = utcDateKey(payment.dueDate);
    const claimedPayment = await Payment.findOneAndUpdate({
      _id: payment._id,
      status: { $ne: 'Paid' },
      dueDate: payment.dueDate,
      reminderSentForDueDate: { $ne: dueDateKey },
      $or: [
        { reminderClaimedForDueDate: { $ne: dueDateKey } },
        { reminderClaimedAt: { $lt: staleClaimBefore } }
      ]
    }, {
      $set: {
        reminderClaimedForDueDate: dueDateKey,
        reminderClaimedAt: now
      }
    }, { new: true });

    if (!claimedPayment) continue;

    const client = payment.clientId;
    const recipient = client?.email || payment.clientEmail;
    const subject = `Payment due soon for ${payment.shootTitle || payment.shootId?.title || 'your shoot'} - MCue Studio`;
    let status = 'Sent';
    let emailError = '';

    try {
      if (!recipient) throw new Error('The client has no email address. Add one to send the payment reminder.');
      await sendEmail({
        to: recipient,
        subject,
        html: paymentReminderTemplate({
          ...payment.toObject(),
          clientName: client?.name || payment.clientName,
          shootTitle: payment.shootTitle || payment.shootId?.title || 'Photography session'
        })
      });
    } catch (error) {
      status = 'Failed';
      emailError = String(error.message || 'Email delivery failed').slice(0, 500);
    }

    if (payment.clientId?._id || payment.clientId) {
      try {
        await EmailLog.create({
          clientId: payment.clientId._id || payment.clientId,
          paymentId: payment._id,
          recipient: recipient || payment.clientEmail || 'Unknown recipient',
          subject,
          type: 'Reminder',
          status,
          error: emailError || undefined
        });
      } catch (logError) {
        console.error('AUTOMATIC PAYMENT REMINDER LOG ERROR:', logError.message);
      }
    }

    const finalizeUpdate = status === 'Sent'
      ? {
        $set: { reminderSentForDueDate: dueDateKey, reminderSentAt: new Date() },
        $unset: { reminderClaimedForDueDate: 1, reminderClaimedAt: 1, reminderLastError: 1 }
      }
      : {
        $set: { reminderLastError: emailError },
        $unset: { reminderClaimedForDueDate: 1, reminderClaimedAt: 1 }
      };

    try {
      await Payment.updateOne({ _id: payment._id, reminderClaimedForDueDate: dueDateKey }, finalizeUpdate);
    } catch (error) {
      console.error(`PAYMENT REMINDER STATE UPDATE ERROR (${payment._id}):`, error.message);
    }

    if (status === 'Sent') sent += 1;
    else {
      failed += 1;
      console.error(`PAYMENT REMINDER FAILED (${payment._id}):`, emailError);
    }
  }

  console.log(`Automatic payment reminders finished: ${sent} sent, ${failed} failed.`);
  return { sent, failed };
};

const schedulePaymentReminders = () => {
  const schedule = process.env.PAYMENT_REMINDER_TIME || '09:00';
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(schedule);
  const timezone = process.env.PAYMENT_REMINDER_TIMEZONE || 'Asia/Kolkata';

  if (!match) {
    console.error(`Invalid PAYMENT_REMINDER_TIME "${schedule}". Expected HH:MM in 24-hour format; using 09:00.`);
  }

  let timezoneValid = true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    timezoneValid = false;
    console.error(`Invalid PAYMENT_REMINDER_TIMEZONE "${timezone}". Using Asia/Kolkata.`);
  }

  const [hour, minute] = match ? [match[1], match[2]] : ['09', '00'];
  const cronTimezone = timezoneValid ? timezone : 'Asia/Kolkata';
  cron.schedule(`${Number(minute)} ${Number(hour)} * * *`, () => {
    sendDuePaymentReminders().catch((error) => console.error('AUTOMATIC PAYMENT REMINDER JOB ERROR:', error));
  }, { timezone: cronTimezone, noOverlap: true });

  console.log(`Automatic payment reminders scheduled for ${hour}:${minute} ${cronTimezone} (due within ${REMINDER_WINDOW_DAYS} days).`);
  sendDuePaymentReminders().catch((error) => console.error('INITIAL PAYMENT REMINDER JOB ERROR:', error));
};

module.exports = { sendDuePaymentReminders, schedulePaymentReminders };
