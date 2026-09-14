package com.batootvibe.pokerok;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.*;
public class LanRoomTest {
  private JSONObject config() throws Exception { return new JSONObject("{\"gameId\":\"game\",\"venue\":\"Дом\",\"players\":[{\"id\":\"alice\",\"name\":\"Алиса\"},{\"id\":\"bob\",\"name\":\"Боб\"}],\"chips\":[{\"color\":\"white\",\"nominal\":5}],\"schema\":\"v1\",\"accepting\":true}"); }
  private String bearer(LanRoom room, String id) throws Exception { return "Bearer " + room.status().getJSONObject("links").getString(id); }
  @Test public void personalTokensAndDurableSubmission() throws Exception {
    String[] disk = { null }; LanRoom room = new LanRoom(null, s -> disk[0] = s); room.update(config());
    String token = bearer(room, "alice"); assertEquals("alice", room.me(token).getJSONObject("player").getString("id"));
    JSONObject payload = new JSONObject("{\"schema\":\"v1\",\"counts\":[12],\"playerId\":\"bob\"}");
    room.submit(token, payload); room.submit(token, payload);
    JSONArray entries = room.status().getJSONArray("submissions"); assertEquals(1, entries.length()); assertEquals("alice", entries.getJSONObject(0).getString("playerId")); assertEquals(1, entries.getJSONObject(0).getInt("sequence"));
    LanRoom restarted = new LanRoom(disk[0], s -> {}); assertEquals(12, restarted.me(token).getJSONArray("counts").getInt(0));
  }
  @Test public void pauseInvalidCountsAndRevokedPlayer() throws Exception {
    LanRoom room = new LanRoom(null, s -> {}); room.update(config()); String token = bearer(room, "alice");
    for (String count : new String[]{"-1", "0.5", "1000001", "\"2\""}) {
      try { room.submit(token, new JSONObject("{\"schema\":\"v1\",\"counts\":["+count+"]}")); fail(); } catch (IllegalArgumentException expected) {}
    }
    room.update(new JSONObject().put("accepting", false));
    try { room.submit(token, new JSONObject("{\"schema\":\"v1\",\"counts\":[1]}")); fail(); } catch (IllegalStateException expected) {}
    JSONObject changed = config(); changed.put("players", new JSONArray("[{\"id\":\"bob\",\"name\":\"Боб\"}]")); room.update(changed);
    try { room.me(token); fail(); } catch (SecurityException expected) {}
  }
  @Test public void failedPersistenceIsNotAcknowledgedOrApplied() throws Exception {
    boolean[] full = {false}; LanRoom room = new LanRoom(null, s -> { if (full[0]) throw new IllegalStateException("disk full"); }); room.update(config()); String token = bearer(room, "alice"); full[0] = true;
    try { room.submit(token, new JSONObject("{\"schema\":\"v1\",\"counts\":[1]}")); fail(); } catch (IllegalStateException expected) {}
    assertEquals(0, room.status().getJSONArray("submissions").length());
  }
  @Test public void changedGameInvalidatesOldLinksAndCounts() throws Exception {
    LanRoom room = new LanRoom(null, s -> {}); room.update(config()); String token = bearer(room, "alice");
    room.update(config().put("gameId", "next-game"));
    try { room.me(token); fail(); } catch (SecurityException expected) {}
    assertEquals(0, room.status().getJSONArray("submissions").length());
  }
}
