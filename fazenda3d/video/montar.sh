set -e
cd "$(dirname "$0")"
: > ordem.txt
for s in abertura inicio mapa os agenda maquinas campo solo pragas irrigacao colheita regioes final valor; do echo "file 'clips/$s.mp4'" >> ordem.txt; done
ffmpeg -y -loglevel error -f concat -safe 0 -i ordem.txt -f lavfi -i anullsrc=r=48000:cl=stereo -shortest \
  -vf "fade=t=in:st=0:d=0.6,format=yuv420p" -c:v libx264 -preset slow -crf 19 -r 30 -c:a aac -b:a 96k -movflags +faststart NexoCafe3D-apresentacao-1080p.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 NexoCafe3D-apresentacao-1080p.mp4)
ffmpeg -y -loglevel error -i NexoCafe3D-apresentacao-1080p.mp4 -vf "scale=1280:720:flags=lanczos" -c:v libx264 -preset slow -crf 24 -c:a aac -b:a 64k -movflags +faststart NexoCafe3D-apresentacao-720p.mp4
ls -la NexoCafe3D-apresentacao-*.mp4; echo "duracao $D"
