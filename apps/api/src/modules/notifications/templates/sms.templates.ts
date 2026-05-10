// ============================================================
// SMS message templates
// Variables: {{patientName}}, {{appointmentDate}}, etc.
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
        'Hi {{patientName}}, your appointment has been cancelled. ' +
          'Call us if you need to rebook.',
        vars
      );
    }
    if (vars['isReschedule']) {
      return interpolate(
        'Hi {{patientName}}, your appointment has been rescheduled to ' +
          '{{appointmentDate}} at {{appointmentTime}}. Reply CANCEL to cancel.',
        vars
      );
    }
    return interpolate(
      'Hi {{patientName}}, your {{appointmentType}} appointment is confirmed for ' +
        '{{appointmentDate}} at {{appointmentTime}}. Reply CANCEL to cancel.',
      vars
    );
  },

  reminder_24h: (vars) =>
    interpolate(
      'Reminder: {{patientName}}, you have an appointment tomorrow, ' +
        '{{appointmentDate}} at {{appointmentTime}}. Reply CANCEL to cancel.',
      vars
    ),

  reminder_2h: (vars) =>
    interpolate(
      'Reminder: {{patientName}}, your appointment is in 2 hours at {{appointmentTime}}. ' +
        'See you soon!',
      vars
    ),

  missed_call: (vars) =>
    interpolate(
      '⚠️ Missed call from {{patientName}} ({{patientPhone}}). ' +
        'Callback requested: {{callbackRequested}}. After-hours mode: {{afterHoursMode}}.',
      vars
    ),

  cancellation: (vars) =>
    interpolate(
      '❌ Cancellation: {{patientName}} ({{patientPhone}}) cancelled their appointment. ' +
        'Reason: {{cancellationReason}}. Wants to rebook: {{wantsToRebook}}.',
      vars
    ),

  staff_task: (vars) => {
    const taskType = vars['taskType'] as string;
    if (taskType === 'escalation') {
      const urgentTag = vars['isUrgent'] ? '🚨 URGENT' : '⚠️';
      return interpolate(
        `${urgentTag} Escalation: {{patientName}} ({{patientPhone}}) needs staff. ` +
          'Reason: {{reason}}. Call them back ASAP.',
        vars
      );
    }
    if (taskType === 'after_hours_emergency') {
      return interpolate(
        '🚨 AFTER-HOURS EMERGENCY: {{patientName}} ({{patientPhone}}) reported an emergency. ' +
          '{{message}}. Call back immediately.',
        vars
      );
    }
    if (taskType === 'cancellation') {
      return interpolate(
        '📋 Cancellation: {{patientName}} ({{patientPhone}}) cancelled. ' +
          'Reason: {{cancellationReason}}. Wants to rebook: {{wantsToRebook}}.',
        vars
      );
    }
    return interpolate('Staff task: {{taskType}} for {{patientName}} ({{patientPhone}}).', vars);
  },
};

export function renderSmsTemplate(type: SmsTemplateType, vars: TemplateVars): string {
  const tpl = templates[type];
  if (!tpl) {
    return `Notification for ${vars['patientName'] ?? 'patient'}.`;
  }
  return tpl(vars);
}
