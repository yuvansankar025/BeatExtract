#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

# Download and install ffmpeg static binary for Render
echo "Downloading ffmpeg..."
wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar xf ffmpeg-release-amd64-static.tar.xz
mkdir -p bin
mv ffmpeg-*-static/ffmpeg bin/
mv ffmpeg-*-static/ffprobe bin/
rm -rf ffmpeg-*-static*
echo "ffmpeg installed locally."

# Pre-download Demucs model to the local project directory
export TORCH_HOME=$(pwd)/.torch
echo "Downloading demucs model..."
python -c "import demucs.pretrained; demucs.pretrained.get_model('htdemucs')"
echo "Demucs model downloaded."
