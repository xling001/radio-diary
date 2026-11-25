package com.transvoice.voice;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.util.Base64;
import android.os.Environment;

import android.content.ContentValues;
import android.provider.MediaStore;
import java.io.OutputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.File;
import java.io.FileOutputStream;

/**
 * 一个壳：把打包在 assets/www 里的网页放进 WebView。
 *
 * 关键决定：不用 file:// 打开，而是伪装成 https://appassets.local/。
 * 原因有两个：
 *   1. 浏览器只在「安全来源」下允许调用麦克风，file:// 在部分版本上不算；
 *   2. IndexedDB（我们存录音用的）在 file:// 上不可用，https 才行。
 * 请求全部由 shouldInterceptRequest 从 assets 读，不联网。
 *
 * 注意：这里刻意不用 lambda、不用匿名内部类——
 * 旧版 d8 处理这类字节码时会崩，而我们没有 Gradle 兜底。
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.local";
    private static final int REQ_MIC = 1;
    private static final int REQ_FILE = 2;

    private WebView web;
    ValueCallback<Uri[]> uploadMsg;
    public long lastBackPressTime = 0;

    /**
     * 原生文件写入桥。
     *
     * 存在的理由：网页那边的导出用的是 <a download> + blob:，而 WebView 没有下载处理器——
     * 这个操作在壳里是空操作：不报错、也不产生文件。所以导出必须走原生。
     *
     * 写到 getExternalFilesDir()（应用外部私有目录）：
     *   - 不需要任何存储权限
     *   - 用户能用文件管理器/电脑找到：Android/data/com.transvoice.voice/files/Music
     *
     * 注意：用静态嵌套类，不用匿名内部类 —— 旧版 d8 处理匿名内部类会崩。
     */
    public static class FileBridge {
        private final Activity act;

        public FileBridge(Activity a) {
            this.act = a;
        }

        /** 状态栏/导航栏着色（UI 线程）。用静态嵌套类，避开旧版 d8 对匿名内部类的崩溃。 */
        public static class BarPainter implements Runnable {
            private final Activity act;
            private final int color;
            private final boolean hasExplicitDark;
            private final boolean explicitDark;

            BarPainter(Activity a, int c) {
                this.act = a;
                this.color = c;
                this.hasExplicitDark = false;
                this.explicitDark = false;
            }

            BarPainter(Activity a, int c, boolean isDark) {
                this.act = a;
                this.color = c;
                this.hasExplicitDark = true;
                this.explicitDark = isDark;
            }

            @Override
            public void run() {
                android.view.Window w = act.getWindow();
                w.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                w.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS
                        | android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
                w.setStatusBarColor(color);
                w.setNavigationBarColor(color);
                if (Build.VERSION.SDK_INT >= 29) {
                    w.setNavigationBarContrastEnforced(false);
                    w.setStatusBarContrastEnforced(false);
                }

                int lum = (((color >> 16) & 0xff) + ((color >> 8) & 0xff) + (color & 0xff)) / 3;
                boolean isLightBg = hasExplicitDark ? !explicitDark : (lum > 140);

                int flags = w.getDecorView().getSystemUiVisibility();
                if (Build.VERSION.SDK_INT >= 23) {
                    if (isLightBg) flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    else flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                }
                if (Build.VERSION.SDK_INT >= 26) {
                    if (isLightBg) flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    else flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                w.getDecorView().setSystemUiVisibility(flags);

                if (Build.VERSION.SDK_INT >= 30) {
                    android.view.WindowInsetsController ctrl = w.getInsetsController();
                    if (ctrl != null) {
                        int mask = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                        ctrl.setSystemBarsAppearance(isLightBg ? mask : 0, mask);
                    }
                }
            }
        }

        /** 调起原生系统分享/另存面板（UI 线程）。 */
        public static class ShareRunnable implements Runnable {
            private final Activity act;
            private final Uri uri;
            private final String mime;
            ShareRunnable(Activity a, Uri u, String m) {
                this.act = a;
                this.uri = u;
                this.mime = m;
            }
            @Override
            public void run() {
                try {
                    Intent intent = new Intent(Intent.ACTION_SEND);
                    intent.setType(mime);
                    intent.putExtra(Intent.EXTRA_STREAM, uri);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    act.startActivity(Intent.createChooser(intent, "分享或保存文件"));
                } catch (Exception ignored) {
                }
            }
        }

        /** 网页切换主题时调用：同步状态栏与底部系统导航栏配色。 */
        @JavascriptInterface
        public void setBars(final String hex) {
            try {
                final int c = android.graphics.Color.parseColor(hex.trim());
                act.runOnUiThread(new BarPainter(act, c));
            } catch (Exception ignored) {
            }
        }

        /** 兼容双参数调用 setBars(isDark, hex) */
        @JavascriptInterface
        public void setBars(final boolean isDark, final String hex) {
            try {
                final int c = android.graphics.Color.parseColor(hex.trim());
                act.runOnUiThread(new BarPainter(act, c, isDark));
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public String save(String name, String mime, String b64) {
            return saveFile(name, b64, mime);
        }

        @JavascriptInterface
        public String saveBase64(String name, String b64) {
            return saveFile(name, b64, "audio/wav");
        }

        @JavascriptInterface
        public String saveFile(String name, String b64, String mime) {
            try {
                String safeName = new File(name).getName();
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                String safeMime = (mime != null && !mime.trim().isEmpty()) ? mime.trim() : "application/octet-stream";

                // 1. Android 10+ (API 29+): 写入系统公共 Download/QingLai 目录，系统文件管理器直接可见
                if (Build.VERSION.SDK_INT >= 29) {
                    Uri insertedUri = null;
                    try {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, safeMime);
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/QingLai");
                        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                        insertedUri = act.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (insertedUri != null) {
                            OutputStream os = act.getContentResolver().openOutputStream(insertedUri);
                            if (os != null) {
                                os.write(data);
                                os.flush();
                                os.close();
                                ContentValues done = new ContentValues();
                                done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                                act.getContentResolver().update(insertedUri, done, null, null);
                                return "下载/QingLai/" + safeName;
                            }
                        }
                    } catch (Exception e) {
                        if (insertedUri != null) {
                            try {
                                act.getContentResolver().delete(insertedUri, null, null);
                            } catch (Exception ignored) {
                            }
                        }
                    }
                } else {
                    // Android 9 及以下：尝试写入公共 Downloads/QingLai
                    try {
                        File dlDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "QingLai");
                        if (!dlDir.exists()) dlDir.mkdirs();
                        if (dlDir.exists() && dlDir.canWrite()) {
                            File outPub = new File(dlDir, safeName);
                            FileOutputStream fo = new FileOutputStream(outPub);
                            fo.write(data);
                            fo.flush();
                            fo.close();
                            android.media.MediaScannerConnection.scanFile(act, new String[]{ outPub.getAbsolutePath() }, null, null);
                            return "下载/QingLai/" + safeName;
                        }
                    } catch (Exception ignored) {
                    }
                }

                // 2. 降级兜底：写入应用外部专属目录
                boolean isAudio = safeMime.startsWith("audio/");
                File dir = act.getExternalFilesDir(isAudio ? Environment.DIRECTORY_MUSIC : Environment.DIRECTORY_DOCUMENTS);
                if (dir == null) dir = act.getFilesDir();
                if (dir != null && !dir.exists()) dir.mkdirs();
                if (dir == null) return "ERR:no directory";
                File out = new File(dir, safeName);
                FileOutputStream fo = new FileOutputStream(out);
                fo.write(data);
                fo.flush();
                fo.close();
                return out.getAbsolutePath();
            } catch (Exception e) {
                return "ERR:" + e.getMessage();
            }
        }

        public static class ToastRunnable implements Runnable {
            private final MainActivity act;
            ToastRunnable(MainActivity a) { this.act = a; }
            @Override
            public void run() {
                long now = System.currentTimeMillis();
                if (now - act.lastBackPressTime < 2000) {
                    act.finish();
                } else {
                    act.lastBackPressTime = now;
                    android.widget.Toast.makeText(act, "再按一次退出电波日记", android.widget.Toast.LENGTH_SHORT).show();
                }
            }
        }

        @JavascriptInterface
        public void onRootBack() {
            if (act instanceof MainActivity) {
                act.runOnUiThread(new ToastRunnable((MainActivity) act));
            } else {
                act.finish();
            }
        }

        public static class KeepScreenOnRunnable implements Runnable {
            private final Activity act;
            private final boolean enable;
            KeepScreenOnRunnable(Activity a, boolean e) {
                this.act = a;
                this.enable = e;
            }
            @Override
            public void run() {
                if (act == null || act.isFinishing()) return;
                android.view.Window w = act.getWindow();
                if (w == null) return;
                if (enable) {
                    w.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    w.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            }
        }

        @JavascriptInterface
        public void setKeepScreenOn(boolean enable) {
            if (act != null) {
                act.runOnUiThread(new KeepScreenOnRunnable(act, enable));
            }
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView.setWebContentsDebuggingEnabled(true);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setAllowFileAccess(false);
        // 注册原生文件写入桥（网页侧用 window.DshFile.saveBase64 调用）
        web.addJavascriptInterface(new FileBridge(this), "DshFile");

        // 状态栏 / 导航栏配色，对齐网页的纸色（--paper #FBF8F3）。
        // 之前用的是 @android:style/Theme.Material（深色），状态栏是深色、网页是浅米色，
        // 中间一条断层。这里只做配色、不做 edge-to-edge —— 真沉浸要让每个贴顶元素留安全区，
        // 一旦做不干净顶部按钮会被状态栏挡住，比现在更难用。
        // SDK 21+ 才能设状态栏颜色；23+ 才有浅色图标标志。
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(0xFFE7ECF3);
        getWindow().setNavigationBarColor(0xFFE7ECF3);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setNavigationBarContrastEnforced(false);
            getWindow().setStatusBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= 23) {
            getWindow().getDecorView().setSystemUiVisibility(
                    android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
        if (Build.VERSION.SDK_INT >= 26) {
            getWindow().getDecorView().setSystemUiVisibility(
                    android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                            | android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
        s.setAllowContentAccess(false);
        s.setTextZoom(100);

        web.setBackgroundColor(0xFF171517);
        web.setWebViewClient(new AssetClient(this));
        web.setWebChromeClient(new MicChromeClient(this));
        web.setFitsSystemWindows(true);

        setContentView(web, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        ensureMicPermission();
        web.loadUrl("https://" + HOST + "/index.html");
    }

    /** 从 assets/www 里读出请求的文件 */
    WebResourceResponse serve(String path) {
        if (path == null || path.isEmpty() || "/".equals(path)) {
            path = "/index.html";
        }
        if (path.indexOf("..") >= 0) {
            return text(403, "forbidden");
        }
        String mime = guessMime(path);
        try {
            InputStream in = getAssets().open("www" + path);
            return new WebResourceResponse(mime, "utf-8", in);
        } catch (IOException e) {
            return text(404, "not found: " + path);
        }
    }

    private WebResourceResponse text(int code, String body) {
        WebResourceResponse r = new WebResourceResponse(
                "text/plain", "utf-8", new ByteArrayInputStream(body.getBytes()));
        r.setStatusCodeAndReasonPhrase(code, "err");
        return r;
    }

    private static String guessMime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    /** Android 6 起麦克风要运行时申请 */
    private void ensureMicPermission() {
        if (Build.VERSION.SDK_INT < 23) return;
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        // 拒绝了也照常进界面，页面自己会提示「麦克风被拒绝了」
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (uploadMsg != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                uploadMsg.onReceiveValue(results);
                uploadMsg = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web != null) {
            web.evaluateJavascript("if(window.__back && !window.__back()){ if(window.DshFile && window.DshFile.onRootBack) window.DshFile.onRootBack(); }", null);
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        android.view.Window w = getWindow();
        if (w != null) {
            w.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** 静态嵌套类：拦截请求，从 assets 返回；外部 https/http 链接交由系统浏览器打开 */
    static class AssetClient extends WebViewClient {
        private final MainActivity host;

        AssetClient(MainActivity h) {
            this.host = h;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request != null ? request.getUrl() : null;
            if (url != null) {
                String scheme = url.getScheme();
                String h = url.getHost();
                if (("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) && !HOST.equalsIgnoreCase(h)) {
                    try {
                        host.startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
            }
            return false;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return host.serve(request.getUrl().getPath());
        }
    }

    /** 静态嵌套类：麦克风授权与系统文件选择器调用 */
    static class MicChromeClient extends WebChromeClient {
        private final MainActivity host;

        MicChromeClient(MainActivity h) {
            this.host = h;
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            request.grant(request.getResources());
        }

        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
            if (host.uploadMsg != null) {
                host.uploadMsg.onReceiveValue(null);
                host.uploadMsg = null;
            }
            host.uploadMsg = filePathCallback;

            Intent intent = null;
            if (fileChooserParams != null) {
                try {
                    intent = fileChooserParams.createIntent();
                } catch (Exception e) {
                    intent = null;
                }
            }
            if (intent == null) {
                intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("audio/*");
            }
            try {
                host.startActivityForResult(Intent.createChooser(intent, "选择音频文件"), REQ_FILE);
                return true;
            } catch (Exception e) {
                if (host.uploadMsg != null) {
                    host.uploadMsg.onReceiveValue(null);
                    host.uploadMsg = null;
                }
                return false;
            }
        }
    }
}
