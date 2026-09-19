-- One missed-call text-back per call. The send path claims a
-- notifications row (type = missed_call_sms) before SMS goes out
-- so hangup + call.missed cannot double-text the same caller.

CREATE UNIQUE INDEX IF NOT EXISTS notifications_missed_call_sms_call_uniq
  ON notifications (call_id)
  WHERE type = 'missed_call_sms' AND call_id IS NOT NULL;
