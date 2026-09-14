package com.batootvibe.pokerok;
import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
@CapacitorPlugin(name = "NativeHost")
public class NativeHostPlugin extends Plugin {
  @PluginMethod public void load(PluginCall call) { try { JSObject result = new JSObject(); result.put("value", PokerStore.get(getContext()).read("app")); call.resolve(result); } catch (Exception e) { call.reject("Не удалось открыть базу", e); } }
  @PluginMethod public void save(PluginCall call) { try { String value = call.getString("value"); if (value == null) throw new IllegalArgumentException(); PokerStore.get(getContext()).write("app", value); call.resolve(); } catch (Exception e) { call.reject("Не удалось сохранить данные", e); } }
  @PluginMethod public void start(PluginCall call) { try { call.resolve(JSObject.fromJSONObject(LanService.start(getContext(), new JSONObject(call.getString("room", "{}"))))); } catch (Exception e) { call.reject("Не удалось открыть Wi-Fi игру: " + e.getMessage(), e); } }
  @PluginMethod public void update(PluginCall call) { try { LanService.update(getContext(), new JSONObject(call.getString("room", "{}"))); call.resolve(); } catch (Exception e) { call.reject("Не удалось обновить игру", e); } }
  @PluginMethod public void status(PluginCall call) { try { call.resolve(JSObject.fromJSONObject(LanService.status(getContext()))); } catch (Exception e) { call.reject("Не удалось проверить Wi-Fi", e); } }
  @PluginMethod public void stop(PluginCall call) { LanService.stop(getContext()); call.resolve(); }
  @PluginMethod public void exportBackup(PluginCall call) {
    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT); intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/json"); intent.putExtra(Intent.EXTRA_TITLE, "pokerok-backup-" + System.currentTimeMillis() + ".json");
    startActivityForResult(call, intent, "backupResult");
  }
  @ActivityCallback private void backupResult(PluginCall call, ActivityResult result) {
    if (call == null) return;
    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.resolve(); return; }
    try (java.io.OutputStream stream = getContext().getContentResolver().openOutputStream(result.getData().getData())) { if (stream == null) throw new IllegalStateException(); stream.write(call.getString("value", "{}").getBytes(StandardCharsets.UTF_8)); call.resolve(); }
    catch (Exception e) { call.reject("Не удалось экспортировать копию", e); }
  }
}
