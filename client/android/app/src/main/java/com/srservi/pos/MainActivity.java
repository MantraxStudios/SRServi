package com.srservi.pos;

import android.Manifest;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Puente de impresión Bluetooth (ESC/POS) para el POS offline → window.SRPrinter
        this.bridge.getWebView().addJavascriptInterface(new BtPrinter(this), "SRPrinter");
        // Permiso de Bluetooth en Android 12+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ActivityCompat.requestPermissions(this,
                    new String[]{ Manifest.permission.BLUETOOTH_CONNECT }, 1001);
        }
    }
}
