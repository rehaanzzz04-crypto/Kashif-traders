param([string]$PrinterName='BlackCopper 80mm Series(1)')
$ErrorActionPreference='Stop'
Get-Printer -Name $PrinterName -ErrorAction Stop | Out-Null
$input64=[Console]::In.ReadToEnd().Trim()
if ($input64.Length -gt 200000) {throw 'Too much data'}
$bytes=[Convert]::FromBase64String($input64)
if ($bytes.Length -lt 10 -or $bytes.Length -gt 100000) {throw 'RAW size invalid'}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class RawPrinter {
[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct DOCINFO { [MarshalAs(UnmanagedType.LPWStr)]public string pDocName;[MarshalAs(UnmanagedType.LPWStr)]public string pOutputFile;[MarshalAs(UnmanagedType.LPWStr)]public string pDatatype; }
[DllImport("winspool.drv",EntryPoint="OpenPrinterW",SetLastError=true,CharSet=CharSet.Unicode)]public static extern bool OpenPrinter(string n,out IntPtr h,IntPtr d);
[DllImport("winspool.drv",SetLastError=true)]public static extern bool ClosePrinter(IntPtr h);
[DllImport("winspool.drv",EntryPoint="StartDocPrinterW",SetLastError=true,CharSet=CharSet.Unicode)]public static extern int StartDocPrinter(IntPtr h,int level,ref DOCINFO info);
[DllImport("winspool.drv",SetLastError=true)]public static extern bool EndDocPrinter(IntPtr h);
[DllImport("winspool.drv",SetLastError=true)]public static extern bool StartPagePrinter(IntPtr h);
[DllImport("winspool.drv",SetLastError=true)]public static extern bool EndPagePrinter(IntPtr h);
[DllImport("winspool.drv",SetLastError=true)]public static extern bool WritePrinter(IntPtr h,byte[] b,int n,out int written);
}
'@
$handle=[IntPtr]::Zero
if(-not [RawPrinter]::OpenPrinter($PrinterName,[ref]$handle,[IntPtr]::Zero)){throw 'Cannot open RAW printer'}
$started=$false;$page=$false
try{
 $doc=New-Object RawPrinter+DOCINFO
 $doc.pDocName='Kashif Traders Receipt';$doc.pDatatype='RAW'
 if([RawPrinter]::StartDocPrinter($handle,1,[ref]$doc) -le 0){throw 'StartDoc failed'};$started=$true
 if(-not [RawPrinter]::StartPagePrinter($handle)){throw 'StartPage failed'};$page=$true
 $written=0
 if(-not [RawPrinter]::WritePrinter($handle,$bytes,$bytes.Length,[ref]$written) -or $written -ne $bytes.Length){throw 'WritePrinter failed'}
 [void][RawPrinter]::EndPagePrinter($handle);$page=$false
 [void][RawPrinter]::EndDocPrinter($handle);$started=$false
 Write-Output ('Written bytes: '+$written)
} finally {
 if($page){[void][RawPrinter]::EndPagePrinter($handle)}
 if($started){[void][RawPrinter]::EndDocPrinter($handle)}
 if($handle -ne [IntPtr]::Zero){[void][RawPrinter]::ClosePrinter($handle)}
}
