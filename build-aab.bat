@echo off
echo ===================================================
echo   Building Signed Release AAB for SideQuestHQ
echo ===================================================

set JAVA_HOME=C:\Program Files\Android\openjdk\jdk-21.0.8
set ANDROID_HOME=C:\Users\TLSB\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%

set ANDROID_KEYSTORE_PATH=C:\Users\TLSB\Documents\sidequesthq-site\@agrim00001__sidequesthq.jks
set ANDROID_KEYSTORE_PASSWORD=82c52830f23ab52f7c26da65b1657c7a
set ANDROID_KEY_ALIAS=e40eaff8ca357c2e3840b87daef59a66
set ANDROID_KEY_PASSWORD=3076dab932eaeedd12c4ab3cd406b110

call npm run mobile:build
call npx cap sync android

cd android
call gradlew.bat bundleRelease
cd ..

echo.
echo ===================================================
echo   BUILD COMPLETE! Signed AAB is available at:
echo   android\app\build\outputs\bundle\release\app-release.aab
echo ===================================================
pause
