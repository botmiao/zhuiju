# Media Validation

Validation is bounded and never downloads a complete video.

## HLS

Check status, reject HTML error pages, require `#EXTM3U`, parse Master or Media Playlist, and resolve relative addresses.

When the host has `ffprobe` on PATH (and `useFfprobe` is not disabled), run `ffprobe -v error -rw_timeout 15000000 <url>` with a 30-second hard timeout instead of segment sampling. Exit code 0 with empty stderr marks the media `decodable`; any error output or non-zero exit rejects the candidate. Only a missing binary falls back to sampling the first `segmentSampleCount` segments with bounded Range requests.

Before invoking ffprobe, the manifest URL and every resolved variant/segment hostname pass the same URL policy and DNS resolution checks as normal fetches (redirects and subrequests inside ffprobe itself are not interceptable; ffprobe validation is refused when a manifest resolves to more than 32 distinct hosts).

## MP4 and WebM

Use HEAD or a bounded Range request. Check content type and a small file header. MP4 uses `ftyp`; WebM uses the EBML signature.

## DASH

Parse MPD XML, inspect Representation and BaseURL data, and validate only bounded manifest or initialization-segment evidence.

## Access requirement

Test discovery context first, then remove Cookie, Referer, and Origin, and finally use a normal User-Agent. Record `none`, `headers`, `session`, or `unknown`; never persist credential values.
