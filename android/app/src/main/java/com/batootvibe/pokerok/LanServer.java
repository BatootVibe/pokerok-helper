package com.batootvibe.pokerok;
import fi.iki.elonen.NanoHTTPD;
import org.json.JSONObject;
import java.util.HashMap;
public final class LanServer extends NanoHTTPD {
  private final LanRoom room;
  private final String page;
  public LanServer(int port, LanRoom room, String page) { super("0.0.0.0", port); this.room = room; this.page = page; }
  private Response response(Response.Status status, String mime, String body) {
    Response result = newFixedLengthResponse(status, mime, body);
    result.addHeader("Cache-Control", "no-store"); result.addHeader("X-Content-Type-Options", "nosniff"); result.addHeader("X-Frame-Options", "DENY"); result.addHeader("Referrer-Policy", "no-referrer");
    result.addHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    return result;
  }
  private Response json(Response.Status status, JSONObject value) { return response(status, "application/json; charset=utf-8", value.toString()); }
  private Response error(Response.Status status, String message) { try { return json(status, new JSONObject().put("error", message)); } catch (Exception e) { return response(status, "text/plain", "Error"); } }
  @Override public Response serve(IHTTPSession session) {
    try {
      String uri = session.getUri().split("\\?", 2)[0];
      if (session.getMethod() == Method.GET && (uri.equals("/") || uri.equals("/player.html"))) return response(Response.Status.OK, "text/html; charset=utf-8", page);
      if (session.getMethod() == Method.GET && uri.equals("/api/health")) return response(Response.Status.OK, "text/plain; charset=utf-8", "ok");
      if (session.getMethod() == Method.GET && uri.equals("/api/me")) return json(Response.Status.OK, room.me(session.getHeaders().get("authorization")));
      if (session.getMethod() == Method.POST && uri.equals("/api/chips")) {
        int length = Integer.parseInt((session.getHeaders().get("content-length") == null ? "-1" : session.getHeaders().get("content-length")));
        if (length < 0 || length > 4096 || session.getHeaders().containsKey("transfer-encoding")) return error(Response.Status.BAD_REQUEST, "Слишком большой запрос");
        HashMap<String,String> files = new HashMap<>(); session.parseBody(files);
        JSONObject payload = new JSONObject((files.get("postData") == null ? "{}" : files.get("postData")));
        room.submit(session.getHeaders().get("authorization"), payload);
        return json(Response.Status.OK, new JSONObject().put("success", true));
      }
      return error(Response.Status.NOT_FOUND, "Страница не найдена");
    } catch (SecurityException e) { return error(Response.Status.UNAUTHORIZED, e.getMessage()); }
    catch (IllegalStateException e) { return error(Response.Status.CONFLICT, e.getMessage()); }
    catch (IllegalArgumentException | org.json.JSONException e) { return error(Response.Status.BAD_REQUEST, e.getMessage()); }
    catch (Throwable e) { return error(Response.Status.INTERNAL_ERROR, "Не удалось обработать запрос. Повторите отправку."); }
  }
}
