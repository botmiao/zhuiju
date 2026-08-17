export function ok(data = {}, warnings = []) {
  return {
    ok: true,
    code: 'OK',
    message: null,
    retryable: false,
    data,
    warnings
  };
}

export function fail(code, message, retryable = false, data = {}, warnings = []) {
  return {
    ok: false,
    code,
    message,
    retryable,
    data,
    warnings
  };
}
