#!/bin/bash
set -e

echo "=== 1. CLEANING OLD ASSETS ==="
rm -rf dist build chaty

echo "=== 2. LOCATING SWIFT FILES ==="
SWIFT_FILES=$(find Sources -name "*.swift")
echo "Files found for compilation:"
echo "$SWIFT_FILES"

echo "=== 3. COMPILING SWIFT BINARY ==="
SDK_PATH=$(xcrun --show-sdk-path)
# Compile all swift files recursively and link sqlite3 library
swiftc -O -parse-as-library -sdk "$SDK_PATH" -lsqlite3 -o chaty $SWIFT_FILES

echo "=== 4. CONSTRUCTING BUNDLE PATHS ==="
mkdir -p dist/ChatY.app/Contents/MacOS
mkdir -p dist/ChatY.app/Contents/Resources

echo "=== 5. PACKAGING BINARY & RESOURCES ==="
mv chaty dist/ChatY.app/Contents/MacOS/ChatY
if [ -f frontend/public/icon.png ]; then
    cp frontend/public/icon.png dist/ChatY.app/Contents/Resources/icon.png
    
    echo "--- Generating native macOS icon.icns ---"
    mkdir -p chaty.iconset
    sips -s format png -z 16 16     frontend/public/icon.png --out chaty.iconset/icon_16x16.png > /dev/null 2>&1
    sips -s format png -z 32 32     frontend/public/icon.png --out chaty.iconset/icon_16x16@2x.png > /dev/null 2>&1
    sips -s format png -z 32 32     frontend/public/icon.png --out chaty.iconset/icon_32x32.png > /dev/null 2>&1
    sips -s format png -z 64 64     frontend/public/icon.png --out chaty.iconset/icon_32x32@2x.png > /dev/null 2>&1
    sips -s format png -z 128 128   frontend/public/icon.png --out chaty.iconset/icon_128x128.png > /dev/null 2>&1
    sips -s format png -z 256 256   frontend/public/icon.png --out chaty.iconset/icon_128x128@2x.png > /dev/null 2>&1
    sips -s format png -z 256 256   frontend/public/icon.png --out chaty.iconset/icon_256x256.png > /dev/null 2>&1
    sips -s format png -z 512 512   frontend/public/icon.png --out chaty.iconset/icon_256x256@2x.png > /dev/null 2>&1
    sips -s format png -z 512 512   frontend/public/icon.png --out chaty.iconset/icon_512x512.png > /dev/null 2>&1
    sips -s format png -z 1024 1024 frontend/public/icon.png --out chaty.iconset/icon_512x512@2x.png > /dev/null 2>&1
    
    iconutil -c icns chaty.iconset -o dist/ChatY.app/Contents/Resources/icon.icns
    rm -rf chaty.iconset
fi

echo "=== 6. WRITING PLIST CONFIGURATION ==="
cat <<EOT > dist/ChatY.app/Contents/Info.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>ChatY</string>
    <key>CFBundleIdentifier</key>
    <string>com.charan.chaty.app</string>
    <key>CFBundleName</key>
    <string>ChatY</string>
    <key>CFBundleDisplayName</key>
    <string>ChatY</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSMicrophoneUsageDescription</key>
    <string>ChatY uses the mic for voice commands</string>
</dict>
</plist>
EOT

echo "=== BUILD SUCCESSFUL: dist/ChatY.app created ==="
