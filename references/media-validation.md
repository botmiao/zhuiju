# Media Validation

Validation is bounded and never downloads a complete video.

## HLS

Check status, reject HTML error pages, require `#EXTM3U`, parse Master or Media Playlist, resolve relative addresses, and sample configured segments.

## MP4 and WebM

Use HEAD or a bounded Range request. Check content type and a small file header. MP4 uses `ftyp`; WebM uses the EBML signature.

## DASH

Parse MPD XML, inspect Representation and BaseURL data, and validate only bounded manifest or initialization-segment evidence.

## Access requirement

Test discovery context first, then remove Cookie, Referer, and Origin, and finally use a normal User-Agent. Record `none`, `headers`, `session`, or `unknown`; never persist credential values.
