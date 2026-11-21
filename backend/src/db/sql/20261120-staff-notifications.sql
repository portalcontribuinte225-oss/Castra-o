-- Apply explicitly before deploying the staff notification endpoints and event producers.
BEGIN;

CREATE TABLE staff_notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    (event_type = 'request_created' AND recipient_user_id IS NULL)
    OR (event_type = 'request_assigned' AND recipient_user_id IS NOT NULL)
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX staff_notifications_created_request_idx
  ON staff_notifications (request_id) WHERE recipient_user_id IS NULL;
CREATE INDEX staff_notifications_request_idx ON staff_notifications (request_id);
CREATE INDEX staff_notifications_municipality_idx ON staff_notifications (municipality_id, id DESC);
CREATE INDEX staff_notifications_recipient_idx
  ON staff_notifications (recipient_user_id, id DESC) WHERE recipient_user_id IS NOT NULL;

CREATE TABLE staff_notification_reads (
  notification_id BIGINT NOT NULL REFERENCES staff_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);
CREATE INDEX staff_notification_reads_user_idx ON staff_notification_reads (user_id, notification_id);

COMMIT;
