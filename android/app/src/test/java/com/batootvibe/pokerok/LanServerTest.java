package com.batootvibe.pokerok;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
public class LanServerTest {
  private HttpURLConnection request(int port, String path, String token, String body) throws Exception {
    HttpURLConnection c = (HttpURLConnection)new URL("http://127.0.0.1:" + port + path).openConnection(); c.setConnectTimeout(3000); c.setReadTimeout(3000);
    if (token != null) c.setRequestProperty("Authorization", "Bearer " + token);
    if (body != null) { c.setRequestMethod("POST"); c.setRequestProperty("Content-Type", "application/json"); c.setDoOutput(true); c.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8)); }
    return c;
  }
  @Test public void browserProtocolAuthenticatesAndSavesBeforeAcknowledging() throws Exception {
    String[] disk = {null}; LanRoom room = new LanRoom(null, value -> disk[0] = value);
    room.update(new JSONObject("{\"gameId\":\"game\",\"venue\":\"test\",\"players\":[{\"id\":\"player\",\"name\":\"Player\"}],\"chips\":[{\"color\":\"red\",\"nominal\":25}],\"schema\":\"v1\",\"accepting\":true}"));
    LanServer server = new LanServer(0, room, "<!doctype html><title>PokerOK</title>"); server.start(3000, true);
    try {
      int port = server.getListeningPort(); String token = room.status().getJSONObject("links").getString("player");
      HttpURLConnection page = request(port, "/", null, null); assertEquals(200, page.getResponseCode()); assertEquals("no-store", page.getHeaderField("Cache-Control")); page.disconnect();
      HttpURLConnection forbidden = request(port, "/api/me", "wrong", null); assertEquals(401, forbidden.getResponseCode()); forbidden.disconnect();
      HttpURLConnection post = request(port, "/api/chips", token, "{\"schema\":\"v1\",\"counts\":[20]}"); assertEquals(200, post.getResponseCode()); post.disconnect();
      assertEquals(20, new LanRoom(disk[0], value -> {}).me("Bearer " + token).getJSONArray("counts").getInt(0));
      room.update(new JSONObject().put("accepting", false));
      HttpURLConnection paused = request(port, "/api/chips", token, "{\"schema\":\"v1\",\"counts\":[21]}"); assertEquals(409, paused.getResponseCode()); paused.disconnect();
    } finally { server.stop(); }
  }
}
