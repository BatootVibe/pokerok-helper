package com.batootvibe.pokerok;
import org.json.JSONArray;
import org.json.JSONObject;
import java.security.SecureRandom;

/** Synchronized room state; a response is acknowledged only after durable persistence. */
public final class LanRoom {
  public interface Persistence { void save(String value); }
  private JSONObject state;
  private final Persistence persistence;
  public LanRoom(String saved, Persistence persistence) throws Exception {
    this.state = saved == null ? new JSONObject() : new JSONObject(saved);
    this.persistence = persistence;
  }
  private String token() {
    byte[] bytes = new byte[24]; new SecureRandom().nextBytes(bytes);
    StringBuilder s = new StringBuilder(); for (byte b : bytes) s.append(String.format("%02x", b & 255)); return s.toString();
  }
  private void commit(JSONObject draft) { persistence.save(draft.toString()); state = draft; }
  public synchronized void update(JSONObject incoming) throws Exception {
    JSONObject draft = new JSONObject(state.toString());
    if (incoming.has("gameId")) {
      if (!incoming.getString("gameId").equals(draft.optString("gameId"))) draft = new JSONObject();
      if (!incoming.optString("schema").equals(draft.optString("schema"))) draft.put("submissions", new JSONObject());
      for (String key : new String[]{"gameId","venue","players","chips","schema"}) draft.put(key, incoming.get(key));
      JSONObject tokens = draft.optJSONObject("tokens"); if (tokens == null) tokens = new JSONObject();
      JSONObject currentTokens = new JSONObject();
      JSONArray players = draft.getJSONArray("players");
      for (int i = 0; i < players.length(); i++) { String id = players.getJSONObject(i).getString("id"); currentTokens.put(id, tokens.has(id) ? tokens.getString(id) : token()); }
      draft.put("tokens", currentTokens);
      if (!draft.has("submissions")) draft.put("submissions", new JSONObject());
    }
    if (incoming.has("accepting")) draft.put("accepting", incoming.getBoolean("accepting"));
    commit(draft);
  }
  private JSONObject player(String bearer) throws Exception {
    if (bearer == null || !bearer.startsWith("Bearer ")) return null;
    String value = bearer.substring(7);
    JSONArray players = state.optJSONArray("players"); JSONObject tokens = state.optJSONObject("tokens");
    if (players == null || tokens == null) return null;
    for (int i = 0; i < players.length(); i++) { JSONObject p = players.getJSONObject(i); if (tokens.optString(p.getString("id")).equals(value)) return p; }
    return null;
  }
  public synchronized JSONObject me(String bearer) throws Exception {
    JSONObject p = player(bearer); if (p == null) throw new SecurityException("Откройте персональный QR-код ведущего");
    JSONObject reply = new JSONObject();
    reply.put("player", p); reply.put("venue", state.optString("venue")); reply.put("chips", state.getJSONArray("chips")); reply.put("schema", state.getString("schema")); reply.put("accepting", state.optBoolean("accepting"));
    JSONObject previous = state.getJSONObject("submissions").optJSONObject(p.getString("id"));
    if (previous != null) reply.put("counts", previous.getJSONArray("counts"));
    return reply;
  }
  public synchronized void submit(String bearer, JSONObject payload) throws Exception {
    JSONObject p = player(bearer); if (p == null) throw new SecurityException("Откройте персональный QR-код ведущего");
    if (!state.optBoolean("accepting")) throw new IllegalStateException("Ведущий проверяет результаты. Приём приостановлен.");
    if (!state.getString("schema").equals(payload.optString("schema"))) throw new IllegalArgumentException("Номиналы изменились. Откройте QR-код заново.");
    JSONArray counts = payload.getJSONArray("counts");
    if (counts.length() != state.getJSONArray("chips").length()) throw new IllegalArgumentException("Неверное количество номиналов");
    for (int i = 0; i < counts.length(); i++) {
      Object raw = counts.get(i); if (!(raw instanceof Number)) throw new IllegalArgumentException("Введите целое количество фишек");
      double n = ((Number) raw).doubleValue(); if ((Double.isInfinite(n) || Double.isNaN(n)) || n < 0 || n > 1000000 || n != Math.floor(n)) throw new IllegalArgumentException("Введите целое количество фишек от 0 до 1 000 000");
    }
    JSONObject draft = new JSONObject(state.toString()); JSONObject submissions = draft.getJSONObject("submissions");
    String id = p.getString("id"); JSONObject old = submissions.optJSONObject(id);
    if (old != null && old.getJSONArray("counts").toString().equals(counts.toString())) return;
    long sequence = draft.optLong("sequence", 0) + 1; draft.put("sequence", sequence);
    JSONObject entry = new JSONObject(); entry.put("playerId", id); entry.put("counts", counts); entry.put("sequence", sequence); submissions.put(id, entry);
    commit(draft);
  }
  public synchronized JSONObject status() throws Exception {
    JSONObject result = new JSONObject(); result.put("links", state.optJSONObject("tokens") == null ? new JSONObject() : state.getJSONObject("tokens"));
    JSONArray entries = new JSONArray(); JSONObject submissions = state.optJSONObject("submissions"); JSONArray players = state.optJSONArray("players");
    if (players != null && submissions != null) for (int i = 0; i < players.length(); i++) { JSONObject s = submissions.optJSONObject(players.getJSONObject(i).getString("id")); if (s != null) entries.put(s); }
    result.put("submissions", entries); return new JSONObject(result.toString());
  }
}
