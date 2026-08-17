export function buildNotification(event, subscription, mediaUrls = []) {
  const playable = mediaUrls.filter((media) => media.availability === 'playable');
  const direct = playable.filter((media) => media.accessRequirement === 'none').length;
  const headers = playable.filter((media) => media.accessRequirement === 'headers').length;
  if (event === 'new-media') return `《${subscription.title}》已发现媒体地址。\n有效媒体地址：${playable.length}\n可直接播放：${direct}\n需要请求头：${headers}\n最近验证：${playable.at(-1)?.lastValidatedAt || '未知'}`;
  if (event === 'bootstrap-complete') return `《${subscription.title}》首次补抓任务已完成。`;
  if (event === 'all-media-expired') return `《${subscription.title}》的已有媒体地址均不可用。`;
  if (event === 'temporary-failure') return `《${subscription.title}》本次检查暂时失败，将等待下一次任务。`;
  return `《${subscription.title}》任务状态：${event}。`;
}
