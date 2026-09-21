package com.kashiftraders.erp;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    private static final String HOME = "https://kashif-traders.vercel.app/";
    private static final int FILE_REQ = 101;
    private static final int CAMERA_PERMISSION_REQ = 102;
    private static final int STORAGE_PERMISSION_REQ = 103;
    private static final int INSTALL_PERMISSION_REQ = 104;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private PermissionRequest pendingWebPermission;
    private File pendingUpdateFile;
    private boolean waitingForInstallPermission = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        web = findViewById(R.id.web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && (host.equals("kashif-traders.vercel.app") || host.endsWith(".vercel.app"))) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectNativeHelpers(view);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean asksForCamera = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            asksForCamera = true;
                            break;
                        }
                    }
                    if (!asksForCamera) {
                        request.deny();
                        return;
                    }
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
                            checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        pendingWebPermission = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQ);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                cameraUri = null;

                Intent picker;
                try {
                    picker = params.createIntent();
                } catch (Exception e) {
                    picker = new Intent(Intent.ACTION_GET_CONTENT);
                    picker.addCategory(Intent.CATEGORY_OPENABLE);
                    picker.setType("*/*");
                }

                Intent camera = createCameraIntent();
                Intent chooser = Intent.createChooser(picker, "Select document");
                if (camera != null) {
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                }

                try {
                    startActivityForResult(chooser, FILE_REQ);
                    return true;
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "No camera or file picker found", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        web.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(
                    String url,
                    String userAgent,
                    String contentDisposition,
                    String mimetype,
                    long contentLength) {
                if (url != null && url.startsWith("blob:")) {
                    captureBlobUrl(url, contentDisposition, mimetype);
                    return;
                }
                downloadHttpUrl(url, userAgent, contentDisposition, mimetype);
            }
        });

        requestNativePermissions();

        if (savedInstanceState == null) {
            web.loadUrl(HOME);
        } else {
            web.restoreState(savedInstanceState);
        }
    }

    private void requestNativePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQ);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                Build.VERSION.SDK_INT <= Build.VERSION_CODES.P &&
                checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, STORAGE_PERMISSION_REQ);
        }
    }

    private Intent createCameraIntent() {
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) == null) {
            return null;
        }
        try {
            File dir = new File(getCacheDir(), "camera");
            if (!dir.exists() && !dir.mkdirs()) {
                return null;
            }
            File photo = File.createTempFile("kt_", ".jpg", dir);
            cameraUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    photo
            );
            camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            camera.setClipData(ClipData.newRawUri("Kashif Traders camera", cameraUri));
            camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return camera;
        } catch (Exception e) {
            cameraUri = null;
            return null;
        }
    }

    private void downloadHttpUrl(String url, String userAgent, String contentDisposition, String mimetype) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            String name = URLUtil.guessFileName(url, contentDisposition, mimetype);
            request.setTitle(name);
            if (mimetype != null && !mimetype.isEmpty()) {
                request.setMimeType(mimetype);
            }
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null) {
                request.addRequestHeader("Cookie", cookie);
            }
            if (userAgent != null) {
                request.addRequestHeader("User-Agent", userAgent);
            }
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(request);
            Toast.makeText(this, "Download started", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception ignored) {
                Toast.makeText(this, "Download could not start", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void captureBlobUrl(String blobUrl, String contentDisposition, String mimetype) {
        String fileName = URLUtil.guessFileName(blobUrl, contentDisposition, mimetype);
        String js = "(async function(){try{" +
                "const r=await fetch(" + quoteJs(blobUrl) + ");" +
                "const b=await r.blob();" +
                "const fr=new FileReader();" +
                "fr.onloadend=function(){AndroidBridge.saveDataUrl(fr.result," + quoteJs(fileName) + ",b.type||" + quoteJs(mimetype == null ? "application/octet-stream" : mimetype) + ")};" +
                "fr.readAsDataURL(b);" +
                "}catch(e){console.error(e)}})();";
        web.evaluateJavascript(js, null);
    }

    private void injectNativeHelpers(WebView view) {
        String js = "(function(){" +
                "if(window.__KT_NATIVE_HELPERS__)return;window.__KT_NATIVE_HELPERS__=true;" +
                "try{window.KT_NATIVE_APP_VERSION=AndroidBridge.getAppVersion();}catch(e){}" +
                "try{window.KT_START_NATIVE_UPDATE=function(url){AndroidBridge.startUpdate(url);};}catch(e){}" +
                "function nativeShare(data){" +
                "return new Promise(function(resolve,reject){" +
                "try{" +
                "var files=data&&data.files?Array.from(data.files):[];" +
                "if(!files.length){AndroidBridge.shareText((data&&data.title)||'Share',(data&&data.text)||'');resolve();return;}" +
                "var file=files[0],fr=new FileReader();" +
                "fr.onloadend=function(){try{AndroidBridge.shareDataUrl(fr.result,file.name||'Kashif-Traders.pdf',file.type||'application/pdf',(data&&data.title)||'Share',(data&&data.text)||'');resolve();}catch(err){reject(err);}};" +
                "fr.onerror=function(){reject(fr.error||new Error('Share failed'));};" +
                "fr.readAsDataURL(file);" +
                "}catch(err){reject(err);}" +
                "});" +
                "}" +
                "try{Object.defineProperty(navigator,'share',{configurable:true,value:nativeShare});}catch(e){try{navigator.share=nativeShare;}catch(ignore){}}" +
                "try{Object.defineProperty(navigator,'canShare',{configurable:true,value:function(data){return !!(data&&data.files&&data.files.length);}});}catch(e){try{navigator.canShare=function(data){return !!(data&&data.files&&data.files.length);};}catch(ignore){}}" +
                "document.addEventListener('click',function(ev){" +
                "const a=ev.target&&ev.target.closest?ev.target.closest('a[download]'):null;" +
                "if(!a||!a.href||!a.href.startsWith('blob:'))return;" +
                "ev.preventDefault();ev.stopPropagation();" +
                "fetch(a.href).then(r=>r.blob()).then(b=>{const fr=new FileReader();" +
                "fr.onloadend=()=>AndroidBridge.saveDataUrl(fr.result,a.download||'Kashif-Traders.pdf',b.type||'application/octet-stream');" +
                "fr.readAsDataURL(b);}).catch(console.error);" +
                "},true);" +
                "})();";
        view.evaluateJavascript(js, null);
    }

    private static String quoteJs(String value) {
        if (value == null) value = "";
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "") + "'";
    }

    private String safeFileName(String name, String mimeType) {
        String value = name == null ? "" : name.trim();
        if (value.isEmpty()) {
            value = mimeType != null && mimeType.contains("pdf") ? "Kashif-Traders.pdf" : "Kashif-Traders-download";
        }
        value = value.replaceAll("[\\\\/:*?\"<>|]", "-");
        if (mimeType != null && mimeType.contains("pdf") && !value.toLowerCase().endsWith(".pdf")) {
            value += ".pdf";
        }
        return value;
    }

    private byte[] decodeDataUrl(String dataUrl) {
        int comma = dataUrl.indexOf(',');
        String encoded = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
        return Base64.decode(encoded, Base64.DEFAULT);
    }

    private void saveBytesToDownloads(byte[] bytes, String fileName, String mimeType) throws Exception {
        String name = safeFileName(fileName, mimeType);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, name);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType == null ? "application/octet-stream" : mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Kashif Traders");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new IllegalStateException("Could not create download");
            }
            try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                if (output == null) throw new IllegalStateException("Could not open download");
                output.write(bytes);
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(uri, values, null, null);
        } else {
            File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File folder = new File(downloads, "Kashif Traders");
            if (!folder.exists() && !folder.mkdirs()) {
                throw new IllegalStateException("Could not create Downloads folder");
            }
            File target = new File(folder, name);
            try (FileOutputStream output = new FileOutputStream(target)) {
                output.write(bytes);
            }
        }
    }

    private File writeShareFile(byte[] bytes, String fileName, String mimeType) throws Exception {
        File folder = new File(getCacheDir(), "share");
        if (!folder.exists() && !folder.mkdirs()) {
            throw new IllegalStateException("Could not create share cache");
        }
        File[] old = folder.listFiles();
        if (old != null) {
            for (File f : old) {
                if (f.isFile()) f.delete();
            }
        }
        File target = new File(folder, safeFileName(fileName, mimeType));
        try (FileOutputStream output = new FileOutputStream(target)) {
            output.write(bytes);
        }
        return target;
    }

    private void openShareSheet(File file, String mimeType, String title, String text) {
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file);
        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType((mimeType == null || mimeType.isEmpty()) ? "application/octet-stream" : mimeType);
        share.putExtra(Intent.EXTRA_STREAM, uri);
        if (text != null && !text.isEmpty()) share.putExtra(Intent.EXTRA_TEXT, text);
        share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        share.setClipData(ClipData.newRawUri("Kashif Traders PDF", uri));
        startActivity(Intent.createChooser(share, (title == null || title.isEmpty()) ? "Share PDF" : title));
    }

    private File downloadUpdateApk(String urlString) throws Exception {
        File folder = new File(getCacheDir(), "update");
        if (!folder.exists() && !folder.mkdirs()) {
            throw new IllegalStateException("Could not create update cache");
        }
        File target = new File(folder, "Kashif-Traders-ERP-update.apk");
        if (target.exists()) target.delete();

        URL current = new URL(urlString);
        HttpURLConnection connection = null;
        int redirects = 0;
        while (redirects < 8) {
            connection = (HttpURLConnection) current.openConnection();
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(60000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent", "Kashif-Traders-Android");
            connection.connect();
            int code = connection.getResponseCode();
            if (code >= 300 && code < 400) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new IllegalStateException("Update redirect failed");
                }
                current = new URL(current, location);
                redirects++;
                continue;
            }
            if (code < 200 || code >= 300) {
                throw new IllegalStateException("Update download failed: HTTP " + code);
            }
            break;
        }
        if (connection == null) throw new IllegalStateException("Update connection failed");

        try (InputStream input = connection.getInputStream();
             FileOutputStream output = new FileOutputStream(target)) {
            byte[] buffer = new byte[32768];
            int read;
            long total = 0;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
                total += read;
            }
            output.flush();
            if (total < 100000) {
                target.delete();
                throw new IllegalStateException("Downloaded update is incomplete");
            }
        } finally {
            connection.disconnect();
        }
        return target;
    }

    private void openUpdateInstaller(File apkFile) {
        if (apkFile == null || !apkFile.exists()) {
            Toast.makeText(this, "Update file is missing", Toast.LENGTH_SHORT).show();
            return;
        }

        pendingUpdateFile = apkFile;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !getPackageManager().canRequestPackageInstalls()) {
            waitingForInstallPermission = true;
            Toast.makeText(this, "Allow Kashif Traders to install this update", Toast.LENGTH_LONG).show();
            Intent settingsIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName())
            );
            startActivityForResult(settingsIntent, INSTALL_PERMISSION_REQ);
            return;
        }

        waitingForInstallPermission = false;
        Uri apkUri = FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                apkFile
        );
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(apkUri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        install.setClipData(ClipData.newRawUri("Kashif Traders update", apkUri));
        try {
            startActivity(install);
        } catch (Exception e) {
            Toast.makeText(this, "Android installer could not open", Toast.LENGTH_LONG).show();
        }
    }

    private void startNativeUpdate(String url) {
        if (url == null || !url.startsWith("https://")) {
            Toast.makeText(this, "Invalid update link", Toast.LENGTH_SHORT).show();
            return;
        }
        Toast.makeText(this, "Downloading update inside app…", Toast.LENGTH_LONG).show();
        new Thread(() -> {
            try {
                File apk = downloadUpdateApk(url);
                pendingUpdateFile = apk;
                runOnUiThread(() -> {
                    Toast.makeText(
                            MainActivity.this,
                            "Update downloaded. Opening Android installer…",
                            Toast.LENGTH_SHORT
                    ).show();
                    openUpdateInstaller(apk);
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(
                        MainActivity.this,
                        "Update download failed. Please try again.",
                        Toast.LENGTH_LONG
                ).show());
            }
        }).start();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public String getAppVersion() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "1.0.5";
            }
        }

        @JavascriptInterface
        public void startUpdate(String url) {
            runOnUiThread(() -> startNativeUpdate(url));
        }

        @JavascriptInterface
        public void saveDataUrl(String dataUrl, String fileName, String mimeType) {
            if (dataUrl == null || dataUrl.isEmpty()) return;
            new Thread(() -> {
                try {
                    byte[] bytes = decodeDataUrl(dataUrl);
                    saveBytesToDownloads(bytes, fileName, mimeType);
                    runOnUiThread(() -> Toast.makeText(
                            MainActivity.this,
                            "Saved to Downloads",
                            Toast.LENGTH_SHORT
                    ).show());
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(
                            MainActivity.this,
                            "Download failed",
                            Toast.LENGTH_SHORT
                    ).show());
                }
            }).start();
        }

        @JavascriptInterface
        public void shareDataUrl(String dataUrl, String fileName, String mimeType, String title, String text) {
            if (dataUrl == null || dataUrl.isEmpty()) return;
            new Thread(() -> {
                try {
                    byte[] bytes = decodeDataUrl(dataUrl);
                    File file = writeShareFile(bytes, fileName, mimeType);
                    runOnUiThread(() -> {
                        try {
                            openShareSheet(file, mimeType, title, text);
                        } catch (Exception e) {
                            Toast.makeText(MainActivity.this, "Share options could not open", Toast.LENGTH_SHORT).show();
                        }
                    });
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(
                            MainActivity.this,
                            "Share failed",
                            Toast.LENGTH_SHORT
                    ).show());
                }
            }).start();
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            runOnUiThread(() -> {
                try {
                    Intent share = new Intent(Intent.ACTION_SEND);
                    share.setType("text/plain");
                    share.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                    startActivity(Intent.createChooser(
                            share,
                            (title == null || title.isEmpty()) ? "Share" : title
                    ));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Share options could not open", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == INSTALL_PERMISSION_REQ) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                    getPackageManager().canRequestPackageInstalls()) {
                if (pendingUpdateFile != null) openUpdateInstaller(pendingUpdateFile);
            } else {
                Toast.makeText(this, "Install permission is required for app updates", Toast.LENGTH_LONG).show();
            }
            return;
        }

        if (requestCode != FILE_REQ || fileCallback == null) return;

        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            boolean hasPickerData = data != null &&
                    (data.getData() != null || data.getClipData() != null);
            if (!hasPickerData && cameraUri != null) {
                result = new Uri[]{cameraUri};
            } else {
                result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            }
        }

        fileCallback.onReceiveValue(result);
        fileCallback = null;
        cameraUri = null;
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (waitingForInstallPermission && pendingUpdateFile != null &&
                (Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                        getPackageManager().canRequestPackageInstalls())) {
            waitingForInstallPermission = false;
            openUpdateInstaller(pendingUpdateFile);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQ && pendingWebPermission != null) {
            PermissionRequest request = pendingWebPermission;
            pendingWebPermission = null;
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                request.deny();
                Toast.makeText(this, "Camera permission is required", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        web.saveState(outState);
        super.onSaveInstanceState(outState);
    }
}
