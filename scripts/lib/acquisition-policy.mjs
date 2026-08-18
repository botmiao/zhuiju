export const validationLevels = ['discovered', 'http-valid', 'manifest-valid', 'playlist-valid', 'segment-valid', 'decodable'];

export function isAcquirableMedia(media, minimumLevel = 'http-valid') {
  return media.availability === 'playable'
    && ['none', 'headers'].includes(media.accessRequirement)
    && media.lifetimeState !== 'expired'
    && validationLevels.indexOf(media.validationLevel) >= validationLevels.indexOf(minimumLevel);
}
