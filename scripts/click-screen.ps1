# 화면 좌표를 OS 레벨로 클릭한다.
#
# 확장 프로그램은 **페이지 안**만 클릭할 수 있다. 크롬 인포바("디버깅을 시작함")
# 같은 브라우저 UI 는 페이지 밖이라 거기서는 못 닫는다. 증빙 캡처에 남으면 안 된다.
param(
  [Parameter(Mandatory=$true)][int]$X,
  [Parameter(Mandatory=$true)][int]$Y
)

Add-Type -AssemblyName System.Windows.Forms

if (-not ("Win32Mouse" -as [type])) {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Mouse {
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, int extra);
  public const uint LEFTDOWN = 0x0002, LEFTUP = 0x0004;
}
"@
}

[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
Start-Sleep -Milliseconds 200
[Win32Mouse]::mouse_event([Win32Mouse]::LEFTDOWN, 0, 0, 0, 0)
[Win32Mouse]::mouse_event([Win32Mouse]::LEFTUP, 0, 0, 0, 0)
Start-Sleep -Milliseconds 300
Write-Output "clicked $X,$Y"
