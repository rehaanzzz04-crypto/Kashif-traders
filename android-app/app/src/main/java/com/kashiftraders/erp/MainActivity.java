package com.kashiftraders.erp;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String HOME="https://kashif-traders.vercel.app/";
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private static final int FILE_REQ=101;

    @Override public void onCreate(Bundle savedInstanceState){super.onCreate(savedInstanceState);setContentView(R.layout.activity_main);web=findViewById(R.id.web);
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);s.setAllowFileAccess(true);s.setMediaPlaybackRequiresUserGesture(false);s.setCacheMode(WebSettings.LOAD_DEFAULT);
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
        web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r){Uri u=r.getUrl();String h=u.getHost();if(h!=null&&(h.equals("kashif-traders.vercel.app")||h.endsWith(".vercel.app")))return false;try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}return true;}});
        web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView w,ValueCallback<Uri[]> cb,FileChooserParams p){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=cb;Intent pick=p.createIntent();Intent camera=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);Intent chooser=Intent.createChooser(pick,"Select document");chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS,new Intent[]{camera});try{startActivityForResult(chooser,FILE_REQ);}catch(ActivityNotFoundException e){fileCallback=null;return false;}return true;}});
        web.setDownloadListener((url,userAgent,contentDisposition,mimetype,contentLength)->{try{DownloadManager.Request r=new DownloadManager.Request(Uri.parse(url));String name=URLUtil.guessFileName(url,contentDisposition,mimetype);r.setTitle(name);r.setMimeType(mimetype);r.addRequestHeader("Cookie",CookieManager.getInstance().getCookie(url));r.addRequestHeader("User-Agent",userAgent);r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,name);((DownloadManager)getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(r);Toast.makeText(this,"Download started",Toast.LENGTH_SHORT).show();}catch(Exception e){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception ignored){}}});
        if(savedInstanceState==null)web.loadUrl(HOME);else web.restoreState(savedInstanceState);
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode==FILE_REQ&&fileCallback!=null){Uri[] result=WebChromeClient.FileChooserParams.parseResult(resultCode,data);fileCallback.onReceiveValue(result);fileCallback=null;}}
    @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onSaveInstanceState(Bundle out){web.saveState(out);super.onSaveInstanceState(out);}
}
