export function ok<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function fail(code: string, message: string, status = 400) {
  return Response.json({ success: false, error: { code, message } }, { status });
}
