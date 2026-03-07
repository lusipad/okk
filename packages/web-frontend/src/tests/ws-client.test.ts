import { normalizeIncomingEvent } from '../io/ws-client';

describe('normalizeIncomingEvent', () => {
  it('能映射 resume_ack 为 session_resumed', () => {
    const event = normalizeIncomingEvent(
      {
        type: 'qa.resume_ack',
        sessionId: 'session-a',
        event_id: 3,
        timestamp: '2026-03-07T00:00:00.000Z',
        payload: {
          replay_count: 2,
          last_event_id: 1
        }
      },
      'session-a'
    );

    expect(event).toMatchObject({
      type: 'session_resumed',
      payload: {
        replayCount: 2,
        lastEventId: 1
      }
    });
  });

  it('能映射 resume_failed 为结构化恢复失败事件', () => {
    const event = normalizeIncomingEvent(
      {
        type: 'qa.resume_failed',
        sessionId: 'session-a',
        event_id: 4,
        timestamp: '2026-03-07T00:00:00.000Z',
        payload: {
          last_event_id: 5,
          latest_event_id: 7
        }
      },
      'session-a'
    );

    expect(event).toMatchObject({
      type: 'session_resume_failed',
      payload: {
        lastEventId: 5,
        latestEventId: 7
      }
    });
  });
});
