package com.srservi.pos;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;

import androidx.core.app.ActivityCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Puente de impresión Bluetooth (ESC/POS) para la app offline (Capacitor).
 * Se expone a la web como window.SRPrinter. Portado del launcher nativo.
 */
public class BtPrinter {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final Context ctx;
    private BluetoothAdapter adapter;
    private BluetoothSocket socket;
    private OutputStream out;
    private final SharedPreferences prefs;

    public BtPrinter(Context context) {
        this.ctx = context;
        this.prefs = context.getSharedPreferences("srprinter", Context.MODE_PRIVATE);
        BluetoothManager bm = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        this.adapter = bm != null ? bm.getAdapter() : BluetoothAdapter.getDefaultAdapter();
    }

    private boolean hasPerm() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    @JavascriptInterface
    public boolean isReady() {
        return adapter != null && adapter.isEnabled() && hasPerm();
    }

    @JavascriptInterface
    public void requestPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && ctx instanceof Activity) {
            ActivityCompat.requestPermissions((Activity) ctx,
                    new String[]{ Manifest.permission.BLUETOOTH_CONNECT }, 1001);
        }
    }

    /** Impresoras emparejadas → JSON: [{"name":..,"mac":..}] */
    @JavascriptInterface
    public String listPrinters() {
        JSONArray arr = new JSONArray();
        try {
            if (adapter == null || !hasPerm()) return "[]";
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            if (bonded != null) {
                for (BluetoothDevice d : bonded) {
                    JSONObject o = new JSONObject();
                    o.put("name", d.getName() != null ? d.getName() : "Impresora");
                    o.put("mac", d.getAddress());
                    arr.put(o);
                }
            }
        } catch (Exception ignored) {}
        return arr.toString();
    }

    @JavascriptInterface
    public boolean connect(String mac) {
        try {
            if (adapter == null || !hasPerm() || mac == null) return false;
            disconnect();
            BluetoothDevice device = adapter.getRemoteDevice(mac);
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            out = socket.getOutputStream();
            return true;
        } catch (Exception e) {
            disconnect();
            return false;
        }
    }

    @JavascriptInterface
    public boolean isConnected() {
        return socket != null && socket.isConnected();
    }

    @JavascriptInterface
    public void disconnect() {
        try { if (out != null) out.close(); } catch (Exception ignored) {}
        try { if (socket != null) socket.close(); } catch (Exception ignored) {}
        out = null;
        socket = null;
    }

    @JavascriptInterface
    public void save(String mac) {
        prefs.edit().putString("mac", mac).apply();
    }

    @JavascriptInterface
    public String getSaved() {
        return prefs.getString("mac", "");
    }

    @JavascriptInterface
    public void setPaperChars(int chars) {
        prefs.edit().putInt("chars", chars).apply();
    }

    private int paperChars() {
        return prefs.getInt("chars", 32); // 58mm por defecto
    }

    /** Conecta a la impresora guardada si no está conectada. */
    private boolean ensureConnected() {
        if (isConnected()) return true;
        String mac = getSaved();
        return mac != null && !mac.isEmpty() && connect(mac);
    }

    @JavascriptInterface
    public boolean printTest() {
        if (!ensureConnected()) return false;
        try {
            Esc b = new Esc(paperChars());
            b.init(); b.center(); b.bold(true); b.big(true);
            b.text("SRServi"); b.big(false); b.nl(); b.bold(false);
            b.sep();
            b.text("Pagina de prueba"); b.nl();
            b.text("Impresora OK"); b.nl();
            b.sep(); b.nl(); b.nl(); b.cut();
            out.write(b.bytes()); out.flush();
            return true;
        } catch (Exception e) { return false; }
    }

    /** Imprime un recibo a partir del JSON del pedido. */
    @JavascriptInterface
    public boolean printReceipt(String json) {
        if (!ensureConnected()) return false;
        try {
            JSONObject o = new JSONObject(json);
            String cur = o.optString("currency", "$");
            Esc b = new Esc(paperChars());
            b.init(); b.center(); b.bold(true); b.big(true);
            b.text("SRServi"); b.big(false); b.nl(); b.bold(false);
            b.sep();
            b.center(); b.bold(true);
            b.text("Pedido: " + o.optString("orderNumber", "")); b.bold(false); b.nl();
            b.text(new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()).format(new Date())); b.nl();
            b.sep();
            b.left();
            JSONArray items = o.optJSONArray("items");
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject it = items.getJSONObject(i);
                    int qty = it.optInt("quantity", 1);
                    b.text(qty + "x " + it.optString("name", "")); b.nl();
                    b.right();
                    b.text(cur + money(it.optDouble("price", 0) * qty)); b.nl();
                    b.left();
                    appendList(b, it.optJSONArray("ingredients"), "  Ingredientes:");
                    appendList(b, it.optJSONArray("extras"), "  Extras:");
                    appendList(b, it.optJSONArray("complements"), "  Complementos:");
                }
            }
            b.sep();
            b.leftRight("Subtotal:", cur + money(o.optDouble("subtotal", 0))); b.nl();
            double disc = o.optDouble("discount", 0);
            if (disc > 0) { b.leftRight("Descuento:", "-" + cur + money(disc)); b.nl(); }
            b.bold(true); b.leftRight("TOTAL:", cur + money(o.optDouble("total", 0))); b.nl(); b.bold(false);
            b.sep();
            String pm = o.optString("paymentMethod", "");
            String pmLabel = pm.equals("card") ? "Tarjeta" : pm.equals("cash") ? "Efectivo" : pm;
            b.leftRight("Pago:", pmLabel); b.nl();
            String coupon = o.optString("couponCode", "");
            if (!coupon.isEmpty() && !coupon.equals("null")) { b.leftRight("Cupon:", coupon); b.nl(); }
            b.sep();
            b.center(); b.bold(true); b.big(true);
            String svc = o.optString("serviceType", "");
            b.text(svc.equals("llevar") ? "PARA LLEVAR" : "PARA SERVIR");
            b.big(false); b.bold(false);
            String table = o.optString("tableNumber", "");
            if (!table.isEmpty() && !table.equals("null")) { b.nl(); b.bold(true); b.text("Mesa #" + table); b.bold(false); }
            b.nl(); b.nl(); b.nl(); b.cut();
            out.write(b.bytes()); out.flush();
            return true;
        } catch (Exception e) { return false; }
    }

    private void appendList(Esc b, JSONArray a, String title) {
        if (a == null || a.length() == 0) return;
        b.text(title); b.nl();
        for (int i = 0; i < a.length(); i++) { b.text("  - " + a.optString(i, "")); b.nl(); }
    }

    private static String money(double v) {
        return String.format(Locale.US, "%.2f", v);
    }

    /** Constructor de comandos ESC/POS. */
    private static class Esc {
        private final int width;
        private final ByteArrayOutputStream d = new ByteArrayOutputStream();
        Esc(int width) { this.width = width; }
        private void w(byte[] b) { d.write(b, 0, b.length); }
        void init() { w(new byte[]{0x1B, 0x40}); }
        void left() { w(new byte[]{0x1B, 0x61, 0x00}); }
        void center() { w(new byte[]{0x1B, 0x61, 0x01}); }
        void right() { w(new byte[]{0x1B, 0x61, 0x02}); }
        void bold(boolean on) { w(new byte[]{0x1B, 0x45, (byte) (on ? 1 : 0)}); }
        void big(boolean on) { w(new byte[]{0x1D, 0x21, (byte) (on ? 0x11 : 0x00)}); }
        void nl() { w(new byte[]{0x0A}); }
        void cut() { w(new byte[]{0x1D, 0x56, 0x00}); }
        void text(String t) {
            try { d.write(t.getBytes("UTF-8")); } catch (Exception ignored) {}
        }
        void sep() {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < width; i++) sb.append('-');
            text(sb.toString()); nl();
        }
        void leftRight(String l, String r) {
            int spaces = width - l.length() - r.length();
            if (spaces > 0) { left(); text(l); StringBuilder sb = new StringBuilder(); for (int i=0;i<spaces;i++) sb.append(' '); text(sb.toString()); text(r); }
            else { left(); text(l); nl(); right(); text(r); left(); }
        }
        byte[] bytes() { return d.toByteArray(); }
    }
}
