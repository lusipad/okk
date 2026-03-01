import type { WsConnectionState } from '../../io/types';

interface ConnectionBannerProps {
  state: WsConnectionState;
}

export function ConnectionBanner({ state }: ConnectionBannerProps) {
  if (state === 'connected') {
    return null;
  }

  const text =
    state === 'connecting'
      ? '正在建立连接...'
      : state === 'reconnecting'
        ? '连接断开，正在重连并从 last_event_id 恢复...'
        : '连接已断开，请检查网络或稍后重试';

  const tone = state === 'disconnected' ? 'danger' : state === 'reconnecting' ? 'warning' : 'info';

  return (
    <div className={`connection-banner connection-${tone}`} role='status' aria-live='polite'>
      {text}
    </div>
  );
}
