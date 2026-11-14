#!/bin/zsh
# Usage: ./build.sh [build|test] — builds or tests on the booted iPhone simulator.
set -e
cd "$(dirname "$0")"
ACTION=${1:-build}
SIM_ID=$(xcrun simctl list devices booted | grep -v Clone | grep -m1 -oE 'iPhone[^(]*\(([0-9A-F-]{36})\)' | grep -oE '[0-9A-F-]{36}')
DEST=${SYNCD_DESTINATION:-"platform=iOS Simulator,id=${SIM_ID},arch=arm64"}
xcodebuild -project SyncD.xcodeproj -scheme SyncD -destination "$DEST" \
  -clonedSourcePackagesDirPath build/SourcePackages -derivedDataPath build/DerivedData -parallel-testing-enabled NO \
  "$ACTION" 2>&1 | grep -E "error:|warning: .*SyncD/|\*\* (BUILD|TEST)|Test (Suite|Case).*(passed|failed)|✘|✔︎? Test|failed|passed after" | grep -v "^ld: warning" | head -${LINES_MAX:-80}
