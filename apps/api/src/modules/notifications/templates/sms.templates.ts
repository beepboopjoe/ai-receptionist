// ============================================================
// SMS message templates
// Variables: {{contactName}}, {{appointmentDate}}, etc.
// ============================================================

export type SmsTemplateType =
  | 'confirmation'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'missed_call'
  | 'staff_task'
  | 'cancellation';

type TemplateVars = Record<string, unknown>;

function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));
}

const templates: Record<SmsTemplateType, (vars: TemplateVars) => string> = {
  confirmation: (vars) => {
    if (vars['isCancellation']) {
      return interpolate(
        'Hi {{contactName}}, your appointment has been cancelled. ' +
          'Call us if you need to rebook.',
        vars
      );
    }
    if (vars['isReschedule']) {
      return interpolate(
        'Hi {{contactName}}, your appointment has been rescheduled to ' +
          '{{appointmentDate}} at {{appointmentTime}}. Reply CANCEL to cancel.',
        vars
      );
    }
    return interpolate(
      'Hi {{contactName}}, your {{appointmentType}} appointment is confirmed for ' +
        '{{appointmentDate}} at {{appointmentTime}}. Reply CANCEL to cancel.',
      vars
    );
  },

  reminder_24h: (vars) =>
    interpolate(
      'Reminder: {{contactName}}, you have an appointment tomorrow, ' +
        '{{appointmentDate}} at {{appointmentTime}}. Reply CANCEL to cancel.',
      vars
    ),

  reminder_2h: (vars) =>
    interpolate(
      'Reminder: {{contactName}}, your appointment is in 2 hours at {{appointmentTime}}. ' +
        'See you soon!',
      vars
    ),

  missed_call: (vars) =>
    interpolate(
      '⚠️ Missed call from {{contactName}} ({{contactPhone}}). ' +
        'Callback requested: {{callbackRequested}}. After-hours mode: {{afterHoursMode}}.',
      vars
    ),

  cancellation: (vars) =>
    interpolate(
      '❌ Cancellation: {{contactName}} ({{contactPhone}}) cancelled their appointment. ' +
        'Reason: {{cancellationReason}}. Wants to rebook: {{wantsToRebook}}.',
      vars
    ),

  staff_task: (vars) => {
    const taskType = vars['taskType'] as string;
    if (taskType === 'escalation') {
      const urgentTag = vars['isUrgent'] ? '🚨 URGENT' : '⚠️';
      return interpolate(
        `${urgentTag} Escalation: {{contactName}} ({{contactPhone}}) needs staff. ` +
          'Reason: {{reason}}. Call them back ASAP.',
        vars
      );
    }
    if (taskType === 'after_hours_emergency') {
      return interpolate(
        '🚨 AFTER-HOURS EMERGENCY: {{contactName}} ({{contactPhone}}) reported an emergency. ' +
          '{{message}}. Call back immediately.',
        vars
      );
    }
    if (taskType === 'cancellation') {
      return interpolate(
        '📋 Cancellation: {{contactName}} ({{contactPhone}}) cancelled. ' +
          'Reason: {{cancellationReason}}. Wants to rebook: {{wantsToRebook}}.',
        vars
      );
    }
    return interpolate('Staff task: {{taskType}} for {{contactName}} ({{contactPhone}}).', vars);
  },
};

export function renderSmsTemplate(type: SmsTemplateType, vars: TemplateVars): string {
  const tpl = templates[type];
  if (!tpl) {
    return `Notification for ${vars['contactName'] ?? 'contact'}.`;
  }
  return tpl(vars);
}
