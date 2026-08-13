# Chrome 창을 앞으로 끌어낸 뒤 화면 전체를 뜬다.
#
# ⚠️ 확장 프로그램 캡처는 페이지 영역만 나온다. YouTube 감사 증빙은
#    **주소 표시줄이 보여야 한다** (CLAUDE.md 품질 표준).
param(
  [Parameter(Mandatory=$true)][string]$Out,
  # Ctrl+<n> 으로 탭을 고른다. 확장은 탭을 활성화하지 않아서,
  # 그냥 찍으면 엉뚱한 탭이 찍힌다.
  [int]$TabIndex = 0,
  [int]$SettleMs = 1200,
  [switch]$DismissInfobar = $true
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not ("Win32Fg" -as [type])) {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Fg {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
}

$chrome = Get-Process chrome -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Sort-Object -Property WorkingSet64 -Descending |
  Select-Object -First 1

if (-not $chrome) { throw "Chrome window not found" }

[void][Win32Fg]::ShowWindow($chrome.MainWindowHandle, 3)   # SW_MAXIMIZE
[void][Win32Fg]::SetForegroundWindow($chrome.MainWindowHandle)
Start-Sleep -Milliseconds 400

if ($TabIndex -gt 0) {
  [System.Windows.Forms.SendKeys]::SendWait("^$TabIndex")
}
Start-Sleep -Milliseconds 400

# 크롬 인포바("'Claude'에서 이 브라우저에 대한 디버깅을 시작함")를 닫는다.
# 새로고침마다 다시 뜨므로 **캡처 직전에** 매번 닫아야 한다.
# 인포바는 페이지 밖이라 확장 프로그램으로는 못 닫는다.
if ($DismissInfobar) {
  if (-not ("Win32Mouse2" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Mouse2 {
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, int extra);
}
"@
  }
  $keep = [System.Windows.Forms.Cursor]::Position
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(1889, 115)
  Start-Sleep -Milliseconds 150
  [Win32Mouse2]::mouse_event(0x0002, 0, 0, 0, 0)
  [Win32Mouse2]::mouse_event(0x0004, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 300
  # 커서가 화면 한복판에 남아 캡처에 찍히지 않게 구석으로 치운다
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(1900, 1000)
}

Start-Sleep -Milliseconds $SettleMs

$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "saved $Out"
