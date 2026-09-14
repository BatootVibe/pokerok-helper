package com.batootvibe.pokerok;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle savedInstanceState) { registerPlugin(NativeHostPlugin.class); super.onCreate(savedInstanceState); }
}
