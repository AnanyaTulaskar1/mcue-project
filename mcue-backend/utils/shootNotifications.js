const Client = require('../models/Client');
const EmailLog = require('../models/EmailLog');
const sendEmail = require('./sendEmail');
const templates = require('./shootNotificationTemplates');

const notifications = {
  request: {
    subject: (shoot) => `We received your shoot request - ${shoot.title} | MCue Studio`,
    template: templates.requestReceived,
    logType: 'Confirmation'
  },
  confirmation: {
    subject: (shoot) => `Shoot confirmed: ${shoot.title} | MCue Studio`,
    template: templates.confirmation,
    logType: 'Confirmation'
  },
  update: {
    subject: (shoot) => `Shoot details updated: ${shoot.title} | MCue Studio`,
    template: templates.updated,
    logType: 'General'
  },
  status: {
    subject: (shoot) => `Shoot status updated: ${shoot.title} | MCue Studio`,
    template: templates.statusUpdate,
    logType: 'General'
  },
  cancellation: {
    subject: (shoot) => `Shoot cancelled: ${shoot.title} | MCue Studio`,
    template: templates.cancelled,
    logType: 'General'
  }
};

const sendShootNotification = async (shoot, notificationType, changedFields = []) => {
  const notification = notifications[notificationType];
  if (!notification) return { sent: false, error: 'Unknown shoot email type.' };

  const client = shoot.clientId?.email
    ? shoot.clientId
    : await Client.findById(shoot.clientId?._id || shoot.clientId).select('name email');
  const recipient = client?.email;
  if (!recipient) return { sent: false, error: 'Add an email address to this client before sending shoot updates.' };

  const shootDetails = {
    title: shoot.title,
    date: shoot.date,
    time: shoot.time,
    location: shoot.location,
    description: shoot.description,
    status: shoot.status,
    clientName: client.name
  };
  const subject = notification.subject(shootDetails);
  let status = 'Sent';
  let errorMessage = '';

  try {
    await sendEmail({
      to: recipient,
      subject,
      html: notificationType === 'update'
        ? notification.template(shootDetails, changedFields)
        : notification.template(shootDetails)
    });
  } catch (error) {
    status = 'Failed';
    errorMessage = String(error.message || 'Email delivery failed').slice(0, 500);
  }

  try {
    await EmailLog.create({
      clientId: client._id,
      recipient,
      subject,
      type: notification.logType,
      status,
      error: errorMessage || undefined
    });
  } catch (logError) {
    console.error('SHOOT EMAIL LOG ERROR:', logError.message);
  }

  if (status === 'Failed') console.error(`SHOOT EMAIL FAILED (${shoot._id}):`, errorMessage);
  return { sent: status === 'Sent', error: errorMessage || undefined };
};

module.exports = sendShootNotification;
