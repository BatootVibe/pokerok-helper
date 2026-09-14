package com.batootvibe.pokerok;
import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
final class PokerStore extends SQLiteOpenHelper {
  private static PokerStore instance;
  static synchronized PokerStore get(Context context) {
    if (instance == null) instance = new PokerStore(context.getApplicationContext());
    return instance;
  }
  private PokerStore(Context context) { super(context, "pokerok-offline.db", null, 1); }
  @Override public void onConfigure(SQLiteDatabase db) { db.execSQL("PRAGMA synchronous=FULL"); }
  @Override public void onCreate(SQLiteDatabase db) { db.execSQL("CREATE TABLE documents (name TEXT PRIMARY KEY, value TEXT NOT NULL)"); }
  @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { throw new IllegalStateException("Unsupported database version"); }
  synchronized String read(String name) {
    try (Cursor c = getReadableDatabase().rawQuery("SELECT value FROM documents WHERE name=?", new String[]{name})) { return c.moveToFirst() ? c.getString(0) : null; }
  }
  synchronized void write(String name, String value) {
    ContentValues values = new ContentValues(); values.put("name", name); values.put("value", value);
    if (getWritableDatabase().insertWithOnConflict("documents", null, values, SQLiteDatabase.CONFLICT_REPLACE) == -1) throw new IllegalStateException("Не удалось сохранить данные на устройстве");
  }
}
