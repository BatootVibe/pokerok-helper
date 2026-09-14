package com.batootvibe.pokerok;
import android.app.*;
import android.content.*;
import android.os.*;
import org.json.*;
import java.net.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
public class LanService extends Service {
  private static LanRoom room;
  private static LanServer server;
  private PowerManager.WakeLock wakeLock;
  private static final int PORT = 8787;
  private static synchronized LanRoom room(Context context) throws Exception {
    if (room == null) { PokerStore store = PokerStore.get(context); room = new LanRoom(store.read("lan"), value -> store.write("lan", value)); }
    return room;
  }
  static synchronized JSONObject start(Context context, JSONObject incoming) throws Exception {
    room(context).update(incoming);
    if (server == null) {
      String page;
      try (java.io.InputStream in = context.getAssets().open("public/player.html")) { java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int count; while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count); page = new String(out.toByteArray(), StandardCharsets.UTF_8); }
      LanServer candidate = new LanServer(PORT, room(context), page);
      candidate.start(5000, true); server = candidate;
      try {
        Intent intent = new Intent(context, LanService.class);
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent); else context.startService(intent);
      } catch (Exception e) { server.stop(); server = null; throw e; }
    }
    return status(context);
  }
  static synchronized void update(Context context, JSONObject incoming) throws Exception { if (server != null) room(context).update(incoming); }
  static synchronized void stop(Context context) { if (server != null) { server.stop(); server = null; } context.stopService(new Intent(context, LanService.class)); }
  static synchronized JSONObject status(Context context) throws Exception {
    JSONObject result = room(context).status(); result.put("running", server != null);
    JSONArray addresses = new JSONArray();
    for (NetworkInterface iface : Collections.list(NetworkInterface.getNetworkInterfaces())) {
      if (!iface.isUp() || iface.isLoopback() || iface.getName().startsWith("rmnet") || iface.getName().startsWith("tun")) continue;
      for (InetAddress addr : Collections.list(iface.getInetAddresses())) if (addr instanceof Inet4Address && addr.isSiteLocalAddress()) addresses.put("http://" + addr.getHostAddress() + ":" + PORT);
    }
    result.put("addresses", addresses); return result;
  }
  @Override public void onCreate() {
    super.onCreate();
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("poker_lan", "Игра по Wi-Fi", NotificationManager.IMPORTANCE_LOW));
    PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "poker_lan") : new Notification.Builder(this);
    Notification notification = builder.setContentTitle("PokerOK · Приём фишек по Wi-Fi").setContentText("Нажмите, чтобы вернуться к игре").setSmallIcon(android.R.drawable.ic_menu_myplaces).setOngoing(true).setContentIntent(open).build();
    startForeground(8787, notification);
    PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PokerOK:LanRoom"); wakeLock.acquire();
  }
  @Override public int onStartCommand(Intent intent, int flags, int startId) { return START_NOT_STICKY; }
  @Override public void onDestroy() { synchronized (LanService.class) { if (server != null) { server.stop(); server = null; } } if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); super.onDestroy(); }
  @Override public IBinder onBind(Intent intent) { return null; }
}
