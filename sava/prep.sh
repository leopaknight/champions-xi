#!/bin/sh
# Prep por clipe: estabiliza (vidstab 2 passes), reduz ruído, sobe p/ 1080x1920, nitidez e grade.
set -e
mkdir -p build/prep
GRADE="eq=contrast=1.10:brightness=-0.015:saturation=1.04:gamma=0.97,curves=all='0/0.02 0.25/0.21 0.5/0.5 0.75/0.79 1/0.98',colorbalance=bs=0.03:bm=0.01:rh=0.01,vignette=angle=0.45"
for f in src/c*.m*; do
  n=$(basename "$f"); n=${n%.*}
  ffmpeg -hide_banner -loglevel error -y -i "$f" -vf "fps=30,vidstabdetect=shakiness=6:accuracy=12:result=build/prep/$n.trf" -f null -
  ffmpeg -hide_banner -loglevel error -y -i "$f" -an -vf "fps=30,vidstabtransform=input=build/prep/$n.trf:smoothing=8:optzoom=0:zoom=5:maxshift=24:maxangle=0.02:crop=keep:interpol=bicubic,hqdn3d=2:1.5:4:3,scale=1080:1920:flags=lanczos,cas=0.45,$GRADE" \
    -c:v libx264 -preset medium -crf 12 -pix_fmt yuv420p build/prep/$n.mp4
  echo "prep $n"
done
